// src/screens/Settings.jsx
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
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
  FaKey,
  FaSpinner,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaSync,
  FaInfoCircle,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const isNative = Capacitor.isNativePlatform();

  const [emailPrefs, setEmailPrefs] = useState({});
  const [pushPrefs, setPushPrefs] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [swReady, setSwReady] = useState(false);

  const { data: prefData, isLoading: prefsLoading, isError: prefsError } =
    useGetNotificationPreferencesQuery();
  const [updateEmail] = useUpdateEmailNotificationsMutation();
  const [updatePush] = useUpdatePushNotificationsMutation();
  const [sendTestPush] = useSendTestPushMutation();
  const [sendTestEmail] = useSendTestEmailMutation();

  // Push hooks
  const webPush = usePushNotifications();
  const mobilePush = useMobilePushNotifications();
  const push = isNative ? mobilePush : webPush;
  const { isSubscribed, permission, subscribe, unsubscribe, isSupported, subscription } = push;

  // Check service worker status (web only)
  useEffect(() => {
    if (isNative || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(() => setSwReady(true)).catch(() => setSwReady(false));
  }, [isNative]);

  // Populate preferences
  useEffect(() => {
    if (prefData?.data) {
      setEmailPrefs(prefData.data.email || {});
      setPushPrefs(prefData.data.push || {});
    }
  }, [prefData]);

  // Log subscription changes for debugging
  useEffect(() => {
    if (!isNative && subscription) {
      console.log('🔔 Current subscription endpoint:', subscription.endpoint);
    }
  }, [isNative, subscription]);

  // Email toggle
  const handleEmailToggle = async (key) => {
    const newPrefs = { ...emailPrefs, [key]: !emailPrefs[key] };
    setEmailPrefs(newPrefs);
    try {
      await updateEmail(newPrefs).unwrap();
      toast.success('Email preference updated');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update email preferences');
      setEmailPrefs(emailPrefs);
    }
  };

  // Push sub-toggle
  const handlePushSubToggle = async (key) => {
    const newPrefs = { ...pushPrefs, [key]: !pushPrefs[key] };
    setPushPrefs(newPrefs);
    try {
      await updatePush(newPrefs).unwrap();
      toast.success('Push preference updated');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update push preferences');
      setPushPrefs(pushPrefs);
    }
  };

  // Master push toggle
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
          toast.success('Push notifications disabled');
        } else {
          toast.error('Failed to disable push');
        }
      } else {
        const success = await subscribe();
        if (success) {
          const newPrefs = { ...pushPrefs, enabled: true };
          setPushPrefs(newPrefs);
          await updatePush(newPrefs).unwrap();
          toast.success('Push notifications enabled');
        } else {
          if (permission === 'denied') {
            toast.error('Notifications blocked. Enable them in browser settings.');
          } else {
            toast.error('Failed to enable push');
          }
        }
      }
    } catch (err) {
      toast.error(err?.data?.message || 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  // Re-register (force new subscription)
  const handleReRegister = async () => {
    if (actionLoading || isNative) return;
    setActionLoading(true);
    try {
      // Unsubscribe first
      await unsubscribe();
      // Then subscribe again
      const success = await subscribe();
      if (success) {
        const newPrefs = { ...pushPrefs, enabled: true };
        setPushPrefs(newPrefs);
        await updatePush(newPrefs).unwrap();
        toast.success('Push subscription refreshed');
      } else {
        toast.error('Failed to re-register push');
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Re-registration failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Test push
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

  // Toggle switch component
  const ToggleSwitch = ({ enabled, onChange, disabled = false }) => (
    <button
      onClick={onChange}
      disabled={disabled || actionLoading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-teal-600' : 'bg-gray-300'
      } ${disabled || actionLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  // Loading / error
  if (prefsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (prefsError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <FaExclamationTriangle className="text-4xl mb-4" />
        <p>Could not load preferences. Pull down to retry.</p>
      </div>
    );
  }

  const pushEnabled = pushPrefs.enabled && isSubscribed && permission === 'granted';
  const pushAvailable = isSupported && isSubscribed && permission === 'granted';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ToastContainer position="bottom-center" autoClose={4000} hideProgressBar={false} />

      <header className="sticky top-0 z-10 bg-teal-600 text-white shadow-sm px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <FaArrowLeft />
        </button>
        <h1 className="text-lg font-semibold">Notification Settings</h1>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto w-full">
        {/* Email section (unchanged) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <FaEnvelope className="text-teal-600" />
            Email Notifications
          </h2>
          {Object.keys(emailPrefs).length === 0 ? (
            <p className="text-sm text-gray-500">No email preferences configured.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(emailPrefs).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-none">
                  <div>
                    <p className="text-sm font-medium text-gray-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Receive email when {key.replace(/([A-Z])/g, ' $1').toLowerCase()} occurs
                    </p>
                  </div>
                  <ToggleSwitch enabled={value} onChange={() => handleEmailToggle(key)} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Push section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <FaMobileAlt className="text-teal-600" />
            Push Notifications
          </h2>

          {isNative ? (
            <div className="flex items-center gap-3 mb-4">
              <FaCheckCircle className="text-green-500" />
              <p className="text-sm text-gray-700">
                Push notifications are automatically enabled on this device.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">Enable push notifications</p>
                  <p className="text-xs text-gray-500">
                    {permission === 'denied'
                      ? 'Notifications are blocked in browser settings.'
                      : 'Receive push notifications in this browser'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {permission === 'denied' ? (
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <FaTimesCircle /> Blocked
                    </span>
                  ) : (
                    <>
                      {actionLoading && <FaSpinner className="animate-spin text-teal-600" />}
                      <ToggleSwitch
                        enabled={pushEnabled}
                        onChange={() => handlePushMasterToggle(pushEnabled)}
                        disabled={!isSupported || permission === 'denied'}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Diagnostic info */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1 mb-4">
                <div className="flex items-center gap-2">
                  <FaInfoCircle className="text-teal-500" />
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
                {!isNative && (
                  <button
                    onClick={handleReRegister}
                    disabled={actionLoading || !isSupported || permission === 'denied'}
                    className="mt-2 flex items-center gap-1 text-teal-600 hover:text-teal-700 transition disabled:opacity-50"
                  >
                    <FaSync className={actionLoading ? 'animate-spin' : ''} />
                    Re‑register Push
                  </button>
                )}
              </div>
            </>
          )}

          {pushEnabled && Object.keys(pushPrefs).length > 1 && (
            <div className="space-y-3">
              {Object.entries(pushPrefs).map(([key, value]) => {
                if (key === 'enabled') return null;
                return (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-none">
                    <div>
                      <p className="text-sm font-medium text-gray-700 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                      <p className="text-xs text-gray-500">
                        Push when {key.replace(/([A-Z])/g, ' $1').toLowerCase()} occurs
                      </p>
                    </div>
                    <ToggleSwitch
                      enabled={value}
                      onChange={() => handlePushSubToggle(key)}
                      disabled={!pushEnabled}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Test section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <FaBell className="text-teal-600" />
            Test Notifications
          </h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleTestPush}
              disabled={!pushAvailable}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-full text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaMobileAlt /> Send Test Push
            </button>
            <button
              onClick={handleTestEmail}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-full text-sm font-medium hover:bg-teal-700 transition"
            >
              <FaEnvelope /> Send Test Email
            </button>
          </div>
          {!isNative && !pushAvailable && isSupported && (
            <p className="text-xs text-amber-600 mt-2">
              Push is not active. Enable it above or re‑register if the endpoint is missing.
            </p>
          )}
        </div>

        {/* VAPID key (web) */}
        {!isNative && (
          <details className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
            <summary className="text-lg font-semibold text-gray-900 flex items-center gap-2 cursor-pointer">
              <FaKey className="text-teal-600" />
              VAPID Public Key
            </summary>
            <p className="text-xs text-gray-500 bg-gray-100 p-3 rounded-lg break-all font-mono mt-4">
              {webPush.vapidPublicKey || 'Not loaded'}
            </p>
          </details>
        )}
      </main>
    </div>
  );
};

export default Settings;