// src/hooks/usePushNotifications.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
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

  // ─── FIX: this hook now has to know whether we're authenticated,
  // because the VAPID-key query below hits a `protect`-guarded route.
  // Without this, useGetVapidPublicKeyQuery fired as soon as
  // `isSupported` became true — completely independent of whether
  // auth state had loaded yet. On a fresh mount that meant it went out
  // with NO Authorization header, got a legitimate 401 "Not authorized,
  // no user token" back, and that message correctly matches
  // AUTH_INVALID_MESSAGES in apiSlice.js — so logout() fired for real,
  // wiping the actual session token that landed a moment later. Not a
  // false 401, a real one — just fired too early, before it should
  // have been asked at all. ───────────────────────────────────────────
  const token = useSelector((state) => state.auth.userInfo?.token);

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
    // ─── FIX: don't fire until we actually have a token, not just
    // when the browser says push is supported.
    skip: !isSupported || !token,
  });
  const [registerSubscription] = useRegisterWebPushMutation();

  const vapidKeyError =
    isSupported &&
    !!token &&
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
        const stored = localStorage.getItem('webFcmToken');
        if (stored && Notification.permission === 'granted') {
          setFcmToken(stored);
          setIsSubscribed(true);
          registerSubscription({ token: stored, deviceType: 'web' })
            .unwrap()
            .catch(err => console.warn('Re‑register existing token failed:', err));
        }
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

    // ─── FIX: don't even attempt this without a token — avoids the
    // same premature-request problem inside subscribe()'s own retry
    // loop, and gives a clear reason in the console instead of a
    // silent 6-second timeout.
    if (!token) {
      console.warn('No auth token yet — refusing to subscribe to push');
      return false;
    }

    if (registering.current) {
      console.log('Already registering, skipping');
      return false;
    }

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

    if (isSubscribed && fcmToken) {
      try {
        await registerSubscription({ token: fcmToken, deviceType: 'web' }).unwrap();
        return true;
      } catch (e) {
        console.warn('Resubscription with existing token failed, will re-register');
      }
    }

    registering.current = true;
    try {
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

      const registration = await navigator.serviceWorker.ready;

      const fcmTok = await getToken(messagingRef.current, {
        vapidKey: vapidPublicKeyRef.current,
        serviceWorkerRegistration: registration,
      });

      if (!fcmTok) {
        console.warn('No registration token received');
        return false;
      }

      setFcmToken(fcmTok);
      localStorage.setItem('webFcmToken', fcmTok);
      setIsSubscribed(true);

      await registerSubscription({ token: fcmTok, deviceType: 'web' }).unwrap();
      console.log('✅ Web push registered successfully');

      return true;
    } catch (error) {
      console.error('Web push subscription error:', error);
      setFcmToken(null);
      localStorage.removeItem('webFcmToken');
      setIsSubscribed(false);
      return false;
    } finally {
      registering.current = false;
    }
  }, [isSupported, token, isSubscribed, fcmToken, registerSubscription]);

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