// src/hooks/useMobilePushNotifications.js
import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useRegisterMobileTokenMutation } from '../slices/notificationApiSlice';

export const useMobilePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [permission, setPermission] = useState('default');

  const [registerMobileToken] = useRegisterMobileTokenMutation();

  useEffect(() => {
    const isMobile = Capacitor.isNativePlatform();
    setIsSupported(isMobile);
    if (isMobile) {
      checkExistingToken();
      createNotificationChannel(); // 👈 create high-importance channel
      setupPushListeners();
    }
  }, []);

  // ── Create a high‑importance channel (Android 8+) ──────────────
  const createNotificationChannel = async () => {
    try {
      await PushNotifications.createChannel({
        id: 'default',           // must match the channel ID used in server
        name: 'Default Channel',
        importance: 4,           // 4 = HIGH, enables pop‑up, sound, vibration
        visibility: 1,           // 1 = PUBLIC (show on lock screen)
        sound: 'default',
        vibration: true,
        lights: true,
        description: 'High‑priority notifications that pop up on screen',
      });
      console.log('✅ Notification channel created with pop‑up enabled');
    } catch (error) {
      console.warn('Could not create notification channel:', error);
    }
  };

  const checkExistingToken = useCallback(() => {
    const storedToken = localStorage.getItem('fcmToken');
    if (storedToken) {
      setFcmToken(storedToken);
      setIsSubscribed(true);
      setPermission('granted');
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;

    try {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== 'granted') {
        setPermission('denied');
        return false;
      }
      setPermission('granted');

      // Ensure channel exists before registering
      await createNotificationChannel();

      return new Promise((resolve) => {
        let registrationListener;
        let errorListener;

        const cleanup = () => {
          registrationListener?.remove();
          errorListener?.remove();
        };

        const onRegistration = async (token) => {
          console.log('📱 FCM Token received:', token.value);
          setFcmToken(token.value);
          localStorage.setItem('fcmToken', token.value);

          try {
            await registerMobileToken({
              fcmToken: token.value,
              deviceType: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
              platform: 'capacitor',
            }).unwrap();
            setIsSubscribed(true);
            resolve(true);
          } catch (error) {
            console.error('Failed to register FCM token on server:', error);
            resolve(false);
          } finally {
            cleanup();
          }
        };

        const onError = (error) => {
          console.error('FCM registration error:', error);
          setIsSubscribed(false);
          resolve(false);
          cleanup();
        };

        Promise.all([
          PushNotifications.addListener('registration', onRegistration),
          PushNotifications.addListener('registrationError', onError),
        ]).then(([regListener, errListener]) => {
          registrationListener = regListener;
          errorListener = errListener;
          PushNotifications.register().catch((error) => {
            console.error('PushNotifications.register() threw:', error);
            resolve(false);
            cleanup();
          });
        });
      });
    } catch (error) {
      console.error('Failed to subscribe to mobile push:', error);
      return false;
    }
  }, [isSupported, registerMobileToken]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !fcmToken) return false;

    try {
      await registerMobileToken({
        fcmToken,
        deviceType: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
        platform: 'capacitor',
        action: 'unsubscribe',
      }).unwrap();

      localStorage.removeItem('fcmToken');
      setFcmToken(null);
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('Mobile push unsubscribe error:', error);
      return false;
    }
  }, [isSupported, fcmToken, registerMobileToken]);

  const setupPushListeners = useCallback(() => {
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('📩 Push received in foreground:', notification);
      window.dispatchEvent(new CustomEvent('mobile-push-received', { detail: notification }));
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('📩 Push tapped:', notification);
      const data = notification.notification.data || {};
      window.dispatchEvent(new CustomEvent('mobile-push-tapped', { detail: data }));
    });
  }, []);

  return {
    isSupported,
    isSubscribed,
    fcmToken,
    permission,
    subscribe,
    unsubscribe,
  };
};