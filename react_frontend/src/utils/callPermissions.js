// src/utils/callPermissions.js
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { Camera } from '@capacitor/camera';

const micErrorMessage = (err) => {
  switch (err?.name) {
    case 'NotAllowedError':
      return Capacitor.isNativePlatform()
        ? 'Microphone is blocked inside the app. Check the Android permissions, then reinstall the app.'
        : 'Microphone permission denied. Allow it in your browser address bar and try again.';
    case 'NotFoundError':
      return 'No microphone found on this device.';
    case 'NotReadableError':
      return 'Microphone is busy. Close other apps using it and try again.';
    default:
      return 'Could not access the microphone.';
  }
};

const probeWebMedia = async (constraints) => {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  stream.getTracks().forEach((t) => t.stop());
};

/**
 * Asks for mic (and camera for video calls) BEFORE LiveKit connects.
 * Only the microphone is blocking. A denied camera just means no video.
 * Returns { ok: true } or { ok: false, message }.
 */
export const ensureCallPermissions = async (needVideo = false) => {
  // 1) Native: same logic as voice notes in chat
  if (Capacitor.isNativePlatform()) {
    try {
      const { value: hasMic } = await VoiceRecorder.hasAudioRecordingPermission();
      if (!hasMic) {
        const { value: granted } = await VoiceRecorder.requestAudioRecordingPermission();
        if (!granted) {
          return {
            ok: false,
            message: 'Microphone permission is required for calls. Enable it in your phone settings.',
          };
        }
      }
    } catch (err) {
      console.warn('[call] native mic permission check failed:', err);
    }

    if (needVideo) {
      try {
        const status = await Camera.checkPermissions();
        if (status.camera !== 'granted') {
          await Camera.requestPermissions({ permissions: ['camera'] });
        }
      } catch (err) {
        console.warn('[call] native camera permission check failed:', err);
      }
    }
  }

  // 2) WebView / browser: prime getUserMedia so we catch problems early
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      message: 'Calls need a secure (HTTPS) connection. Media devices are unavailable here.',
    };
  }

  try {
    await probeWebMedia({ audio: true });
  } catch (err) {
    console.error('[call] getUserMedia(audio) failed:', err);
    return { ok: false, message: micErrorMessage(err) };
  }

  if (needVideo) {
    try {
      await probeWebMedia({ video: true });
    } catch (err) {
      console.warn('[call] camera unavailable, continuing without video:', err);
    }
  }

  return { ok: true };
};