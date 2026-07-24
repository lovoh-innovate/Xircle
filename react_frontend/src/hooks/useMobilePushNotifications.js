// src/hooks/useMobilePushNotifications.js
import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useRegisterMobileTokenMutation } from '../slices/notificationApiSlice';

export const useMobilePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [permission, setPermission] = useState('default');

  const [registerMobileToken] = useRegisterMobileTokenMutation();

  // Check if running on Capacitor (mobile)
  useEffect(() => {
    const isMobile = Capacitor.isNativePlatform();
    setIsSupported(isMobile);
    if (isMobile) {
      checkExistingToken();
    }
  }, []);

  // Check if we already have a token stored (from previous session)
  const checkExistingToken = useCallback(() => {
    const storedToken = localStorage.getItem('fcmToken');
    if (storedToken) {
      setFcmToken(storedToken);
      setIsSubscribed(true);
      setPermission('granted');
    }
  }, []);

  // Request permission and register for push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // Check current permission status
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== 'granted') {
        setPermission('denied');
        return false;
      }
      setPermission('granted');

      // Register with FCM
      await PushNotifications.register();

      // Wait for the FCM token
      return new Promise((resolve) => {
        const onRegistration = async (token) => {
          console.log('📱 FCM Token received:', token.value);
          setFcmToken(token.value);
          localStorage.setItem('fcmToken', token.value);

          try {
            await registerMobileToken({
              fcmToken: token.value,
              deviceType: 'android', // can be made dynamic
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

  // Unsubscribe (remove token from backend)
  const unsubscribe = useCallback(async () => {
    if (!isSupported || !fcmToken) return false;

    try {
      await registerMobileToken({
        fcmToken,
        deviceType: 'android',
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

  return {
    isSupported,
    isSubscribed,
    fcmToken,
    permission,
    subscribe,
    unsubscribe,
  };
};