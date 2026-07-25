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
      createNotificationChannel();
      setupPushListeners();
    }
  }, []);

  const createNotificationChannel = async () => {
    try {
      await PushNotifications.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: 4,
        visibility: 1,
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
    if (!isSupported) {
      console.warn('Push notifications not supported on this platform');
      return false;
    }

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
    if (!isSupported || !fcmToken) {
      console.warn('Cannot unsubscribe: no token or unsupported platform');
      return false;
    }

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
      console.log('✅ Mobile push unsubscribed');
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
      console.log('📩 Push action performed:', notification);
      const data = notification.notification.data || {};
      // Include actionId if present
      data.actionId = notification.actionId;
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