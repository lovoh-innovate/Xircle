// src/screens/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Capacitor } from '@capacitor/core';
import {
  useGetNotificationPreferencesQuery,
  useUpdateEmailNotificationsMutation,
  useUpdatePushNotificationsMutation,
  useSendTestPushMutation,
  useSendTestEmailMutation,
} from '../slices/notificationApiSlice';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useMobilePushNotifications } from '../hooks/useMobilePushNotifications';
import {
  FaArrowLeft,
  FaBell,
  FaEnvelope,
  FaMobileAlt,
  FaSpinner,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaSync,
  FaInfoCircle,
  FaSun,
  FaMoon,
  FaDesktop,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

// ─── Custom hook – centralises all settings logic ──────────────────────

const useNotificationSettings = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const isNative = Capacitor.isNativePlatform();

  // Local state
  const [emailPrefs, setEmailPrefs] = useState({});
  const [pushPrefs, setPushPrefs] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // API hooks
  const { data: prefData, isLoading: prefsLoading, isError: prefsError, refetch } =
    useGetNotificationPreferencesQuery();
  const [updateEmail] = useUpdateEmailNotificationsMutation();
  const [updatePush] = useUpdatePushNotificationsMutation();
  const [sendTestPush] = useSendTestPushMutation();
  const [sendTestEmail] = useSendTestEmailMutation();

  // Push hooks – choose based on platform
  const webPush = usePushNotifications();
  const mobilePush = useMobilePushNotifications();
  const push = isNative ? mobilePush : webPush;
  const { isSubscribed, permission, subscribe, unsubscribe, isSupported, subscription, fcmToken } = push;

  // Load preferences from API
  useEffect(() => {
    if (prefData?.data) {
      setEmailPrefs(prefData.data.email || {});
      setPushPrefs(prefData.data.push || {});
    }
  }, [prefData]);

  // Check service worker status (web only)
  useEffect(() => {
    if (isNative || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(() => setSwReady(true)).catch(() => setSwReady(false));
  }, [isNative]);

  // Log subscription changes
  useEffect(() => {
    if (!isNative && subscription) {
      console.log('🔔 Web subscription endpoint:', subscription.endpoint);
    }
    if (isNative && fcmToken) {
      console.log('📱 FCM Token:', fcmToken);
    }
  }, [isNative, subscription, fcmToken]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleEmailToggle = async (key) => {
    const newPrefs = { ...emailPrefs, [key]: !emailPrefs[key] };
    setEmailPrefs(newPrefs);
    try {
      await updateEmail(newPrefs).unwrap();
      setSuccess('Email preference updated');
      setTimeout(() => setSuccess(''), 3000);
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
        const success = await unsubscribe();
        if (success) {
          const newPrefs = { ...pushPrefs, enabled: false };
          setPushPrefs(newPrefs);
          await updatePush(newPrefs).unwrap();
          setSuccess('Push notifications disabled');
          setTimeout(() => setSuccess(''), 3000);
        } else {
          setError('Failed to disable push');
          setTimeout(() => setError(''), 4000);
        }
      } else {
        const success = await subscribe();
        if (success) {
          const newPrefs = { ...pushPrefs, enabled: true };
          setPushPrefs(newPrefs);
          await updatePush(newPrefs).unwrap();
          setSuccess('Push notifications enabled');
          setTimeout(() => setSuccess(''), 3000);
        } else {
          if (permission === 'denied') {
            setError('Notifications blocked. Enable them in browser settings.');
          } else {
            setError('Failed to enable push');
          }
          setTimeout(() => setError(''), 4000);
        }
      }
    } catch (err) {
      setError(err?.data?.message || 'An error occurred');
      setTimeout(() => setError(''), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReRegister = async () => {
    if (actionLoading || isNative) return;
    setActionLoading(true);
    try {
      await unsubscribe();
      const success = await subscribe();
      if (success) {
        const newPrefs = { ...pushPrefs, enabled: true };
        setPushPrefs(newPrefs);
        await updatePush(newPrefs).unwrap();
        setSuccess('Push subscription refreshed');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to re-register push');
        setTimeout(() => setError(''), 4000);
      }
    } catch (err) {
      setError(err?.data?.message || 'Re-registration failed');
      setTimeout(() => setError(''), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestPush = async () => {
    if (!isSubscribed || permission !== 'granted') {
      toast.warning('Push is not active');
      return;
    }
    try {
      await sendTestPush().unwrap();
      toast.success('Test push notification sent');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send test push');
      console.error('Test push error:', err);
    }
  };

  const handleTestEmail = async () => {
    try {
      await sendTestEmail().unwrap();
      toast.success('Test email sent');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send test email');
    }
  };

  const pushEnabled = pushPrefs.enabled && isSubscribed && permission === 'granted';
  const pushAvailable = isSupported && isSubscribed && permission === 'granted';

  return {
    // State
    emailPrefs,
    pushPrefs,
    actionLoading,
    swReady,
    success,
    error,
    isNative,
    push,
    isSubscribed,
    permission,
    isSupported,
    subscription,
    fcmToken,
    pushEnabled,
    pushAvailable,
    isLoading: prefsLoading,
    isError: prefsError,
    refetch,

    // Handlers
    handleEmailToggle,
    handlePushSubToggle,
    handlePushMasterToggle,
    handleReRegister,
    handleTestPush,
    handleTestEmail,
  };
};

// ─── Toggle Switch Component ─────────────────────────────────────────────

const ToggleSwitch = ({ enabled, onChange, disabled = false, loading = false }) => (
  <button
    onClick={onChange}
    disabled={disabled || loading}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      enabled ? 'bg-teal-500 dark:bg-[#0d9488]' : 'bg-gray-300 dark:bg-gray-700'
    } ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        enabled ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

// ─── Theme Toggle Component ─────────────────────────────────────────────

const ThemeToggleCard = () => {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <FaSun className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />;
      case 'dark':
        return <FaMoon className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
      default:
        return <FaDesktop className="w-5 h-5 text-blue-500 dark:text-blue-400" />;
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
      <div className="px-5 py-3 bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-200/60 dark:border-gray-800/40">
        <div className="flex items-center space-x-2">
          <FaSun className="w-4 h-4 text-teal-600 dark:text-[#0d9488]" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Appearance</h2>
        </div>
      </div>
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800/40">
            {getThemeIcon()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Current: <span className="text-gray-800 dark:text-gray-300 font-medium">{getThemeLabel()}</span>
              {theme === 'system' && (
                <span className="text-gray-500 dark:text-gray-500 ml-1">
                  ({isDarkMode ? 'Dark' : 'Light'} mode)
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="px-4 py-2 text-sm font-medium text-white bg-teal-600 dark:bg-[#0d9488] rounded-lg hover:bg-teal-700 dark:hover:opacity-80 transition"
        >
          Switch to {theme === 'light' ? 'Dark' : theme === 'dark' ? 'System' : 'Light'}
        </button>
      </div>
    </div>
  );
};

// ─── Desktop View ──────────────────────────────────────────────────────

const DesktopNotificationSettings = ({ state }) => {
  const {
    emailPrefs,
    pushPrefs,
    actionLoading,
    swReady,
    success,
    error,
    isNative,
    push,
    isSubscribed,
    permission,
    isSupported,
    subscription,
    fcmToken,
    pushEnabled,
    pushAvailable,
    handleEmailToggle,
    handlePushSubToggle,
    handlePushMasterToggle,
    handleReRegister,
    handleTestPush,
    handleTestEmail,
  } = state;

  return (
    <div className="hidden md:block min-h-screen bg-gray-50 dark:bg-[#0b0b10] transition-colors duration-300">
      <div className="px-6 py-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-teal-100 dark:bg-[#0d9488]/20 rounded-lg">
                <FaBell className="w-5 h-5 text-teal-600 dark:text-[#0d9488]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Notification Settings</h1>
                <p className="text-xs text-gray-500 dark:text-gray-500">Manage your notification preferences</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/40 rounded-lg flex items-center space-x-2">
              <FaExclamationTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/40 rounded-lg flex items-center space-x-2">
              <FaCheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
              <p className="text-sm text-green-600 dark:text-green-300">{success}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            {/* Theme Toggle */}
            <ThemeToggleCard />

            {/* Email Notifications */}
            <div className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden transition-colors duration-300">
              <div className="px-5 py-3 bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-200/60 dark:border-gray-800/40">
                <div className="flex items-center space-x-2">
                  <FaEnvelope className="w-4 h-4 text-teal-600 dark:text-[#0d9488]" />
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Email Notifications</h2>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {Object.keys(emailPrefs).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-500">No email preferences configured.</p>
                ) : (
                  Object.entries(emailPrefs).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          Receive email when {key.replace(/([A-Z])/g, ' $1').toLowerCase()} occurs
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
              <div className="px-5 py-3 bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-200/60 dark:border-gray-800/40">
                <div className="flex items-center space-x-2">
                  {isNative ? (
                    <FaMobileAlt className="w-4 h-4 text-teal-600 dark:text-[#0d9488]" />
                  ) : (
                    <FaBell className="w-4 h-4 text-teal-600 dark:text-[#0d9488]" />
                  )}
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {isNative ? 'Mobile Push Notifications' : 'Web Push Notifications'}
                  </h2>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {isNative ? (
                  <div className="flex items-center gap-3">
                    <FaCheckCircle className="text-green-500 dark:text-green-400" />
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Push notifications are automatically enabled on this device.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable push notifications</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {permission === 'denied'
                            ? 'Notifications are blocked in browser settings.'
                            : 'Receive push notifications in this browser'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {permission === 'denied' ? (
                          <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                            <FaTimesCircle /> Blocked
                          </span>
                        ) : (
                          <>
                            {actionLoading && <FaSpinner className="animate-spin text-teal-600 dark:text-[#0d9488]" />}
                            <ToggleSwitch
                              enabled={pushEnabled}
                              onChange={() => handlePushMasterToggle(pushEnabled)}
                              disabled={!isSupported || permission === 'denied' || actionLoading}
                              loading={actionLoading}
                            />
                          </>
                        )}
                      </div>
                    </div>

                    {/* Diagnostic info */}
                    <div className="bg-gray-50 dark:bg-[#0b0b10] rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 space-y-1 border border-gray-200 dark:border-gray-800/40">
                      <div className="flex items-center gap-2">
                        <FaInfoCircle className="text-teal-600 dark:text-[#0d9488]" />
                        <span>Service Worker: {swReady ? '✅ Ready' : '⏳ Loading...'}</span>
                      </div>
                      {subscription && (
                        <div className="truncate">
                          <span className="font-medium">Endpoint:</span>{' '}
                          {subscription.endpoint.length > 60
                            ? subscription.endpoint.slice(0, 60) + '…'
                            : subscription.endpoint}
                        </div>
                      )}
                      <button
                        onClick={handleReRegister}
                        disabled={actionLoading || !isSupported || permission === 'denied'}
                        className="mt-2 flex items-center gap-1 text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition disabled:opacity-50"
                      >
                        <FaSync className={actionLoading ? 'animate-spin' : ''} />
                        Re‑register Push
                      </button>
                    </div>
                  </>
                )}

                {/* Push sub-preferences */}
                {pushEnabled && Object.keys(pushPrefs).length > 1 && (
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800/40">
                    {Object.entries(pushPrefs).map(([key, value]) => {
                      if (key === 'enabled') return null;
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
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

                {isNative && fcmToken && (
                  <div className="bg-gray-50 dark:bg-[#0b0b10] rounded-lg p-3 border border-gray-200 dark:border-gray-800/40">
                    <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                      <span className="font-medium">FCM Token:</span> {fcmToken}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Test Notifications */}
            <div className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden transition-colors duration-300">
              <div className="px-5 py-3 bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-200/60 dark:border-gray-800/40">
                <div className="flex items-center space-x-2">
                  <FaBell className="w-4 h-4 text-teal-600 dark:text-[#0d9488]" />
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Test Notifications</h2>
                </div>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={handleTestPush}
                    disabled={!pushAvailable}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-full text-sm font-medium hover:bg-teal-700 dark:hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaMobileAlt /> Send Test Push
                  </button>
                  <button
                    onClick={handleTestEmail}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-full text-sm font-medium hover:bg-teal-700 dark:hover:opacity-80 transition"
                  >
                    <FaEnvelope /> Send Test Email
                  </button>
                </div>
                {!isNative && !pushAvailable && isSupported && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                    Push is not active. Enable it above or re‑register if the endpoint is missing.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Mobile View ────────────────────────────────────────────────────────

const MobileNotificationSettings = ({ state }) => {
  const {
    emailPrefs,
    pushPrefs,
    actionLoading,
    swReady,
    success,
    error,
    isNative,
    push,
    isSubscribed,
    permission,
    isSupported,
    subscription,
    fcmToken,
    pushEnabled,
    pushAvailable,
    handleEmailToggle,
    handlePushSubToggle,
    handlePushMasterToggle,
    handleReRegister,
    handleTestPush,
    handleTestEmail,
  } = state;

  return (
    <div className="md:hidden bg-gray-50 dark:bg-[#0b0b10] min-h-screen pb-20 transition-colors duration-300">
      <div className="bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <FaBell className="w-5 h-5 text-teal-600 dark:text-[#0d9488]" />
          <h1 className="text-base font-semibold text-gray-800 dark:text-gray-200">Notification Settings</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/40 rounded-lg flex items-center space-x-2">
            <FaExclamationTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
            <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/40 rounded-lg flex items-center space-x-2">
            <FaCheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
            <p className="text-xs text-green-600 dark:text-green-300">{success}</p>
          </div>
        )}

        {/* Theme Toggle */}
        <ThemeToggleCard />

        {/* Email Notifications */}
        <div className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden transition-colors duration-300">
          <div className="px-4 py-3 bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-200/60 dark:border-gray-800/40">
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
                <div key={key} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Receive email when {key.replace(/([A-Z])/g, ' $1').toLowerCase()} occurs
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
          <div className="px-4 py-3 bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-200/60 dark:border-gray-800/40">
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
                <FaCheckCircle className="text-green-500 dark:text-green-400" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Push notifications are automatically enabled on this device.
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable push</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {permission === 'denied'
                        ? 'Notifications are blocked in browser settings.'
                        : 'Receive push notifications in this browser'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {permission === 'denied' ? (
                      <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                        <FaTimesCircle /> Blocked
                      </span>
                    ) : (
                      <>
                        {actionLoading && <FaSpinner className="animate-spin text-teal-600 dark:text-[#0d9488]" />}
                        <ToggleSwitch
                          enabled={pushEnabled}
                          onChange={() => handlePushMasterToggle(pushEnabled)}
                          disabled={!isSupported || permission === 'denied' || actionLoading}
                          loading={actionLoading}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Diagnostic info */}
                <div className="p-4 bg-gray-50 dark:bg-[#0b0b10] space-y-1 border-t border-gray-200 dark:border-gray-800/30">
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <FaInfoCircle className="text-teal-600 dark:text-[#0d9488]" />
                    <span>Service Worker: {swReady ? '✅ Ready' : '⏳ Loading...'}</span>
                  </div>
                  {subscription && (
                    <div className="truncate text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Endpoint:</span>{' '}
                      {subscription.endpoint.length > 60
                        ? subscription.endpoint.slice(0, 60) + '…'
                        : subscription.endpoint}
                    </div>
                  )}
                  <button
                    onClick={handleReRegister}
                    disabled={actionLoading || !isSupported || permission === 'denied'}
                    className="mt-1 flex items-center gap-1 text-xs text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition disabled:opacity-50"
                  >
                    <FaSync className={actionLoading ? 'animate-spin' : ''} />
                    Re‑register Push
                  </button>
                </div>
              </>
            )}

            {/* Push sub-preferences */}
            {pushEnabled && Object.keys(pushPrefs).length > 1 && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
                {Object.entries(pushPrefs).map(([key, value]) => {
                  if (key === 'enabled') return null;
                  return (
                    <div key={key} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
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

            {isNative && fcmToken && (
              <div className="p-4 bg-gray-50 dark:bg-[#0b0b10] border-t border-gray-200 dark:border-gray-800/30">
                <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                  <span className="font-medium">FCM Token:</span> {fcmToken}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Test Notifications */}
        <div className="bg-white dark:bg-[#14141a] rounded-xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden transition-colors duration-300">
          <div className="px-4 py-3 bg-gray-50 dark:bg-[#0f0f12] border-b border-gray-200/60 dark:border-gray-800/40">
            <div className="flex items-center space-x-2">
              <FaBell className="w-4 h-4 text-teal-600 dark:text-[#0d9488]" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Test Notifications</h2>
            </div>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleTestPush}
                disabled={!pushAvailable}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-full text-sm font-medium hover:bg-teal-700 dark:hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaMobileAlt /> Send Test Push
              </button>
              <button
                onClick={handleTestEmail}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 dark:bg-[#0d9488] text-white rounded-full text-sm font-medium hover:bg-teal-700 dark:hover:opacity-80 transition"
              >
                <FaEnvelope /> Send Test Email
              </button>
            </div>
            {!isNative && !pushAvailable && isSupported && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                Push is not active. Enable it above or re‑register if the endpoint is missing.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────

const Settings = () => {
  const state = useNotificationSettings();
  const navigate = useNavigate();

  // Make ToastContainer respect the current theme
  const { isDarkMode } = useTheme();

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

  return (
    <>
      {/* Header with back button (mobile) */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 px-4 h-14 flex items-center gap-3 md:hidden">
        <button onClick={() => navigate(-1)} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
          <FaArrowLeft />
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Settings</h1>
      </header>
      <DesktopNotificationSettings state={state} />
      <MobileNotificationSettings state={state} />
      <ToastContainer
        position="bottom-center"
        autoClose={4000}
        hideProgressBar={false}
        theme={isDarkMode ? 'dark' : 'light'}
      />
    </>
  );
};

export default Settings;