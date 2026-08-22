// src/screens/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  useGetNotificationPreferencesQuery,
  useUpdateEmailNotificationsMutation,
  useUpdatePushNotificationsMutation,
  useSendTestPushMutation,
  useSendTestEmailMutation,
  useGetVapidPublicKeyQuery,
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
  FaSync,
  FaInfoCircle,
  FaSun,
  FaMoon,
  FaDesktop,
  FaExternalLinkAlt,
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
  const [swReady, setSwReady] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('idle');

  const { data: prefData, isLoading: prefsLoading, isError: prefsError, refetch } =
    useGetNotificationPreferencesQuery();
  const [updateEmail] = useUpdateEmailNotificationsMutation();
  const [updatePush] = useUpdatePushNotificationsMutation();
  const [sendTestPush] = useSendTestPushMutation();
  const [sendTestEmail] = useSendTestEmailMutation();
  const { data: vapidData, isLoading: vapidLoading } = useGetVapidPublicKeyQuery();

  // Single shared push-state instance (see PushNotificationContext) —
  // this is the SAME instance WebPushInitializer/PushNotificationInitializer
  // use, so it's never out of sync after a reload/navigation.
  const push = usePushNotificationContext();
  const { isSubscribed, permission, subscribe, unsubscribe, isSupported, fcmToken, isNative } = push;

  useEffect(() => {
    if (prefData?.data) {
      setEmailPrefs(prefData.data.email || {});
      setPushPrefs(prefData.data.push || {});
    }
  }, [prefData]);

  useEffect(() => {
    if (isNative || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then(() => {
        console.log('✅ Service Worker is ready');
        setSwReady(true);
      })
      .catch((err) => {
        console.warn('❌ Service Worker not ready:', err);
        setSwReady(false);
      });
  }, [isNative]);

  useEffect(() => {
    if (fcmToken) {
      console.log(`🔔 ${isNative ? 'Mobile' : 'Web'} FCM token:`, fcmToken);
    }
  }, [isNative, fcmToken]);

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
    setRegistrationStatus('registering');

    console.log('🔔 Toggling push:', {
      currentlyEnabled,
      isSupported,
      permission,
      isSubscribed,
      fcmToken: fcmToken?.substring(0, 30) + '...',
      vapidKey: vapidData?.data?.publicKey?.substring(0, 30) + '...',
      isNative,
    });

    try {
      if (currentlyEnabled) {
        console.log('🔔 Unsubscribing from push...');
        const success = await unsubscribe();
        if (success) {
          const newPrefs = { ...pushPrefs, enabled: false };
          setPushPrefs(newPrefs);
          await updatePush(newPrefs).unwrap();
          setSuccess('Push notifications disabled');
          setRegistrationStatus('idle');
          setTimeout(() => setSuccess(''), 3000);
          console.log('✅ Push unsubscribed successfully');
        } else {
          setRegistrationStatus('error');
          setError('Failed to disable push');
          setTimeout(() => setError(''), 4000);
          console.warn('❌ Push unsubscribe returned false');
        }
      } else {
        if (!vapidData?.data?.publicKey) {
          console.error('❌ VAPID key not available');
          setRegistrationStatus('error');
          setError('VAPID key not available. Please try again.');
          setTimeout(() => setError(''), 4000);
          setActionLoading(false);
          return;
        }

        if (!isNative && !swReady) {
          console.warn('⚠️ Service Worker not ready, attempting to register...');
          try {
            await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
            setSwReady(true);
            console.log('✅ Service Worker registered successfully');
          } catch (swErr) {
            console.error('❌ Service Worker registration failed:', swErr);
            setRegistrationStatus('error');
            setError('Service Worker registration failed. Please refresh and try again.');
            setTimeout(() => setError(''), 4000);
            setActionLoading(false);
            return;
          }
        }

        console.log('🔔 Subscribing to push...');
        const success = await subscribe();
        if (success) {
          const newPrefs = { ...pushPrefs, enabled: true };
          setPushPrefs(newPrefs);
          await updatePush(newPrefs).unwrap();
          setSuccess('Push notifications enabled');
          setRegistrationStatus('success');
          setTimeout(() => setSuccess(''), 3000);
          console.log('✅ Push subscribed successfully');
        } else {
          setRegistrationStatus('error');
          if (permission === 'denied') {
            setError('Notifications blocked. Enable them in browser settings.');
          } else if (!isSupported) {
            setError('Push notifications are not supported in this browser.');
          } else {
            setError('Failed to enable push. Please try again.');
          }
          setTimeout(() => setError(''), 4000);
          console.warn('❌ Push subscribe returned false');
        }
      }
    } catch (err) {
      console.error('❌ Push toggle error:', err);
      setRegistrationStatus('error');
      setError(err?.message || 'An error occurred');
      setTimeout(() => setError(''), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReRegister = async () => {
    if (actionLoading || isNative) return;
    setActionLoading(true);
    setRegistrationStatus('registering');
    console.log('🔄 Re-registering push...');

    try {
      await unsubscribe();
      const success = await subscribe();
      if (success) {
        const newPrefs = { ...pushPrefs, enabled: true };
        setPushPrefs(newPrefs);
        await updatePush(newPrefs).unwrap();
        setSuccess('Push subscription refreshed');
        setRegistrationStatus('success');
        setTimeout(() => setSuccess(''), 3000);
        console.log('✅ Push re-registered successfully');
      } else {
        setRegistrationStatus('error');
        setError('Failed to re-register push');
        setTimeout(() => setError(''), 4000);
        console.warn('❌ Push re-register returned false');
      }
    } catch (err) {
      console.error('❌ Re-register error:', err);
      setRegistrationStatus('error');
      setError(err?.message || 'Re-registration failed');
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
  const vapidKeyAvailable = !!vapidData?.data?.publicKey;

  return {
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
    fcmToken,
    pushEnabled,
    pushAvailable,
    registrationStatus,
    vapidKeyAvailable,
    vapidLoading,
    isLoading: prefsLoading,
    isError: prefsError,
    refetch,

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

// ─── Shared diagnostic block ────────────────────────────────────────────
const PushTokenDiagnostic = ({
  swReady,
  fcmToken,
  isNative,
  actionLoading,
  isSupported,
  permission,
  onReRegister,
  vapidKeyAvailable,
  isSubscribed,
}) => {
  const [copied, setCopied] = useState(false);

  const copyToken = () => {
    if (fcmToken) {
      navigator.clipboard.writeText(fcmToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-[#0b0b10] rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 space-y-1.5 border border-gray-200 dark:border-gray-800/40">
      <div className="flex items-center gap-2 flex-wrap">
        <FaInfoCircle className="text-teal-600 dark:text-[#0d9488]" />
        <span>Status: {isSubscribed ? '✅ Subscribed' : permission === 'denied' ? '🚫 Blocked' : '⏳ Not subscribed'}</span>
      </div>
      {!isNative && (
        <div className="flex items-center gap-2 flex-wrap">
          <span>Service Worker: {swReady ? '✅ Ready' : '⏳ Loading...'}</span>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span>VAPID Key: {vapidKeyAvailable ? '✅ Available' : '⏳ Loading...'}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span>Permission: {permission === 'granted' ? '✅ Granted' : permission === 'denied' ? '❌ Denied' : '⏳ Not requested'}</span>
        {permission === 'denied' && !isNative && (
          <button
            onClick={() => {
              toast.info('Please enable notifications in browser settings.', {
                duration: 5000,
              });
            }}
            className="text-blue-600 dark:text-blue-400 hover:underline text-xs flex items-center gap-1"
          >
            <FaExternalLinkAlt className="text-[9px]" /> Learn how
          </button>
        )}
      </div>
      {fcmToken && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">Token:</span>
          <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
            {fcmToken.length > 40 ? fcmToken.slice(0, 40) + '…' : fcmToken}
          </span>
          <button
            onClick={copyToken}
            className="text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition text-[10px]"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      {!isNative && (
        <button
          onClick={onReRegister}
          disabled={actionLoading || !isSupported || permission === 'denied' || !vapidKeyAvailable}
          className="mt-2 flex items-center gap-1 text-teal-600 dark:text-[#0d9488] hover:text-teal-700 dark:hover:text-[#14b8a6] transition disabled:opacity-50"
        >
          <FaSync className={actionLoading ? 'animate-spin' : ''} />
          Re‑register Push
        </button>
      )}
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
    permission,
    isSupported,
    fcmToken,
    pushEnabled,
    pushAvailable,
    registrationStatus,
    vapidKeyAvailable,
    vapidLoading,
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
            <ThemeToggleCard />

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
                  {registrationStatus === 'registering' && (
                    <FaSpinner className="animate-spin text-teal-600 dark:text-[#0d9488] ml-2" />
                  )}
                  {registrationStatus === 'success' && (
                    <FaCheckCircle className="text-green-500 dark:text-green-400 ml-2" />
                  )}
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable push notifications</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {permission === 'denied'
                          ? 'Notifications are blocked in browser settings.'
                          : isSupported && vapidKeyAvailable
                          ? 'Receive push notifications in this browser'
                          : vapidKeyAvailable === false && !isNative
                          ? 'Loading VAPID key...'
                          : 'Push is not supported in this browser'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {permission === 'denied' ? (
                        <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                          <FaTimesCircle /> Blocked
                        </span>
                      ) : (
                        <ToggleSwitch
                          enabled={pushEnabled}
                          onChange={() => handlePushMasterToggle(pushEnabled)}
                          disabled={
                            !isSupported ||
                            permission === 'denied' ||
                            actionLoading ||
                            vapidLoading ||
                            !vapidKeyAvailable
                          }
                          loading={actionLoading}
                        />
                      )}
                    </div>
                  </div>
                )}

                <PushTokenDiagnostic
                  swReady={swReady}
                  fcmToken={fcmToken}
                  isNative={isNative}
                  actionLoading={actionLoading}
                  isSupported={isSupported}
                  permission={permission}
                  onReRegister={handleReRegister}
                  vapidKeyAvailable={vapidKeyAvailable}
                  isSubscribed={state.isSubscribed}
                />

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
              </div>
            </div>

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
                    Push is not active. Enable it above or re‑register if the token is missing.
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
    permission,
    isSupported,
    fcmToken,
    pushEnabled,
    pushAvailable,
    registrationStatus,
    vapidKeyAvailable,
    vapidLoading,
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
          {registrationStatus === 'registering' && (
            <FaSpinner className="animate-spin text-teal-600 dark:text-[#0d9488] ml-2" />
          )}
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

        <ThemeToggleCard />

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
              {registrationStatus === 'registering' && (
                <FaSpinner className="animate-spin text-teal-600 dark:text-[#0d9488] ml-2" />
              )}
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
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable push</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {permission === 'denied'
                      ? 'Notifications are blocked in browser settings.'
                      : isSupported && vapidKeyAvailable
                      ? 'Receive push notifications in this browser'
                      : vapidKeyAvailable === false && !isNative
                      ? 'Loading VAPID key...'
                      : 'Push is not supported in this browser'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {permission === 'denied' ? (
                    <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                      <FaTimesCircle /> Blocked
                    </span>
                  ) : (
                    <ToggleSwitch
                      enabled={pushEnabled}
                      onChange={() => handlePushMasterToggle(pushEnabled)}
                      disabled={
                        !isSupported ||
                        permission === 'denied' ||
                        actionLoading ||
                        vapidLoading ||
                        !vapidKeyAvailable
                      }
                      loading={actionLoading}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="p-4 border-t border-gray-200 dark:border-gray-800/30">
              <PushTokenDiagnostic
                swReady={swReady}
                fcmToken={fcmToken}
                isNative={isNative}
                actionLoading={actionLoading}
                isSupported={isSupported}
                permission={permission}
                onReRegister={handleReRegister}
                vapidKeyAvailable={vapidKeyAvailable}
                isSubscribed={state.isSubscribed}
              />
            </div>

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
          </div>
        </div>

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
                Push is not active. Enable it above or re‑register if the token is missing.
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
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40 px-4 h-14 flex items-center gap-3 md:hidden">
        <button onClick={() => navigate(-1)} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
          <FaArrowLeft />
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Settings</h1>
      </header>
      <DesktopNotificationSettings state={state} />
      <MobileNotificationSettings state={state} />
    </>
  );
};

export default Settings;