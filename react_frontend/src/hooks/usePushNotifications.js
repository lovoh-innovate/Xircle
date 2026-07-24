// src/hooks/usePushNotifications.js
import { useState, useEffect, useCallback } from 'react';
import {
  useGetVapidPublicKeyQuery,
  useRegisterWebPushMutation,
} from '../slices/notificationApiSlice';

// Convert a base64‑encoded VAPID key to a Uint8Array for the Push API
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const usePushNotifications = () => {
  // -------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState(null);

  // RTK Query hooks
  const { data: vapidData, isLoading: vapidLoading } = useGetVapidPublicKeyQuery(undefined, {
    skip: !isSupported, // only fetch if the browser supports push
  });
  const [registerSubscription] = useRegisterWebPushMutation();

  // -------------------------------------------------------------------
  // Check for browser support on mount
  // -------------------------------------------------------------------
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Store the VAPID public key when it arrives
  useEffect(() => {
    if (vapidData?.data?.publicKey) {
      setVapidPublicKey(vapidData.data.publicKey);
    }
  }, [vapidData]);

  // -------------------------------------------------------------------
  // Check if the user is already subscribed
  // -------------------------------------------------------------------
  const checkExistingSubscription = useCallback(async () => {
    if (!isSupported) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        setSubscription(existingSub);
        setIsSubscribed(true);
        setPermission('granted');
      }
    } catch (error) {
      console.error('Error checking existing web push subscription:', error);
    }
  }, [isSupported]);

  // -------------------------------------------------------------------
  // Subscribe to push notifications
  // -------------------------------------------------------------------
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      console.warn('Push notifications are not supported in this browser');
      return false;
    }

    if (!vapidPublicKey) {
      console.warn('VAPID public key not yet available');
      return false;
    }

    try {
      // 1. Request permission if needed
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
        setPermission(perm);
      }
      if (perm !== 'granted') {
        setPermission(perm);
        return false;
      }

      // 2. Get the service worker registration
      const registration = await navigator.serviceWorker.ready;

      // 3. Subscribe with the VAPID key
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // 4. Store locally
      setSubscription(newSubscription);
      setIsSubscribed(true);
      setPermission('granted');

      // 5. Send the raw subscription object to your server
      await registerSubscription({
        subscription: newSubscription, // raw PushSubscription object
        deviceType: 'web',
      }).unwrap();

      return true;
    } catch (error) {
      console.error('Web push subscription error:', error);
      return false;
    }
  }, [isSupported, vapidPublicKey, registerSubscription]);

  // -------------------------------------------------------------------
  // Unsubscribe from push notifications
  // -------------------------------------------------------------------
  const unsubscribe = useCallback(async () => {
    if (!isSupported || !subscription) {
      console.warn('No active subscription to unsubscribe from');
      return false;
    }

    try {
      // 1. Unsubscribe from the browser's push service
      await subscription.unsubscribe();

      // 2. Tell the server to remove this subscription
      await registerSubscription({
        subscription: subscription, // raw object
        deviceType: 'web',
        action: 'unsubscribe',
      }).unwrap();

      // 3. Clear local state
      setSubscription(null);
      setIsSubscribed(false);
      setPermission(Notification.permission); // may remain 'granted' but we're unsubscribed

      return true;
    } catch (error) {
      console.error('Web push unsubscribe error:', error);
      return false;
    }
  }, [isSupported, subscription, registerSubscription]);

  // -------------------------------------------------------------------
  // Return everything the UI might need
  // -------------------------------------------------------------------
  return {
    isSupported,
    isSubscribed,
    permission,
    subscription,          // the raw PushSubscription object (contains endpoint)
    vapidPublicKey,
    vapidLoading,
    subscribe,
    unsubscribe,
  };
};