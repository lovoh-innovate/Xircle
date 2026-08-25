// src/hooks/usePushNotifications.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported as isMessagingSupported,
} from 'firebase/messaging';
import {
  useGetVapidPublicKeyQuery,
  useRegisterWebPushMutation,
} from '../slices/notificationApiSlice';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState(null);

  const messagingRef = useRef(null);
  const registering = useRef(false);

  // ─── FIX: vapidPublicKey as state is fine for render, but subscribe()
  // is a stable-ish useCallback whose closure captures whatever
  // vapidPublicKey was at creation time. A `while` loop that sleeps and
  // re-checks that captured const can NEVER see a newer value — it's not
  // a ref, so it never changes mid-execution no matter what React does
  // in between awaits. We mirror the value into a ref so the loop reads
  // live state instead of a frozen snapshot from render time. ─────────
  const vapidPublicKeyRef = useRef(null);
  useEffect(() => {
    vapidPublicKeyRef.current = vapidPublicKey;
  }, [vapidPublicKey]);

  const {
    data: vapidData,
    isLoading: vapidLoading,
    isError: vapidQueryError,
    refetch: refetchVapidKey,
  } = useGetVapidPublicKeyQuery(undefined, {
    skip: !isSupported,
  });
  const [registerSubscription] = useRegisterWebPushMutation();

  // ─── FIX: this was previously never returned from the hook at all,
  // so Settings.jsx's `vapidKeyError` was always undefined — the
  // warning banner never rendered and pushAvailable never accounted
  // for it. True when: the endpoint request failed (network/auth/500),
  // OR it succeeded but came back without a usable key (e.g. the
  // controller's 503 "not configured" response, or a malformed body).
  const vapidKeyError =
    isSupported &&
    !vapidLoading &&
    (vapidQueryError || (vapidData !== undefined && !vapidData?.data?.publicKey));

  const retryLoadVapidKey = useCallback(() => {
    refetchVapidKey();
  }, [refetchVapidKey]);

  // Check support and initialise
  useEffect(() => {
    let cancelled = false;
    isMessagingSupported().then((supported) => {
      if (cancelled) return;
      setIsSupported(supported);
      if (supported) {
        messagingRef.current = getMessaging(firebaseApp);
        setPermission(Notification.permission);
        // Check for existing token in localStorage
        const stored = localStorage.getItem('webFcmToken');
        if (stored && Notification.permission === 'granted') {
          setFcmToken(stored);
          setIsSubscribed(true);
          // Optionally re‑send token to server to be safe
          registerSubscription({ token: stored, deviceType: 'web' })
            .unwrap()
            .catch(err => console.warn('Re‑register existing token failed:', err));
        }
        // Listen to foreground messages
        onMessage(messagingRef.current, (payload) => {
          console.log('📩 Web push received in foreground:', payload);
          window.dispatchEvent(
            new CustomEvent('mobile-push-received', {
              detail: { data: payload.data || {} },
            })
          );
        });
      }
    });
    return () => { cancelled = true; };
  }, [registerSubscription]);

  // Update VAPID key when it arrives
  useEffect(() => {
    if (vapidData?.data?.publicKey) {
      setVapidPublicKey(vapidData.data.publicKey);
    }
  }, [vapidData]);

  // ─── Subscribe ──────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      console.warn('Push notifications are not supported in this browser');
      return false;
    }

    if (registering.current) {
      console.log('Already registering, skipping');
      return false;
    }

    // Wait for VAPID key if not available — now polls the REF (live
    // value), not the closed-over state variable, so it actually has a
    // chance of seeing the key land mid-wait instead of always failing.
    if (!vapidPublicKeyRef.current) {
      console.warn('Waiting for VAPID key...');
      let retries = 0;
      while (!vapidPublicKeyRef.current && retries < 15) {
        await new Promise(r => setTimeout(r, 400));
        retries++;
      }
      if (!vapidPublicKeyRef.current) {
        console.error('VAPID key never loaded');
        return false;
      }
    }

    // If already subscribed, just send the token again (in case server lost it)
    if (isSubscribed && fcmToken) {
      try {
        await registerSubscription({ token: fcmToken, deviceType: 'web' }).unwrap();
        return true;
      } catch (e) {
        console.warn('Resubscription with existing token failed, will re-register');
        // fall through
      }
    }

    registering.current = true;
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
      setPermission('granted');

      // 2. Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // 3. Get FCM token
      const token = await getToken(messagingRef.current, {
        vapidKey: vapidPublicKeyRef.current,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        console.warn('No registration token received');
        return false;
      }

      // 4. Store locally
      setFcmToken(token);
      localStorage.setItem('webFcmToken', token);
      setIsSubscribed(true);

      // 5. Send token to server
      await registerSubscription({ token, deviceType: 'web' }).unwrap();
      console.log('✅ Web push registered successfully');

      return true;
    } catch (error) {
      console.error('Web push subscription error:', error);
      // If it failed, clear local state to avoid confusion
      setFcmToken(null);
      localStorage.removeItem('webFcmToken');
      setIsSubscribed(false);
      return false;
    } finally {
      registering.current = false;
    }
  }, [isSupported, isSubscribed, fcmToken, registerSubscription]);

  // ─── Unsubscribe ──────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!isSupported || !fcmToken) {
      console.warn('No active token to unsubscribe from');
      return false;
    }

    try {
      await deleteToken(messagingRef.current);
      await registerSubscription({
        token: fcmToken,
        deviceType: 'web',
        action: 'unsubscribe',
      }).unwrap();

      localStorage.removeItem('webFcmToken');
      setFcmToken(null);
      setIsSubscribed(false);
      setPermission(Notification.permission);
      return true;
    } catch (error) {
      console.error('Web push unsubscribe error:', error);
      return false;
    }
  }, [isSupported, fcmToken, registerSubscription]);

  // ─── Return ──────────────────────────────────────────────────────
  return {
    isSupported,
    isSubscribed,
    permission,
    fcmToken,
    vapidPublicKey,
    vapidLoading,
    vapidKeyError,
    retryLoadVapidKey,
    subscribe,
    unsubscribe,
  };
};