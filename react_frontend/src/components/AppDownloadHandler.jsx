// src/components/AppDownloadHandler.jsx
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { toast } from 'react-hot-toast';

/**
 * Download APK file - opens in browser for native Android
 * @param {string} versionId - The version ID to download
 * @param {string} token - User authentication token
 * @param {string} version - Version number (for display)
 */
export const downloadAppFile = async (versionId, token, version) => {
  const API_BASE = import.meta.env.VITE_API_URL || '';
  const downloadUrl = `${API_BASE}/api/app/download/${versionId}?token=${token}`;
  
  console.log('📱 Download URL:', downloadUrl);
  
  if (Capacitor.isNativePlatform()) {
    // ── Capacitor Native - Open in Browser ──
    try {
      // Show loading toast
      toast.loading('Opening browser for download...', { duration: 5000 });
      
      await Browser.open({
        url: downloadUrl,
        presentationStyle: 'fullscreen',
        toolbarColor: '#0d9488',
        // For Android, this will open in Chrome
      });
      
      toast.dismiss();
      toast.success('Download started in browser!');
      return { success: true, method: 'browser' };
      
    } catch (error) {
      toast.dismiss();
      console.error('Browser open failed:', error);
      
      // Fallback: Try opening with system browser
      try {
        await Browser.open({
          url: downloadUrl,
          presentationStyle: 'popover',
        });
        return { success: true, method: 'browser' };
      } catch (fallbackError) {
        throw new Error('Failed to open download. Please try again.');
      }
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
  const API_BASE = import.meta.env.VITE_API_URL || '';
  const url = `${API_BASE}/api/app/download/${versionId}?token=${token}`;
  
  if (Capacitor.isNativePlatform()) {
    await Browser.open({
      url: url,
      presentationStyle: 'fullscreen',
      toolbarColor: '#0d9488',
    });
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