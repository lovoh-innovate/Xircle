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
      setupPushListeners();
    }
    // Cleanup? The plugin listeners are persistent; we don't need to remove them.
  }, []);

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

      await PushNotifications.register();

      return new Promise((resolve) => {
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
            registrationListener.remove();
          }
        };

        const onError = (error) => {
          console.error('FCM registration error:', error);
          setIsSubscribed(false);
          resolve(false);
          errorListener.remove();
        };

        const registrationListener = PushNotifications.addListener('registration', onRegistration);
        const errorListener = PushNotifications.addListener('registrationError', onError);
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
      // Optionally show an in-app toast
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