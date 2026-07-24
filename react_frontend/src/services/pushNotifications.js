// src/services/pushNotifications.js
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { dispatch } from '../store';           // from updated store.js
import { apiSlice } from '../slices/apiSlice'; // RTK Query api
import { toast } from 'react-toastify';       // optional: show a toast on foreground push

let initialized = false;

/**
 * Call this once when the user logs in (or when the app starts if already logged in).
 */
export const initPushNotifications = async () => {
  if (initialized) return;
  initialized = true;

  // Push only works on native mobile (ignore web)
  if (!Capacitor.isNativePlatform()) {
    console.log('🔕 Push notifications are not available on web');
    return;
  }

  // 1. Request permission
  const permStatus = await PushNotifications.requestPermissions();
  if (permStatus.receive !== 'granted') {
    console.warn('❌ Push notification permission denied');
    return;
  }

  // 2. Register with FCM
  await PushNotifications.register();

  // ── FCM token received ──────────────────────────────────────────
  PushNotifications.addListener('registration', async (token) => {
    console.log('📱 FCM token:', token.value);
    try {
      // Dispatch the registerMobileToken mutation via RTK Query
      const result = await dispatch(
        apiSlice.endpoints.registerMobileToken.initiate({
          fcmToken: token.value,
          deviceType: 'android', // you can use Capacitor.getPlatform() to detect
          platform: 'capacitor',
        })
      ).unwrap();
      console.log('✅ FCM token registered on server:', result);
    } catch (err) {
      console.error('❌ Error registering FCM token:', err);
    }
  });

  // ── Registration error ─────────────────────────────────────────
  PushNotifications.addListener('registrationError', (error) => {
    console.error('❌ Push registration error:', error);
  });

  // ── Foreground notification received ────────────────────────────
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('🔔 Push received (foreground):', notification);
    const { title, body, data } = notification;
    // Show an in‑app banner or a toast (you can replace this with a custom component)
    if (title || body) {
      toast.info(`${title || ''}\n${body || ''}`, {
        autoClose: 5000,
        onClick: () => {
          // On tap, navigate if there is navigation data
          if (window.__navigate && data?.roomId) {
            window.__navigate(`/call/${data.roomId}`);
          }
        },
      });
    }
    // If you have a custom in‑app banner component, you can emit an event instead.
  });

  // ── Notification tapped (app was in background/closed) ──────────
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('👆 Push action performed:', action);
    const data = action.notification.data;
    // Navigate based on the payload, e.g., to a call or chat
    if (data?.roomId && window.__navigate) {
      window.__navigate(`/call/${data.roomId}`);
    } else if (data?.workspaceId && window.__navigate) {
      window.__navigate(`/workspace/${data.workspaceId}`);
    }
    // You can handle other deep links similarly
  });
};

/**
 * Clean up (unregister) – optional, call on logout if needed.
 */
export const removePushNotifications = async () => {
  if (Capacitor.isNativePlatform()) {
    await PushNotifications.unregister();
    initialized = false;
  }
};