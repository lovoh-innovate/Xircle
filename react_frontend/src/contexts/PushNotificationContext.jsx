import React, { createContext, useContext } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useMobilePushNotifications } from '../hooks/useMobilePushNotifications';

const PushNotificationContext = createContext(null);

// Mounted ONCE at the app root. Every screen (Settings, etc.) reads from
// this context instead of calling usePushNotifications()/
// useMobilePushNotifications() itself — calling those hooks in more than
// one place creates independent copies of isSubscribed/fcmToken/permission
// that don't sync, which is what was causing the web toggle to appear
// "off" after reload and registering duplicate onMessage listeners.
export const PushNotificationProvider = ({ children }) => {
  const isNative = Capacitor.isNativePlatform();
  const webPush = usePushNotifications();
  const mobilePush = useMobilePushNotifications();
  const push = isNative ? mobilePush : webPush;

  const value = {
    ...push,
    isNative,
  };

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
};

export const usePushNotificationContext = () => {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) {
    throw new Error('usePushNotificationContext must be used within a PushNotificationProvider');
  }
  return ctx;
};