// src/hooks/useCallAIRecorder.js
//
// Captures the local user's microphone (the SAME track LiveKit already has
// open — so there is no second getUserMedia and no audio-focus fight) and
// uploads it in standalone ~10 s files for server-side Whisper transcription.
//
// Works on: Chrome (Android + desktop), Firefox, Safari/iOS (audio/mp4),
// and inside the Capacitor Android/iOS WebView. It does NOT use the Web
// Speech API (which doesn't exist in Android WebView).
//
// Status values passed to onStatus(status, errorMessage?):
//   'idle'        AI is off
//   'muted'       AI is on but the user's mic is muted (nothing is recorded)
//   'no-mic'      AI is on but LiveKit hasn't published a mic track yet
//   'unsupported' MediaRecorder isn't available on this device
//   'listening'   recording normally
//   'sending'     uploading a segment
//   'error'       setup or upload failed (message in 2nd arg)

import { useEffect, useRef } from 'react';

// Groq bills each request as at least 10 s of audio, so shorter segments
// just waste quota.
const SEGMENT_MS = 10_000;
const VOICE_RMS = 0.015;
const MIN_BYTES = 3000;

const pickMime = () => {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return null; // unsupported
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
  ];
  for (const m of candidates) {
    try {
      if (window.MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* try next */
    }
  }
  return ''; // let the browser pick its default
};

const extFor = (type) => {
  const t = String(type || '').toLowerCase();
  if (t.includes('mp4') || t.includes('aac') || t.includes('m4a')) return 'mp4';
  if (t.includes('ogg')) return 'ogg';
  return 'webm';
};

export default function useCallAIRecorder({
  enabled,   // call.ai.enabled
  micOn,     // LiveKit isMicrophoneEnabled
  micTrack,  // MediaStreamTrack from LiveKit's local mic publication
  onUpload,  // async (blob, filename) => void  — throws on failure
  onStatus,  // (status, errorMessage?) => void
}) {
  const onUploadRef = useRef(onUpload);
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onUploadRef.current = onUpload;
    onStatusRef.current = onStatus;
  });

  useEffect(() => {
    const report = (s, msg) => onStatusRef.current?.(s, msg);

    if (!enabled) {
      report('idle');
      return undefined;
    }
    if (!micOn) {
      report('muted');
      return undefined;
    }
    if (!micTrack || micTrack.readyState === 'ended') {
      report('no-mic');
      return undefined;
    }

    const mime = pickMime();
    if (mime === null) {
      report('unsupported');
      return undefined;
    }

    let stopped = false;
    let recorder = null;
    let timer = null;
    let meter = null;
    let ctx = null;

    // Clone so stopping our copy never touches LiveKit's own track.
    const stream = new MediaStream([micTrack.clone()]);

    // ── Voice detection (skip uploading pure silence) ────────────────
    let heardVoice = false;
    let vadUsable = false;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        ctx = new AC();
        ctx.resume?.().catch(() => {});
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        meter = setInterval(() => {
          // A suspended context (autoplay policy) reads as silence — in that
          // case VAD is unreliable, so we upload every segment instead.
          vadUsable = ctx.state === 'running';
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const d = (buf[i] - 128) / 128;
            sum += d * d;
          }
          if (Math.sqrt(sum / buf.length) > VOICE_RMS) heardVoice = true;
        }, 100);
      }
    } catch (e) {
      console.warn('[aiRecorder] VAD unavailable:', e);
      vadUsable = false;
    }

    const send = async (blob) => {
      try {
        report('sending');
        const base = String(blob.type || '').split(';')[0] || 'audio/webm';
        await onUploadRef.current?.(blob, `chunk.${extFor(base)}`);
        if (!stopped) report('listening');
      } catch (e) {
        console.error('[aiRecorder] upload failed:', e);
        report(
          'error',
          e?.data?.message || e?.error || e?.message || 'Upload failed'
        );
      }
    };

    const recordOne = () => {
      if (stopped) return;
      heardVoice = false;
      const parts = [];

      let rec;
      try {
        rec = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
      } catch (e) {
        console.error('[aiRecorder] MediaRecorder init failed:', e);
        report('error', e?.message || 'Could not start recorder');
        return;
      }
      recorder = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) parts.push(e.data);
      };
      rec.onerror = (e) => {
        console.error('[aiRecorder] recorder error:', e?.error || e);
        report('error', e?.error?.message || 'Recorder error');
      };
      rec.onstop = () => {
        clearTimeout(timer);
        // Capture BEFORE the next segment resets the flag.
        const hadVoice = !vadUsable || heardVoice;
        if (!stopped) recordOne(); // next segment starts immediately
        if (!hadVoice || parts.length === 0) return;

        const type = rec.mimeType || mime || 'audio/webm';
        const blob = new Blob(parts, { type });
        if (blob.size < MIN_BYTES) return;
        send(blob);
      };

      try {
        rec.start(); // no timeslice → ONE complete, self-contained file on stop()
      } catch (e) {
        console.error('[aiRecorder] start failed:', e);
        report('error', e?.message || 'Could not start recorder');
        return;
      }

      timer = setTimeout(() => {
        if (rec.state === 'recording') {
          try {
            rec.stop();
          } catch {
            /* ignore */
          }
        }
      }, SEGMENT_MS);
    };

    report('listening');
    recordOne();

    return () => {
      stopped = true;
      clearTimeout(timer);
      // Stop the recorder FIRST so the last partial segment is still sent.
      try {
        if (recorder && recorder.state === 'recording') recorder.stop();
      } catch {
        /* ignore */
      }
      clearInterval(meter);
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      try {
        ctx?.close?.().catch(() => {});
      } catch {
        /* ignore */
      }
    };
  }, [enabled, micOn, micTrack]);
}