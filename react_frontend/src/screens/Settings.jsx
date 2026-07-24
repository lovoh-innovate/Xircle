// src/screens/Settings.jsx
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Capacitor } from '@capacitor/core';
import {
  useGetNotificationPreferencesQuery,
  useUpdateEmailNotificationsMutation,
  useUpdatePushNotificationsMutation,
  useRegisterWebPushMutation,
  useSendTestPushMutation,
  useSendTestEmailMutation,
  useGetVapidPublicKeyQuery,
} from '../slices/notificationApiSlice';
import {
  FaArrowLeft,
  FaBell,
  FaEnvelope,
  FaMobileAlt,
  FaGlobe,
  FaKey,
  FaSpinner,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
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
  const [webPushSubscribed, setWebPushSubscribed] = useState(false);
  const [subscriptionObj, setSubscriptionObj] = useState(null);
  const [registeringPush, setRegisteringPush] = useState(false);

  // API hooks
  const { data: prefData, isLoading: prefsLoading, isError: prefsError } = useGetNotificationPreferencesQuery();
  const [updateEmail] = useUpdateEmailNotificationsMutation();
  const [updatePush] = useUpdatePushNotificationsMutation();
  const [registerWebPush] = useRegisterWebPushMutation();
  const [sendTestPush] = useSendTestPushMutation();
  const [sendTestEmail] = useSendTestEmailMutation();
  const { data: vapidData, isLoading: vapidLoading } = useGetVapidPublicKeyQuery(undefined, { skip: isNative });

  // Populate preferences
  useEffect(() => {
    if (prefData?.data) {
      setEmailPrefs(prefData.data.email || {});
      setPushPrefs(prefData.data.push || {});
    }
  }, [prefData]);

  // Check existing web push subscription
  useEffect(() => {
    if (isNative) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscriptionObj(sub);
        setWebPushSubscribed(!!sub);
        if (sub && Notification.permission === 'granted') {
          setPushPrefs((prev) => ({ ...prev, enabled: true }));
        }
      });
    });
  }, [isNative]);

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

  // Master push toggle (subscribe/unsubscribe)
  const handlePushMasterToggle = async (currentlyEnabled) => {
    if (isNative) return; // managed by Capacitor

    if (!currentlyEnabled) {
      // Subscribe
      if (Notification.permission === 'denied') {
        toast.error('Notifications blocked. Enable them in browser settings and try again.');
        return;
      }

      setRegisteringPush(true);
      try {
        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
          toast.error('Permission denied for push notifications');
          return;
        }
        if (!vapidData?.data?.publicKey) {
          toast.error('VAPID public key not available');
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidData.data.publicKey,
        });
        await registerWebPush({
          subscription,
          deviceType: 'web',
        }).unwrap();
        setSubscriptionObj(subscription);
        setWebPushSubscribed(true);
        setPushPrefs((prev) => ({ ...prev, enabled: true }));
        toast.success('Web push notifications enabled');
      } catch (err) {
        toast.error(err?.data?.message || 'Failed to enable push');
      } finally {
        setRegisteringPush(false);
      }
    } else {
      // Unsubscribe
      setRegisteringPush(true);
      try {
        if (subscriptionObj) {
          await subscriptionObj.unsubscribe();
          await registerWebPush({
            subscription: subscriptionObj,
            deviceType: 'web',
            action: 'unsubscribe',
          }).unwrap();
        }
        setSubscriptionObj(null);
        setWebPushSubscribed(false);
        setPushPrefs((prev) => ({ ...prev, enabled: false }));
        toast.success('Web push notifications disabled');
      } catch (err) {
        toast.error(err?.data?.message || 'Failed to disable push');
      } finally {
        setRegisteringPush(false);
      }
    }
  };

  // Sub-preference toggles
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

  // Test push
  const handleTestPush = async () => {
    try {
      await sendTestPush().unwrap();
      toast.success('Test push notification sent');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send test push');
    }
  };

  // Test email
  const handleTestEmail = async () => {
    try {
      await sendTestEmail().unwrap();
      toast.success('Test email sent');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to send test email');
    }
  };

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

  const pushEnabled = pushPrefs.enabled && (isNative || webPushSubscribed);
  const pushAvailable = isNative || (webPushSubscribed && Notification.permission === 'granted');

  const ToggleSwitch = ({ enabled, onChange, disabled = false }) => (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-teal-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ToastContainer position="bottom-center" autoClose={4000} hideProgressBar={false} />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-teal-600 text-white shadow-sm px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <FaArrowLeft />
        </button>
        <h1 className="text-lg font-semibold">Notification Settings</h1>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto w-full">
        {/* Email Notifications */}
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

        {/* Push Notifications */}
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
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">Enable push notifications</p>
                <p className="text-xs text-gray-500">
                  {Notification.permission === 'denied'
                    ? 'Notifications are blocked in browser settings.'
                    : 'Receive push notifications in this browser'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {Notification.permission === 'denied' ? (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <FaTimesCircle /> Blocked
                  </span>
                ) : (
                  <>
                    {registeringPush && <FaSpinner className="animate-spin text-teal-600" />}
                    <ToggleSwitch
                      enabled={pushEnabled}
                      onChange={() => handlePushMasterToggle(pushEnabled)}
                      disabled={registeringPush || Notification.permission === 'denied'}
                    />
                  </>
                )}
              </div>
            </div>
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

        {/* Test Notifications */}
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
        </div>

        {/* VAPID key */}
        {!isNative && vapidData?.data?.publicKey && (
          <details className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
            <summary className="text-lg font-semibold text-gray-900 flex items-center gap-2 cursor-pointer">
              <FaKey className="text-teal-600" />
              VAPID Public Key
            </summary>
            <p className="text-xs text-gray-500 bg-gray-100 p-3 rounded-lg break-all font-mono mt-4">
              {vapidData.data.publicKey}
            </p>
          </details>
        )}
      </main>
    </div>
  );
};

export default Settings;