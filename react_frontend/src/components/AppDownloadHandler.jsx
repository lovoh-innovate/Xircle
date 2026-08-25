// src/components/AppDownloadHandler.jsx
import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { toast } from 'react-hot-toast';

const API_BASE = 'https://xircle.onrender.com';

/**
 * Download APK file - hands off to the device's actual default browser app
 * using AppLauncher (fires a real ACTION_VIEW intent - full app switch,
 * not an in-app Custom Tab / SFSafariViewController).
 * @param {string} versionId - The version ID to download
 * @param {string} token - User authentication token
 * @param {string} version - Version number (for display)
 */
export const downloadAppFile = async (versionId, token, version) => {
  const downloadUrl = `${API_BASE}/api/app/download/${versionId}?token=${token}`;
  console.log('📱 Download URL:', downloadUrl);

  if (Capacitor.isNativePlatform()) {
    // ── Capacitor Native - Hand off to the SYSTEM default browser ──
    try {
      await AppLauncher.openUrl({ url: downloadUrl });
      toast.success('Download started in your browser!');
      return { success: true, method: 'system-browser' };
    } catch (error) {
      console.error('System browser open failed:', error);
      toast.error('Failed to open download. Please try again.');
      throw new Error('Failed to open download. Please try again.');
    }
  } else {
    // ── Web Browser Download ──
    window.open(downloadUrl, '_blank');
    toast.success('Download started in your browser');
    return { success: true, method: 'browser' };
  }
};

/**
 * Simple download function without loading state
 */
export const downloadAppVersion = async (versionId, token) => {
  const url = `${API_BASE}/api/app/download/${versionId}?token=${token}`;

  if (Capacitor.isNativePlatform()) {
    try {
      await AppLauncher.openUrl({ url });
    } catch (error) {
      console.error('System browser open failed:', error);
      toast.error('Failed to open download. Please try again.');
      throw error;
    }
  } else {
    window.open(url, '_blank');
  }
};

/**
 * Check if the app is running natively on Android
 */
export const isAndroidNative = () => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * Check if the app is running natively on iOS
 */
export const isIosNative = () => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};