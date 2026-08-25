// src/screens/Settings.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  useGetNotificationPreferencesQuery,
  useUpdateEmailNotificationsMutation,
  useUpdatePushNotificationsMutation,
} from '../slices/notificationApiSlice';
import { usePushNotificationContext } from '../contexts/PushNotificationContext';
import {
  FaArrowLeft,
  FaBell,
  FaEnvelope,
  FaMobileAlt,
  FaSpinner,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaSun,
  FaMoon,
  FaDesktop,
  FaSync,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

// ─── Custom hook – centralises all settings logic ──────────────────────

const useNotificationSettings = () => {
  const { userInfo } = useSelector((state) => state.auth);

  const [emailPrefs, setEmailPrefs] = useState({});
  const [pushPrefs, setPushPrefs] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Fetch preferences from server
  const {
    data: prefData,
    isLoading: prefsLoading,
    isError: prefsError,
    refetch,
  } = useGetNotificationPreferencesQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const [updateEmail] = useUpdateEmailNotificationsMutation();
  const [updatePush] = useUpdatePushNotificationsMutation();

  const push = usePushNotificationContext();
  const {
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    isSupported,
    isNative,
    vapidKeyError,
    retryLoadVapidKey,
  } = push;

  // Prevent auto-subscribe from running multiple times
  const autoSubscribeAttempted = useRef(false);

  // Sync local state with server data
  useEffect(() => {
    if (prefData?.data) {
      const email = prefData.data.email || {};
      const push = prefData.data.push || {};
      setEmailPrefs(email);
      setPushPrefs(push);
    }
  }, [prefData]);

  // Auto-subscribe if needed (only once)
  useEffect(() => {
    const autoSubscribe = async () => {
      if (autoSubscribeAttempted.current) return;
      if (!isNative && isSupported && permission === 'granted' && !isSubscribed) {
        // Only if the server says push is enabled
        if (pushPrefs.enabled) {
          console.log('🔄 Auto-subscribing to push...');
          autoSubscribeAttempted.current = true;
          await subscribe();
        }
      }
    };
    autoSubscribe();
  }, [isNative, isSupported, permission, isSubscribed, pushPrefs.enabled, subscribe]);

  // ─── Self-heal: if this browser IS subscribed (real token in
  // localStorage, verified on mount) but the server still thinks push
  // is disabled — e.g. a previous updatePush() call was lost, or the
  // register call landed but the preference PUT didn't — quietly patch
  // the server so future reloads/devices/admin views agree with reality.
  // Runs once per mismatch, not on every render.
  const selfHealAttempted = useRef(false);
  useEffect(() => {
    if (isNative) return;
    if (selfHealAttempted.current) return;
    if (isSubscribed && pushPrefs && pushPrefs.enabled === false) {
      selfHealAttempted.current = true;
      updatePush({ ...pushPrefs, enabled: true })
        .unwrap()
        .then(() => refetch())
        .catch((err) => console.warn('Push pref self-heal failed:', err));
    }
  }, [isNative, isSubscribed, pushPrefs, updatePush, refetch]);

  const handleEmailToggle = async (key) => {
    const newPrefs = { ...emailPrefs, [key]: !emailPrefs[key] };
    setEmailPrefs(newPrefs);
    try {
      await updateEmail(newPrefs).unwrap();
      setSuccess('Email preference updated');
      setTimeout(() => setSuccess(''), 3000);
      refetch();
    } catch (err) {
      setError(err?.data?.message || 'Failed to update email preferences');
      setTimeout(() => setError(''), 4000);
      setEmailPrefs(emailPrefs);
    }
  };

  const handlePushSubToggle = async (key) => {
    const newPrefs = { ...pushPrefs, [key]: !pushPrefs[key] };
    setPushPrefs(newPrefs);
    try {
      await updatePush(newPrefs).unwrap();
      setSuccess('Push preference updated');
      setTimeout(() => setSuccess(''), 3000);
      refetch();
    } catch (err) {
      setError(err?.data?.message || 'Failed to update push preferences');
      setTimeout(() => setError(''), 4000);
      setPushPrefs(pushPrefs);
    }
  };

  const handlePushMasterToggle = async (currentlyEnabled) => {
    if (actionLoading) return;
    setActionLoading(true);

    try {
      if (currentlyEnabled) {
        // Disable
        const success = await unsubscribe();
        if (success) {
          const newPrefs = { ...pushPrefs, enabled: false };
          setPushPrefs(newPrefs);
          await updatePush(newPrefs).unwrap();
          setSuccess('Push notifications disabled');
          setTimeout(() => setSuccess(''), 3000);
          refetch();
        } else {
          setError('Failed to disable push');
          setTimeout(() => setError(''), 4000);
        }
      } else {
        // Enable
        const success = await subscribe();
        if (success) {
          const newPrefs = { ...pushPrefs, enabled: true };
          setPushPrefs(newPrefs);
          await updatePush(newPrefs).unwrap();
          setSuccess('Push notifications enabled');
          setTimeout(() => setSuccess(''), 3000);
          refetch();
        } else {
          if (permission === 'denied') {
            setError('Notifications blocked. Enable them in browser settings.');
          } else if (!isSupported) {
            setError('Push notifications are not supported in this browser.');
          } else {
            setError('Failed to enable push. Please try again.');
          }
          setTimeout(() => setError(''), 4000);
        }
      }
    } catch (err) {
      console.error('Push toggle error:', err);
      setError(err?.message || 'An error occurred');
      setTimeout(() => setError(''), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── THE FIX: pushEnabled now trusts the LOCAL browser subscription
  // state (isSubscribed, derived from localStorage token + actual
  // Notification.permission on mount) over the server preference.
  // `isSubscribed` becomes true almost immediately on reload — well
  // before the GET /preferences round trip resolves — so this is what
  // was causing the toggle to render "off" after reload even though
  // this browser was genuinely registered: it was ignoring the one
  // signal that actually reflects reality, and only trusting the server
  // flag, which could lag or fall out of sync. ───────────────────────
  const pushEnabled = useMemo(() => {
    // For mobile, just use server preference (mobile handles subscription internally)
    if (isNative) {
      return pushPrefs.enabled;
    }
    // For web:
    // If permission is denied, push cannot work => force off
    if (permission === 'denied') return false;
    // If VAPID key is missing, push cannot work => force off
    if (vapidKeyError) return false;
    // Trust the real local subscription first; fall back to the server
    // flag only when we don't have a local subscription yet (e.g. very
    // first load before the mount effect has resolved).
    return isSubscribed || pushPrefs.enabled;
  }, [pushPrefs.enabled, permission, vapidKeyError, isNative, isSubscribed]);

  // Push is available if supported and permission granted (and no VAPID error)
  const pushAvailable = useMemo(() => {
    if (isNative) return true;
    return isSupported && permission === 'granted' && !vapidKeyError;
  }, [isNative, isSupported, permission, vapidKeyError]);

  return {
    emailPrefs,
    pushPrefs,
    actionLoading,
    success,
    error,
    isNative,
    permission,
    isSupported,
    pushEnabled,
    pushAvailable,
    isLoading: prefsLoading,
    isError: prefsError,
    vapidKeyError,
    retryLoadVapidKey,
    refetch,
    handleEmailToggle,
    handlePushSubToggle,
    handlePushMasterToggle,
  };
};

// ─── Toggle Switch Component ──────────────────────────────────────────

const ToggleSwitch = ({ enabled, onChange, disabled = false, loading = false }) => (
  <button
    onClick={onChange}
    disabled={disabled || loading}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
      enabled ? 'bg-teal-500 dark:bg-[#0d9488]' : 'bg-gray-300 dark:bg-gray-700'
    } ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
        enabled ? 'translate-x-4.5' : 'translate-x-0.5'
      }`}
    />
  </button>
);

// ─── Theme Toggle Component ──────────────────────────────────────────

const ThemeToggleCard = () => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <FaSun className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />;
      case 'dark':
        return <FaMoon className="w-4 h-4 text-purple-500 dark:text-purple-400" />;
      default:
        return <FaDesktop className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      default:
        return 'System';
    }
  };

  return (
    <div className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden transition-colors duration-300">
      <div className="px-4 py-2.5 bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-200/60 dark:border-gray-800/40">
        <div className="flex items-center space-x-2">
          <FaSun className="w-4 h-4 text-teal-600 dark:text-[#0d9488]" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Appearance</h2>
        </div>
      </div>
      <div className="p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800/40 flex-shrink-0">
            {getThemeIcon()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">Theme</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
              {getThemeLabel()}
              {theme === 'system' && (
                <span className="text-gray-500 dark:text-gray-500 ml-1">
                  ({isDarkMode ? 'Dark' : 'Light'})
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 dark:bg-[#0d9488] rounded-lg hover:bg-teal-700 dark:hover:opacity-80 transition whitespace-nowrap"
        >
          Switch to {theme === 'light' ? 'Dark' : theme === 'dark' ? 'System' : 'Light'}
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────

const Settings = () => {
  const state = useNotificationSettings();
  const navigate = useNavigate();

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0b0b10] transition-colors duration-300">
        <div className="text-center">
          <FaSpinner className="w-10 h-10 text-teal-600 dark:text-[#0d9488] animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (state.isError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#0b0b10] transition-colors duration-300">
        <div className="text-center">
          <FaExclamationTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Could not load preferences. Pull down to retry.</p>
          <button
            onClick={() => state.refetch()}
            className="mt-3 px-4 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-lg text-sm hover:bg-teal-700 dark:hover:opacity-80 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    emailPrefs,
    pushPrefs,
    actionLoading,
    success,
    error,
    isNative,
    permission,
    isSupported,
    pushEnabled,
    pushAvailable,
    vapidKeyError,
    retryLoadVapidKey,
    handleEmailToggle,
    handlePushSubToggle,
    handlePushMasterToggle,
  } = state;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] transition-colors duration-300 pb-20 md:pb-6">
      {/* Header for mobile */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 px-4 h-14 flex items-center gap-3 md:hidden">
        <button onClick={() => navigate(-1)} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
          <FaArrowLeft />
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Settings</h1>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 md:py-6">
        {/* Notification Settings heading (desktop) */}
        <div className="hidden md:flex items-center space-x-2 mb-6">
          <div className="p-1.5 bg-teal-100 dark:bg-[#0d9488]/20 rounded-lg">
            <FaBell className="w-5 h-5 text-teal-600 dark:text-[#0d9488]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Notification Settings</h1>
            <p className="text-xs text-gray-500 dark:text-gray-500">Manage your notification preferences</p>
          </div>
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/40 rounded-lg flex items-center space-x-2">
            <FaExclamationTriangle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/40 rounded-lg flex items-center space-x-2">
            <FaCheckCircle className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-600 dark:text-green-300">{success}</p>
          </div>
        )}

        {/* VAPID key error warning */}
        {vapidKeyError && !isNative && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700/40 rounded-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FaExclamationTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Push notifications are unavailable: VAPID key not loaded.
              </p>
            </div>
            <button
              onClick={retryLoadVapidKey}
              className="text-xs text-yellow-700 dark:text-yellow-300 hover:underline flex items-center gap-1 flex-shrink-0"
            >
              <FaSync className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        <div className="space-y-4 md:space-y-6">
          <ThemeToggleCard />

          {/* Email Notifications */}
          <div className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden transition-colors duration-300">
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-200/60 dark:border-gray-800/40">
              <div className="flex items-center space-x-2">
                <FaEnvelope className="w-4 h-4 text-teal-600 dark:text-[#0d9488]" />
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Email Notifications</h2>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
              {Object.keys(emailPrefs).length === 0 ? (
                <p className="p-4 text-sm text-gray-500 dark:text-gray-500">No email preferences configured.</p>
              ) : (
                Object.entries(emailPrefs).map(([key, value]) => (
                  <div key={key} className="p-4 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize truncate">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                        Email when {key.replace(/([A-Z])/g, ' $1').toLowerCase()} occurs
                      </p>
                    </div>
                    <ToggleSwitch
                      enabled={value}
                      onChange={() => handleEmailToggle(key)}
                      disabled={actionLoading}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Push Notifications */}
          <div className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden transition-colors duration-300">
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-200/60 dark:border-gray-800/40">
              <div className="flex items-center space-x-2">
                {isNative ? (
                  <FaMobileAlt className="w-4 h-4 text-teal-600 dark:text-[#0d9488]" />
                ) : (
                  <FaBell className="w-4 h-4 text-teal-600 dark:text-[#0d9488]" />
                )}
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {isNative ? 'Mobile Push' : 'Web Push'}
                </h2>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
              {isNative ? (
                <div className="p-4 flex items-center gap-3">
                  <FaCheckCircle className="text-green-500 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Push notifications are automatically enabled on this device.
                  </p>
                </div>
              ) : (
                <div className="p-4 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable push</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                      {permission === 'denied'
                        ? 'Notifications are blocked in browser settings.'
                        : vapidKeyError
                        ? 'Push not available (VAPID key missing).'
                        : isSupported
                        ? 'Receive push notifications in this browser'
                        : 'Push is not supported in this browser'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {permission === 'denied' ? (
                      <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                        <FaTimesCircle /> Blocked
                      </span>
                    ) : (
                      <ToggleSwitch
                        enabled={pushEnabled}
                        onChange={() => handlePushMasterToggle(pushEnabled)}
                        disabled={!pushAvailable || actionLoading}
                        loading={actionLoading}
                      />
                    )}
                  </div>
                </div>
              )}

              {pushEnabled && Object.keys(pushPrefs).length > 1 && (
                <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
                  {Object.entries(pushPrefs).map(([key, value]) => {
                    if (key === 'enabled') return null;
                    return (
                      <div key={key} className="p-4 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize truncate">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                            Push when {key.replace(/([A-Z])/g, ' $1').toLowerCase()} occurs
                          </p>
                        </div>
                        <ToggleSwitch
                          enabled={value}
                          onChange={() => handlePushSubToggle(key)}
                          disabled={!pushEnabled || actionLoading}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;