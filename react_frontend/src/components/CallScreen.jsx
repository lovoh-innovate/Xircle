// src/screens/CallScreen.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { Capacitor } from '@capacitor/core';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useTracks,
  useLocalParticipant,
  useParticipants,
  useSpeakingParticipants,
  useIsSpeaking,
  useIsMuted,
  useRoomContext,
} from '@livekit/components-react';
import {
  Track,
  DisconnectReason,
  MediaDeviceFailure,
  VideoQuality,
} from 'livekit-client';
import {
  FaPhoneSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaSpinner,
  FaExclamationTriangle,
  FaLink,
  FaPhone,
  FaArrowLeft,
  FaSignOutAlt,
  FaCircle,
  FaEllipsisH,
  FaSyncAlt,
  FaDesktop,
  FaVolumeUp,
  // ── AI additions ──
  FaRobot,
  FaBrain,
  FaPaperPlane,
  FaHandPaper,
  FaSmile,
  FaWifi,
  FaQuestionCircle,
  FaCommentDots,
  FaLightbulb,
  FaBookOpen,
  FaTimes,
} from 'react-icons/fa';

import { useSocket } from '../components/SocketContext.jsx';
import { ensureCallPermissions } from '../utils/callPermissions';
import {
  useGetCallByIdQuery,
  useGetCallTokenMutation,
  useJoinCallMutation,
  useLeaveCallMutation,
  useEndCallMutation,
  useRejectCallMutation,
  useStartCallAIMutation,
  useStopCallAIMutation,
  useFinalizeCallNotesMutation,
  usePushCallTranscriptMutation,
  useAskCallAITextMutation,
  useAskCallAIVoiceMutation,
  useSendInCallMessageMutation,
  useSetRaisedHandMutation,
  useSendCallReactionMutation,
  useUpdateCallDataSaverMutation,
} from '../slices/callApiSlice';

// ─────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────
const BRAND = '#06b6d4';
const POLL_MS = 20_000;

const ROOM_OPTIONS = {
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

const IS_NATIVE = Capacitor.isNativePlatform();

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
const formatClock = (total) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
};

const getInfo = (participant) => {
  let meta = {};
  try {
    meta = participant?.metadata ? JSON.parse(participant.metadata) : {};
  } catch {
    meta = {};
  }
  return {
    name: participant?.name || 'Participant',
    username: meta.username || '',
    profile: meta.profile || '',
  };
};

const getUserId = (p) => String(p?.user?._id || p?.user || p?._id || '');

const deviceFailureMessage = (failure) => {
  switch (failure) {
    case MediaDeviceFailure.PermissionDenied:
      return 'Microphone/camera permission was denied.';
    case MediaDeviceFailure.NotFound:
      return 'No microphone or camera was found.';
    case MediaDeviceFailure.DeviceInUse:
      return 'Your microphone or camera is being used by another app.';
    default:
      return 'Could not start your microphone or camera.';
  }
};

const IS_TOUCH_DEVICE =
  typeof navigator !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

const SCREEN_SHARE_SUPPORTED =
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
  !IS_NATIVE;

// ─────────────────────────────────────────────────────────────────────
// Keep-alive hooks (call keeps running when the user leaves the app)
// ─────────────────────────────────────────────────────────────────────

/**
 * Android (Capacitor): starts a foreground service with the microphone
 * type so the OS keeps the process + mic alive while the app is in the
 * background. Shows a persistent "call in progress" notification.
 */
const useBackgroundCall = (active) => {
  useEffect(() => {
    if (!active || !IS_NATIVE) return undefined;

    let cancelled = false;
    let BackgroundMode = null;

    (async () => {
      try {
        const mod = await import('@anuradev/capacitor-background-mode');
        if (cancelled) return;
        BackgroundMode = mod.BackgroundMode;

        await BackgroundMode.requestNotificationsPermission?.();
        await BackgroundMode.requestMicrophonePermission?.();
        if (cancelled) return;

        await BackgroundMode.enable({
          title: 'Xircle call in progress',
          text: 'Tap to return to your call',
          allowMicrophoneInBackground: true,
        });
      } catch (err) {
        console.warn('[background] enable failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      try {
        BackgroundMode?.disable?.()?.catch?.(() => {});
      } catch {}
    };
  }, [active]);
};

/** Android back button minimizes the app (call keeps running) instead of leaving the screen. */
const useMinimizeOnBack = (active) => {
  useEffect(() => {
    if (!active || !IS_NATIVE) return undefined;

    let cancelled = false;
    let handle = null;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const h = await App.addListener('backButton', () => {
          App.minimizeApp?.();
        });
        if (cancelled) {
          h.remove();
        } else {
          handle = h;
        }
      } catch (err) {
        console.warn('[back] listener failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      try {
        handle?.remove?.();
      } catch {}
    };
  }, [active]);
};

/** Keep the screen awake while in a call (re-acquired after returning to the app). */
const useWakeLock = (active) => {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) {
      return undefined;
    }
    let lock = null;
    let released = false;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* not allowed right now */
      }
    };
    acquire();

    const onVis = () => {
      if (document.visibilityState === 'visible' && !released) acquire();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVis);
      try {
        lock?.release?.().catch(() => {});
      } catch {}
    };
  }, [active]);
};

// ─────────────────────────────────────────────────────────────────────
// AI helpers — audio playback, voice recorder, live transcript
// ─────────────────────────────────────────────────────────────────────
const playAudioDataUrl = (base64, format = 'wav', onEnded) => {
  try {
    const audio = new Audio(`data:audio/${format};base64,${base64}`);
    audio.play().catch((e) => console.error('[audio] play failed:', e));
    audio.onended = () => onEnded?.();
    return audio;
  } catch (err) {
    console.error('[audio] failed:', err);
    return null;
  }
};

const useVoiceRecorder = () => {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const start = useCallback(async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.error('[voice] start failed:', err);
      toast.error('Could not access microphone.');
    }
  }, [recording]);

  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const mr = mediaRecorderRef.current;
        if (!mr) {
          resolve(null);
          return;
        }
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          chunksRef.current = [];
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          mediaRecorderRef.current = null;
          setRecording(false);
          resolve(blob);
        };
        try {
          mr.stop();
        } catch {
          resolve(null);
        }
      }),
    []
  );

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
    },
    []
  );

  return { recording, start, stop };
};

const useLiveTranscript = ({ enabled, onFinal }) => {
  const recognitionRef = useRef(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    const SR =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;

    setSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) onFinalRef.current?.(text);
      }
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[SR] error:', e.error);
      }
    };

    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (enabled && !listening) {
      try {
        rec.start();
        setListening(true);
      } catch {}
    } else if (!enabled && listening) {
      try {
        rec.stop();
      } catch {}
      setListening(false);
    }
  }, [enabled, listening]);

  return { supported, listening };
};

// ─────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────
const Avatar = ({ info, size, brandColor = BRAND }) => {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (info.profile) {
    return (
      <img
        src={info.profile}
        alt={info.name}
        style={style}
        className="rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div
      style={{ ...style, backgroundColor: brandColor }}
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
    >
      {info.name.charAt(0).toUpperCase()}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Controls / generic UI primitives
// ─────────────────────────────────────────────────────────────────────
const CtrlBtn = ({
  onClick,
  label,
  tone = 'neutral',
  children,
  className = '',
}) => {
  const tones = {
    neutral: 'bg-white/10 hover:bg-white/20 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    active: 'bg-teal-600 hover:bg-teal-700 text-white',
  };
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
};

const Sheet = ({ open, onClose, title, children, maxWidth = 'sm:max-w-md' }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`bg-[#14141a] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full ${maxWidth} p-4`}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-gray-400 hover:text-white rounded-lg"
          >
            <FaTimes />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Participant tile
// ─────────────────────────────────────────────────────────────────────
const ParticipantCard = ({
  participant,
  cameraRef,
  variant,
  brandColor = BRAND,
  active,
  onClick,
}) => {
  const isSpeaking = useIsSpeaking(participant);
  const micMuted = useIsMuted(Track.Source.Microphone, { participant });
  const info = getInfo(participant);
  const isMain = variant === 'main';
  const camOn = !!cameraRef && !cameraRef.publication?.isMuted;

  const ringStyle = isSpeaking
    ? { boxShadow: `0 0 0 3px ${brandColor}` }
    : active
    ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.35)' }
    : {};

  return (
    <div
      onClick={onClick}
      style={ringStyle}
      className={`relative overflow-hidden bg-[#1a1a24] transition-shadow ${
        isMain
          ? 'w-full h-full rounded-2xl'
          : 'w-28 h-20 sm:w-36 sm:h-24 rounded-xl flex-shrink-0 cursor-pointer'
      }`}
    >
      {camOn ? (
        <VideoTrack
          trackRef={cameraRef}
          className="w-full h-full object-cover"
          style={participant.isLocal ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-2">
          <Avatar info={info} size={isMain ? 112 : 36} brandColor={brandColor} />
          {isMain && (
            <div className="text-center">
              <p className="text-xl font-semibold">
                {info.name}
                {participant.isLocal ? ' (You)' : ''}
              </p>
              {info.username && (
                <p className="text-sm text-gray-400">@{info.username}</p>
              )}
            </div>
          )}
        </div>
      )}

      {(!isMain || camOn) && (
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1 bg-black/55 rounded-md px-2 py-0.5 text-[11px] sm:text-xs">
          {micMuted && (
            <FaMicrophoneSlash className="text-red-400 flex-shrink-0" />
          )}
          <span className="truncate">
            {participant.isLocal ? 'You' : info.name}
          </span>
        </div>
      )}

      {isMain && (
        <>
          {micMuted && (
            <div className="absolute top-3 right-3 bg-black/55 rounded-lg p-2">
              <FaMicrophoneSlash className="text-red-400" />
            </div>
          )}
          {isSpeaking && (
            <div className="absolute top-3 left-3 flex items-end gap-[3px] h-5 bg-black/55 rounded-lg px-3 py-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full call-bar"
                  style={{
                    backgroundColor: brandColor,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Round camera bubble pinned top-right over a shared screen.
 * Shows the presenter's face (or avatar if their camera is off).
 */
const PipBubble = ({ participant, cameraRef, brandColor = BRAND }) => {
  const isSpeaking = useIsSpeaking(participant);
  const micMuted = useIsMuted(Track.Source.Microphone, { participant });
  const info = getInfo(participant);
  const camOn = !!cameraRef && !cameraRef.publication?.isMuted;

  return (
    <div
      className="absolute top-3 right-3 z-10 w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-[#1a1a24] shadow-2xl"
      style={{
        border: `3px solid ${isSpeaking ? brandColor : 'rgba(255,255,255,0.25)'}`,
      }}
    >
      {camOn ? (
        <VideoTrack
          trackRef={cameraRef}
          className="w-full h-full object-cover"
          style={participant.isLocal ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Avatar info={info} size={56} brandColor={brandColor} />
        </div>
      )}
      {micMuted && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/70 rounded-full p-1">
          <FaMicrophoneSlash className="text-red-400 text-[10px]" />
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// AI + meeting UI
// ═════════════════════════════════════════════════════════════════════
const FloatingReactions = ({ reactions }) => (
  <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
    {reactions.map((r) => {
      // stable position per reaction (Math.random in render made them jump)
      const seed = parseInt(String(r._id).slice(0, 4), 36) || 0;
      return (
        <div
          key={r._id}
          className="absolute text-4xl"
          style={{
            left: `${10 + (seed % 80)}%`,
            bottom: '15%',
            animation: 'float-up 3s ease-out forwards',
          }}
        >
          {r.emoji}
        </div>
      );
    })}
    <style>{`
      @keyframes float-up {
        0%   { transform: translateY(0)    scale(1);   opacity: 1; }
        100% { transform: translateY(-60vh) scale(1.6); opacity: 0; }
      }
    `}</style>
  </div>
);

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🎉', '🔥', '👎'];

const ReactionPicker = ({ open, onClose, onPick }) => (
  <Sheet
    open={open}
    onClose={onClose}
    title="Send a reaction"
    maxWidth="sm:max-w-sm"
  >
    <div className="grid grid-cols-4 gap-2">
      {REACTION_EMOJIS.map((e) => (
        <button
          key={e}
          onClick={() => {
            onPick(e);
            onClose();
          }}
          className="h-12 rounded-lg hover:bg-white/10 text-2xl transition"
        >
          {e}
        </button>
      ))}
    </div>
  </Sheet>
);

const DataSaverMenu = ({ open, onClose, dataSaver, onChange }) => {
  const qualities = [
    { v: 'auto', label: 'Auto' },
    { v: 'low', label: 'Low' },
    { v: 'medium', label: 'Med' },
    { v: 'high', label: 'High' },
  ];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Data saver"
      maxWidth="sm:max-w-sm"
    >
      <label className="flex items-center gap-2 py-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!dataSaver.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
        />
        <span className="text-sm text-gray-200">Enable data saver</span>
      </label>
      <label className="flex items-center gap-2 py-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!dataSaver.audioOnly}
          onChange={(e) => onChange({ audioOnly: e.target.checked })}
        />
        <span className="text-sm text-gray-200">Audio only (no video)</span>
      </label>
      <div className="mt-2">
        <p className="text-xs text-gray-400 mb-1.5">Video quality</p>
        <div className="grid grid-cols-4 gap-1">
          {qualities.map((q) => (
            <button
              key={q.v}
              onClick={() => onChange({ videoQuality: q.v })}
              className={`text-xs py-2 rounded-lg transition ${
                dataSaver.videoQuality === q.v
                  ? 'bg-teal-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
};

/** Audio output (loudspeaker / earpiece / headset) picker. */
const SpeakerMenu = ({
  open,
  onClose,
  outputs,
  currentId,
  onSelect,
  supported,
}) => (
  <Sheet
    open={open}
    onClose={onClose}
    title="Audio output"
    maxWidth="sm:max-w-sm"
  >
    {!supported && (
      <div className="text-sm text-gray-400 leading-relaxed">
        This browser doesn't let apps choose the audio output. On iOS, call
        audio always plays through the speaker — set the device volume / mute
        switch to control it.
      </div>
    )}
    {supported && outputs.length === 0 && (
      <p className="text-sm text-gray-400">
        No audio output devices found. Try again after a call starts.
      </p>
    )}
    {supported && outputs.length > 0 && (
      <div className="space-y-1">
        {outputs.map((o) => {
          const selected = currentId === o.deviceId;
          return (
            <button
              key={o.deviceId}
              onClick={() => {
                onSelect(o.deviceId);
                onClose();
              }}
              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between text-sm transition ${
                selected
                  ? 'bg-teal-600/20 text-teal-300'
                  : 'bg-white/5 text-gray-200 hover:bg-white/10'
              }`}
            >
              <span className="truncate">
                {o.label || `Audio device (${o.deviceId.slice(0, 6)})`}
              </span>
              {selected && <FaTimes className="text-[0px]" />}
            </button>
          );
        })}
      </div>
    )}
  </Sheet>
);

const MoreMenu = ({ open, onClose, brandColor, items }) => (
  <Sheet open={open} onClose={onClose} title="More options">
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <button
          key={it.label}
          onClick={() => {
            onClose();
            it.onClick();
          }}
          className={`flex flex-col items-center gap-2 p-3 rounded-xl transition text-gray-200 ${
            it.active ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'
          }`}
        >
          <span
            className="text-lg"
            style={it.active ? { color: brandColor } : undefined}
          >
            {it.icon}
          </span>
          <span className="text-[11px] text-center leading-tight">
            {it.label}
          </span>
        </button>
      ))}
    </div>
  </Sheet>
);

// ─────────────────────────────────────────────────────────────────────
// AI Panel
// ─────────────────────────────────────────────────────────────────────
const AIPanel = ({
  open,
  onClose,
  tab,
  setTab,
  brandColor,
  aiEnabled,
  transcriptSupported,
  transcript,
  liveSummary,
  exchanges,
  chatMessages,
  noteReady,
  askText,
  setAskText,
  onAskText,
  askingText,
  onAskVoiceStart,
  onAskVoiceStop,
  voiceRecording,
  askingVoice,
  chatText,
  setChatText,
  onSendChat,
  meId,
}) => {
  if (!open) return null;

  const tabs = [
    { id: 'summary', label: 'Summary', icon: <FaBrain /> },
    { id: 'transcript', label: 'Transcript', icon: <FaCommentDots /> },
    { id: 'ask', label: 'Ask AI', icon: <FaQuestionCircle /> },
    { id: 'chat', label: 'Chat', icon: <FaLightbulb /> },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex sm:items-stretch sm:justify-end">
      <div className="flex-1 bg-black/40" onClick={onClose} />

      <div className="w-full sm:w-[420px] h-[85dvh] sm:h-full bg-[#0f0f15] border-l border-white/10 flex flex-col sm:rounded-none rounded-t-2xl shadow-2xl overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-2">
            <FaRobot style={{ color: brandColor }} />
            <h3 className="text-base font-semibold">Xircle AI</h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md ${
                aiEnabled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {aiEnabled ? 'LIVE' : 'OFF'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex border-b border-white/10 flex-shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-medium flex flex-col items-center gap-1 transition ${
                tab === t.id ? 'text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
              style={
                tab === t.id
                  ? { borderBottom: `2px solid ${brandColor}` }
                  : { borderBottom: '2px solid transparent' }
              }
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {tab === 'summary' && (
            <div className="space-y-4">
              {!aiEnabled && (
                <div className="text-sm text-gray-400">
                  Turn on AI to start recording notes. The summary will update
                  live as people speak.
                </div>
              )}
              {aiEnabled && !liveSummary && (
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <FaSpinner className="animate-spin" /> Listening for context…
                </div>
              )}
              {liveSummary && (
                <>
                  {liveSummary.text && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                        Live summary
                      </p>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">
                        {liveSummary.text}
                      </p>
                    </div>
                  )}
                  {liveSummary.keyPoints?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                        Key points
                      </p>
                      <ul className="text-sm text-gray-200 list-disc pl-5 space-y-1">
                        {liveSummary.keyPoints.map((k, i) => (
                          <li key={i}>{k}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {liveSummary.actionItems?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                        Action items
                      </p>
                      <ul className="text-sm text-gray-200 space-y-1">
                        {liveSummary.actionItems.map((a, i) => (
                          <li key={i} className="flex gap-2">
                            <span style={{ color: brandColor }}>•</span>
                            <span>
                              {a.text}
                              {a.assignee && (
                                <span className="text-gray-400">
                                  {' '}
                                  — {a.assignee}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              {noteReady?.noteId && (
                <div className="rounded-lg bg-teal-500/10 border border-teal-500/30 px-3 py-2 text-xs text-teal-200">
                  <FaBookOpen className="inline mr-1" />
                  Notes saved — see the ended screen to open them.
                </div>
              )}
            </div>
          )}

          {tab === 'transcript' && (
            <div className="space-y-2">
              {!transcriptSupported && aiEnabled && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-300">
                  Live transcription isn't supported in this browser. Use
                  Ask-AI or in-call chat — both still work.
                </div>
              )}
              {!aiEnabled && (
                <div className="text-sm text-gray-400">
                  Turn on AI to start the transcript.
                </div>
              )}
              {aiEnabled && transcript.length === 0 && (
                <div className="text-sm text-gray-400">
                  Waiting for the first words…
                </div>
              )}
              {transcript.map((s, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium" style={{ color: brandColor }}>
                    {s.speakerName || 'Someone'}:
                  </span>{' '}
                  <span className="text-gray-200">{s.text}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'ask' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Ask about anything in the call. Voice answers play out loud.
              </p>

              <div className="flex items-center gap-2">
                <input
                  value={askText}
                  onChange={(e) => setAskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onAskText();
                    }
                  }}
                  placeholder="What did we decide?"
                  className="flex-1 px-3 py-2.5 bg-[#0b0b10] border border-white/10 rounded-lg text-sm text-white outline-none focus:border-teal-500"
                />
                <button
                  onClick={onAskText}
                  disabled={askingText || !askText.trim()}
                  className="w-11 h-11 rounded-lg flex items-center justify-center disabled:opacity-60"
                  style={{ backgroundColor: brandColor }}
                >
                  {askingText ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <FaPaperPlane />
                  )}
                </button>
              </div>

              <button
                onMouseDown={onAskVoiceStart}
                onMouseUp={onAskVoiceStop}
                onTouchStart={onAskVoiceStart}
                onTouchEnd={onAskVoiceStop}
                disabled={askingVoice}
                className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                  voiceRecording
                    ? 'bg-red-600 text-white'
                    : 'bg-white/10 hover:bg-white/15 text-white'
                } disabled:opacity-60`}
              >
                {askingVoice ? (
                  <>
                    <FaSpinner className="animate-spin" /> Thinking…
                  </>
                ) : voiceRecording ? (
                  <>
                    <FaCircle className="text-xs animate-pulse" /> Release to ask
                  </>
                ) : (
                  <>
                    <FaMicrophone /> Hold to ask by voice
                  </>
                )}
              </button>

              <div className="space-y-3 pt-2">
                {exchanges.length === 0 && (
                  <p className="text-xs text-gray-500">
                    Your questions and answers will appear here.
                  </p>
                )}
                {exchanges.map((x, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-xs text-gray-400">{x.question}</p>
                    <div
                      className="rounded-lg px-3 py-2 text-sm text-gray-100"
                      style={{ backgroundColor: `${brandColor}22` }}
                    >
                      {x.answer}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'chat' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Send a message if your mic is noisy or your network is slow.
              </p>
              <div className="space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-gray-500">No messages yet.</p>
                )}
                {chatMessages.map((m, i) => {
                  const mine = String(m.sender) === String(meId);
                  return (
                    <div
                      key={i}
                      className={`text-sm flex ${
                        mine ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-1.5 rounded-xl ${
                          mine ? 'text-white' : 'bg-white/10 text-gray-100'
                        }`}
                        style={mine ? { backgroundColor: brandColor } : undefined}
                      >
                        {!mine && m.senderName && (
                          <p className="text-[10px] text-gray-400 mb-0.5">
                            {m.senderName}
                          </p>
                        )}
                        {m.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {tab === 'chat' && (
          <div
            className="border-t border-white/10 p-3 flex items-center gap-2 flex-shrink-0"
            style={{
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSendChat();
                }
              }}
              placeholder="Type a message…"
              className="flex-1 px-3 py-2 bg-[#0b0b10] border border-white/10 rounded-lg text-sm text-white outline-none"
            />
            <button
              onClick={onSendChat}
              disabled={!chatText.trim()}
              className="w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-60"
              style={{ backgroundColor: brandColor }}
            >
              <FaPaperPlane />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// In-call stage (must live INSIDE <LiveKitRoom>)
// ─────────────────────────────────────────────────────────────────────
const CallStage = ({
  isVideo,
  brandColor,
  onHangUp,
  onEndForAll,
  isCreator,
  deviceError,
  call,
  onCopyLink,
  aiEnabled,
  aiStarting,
  onStartAI,
  onStopAI,
  transcriptSupported,
  onTranscriptSegment,
  onOpenAIPanel,
  transcriptCount,
  handRaised,
  onToggleHand,
  onReact,
  raisedHands,
  dataSaver,
  onDataSaverChange,
  reactions,
}) => {
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const speaking = useSpeakingParticipants();
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();
  const room = useRoomContext();

  const [pinned, setPinned] = useState(null);
  const [lastSpeaker, setLastSpeaker] = useState(null);
  const [secs, setSecs] = useState(0);
  const [endMenuOpen, setEndMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [dataSaverOpen, setDataSaverOpen] = useState(false);
  const [speakerOpen, setSpeakerOpen] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [currentSinkId, setCurrentSinkId] = useState('default');
  const [flipping, setFlipping] = useState(false);

  const localScreenShare = screenTracks.find(
    (t) => t.participant.isLocal && !t.publication?.isMuted
  );
  const remoteScreenShare = screenTracks.find(
    (t) => !t.participant.isLocal && !t.publication?.isMuted
  );
  // A remote share always wins the main stage; your own share is shown
  // as a "you're sharing" card (rendering it would create a mirror tunnel).
  const activeScreen = remoteScreenShare || localScreenShare;
  const isSharingScreen = !!isScreenShareEnabled;

  const sinkSupported =
    typeof window !== 'undefined' &&
    'setSinkId' in HTMLMediaElement.prototype;

  // ── Enumerate audio output devices ──
  const refreshOutputs = useCallback(async () => {
    if (!sinkSupported || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outs = devices.filter((d) => d.kind === 'audiooutput');
      setAudioOutputs(outs);
      if (!currentSinkId || currentSinkId === 'default') {
        const def =
          outs.find((d) => d.deviceId === 'default') || outs[0] || null;
        if (def) setCurrentSinkId(def.deviceId);
      }
    } catch (err) {
      console.warn('[speaker] enumerate failed:', err);
    }
  }, [sinkSupported, currentSinkId]);

  useEffect(() => {
    refreshOutputs();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshOutputs);
    return () =>
      navigator.mediaDevices?.removeEventListener?.(
        'devicechange',
        refreshOutputs
      );
  }, [refreshOutputs]);

  // ── Change audio output ──
  const handleChangeOutput = useCallback(
    async (deviceId) => {
      try {
        if (room?.switchActiveDevice) {
          await room.switchActiveDevice('audiooutput', deviceId);
        } else {
          const els = document.querySelectorAll('audio');
          for (const el of els) {
            try {
              await el.setSinkId(deviceId);
            } catch {
              /* ignore */
            }
          }
        }
        setCurrentSinkId(deviceId);
        toast.success('Audio output changed');
      } catch (err) {
        console.error('[speaker] switch failed:', err);
        toast.error('Could not switch audio output.');
      }
    },
    [room]
  );

  // ── Camera flip (front/back) ──
  const flipCamera = useCallback(async () => {
    if (!localParticipant || !room || flipping) return;
    setFlipping(true);
    try {
      const videoPub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = videoPub?.videoTrack;
      if (!track) {
        toast.info('Turn your camera on first.');
        return;
      }
      const settings = track.mediaStreamTrack?.getSettings?.() || {};
      const currentFacing = settings.facingMode;

      if (currentFacing) {
        const nextFacing =
          currentFacing === 'user' ? 'environment' : 'user';
        try {
          await track.restartTrack({ facingMode: nextFacing });
          return;
        } catch (e) {
          console.warn('[flip] restartTrack failed, falling back:', e);
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === 'videoinput');
      if (cams.length <= 1) {
        toast.info('No other camera found.');
        return;
      }
      const currentId = settings.deviceId;
      const next = cams.find((c) => c.deviceId !== currentId) || cams[0];
      await room.switchActiveDevice('videoinput', next.deviceId);
    } catch (err) {
      console.error('[flip] failed:', err);
      toast.error('Could not switch camera.');
    } finally {
      setFlipping(false);
    }
  }, [localParticipant, room, flipping]);

  // ── Screen share (camera is untouched, so your face stays in the bubble) ──
  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;

    if (!SCREEN_SHARE_SUPPORTED) {
      toast.info(
        'Screen sharing from a phone or the app isn’t supported yet. Use a desktop browser to share.'
      );
      return;
    }

    const enabling = !isSharingScreen;

    try {
      await localParticipant.setScreenShareEnabled(
        enabling,
        enabling ? { audio: true } : undefined
      );
    } catch (err) {
      console.error('[screen] failed:', err?.name, err?.message, err);

      const msg = String(err?.message || '');
      if (
        err?.name === 'NotAllowedError' &&
        /permission denied|cancel/i.test(msg)
      ) {
        // user closed the picker, ignore
        return;
      }
      if (err?.name === 'NotAllowedError') {
        toast.error('Screen share was blocked. Check browser permissions.');
      } else if (
        /not supported|unsupported/i.test(msg) ||
        err?.name === 'NotSupportedError'
      ) {
        toast.info('Screen sharing is not supported on this device.');
      } else if (/permission|publish|not allowed/i.test(msg)) {
        toast.error('You are not allowed to share your screen in this call.');
      } else {
        toast.error(
          `Could not share screen: ${msg || err?.name || 'unknown error'}`
        );
      }
    }
  }, [localParticipant, isSharingScreen]);

  // ── AI STT ──
  useLiveTranscript({
    enabled: aiEnabled && isMicrophoneEnabled && transcriptSupported,
    onFinal: onTranscriptSegment,
  });

  // ── Apply data saver ──
  useEffect(() => {
    if (!localParticipant) return;
    try {
      if (dataSaver?.audioOnly && isCameraEnabled) {
        localParticipant.setCameraEnabled(false).catch(() => {});
      }
      if (dataSaver?.videoQuality === 'low') {
        localParticipant.setVideoQuality?.(VideoQuality.LOW);
      } else if (dataSaver?.videoQuality === 'medium') {
        localParticipant.setVideoQuality?.(VideoQuality.MEDIUM);
      } else if (dataSaver?.videoQuality === 'high') {
        localParticipant.setVideoQuality?.(VideoQuality.HIGH);
      }
    } catch (err) {
      console.warn('[dataSaver] apply failed:', err);
    }
  }, [dataSaver, localParticipant, isCameraEnabled]);

  // ── Bring the camera back after the app returns from the background ──
  // Android stops camera capture while backgrounded (audio keeps going via
  // the foreground service). Restart it when the user comes back.
  useEffect(() => {
    if (!localParticipant) return undefined;
    let camWasOn = false;

    const onVis = async () => {
      if (document.visibilityState === 'hidden') {
        camWasOn = !!localParticipant.isCameraEnabled;
        return;
      }
      if (!camWasOn) return;
      camWasOn = false;
      try {
        const pub = localParticipant.getTrackPublication(Track.Source.Camera);
        const ms = pub?.videoTrack?.mediaStreamTrack;
        if (!ms || ms.readyState === 'ended' || pub?.isMuted) {
          await localParticipant.setCameraEnabled(false);
          await localParticipant.setCameraEnabled(true);
        }
      } catch (err) {
        console.warn('[camera] resume failed:', err);
      }
    };

    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [localParticipant]);

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const remote = speaking.find((p) => !p.isLocal);
    if (remote) setLastSpeaker(remote.identity);
  }, [speaking]);

  const remotes = participants.filter((p) => !p.isLocal);
  const mainP =
    participants.find((p) => p.identity === pinned) ||
    remotes.find((p) => p.identity === lastSpeaker) ||
    remotes[0] ||
    localParticipant;

  const camRefFor = (p) =>
    cameraTracks.find((t) => t.participant.identity === p.identity);

  const toggleMic = async () => {
    try {
      await localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.error('[call] toggle mic failed:', err);
    }
  };

  const toggleCam = async () => {
    try {
      await localParticipant?.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error('[call] toggle camera failed:', err);
    }
  };

  const showEndMenu =
    isCreator &&
    remotes.length > 0 &&
    (call?.isMeeting || (call?.participants || []).length > 2);

  const handsUpCount = raisedHands?.length || 0;

  // Camera button shows in video calls, and also whenever you're sharing
  // (so voice-call users can add their face to a screen share).
  const showCameraControls = isVideo || isSharingScreen || isCameraEnabled;

  // Build More items
  const moreItems = [];
  if (SCREEN_SHARE_SUPPORTED) {
    moreItems.push({
      label: isSharingScreen ? 'Stop share' : 'Share screen',
      icon: <FaDesktop />,
      active: isSharingScreen,
      onClick: toggleScreenShare,
    });
  }
  moreItems.push({
    label: 'Audio output',
    icon: <FaVolumeUp />,
    onClick: () => {
      refreshOutputs();
      setSpeakerOpen(true);
    },
  });
  moreItems.push({
    label: handRaised ? 'Lower hand' : 'Raise hand',
    icon: <FaHandPaper />,
    active: handRaised,
    onClick: onToggleHand,
  });
  moreItems.push({
    label: 'React',
    icon: <FaSmile />,
    onClick: () => setReactionPickerOpen(true),
  });
  moreItems.push({
    label: 'Data saver',
    icon: <FaWifi />,
    active: !!dataSaver?.enabled,
    onClick: () => setDataSaverOpen(true),
  });
  if (call?.isMeeting && call?.meetingLink) {
    moreItems.push({
      label: 'Copy link',
      icon: <FaLink />,
      onClick: onCopyLink,
    });
  }

  const presenter = activeScreen?.participant;

  return (
    <div className="h-dvh bg-[#0b0b10] text-white flex flex-col">
      <style>{`
        @keyframes call-bar-anim { 0%,100% { height: 4px } 50% { height: 16px } }
        .call-bar { height: 4px; animation: call-bar-anim 0.8s ease-in-out infinite; }
      `}</style>

      <FloatingReactions reactions={reactions} />

      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-white/10 gap-2"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold truncate flex items-center gap-2">
            {call?.isMeeting
              ? 'Meeting'
              : isVideo
              ? 'Video Call'
              : 'Voice Call'}
            {aiEnabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 flex items-center gap-1">
                <FaRobot /> AI
              </span>
            )}
            {isSharingScreen && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 flex items-center gap-1">
                <FaDesktop /> Sharing
              </span>
            )}
            {handsUpCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 flex items-center gap-1">
                <FaHandPaper /> {handsUpCount}
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-400 truncate">
            {participants.length} participant
            {participants.length === 1 ? '' : 's'}
            {call?.isMeeting && call?.meetingCode && (
              <span className="ml-2 text-gray-500">· {call.meetingCode}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={aiEnabled ? onStopAI : onStartAI}
            disabled={aiStarting}
            title={aiEnabled ? 'Stop AI notes' : 'Start AI notes'}
            className={`h-9 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition ${
              aiEnabled
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-white/10 hover:bg-white/20'
            } disabled:opacity-60`}
          >
            {aiStarting ? (
              <FaSpinner className="animate-spin text-[10px]" />
            ) : (
              <FaRobot className="text-sm" />
            )}
            <span className="hidden sm:inline">
              {aiEnabled ? 'Stop AI' : 'Start AI'}
            </span>
          </button>
          <span className="text-sm tabular-nums text-gray-300 ml-1">
            {formatClock(secs)}
          </span>
        </div>
      </div>

      {deviceError && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-300">
          <FaExclamationTriangle className="flex-shrink-0" />
          <span>{deviceError}</span>
        </div>
      )}

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto px-3 py-3 flex-shrink-0">
        {participants.map((p) => (
          <ParticipantCard
            key={p.identity}
            participant={p}
            cameraRef={camRefFor(p)}
            variant="thumb"
            brandColor={brandColor}
            active={p.identity === mainP?.identity}
            onClick={() => setPinned(p.identity)}
          />
        ))}
      </div>

      {/* Main tile — screen share takes priority, presenter's face in the corner */}
      <div className="flex-1 min-h-0 px-3 pb-3">
        {activeScreen ? (
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black">
            {activeScreen.participant.isLocal ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center px-6">
                <FaDesktop className="text-4xl" style={{ color: brandColor }} />
                <div>
                  <p className="text-lg font-semibold">
                    You’re sharing your screen
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Everyone in the call can see it.
                  </p>
                </div>
                <button
                  onClick={toggleScreenShare}
                  className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium"
                >
                  Stop sharing
                </button>
              </div>
            ) : (
              <VideoTrack
                trackRef={activeScreen}
                className="w-full h-full object-contain"
              />
            )}

            <div className="absolute bottom-2 left-2 bg-black/70 rounded-md px-2 py-1 text-xs flex items-center gap-1.5">
              <FaDesktop className="text-[10px]" />
              {activeScreen.participant.isLocal
                ? 'Your screen'
                : `${getInfo(activeScreen.participant).name}'s screen`}
            </div>

            {presenter && (
              <PipBubble
                participant={presenter}
                cameraRef={camRefFor(presenter)}
                brandColor={brandColor}
              />
            )}
          </div>
        ) : mainP ? (
          <ParticipantCard
            participant={mainP}
            cameraRef={camRefFor(mainP)}
            variant="main"
            brandColor={brandColor}
          />
        ) : null}
      </div>

      <RoomAudioRenderer />
      <StartAudio
        label="Tap to enable audio"
        className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-white text-gray-900 font-medium shadow-lg"
      />

      {/* Floating AI panel button */}
      <button
        onClick={onOpenAIPanel}
        className="fixed bottom-24 right-3 z-[65] w-12 h-12 rounded-xl flex items-center justify-center shadow-xl transition active:scale-95"
        style={{ backgroundColor: brandColor }}
        title="Open AI panel"
      >
        <FaRobot className="text-lg" />
        {transcriptCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-md min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {transcriptCount > 99 ? '99+' : transcriptCount}
          </span>
        )}
      </button>

      {/* Primary control bar */}
      <div
        className="px-3 py-3 bg-white/5 border-t border-white/10 flex items-center justify-center gap-1.5 sm:gap-2"
        style={{
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <CtrlBtn
          onClick={toggleMic}
          label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
          tone={isMicrophoneEnabled ? 'neutral' : 'danger'}
        >
          {isMicrophoneEnabled ? (
            <FaMicrophone className="text-lg" />
          ) : (
            <FaMicrophoneSlash className="text-lg" />
          )}
        </CtrlBtn>

        {showCameraControls && (
          <CtrlBtn
            onClick={toggleCam}
            label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
            tone={isCameraEnabled ? 'neutral' : 'danger'}
          >
            {isCameraEnabled ? (
              <FaVideo className="text-lg" />
            ) : (
              <FaVideoSlash className="text-lg" />
            )}
          </CtrlBtn>
        )}

        {showCameraControls && isCameraEnabled && IS_TOUCH_DEVICE && (
          <CtrlBtn
            onClick={flipCamera}
            label="Switch camera"
            tone="neutral"
            className={flipping ? 'opacity-60' : ''}
          >
            {flipping ? (
              <FaSpinner className="animate-spin text-lg" />
            ) : (
              <FaSyncAlt className="text-lg" />
            )}
          </CtrlBtn>
        )}

        {SCREEN_SHARE_SUPPORTED && (
          <CtrlBtn
            onClick={toggleScreenShare}
            label={isSharingScreen ? 'Stop sharing' : 'Share screen'}
            tone={isSharingScreen ? 'active' : 'neutral'}
          >
            <FaDesktop className="text-lg" />
          </CtrlBtn>
        )}

        <CtrlBtn onClick={() => setMoreOpen(true)} label="More options">
          <FaEllipsisH className="text-lg" />
        </CtrlBtn>

        <button
          onClick={() => (showEndMenu ? setEndMenuOpen((v) => !v) : onHangUp())}
          onContextMenu={(e) => {
            if (showEndMenu) {
              e.preventDefault();
              setEndMenuOpen(true);
            }
          }}
          className="h-11 sm:h-12 px-3 sm:px-5 ml-1 rounded-xl bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2 transition text-white font-medium shadow-md"
          aria-label="Leave call"
        >
          <FaPhoneSlash className="text-lg" />
          <span className="hidden sm:inline text-sm">Leave</span>
        </button>
      </div>

      {/* Overlays */}
      <MoreMenu
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        brandColor={brandColor}
        items={moreItems}
      />

      <ReactionPicker
        open={reactionPickerOpen}
        onClose={() => setReactionPickerOpen(false)}
        onPick={onReact}
      />

      <DataSaverMenu
        open={dataSaverOpen}
        onClose={() => setDataSaverOpen(false)}
        dataSaver={dataSaver}
        onChange={onDataSaverChange}
      />

      <SpeakerMenu
        open={speakerOpen}
        onClose={() => setSpeakerOpen(false)}
        outputs={audioOutputs}
        currentId={currentSinkId}
        onSelect={handleChangeOutput}
        supported={sinkSupported}
      />

      {/* End-for-everyone dropdown */}
      {endMenuOpen && showEndMenu && (
        <>
          <div
            className="fixed inset-0 z-[75]"
            onClick={() => setEndMenuOpen(false)}
          />
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[80] bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden w-56">
            <button
              onClick={() => {
                setEndMenuOpen(false);
                onHangUp();
              }}
              className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/5 flex items-center gap-2"
            >
              <FaSignOutAlt className="text-xs" /> Leave only
            </button>
            <button
              onClick={() => {
                setEndMenuOpen(false);
                onEndForAll();
              }}
              className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 border-t border-white/5"
            >
              <FaPhoneSlash className="text-xs" /> End for everyone
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Full-screen wrapper
// ─────────────────────────────────────────────────────────────────────
const FullScreen = ({ children }) => (
  <div
    className="min-h-dvh bg-[#0b0b10] text-white flex flex-col items-center justify-center p-6"
    style={{
      paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
      paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
    }}
  >
    {children}
  </div>
);

// ═════════════════════════════════════════════════════════════════════
// MAIN — CallScreen
// ═════════════════════════════════════════════════════════════════════
const CallScreen = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userInfo } = useSelector((s) => s.auth);
  const socketContext = useSocket();
  const socket = socketContext?.socket;

  const callId = params.callId || params.roomId;
  const myId = String(userInfo?._id || '');

  const {
    data: callData,
    isLoading: callLoading,
    error: callError,
    refetch: refetchCall,
  } = useGetCallByIdQuery(callId, {
    skip: !callId || !userInfo,
    pollingInterval: POLL_MS,
    refetchOnFocus: true,
  });
  const call = callData?.call;

  const [getCallToken] = useGetCallTokenMutation();
  const [joinCall] = useJoinCallMutation();
  const [leaveCall] = useLeaveCallMutation();
  const [endCall] = useEndCallMutation();
  const [rejectCall] = useRejectCallMutation();

  const [startCallAI] = useStartCallAIMutation();
  const [stopCallAI] = useStopCallAIMutation();
  const [finalizeCallNotes] = useFinalizeCallNotesMutation();
  const [pushCallTranscript] = usePushCallTranscriptMutation();
  const [askCallAIText] = useAskCallAITextMutation();
  const [askCallAIVoice] = useAskCallAIVoiceMutation();
  const [sendInCallMessage] = useSendInCallMessageMutation();
  const [setRaisedHand] = useSetRaisedHandMutation();
  const [sendCallReaction] = useSendCallReactionMutation();
  const [updateCallDataSaver] = useUpdateCallDataSaverMutation();

  const [phase, setPhase] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [tokenData, setTokenData] = useState(null);
  const [permState, setPermState] = useState('idle');
  const [permError, setPermError] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const [connectionLost, setConnectionLost] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiTab, setAiTab] = useState('summary');
  const [aiStarting, setAiStarting] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [liveSummary, setLiveSummary] = useState(null);
  const [aiExchanges, setAiExchanges] = useState([]);
  const [inCallMessages, setInCallMessages] = useState([]);
  const [raisedHands, setRaisedHands] = useState([]);
  const [handRaised, setHandRaised] = useState(false);
  const [dataSaver, setDataSaver] = useState({
    enabled: false,
    audioOnly: false,
    videoQuality: 'auto',
  });
  const [reactions, setReactions] = useState([]);
  const [noteReady, setNoteReady] = useState(null);

  const [askText, setAskText] = useState('');
  const [askingText, setAskingText] = useState(false);
  const [askingVoice, setAskingVoice] = useState(false);
  const audioRef = useRef(null);

  const [chatText, setChatText] = useState('');

  const voiceRec = useVoiceRecorder();

  const leavingRef = useRef(false);
  const hasJoinedRef = useRef(false);

  const myParticipant = useMemo(
    () => call?.participants?.find((p) => getUserId(p) === myId),
    [call, myId]
  );
  const isCreator = String(call?.creator?._id || call?.creator || '') === myId;
  const wantsVideo = call?.type === 'video';
  const aiEnabled = !!call?.ai?.enabled;

  const canViewNote =
    !!noteReady && (noteReady.kind === 'WorkspaceNote' || isCreator);

  // ── Keep the call alive when the app is backgrounded ──
  const callIsLive = phase === 'in-call' && !!tokenData && !connectionLost;
  useBackgroundCall(callIsLive);
  useMinimizeOnBack(callIsLive);
  useWakeLock(callIsLive);

  const goBack = useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/calls', { replace: true });
    }
  }, [location.key, navigate]);

  useEffect(() => {
    if (!userInfo) navigate('/login', { replace: true });
  }, [userInfo, navigate]);

  useEffect(() => {
    if (!call) return;
    if (!myParticipant) {
      setPhase('error');
      setErrorMsg("You're not a participant in this call.");
      return;
    }

    const callIsOver = ['ended', 'missed', 'cancelled'].includes(call.status);
    const myStatus = myParticipant.status;

    if (myStatus === 'rejected' || myStatus === 'left') {
      setPhase('ended-for-you');
      return;
    }
    if (callIsOver) {
      setPhase('ended');
      return;
    }
    if (myStatus === 'accepted') {
      if (phase !== 'in-call' && phase !== 'joining') setPhase('joining');
      return;
    }
    if (['ringing', 'missed', 'pending'].includes(myStatus)) {
      if (phase !== 'in-call' && phase !== 'joining') setPhase('can-join');
      return;
    }
  }, [call, myParticipant, phase]);

  const runPermissionCheck = useCallback(async () => {
    setPermState('checking');
    setPermError('');
    const res = await ensureCallPermissions(wantsVideo);
    if (res.ok) {
      setPermState('granted');
      return true;
    }
    setPermState('denied');
    setPermError(res.message || 'Microphone permission is required.');
    return false;
  }, [wantsVideo]);

  const doJoin = useCallback(
    async ({ markAccepted = false } = {}) => {
      if (hasJoinedRef.current) return;
      hasJoinedRef.current = true;
      setPhase('joining');

      if (permState !== 'granted') {
        const ok = await runPermissionCheck();
        if (!ok) {
          hasJoinedRef.current = false;
          setPhase('can-join');
          return;
        }
      }

      if (markAccepted || myParticipant?.status !== 'accepted') {
        try {
          await joinCall(callId).unwrap();
        } catch (err) {
          const msg = err?.data?.message || 'Failed to join call';
          setErrorMsg(msg);
          setPhase('can-join');
          hasJoinedRef.current = false;
          toast.error(msg);
          return;
        }
      }

      try {
        const res = await getCallToken(callId).unwrap();

        if (Array.isArray(res.recentTranscript))
          setTranscript(res.recentTranscript);
        if (res.liveSummary) setLiveSummary(res.liveSummary);
        if (Array.isArray(res.recentMessages))
          setInCallMessages(res.recentMessages);
        if (Array.isArray(res.raisedHands)) {
          setRaisedHands(res.raisedHands);
          setHandRaised(res.raisedHands.some((h) => String(h.userId) === myId));
        }
        if (res.dataSaver) setDataSaver(res.dataSaver);

        setTokenData(res);
        setPhase('in-call');
      } catch (err) {
        const msg = err?.data?.message || 'Failed to get media token';
        setErrorMsg(msg);
        setPhase('can-join');
        hasJoinedRef.current = false;
        toast.error(msg);
      }
    },
    [
      callId,
      joinCall,
      getCallToken,
      myParticipant,
      permState,
      runPermissionCheck,
      myId,
    ]
  );

  useEffect(() => {
    if (
      phase === 'joining' &&
      !tokenData &&
      myParticipant?.status === 'accepted'
    ) {
      doJoin({ markAccepted: false });
    }
  }, [phase, tokenData, myParticipant, doJoin]);

  useEffect(() => {
    if (!socket || !call?.roomId) return;
    const room = call.roomId;
    socket.emit('join-call-room', room, () => {});

    const onEnded = () => {
      if (leavingRef.current) return;
      setPhase('ended');
      refetchCall?.();
    };
    const onTranscript = ({ callId: cid, segments }) => {
      if (String(cid) !== String(callId)) return;
      setTranscript((prev) => [...prev, ...segments].slice(-500));
    };
    const onSummary = ({ callId: cid, summary }) => {
      if (String(cid) !== String(callId)) return;
      setLiveSummary(summary);
    };
    const onExchange = (p) => {
      if (String(p.callId) !== String(callId)) return;
      setAiExchanges((prev) => [
        ...prev,
        { question: p.question, answer: p.answer, sources: p.sources },
      ]);
    };
    const onChat = (p) => {
      if (String(p.callId) !== String(callId)) return;
      setInCallMessages((prev) => [...prev, p.message]);
    };
    const onHand = (p) => {
      if (String(p.callId) !== String(callId)) return;
      setRaisedHands(p.raisedHands || []);
    };
    const onReaction = (p) => {
      if (String(p.callId) !== String(callId)) return;
      const id = Math.random().toString(36).slice(2);
      setReactions((prev) => [...prev, { ...p, _id: id }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r._id !== id));
      }, 3000);
    };
    const onNoteReady = (p) => {
      if (String(p.callId) !== String(callId)) return;
      setNoteReady({
        noteId: p.noteId,
        kind: p.kind,
        title: p.title,
      });
      toast.success('AI notes are ready!');
    };

    socket.on('call-ended', onEnded);
    socket.on('call-transcript-update', onTranscript);
    socket.on('call-summary-update', onSummary);
    socket.on('call-ai-exchange', onExchange);
    socket.on('call-chat-message', onChat);
    socket.on('call-hand-update', onHand);
    socket.on('call-reaction', onReaction);
    socket.on('call-note-ready', onNoteReady);

    return () => {
      socket.off('call-ended', onEnded);
      socket.off('call-transcript-update', onTranscript);
      socket.off('call-summary-update', onSummary);
      socket.off('call-ai-exchange', onExchange);
      socket.off('call-chat-message', onChat);
      socket.off('call-hand-update', onHand);
      socket.off('call-reaction', onReaction);
      socket.off('call-note-ready', onNoteReady);
      socket.emit('leave-call-room', room);
    };
  }, [socket, call?.roomId, callId, refetchCall]);

  const handleAnswer = () => doJoin({ markAccepted: true });

  const handleDecline = async () => {
    try {
      await rejectCall(callId).unwrap();
    } catch {}
    goBack();
  };

  const handleHangUp = useCallback(async () => {
    leavingRef.current = true;
    try {
      await leaveCall(callId).unwrap();
    } catch {}
    goBack();
  }, [callId, leaveCall, goBack]);

  const handleEndForAll = useCallback(async () => {
    leavingRef.current = true;
    try {
      await endCall(callId).unwrap();
    } catch {}
    goBack();
  }, [callId, endCall, goBack]);

  const handleDisconnected = useCallback(
    async (reason) => {
      if (leavingRef.current) return;
      if (reason === DisconnectReason.CLIENT_INITIATED) return;
      try {
        const result = await refetchCall().unwrap();
        if (['ended', 'missed', 'cancelled'].includes(result?.call?.status)) {
          setPhase('ended');
          return;
        }
      } catch {}
      setConnectionLost(true);
    },
    [refetchCall]
  );

  const handleDeviceFailure = useCallback((failure) => {
    console.error('[call] media device failure:', failure);
    setDeviceError(deviceFailureMessage(failure));
  }, []);

  const handleCopyLink = () => {
    if (!call?.meetingLink) return;
    navigator.clipboard.writeText(call.meetingLink);
    toast.success('Link copied — share it to invite guests');
  };

  // ── AI handlers ──
  const handleStartAI = useCallback(async () => {
    if (aiStarting) return;
    setAiStarting(true);
    try {
      await startCallAI({ callId }).unwrap();
      toast.success('AI notes started');
    } catch (err) {
      toast.error(err?.data?.message || 'Could not start AI');
    } finally {
      setAiStarting(false);
    }
  }, [aiStarting, callId, startCallAI]);

  const handleStopAI = useCallback(async () => {
    if (aiStarting) return;
    if (!window.confirm('Stop AI and generate the final notes?')) return;
    setAiStarting(true);
    try {
      const res = await stopCallAI(callId).unwrap();
      if (res?.created) {
        setNoteReady({
          noteId: res.noteId,
          kind: res.kind,
          title: res.title,
        });
        toast.success('Final notes saved!');
      } else if (res?.reason) {
        toast.info(res.reason);
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Could not stop AI');
    } finally {
      setAiStarting(false);
    }
  }, [aiStarting, callId, stopCallAI]);

  const handleTranscriptSegment = useCallback(
    (text) => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {}
        audioRef.current = null;
      }
      if (!aiEnabled || !callId || !text?.trim()) return;
      pushCallTranscript({
        callId,
        segments: [{ text: text.trim(), isFinal: true, at: new Date() }],
      }).catch(() => {});
    },
    [aiEnabled, callId, pushCallTranscript]
  );

  const handleAskText = useCallback(async () => {
    const q = askText.trim();
    if (!q || askingText) return;
    setAskingText(true);
    try {
      const res = await askCallAIText({
        callId,
        question: q,
        wantAudio: true,
      }).unwrap();
      setAskText('');
      setAiExchanges((prev) => [
        ...prev,
        { question: q, answer: res.answer, sources: res.sources },
      ]);
      if (res.audio?.base64) {
        audioRef.current = playAudioDataUrl(
          res.audio.base64,
          res.audio.format,
          () => {
            audioRef.current = null;
          }
        );
      }
    } catch (err) {
      toast.error(err?.data?.message || 'AI could not answer.');
    } finally {
      setAskingText(false);
    }
  }, [askText, askingText, callId, askCallAIText]);

  const handleAskVoiceStart = useCallback(async () => {
    if (askingVoice) return;
    await voiceRec.start();
  }, [askingVoice, voiceRec]);

  const handleAskVoiceStop = useCallback(async () => {
    const blob = await voiceRec.stop();
    if (!blob || blob.size === 0) return;
    setAskingVoice(true);
    try {
      const res = await askCallAIVoice({
        callId,
        audio: blob,
        filename: 'question.webm',
      }).unwrap();
      if (res.empty) {
        toast.info("Didn't catch that — try again.");
        return;
      }
      setAiExchanges((prev) => [
        ...prev,
        { question: res.question, answer: res.answer, sources: res.sources },
      ]);
      if (res.audio?.base64) {
        audioRef.current = playAudioDataUrl(
          res.audio.base64,
          res.audio.format,
          () => {
            audioRef.current = null;
          }
        );
      }
    } catch (err) {
      toast.error(err?.data?.message || 'AI could not answer.');
    } finally {
      setAskingVoice(false);
    }
  }, [callId, askCallAIVoice, voiceRec]);

  const handleSendChat = useCallback(async () => {
    const c = chatText.trim();
    if (!c) return;
    setChatText('');
    setInCallMessages((prev) => [
      ...prev,
      {
        sender: myId,
        senderName: userInfo?.name || 'You',
        content: c,
        kind: 'text',
        createdAt: new Date(),
      },
    ]);
    try {
      await sendInCallMessage({ callId, content: c }).unwrap();
    } catch (err) {
      toast.error(err?.data?.message || 'Message failed.');
    }
  }, [chatText, callId, myId, userInfo?.name, sendInCallMessage]);

  const handleToggleHand = useCallback(async () => {
    const next = !handRaised;
    setHandRaised(next);
    try {
      await setRaisedHand({ callId, raised: next }).unwrap();
    } catch (err) {
      setHandRaised(!next);
      toast.error(err?.data?.message || 'Could not update hand.');
    }
  }, [handRaised, callId, setRaisedHand]);

  const handleReact = useCallback(
    async (emoji) => {
      try {
        await sendCallReaction({ callId, emoji }).unwrap();
      } catch {
        toast.error('Could not send reaction.');
      }
    },
    [callId, sendCallReaction]
  );

  const handleDataSaverChange = useCallback(
    async (patch) => {
      const next = { ...dataSaver, ...patch };
      setDataSaver(next);
      try {
        await updateCallDataSaver({ callId, ...patch }).unwrap();
      } catch (err) {
        toast.error(err?.data?.message || 'Could not update.');
      }
    },
    [callId, dataSaver, updateCallDataSaver]
  );

  const handleOpenNote = useCallback(() => {
    if (!noteReady?.noteId) return;
    if (noteReady.kind === 'WorkspaceNote') {
      const wsId =
        call?.workspace?._id || call?.workspace || tokenData?.workspaceId;
      navigate(`/workspace/${wsId}/notes/${noteReady.noteId}`);
    } else {
      navigate(`/notes/${noteReady.noteId}`);
    }
  }, [noteReady, call?.workspace, tokenData?.workspaceId, navigate]);

  // ── Early returns ──
  if (!callId || !userInfo) {
    return (
      <FullScreen>
        <FaExclamationTriangle className="text-3xl text-amber-400 mb-3" />
        <p className="text-white text-base mb-4">Invalid call link.</p>
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-lg text-white font-semibold"
          style={{ backgroundColor: BRAND }}
        >
          Go back
        </button>
      </FullScreen>
    );
  }

  if (callLoading && !call) {
    return (
      <FullScreen>
        <FaSpinner className="animate-spin text-3xl text-white/70" />
        <p className="text-gray-400 text-sm mt-4">Loading call…</p>
      </FullScreen>
    );
  }

  if (callError) {
    return (
      <FullScreen>
        <FaExclamationTriangle className="text-3xl text-red-400 mb-3" />
        <p className="text-white text-base mb-4">
          {callError?.data?.message || "We couldn't load this call."}
        </p>
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-lg text-white font-semibold"
          style={{ backgroundColor: BRAND }}
        >
          Go back
        </button>
      </FullScreen>
    );
  }

  if (phase === 'error') {
    return (
      <FullScreen>
        <FaExclamationTriangle className="text-3xl text-red-400 mb-3" />
        <p className="text-white text-base mb-4">{errorMsg}</p>
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-lg text-white font-semibold"
          style={{ backgroundColor: BRAND }}
        >
          Go back
        </button>
      </FullScreen>
    );
  }

  if (phase === 'ended-for-you') {
    const wasLeft = myParticipant?.status === 'left';
    return (
      <FullScreen>
        <div className="text-6xl mb-6">📞</div>
        <h2 className="text-2xl font-bold mb-2">
          {wasLeft ? 'You left this call' : 'You rejected this call'}
        </h2>
        <p className="text-gray-400 mb-6 text-sm max-w-sm mx-auto text-center">
          {call?.status === 'ongoing'
            ? 'The call is still going on for other participants.'
            : 'The call has ended.'}
        </p>
        {canViewNote && (
          <button
            onClick={handleOpenNote}
            className="mb-3 px-6 py-3 rounded-lg font-semibold text-white flex items-center gap-2 mx-auto"
            style={{ backgroundColor: BRAND }}
          >
            <FaBookOpen /> View AI notes
          </button>
        )}
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-lg font-semibold text-white transition"
          style={{ backgroundColor: BRAND }}
        >
          Back to calls
        </button>
      </FullScreen>
    );
  }

  if (phase === 'ended') {
    return (
      <FullScreen>
        <div className="text-6xl mb-6">📞</div>
        <h2 className="text-2xl font-bold mb-2">Call Ended</h2>
        <p className="text-gray-400 mb-6 text-sm">
          {call?.type === 'video'
            ? 'Your video call has ended.'
            : 'Your voice call has ended.'}
        </p>

        {canViewNote && (
          <button
            onClick={handleOpenNote}
            className="mb-3 px-6 py-3 rounded-lg font-semibold text-white flex items-center gap-2 mx-auto"
            style={{ backgroundColor: BRAND }}
          >
            <FaBookOpen /> View AI notes
          </button>
        )}

        {noteReady && !canViewNote && (
          <div className="mb-4 max-w-sm text-center rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-xs text-gray-300">
            AI notes were saved to{' '}
            <strong>{call?.creator?.name || 'the initiator'}'s</strong> personal
            notes. Ask them to share if you need a copy.
          </div>
        )}

        <button
          onClick={goBack}
          className="px-6 py-3 rounded-lg font-semibold text-white transition"
          style={{ backgroundColor: BRAND }}
        >
          Back to calls
        </button>
      </FullScreen>
    );
  }

  if (phase === 'can-join' || phase === 'joining') {
    const myStatus = myParticipant?.status;
    const isRinging = myStatus === 'ringing';
    const isLateJoin = myStatus === 'missed' || myStatus === 'pending';
    const others = (call.participants || []).filter(
      (p) => getUserId(p) !== myId && p.status === 'accepted'
    );

    const title = isRinging
      ? 'Incoming call'
      : isLateJoin
      ? 'Call in progress'
      : 'Join call';

    const subtitle = isRinging
      ? call?.creator?.name
        ? `${call.creator.name} is calling…`
        : 'You have an incoming call'
      : isLateJoin
      ? 'You missed this call — you can still join while it’s ongoing.'
      : 'Ready to jump in?';

    return (
      <div
        className="min-h-dvh bg-[#0b0b10] text-white flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <FaArrowLeft className="text-sm" />
          </button>
          <div className="text-right">
            <h3 className="text-sm font-semibold">
              {call.type === 'video' ? 'Video Call' : 'Voice Call'}
              {call.isMeeting && (
                <span className="text-[10px] font-normal text-cyan-400 ml-2 uppercase tracking-wide">
                  Meeting
                </span>
              )}
            </h3>
            <p className="text-[11px] text-gray-400">
              {call.participants?.length || 0} invited
            </p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-sm w-full">
            <div className="flex justify-center gap-3 mb-6 flex-wrap">
              {others.slice(0, 4).map((p) => (
                <Avatar
                  key={getUserId(p)}
                  info={{ name: p.user?.name || '?', profile: p.user?.profile }}
                  size={72}
                />
              ))}
              {others.length === 0 && (
                <Avatar
                  info={{
                    name: call.creator?.name || '?',
                    profile: call.creator?.profile,
                  }}
                  size={72}
                />
              )}
            </div>

            <h2 className="text-xl font-bold mb-1">{title}</h2>
            <p className="text-sm text-gray-400 mb-6">{subtitle}</p>

            {permState === 'checking' && (
              <p className="text-xs text-gray-400 mb-4 flex items-center justify-center gap-2">
                <FaSpinner className="animate-spin" /> Allow mic access…
              </p>
            )}

            {permState === 'denied' && (
              <div className="mb-4 rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                {permError}
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-sm text-amber-300">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              {isRinging && (
                <button
                  onClick={handleDecline}
                  className="w-16 h-16 rounded-xl bg-red-600 hover:bg-red-700 flex items-center justify-center transition shadow-lg"
                  aria-label="Decline"
                >
                  <FaPhoneSlash className="text-xl" />
                </button>
              )}
              <button
                onClick={handleAnswer}
                disabled={phase === 'joining'}
                className="w-20 h-20 rounded-xl flex items-center justify-center text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#16a34a' }}
                aria-label={isLateJoin ? 'Join' : 'Answer'}
              >
                {phase === 'joining' ? (
                  <FaSpinner className="animate-spin text-2xl" />
                ) : (
                  <FaPhone className="text-2xl" />
                )}
              </button>
            </div>

            {call.isMeeting && call.meetingLink && (
              <button
                onClick={handleCopyLink}
                className="mt-6 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
              >
                <FaLink className="text-[10px]" /> Copy meeting link
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'in-call' && tokenData && !connectionLost) {
    return (
      <>
        <LiveKitRoom
          serverUrl={tokenData.url}
          token={tokenData.token}
          connect
          audio
          video={wantsVideo}
          options={ROOM_OPTIONS}
          onDisconnected={handleDisconnected}
          onMediaDeviceFailure={handleDeviceFailure}
        >
          <CallStage
            isVideo={wantsVideo}
            brandColor={BRAND}
            call={call}
            isCreator={isCreator}
            deviceError={deviceError}
            onHangUp={handleHangUp}
            onEndForAll={() => setEndConfirmOpen(true)}
            onCopyLink={handleCopyLink}
            aiEnabled={aiEnabled}
            aiStarting={aiStarting}
            onStartAI={handleStartAI}
            onStopAI={handleStopAI}
            transcriptSupported={
              typeof window !== 'undefined' &&
              !!(window.SpeechRecognition || window.webkitSpeechRecognition)
            }
            onTranscriptSegment={handleTranscriptSegment}
            onOpenAIPanel={() => setAiPanelOpen(true)}
            transcriptCount={transcript.length}
            handRaised={handRaised}
            onToggleHand={handleToggleHand}
            onReact={handleReact}
            raisedHands={raisedHands}
            dataSaver={dataSaver}
            onDataSaverChange={handleDataSaverChange}
            reactions={reactions}
          />
        </LiveKitRoom>

        <AIPanel
          open={aiPanelOpen}
          onClose={() => setAiPanelOpen(false)}
          tab={aiTab}
          setTab={setAiTab}
          brandColor={BRAND}
          aiEnabled={aiEnabled}
          transcriptSupported={
            typeof window !== 'undefined' &&
            !!(window.SpeechRecognition || window.webkitSpeechRecognition)
          }
          transcript={transcript}
          liveSummary={liveSummary}
          exchanges={aiExchanges}
          chatMessages={inCallMessages}
          noteReady={noteReady}
          askText={askText}
          setAskText={setAskText}
          onAskText={handleAskText}
          askingText={askingText}
          onAskVoiceStart={handleAskVoiceStart}
          onAskVoiceStop={handleAskVoiceStop}
          voiceRecording={voiceRec.recording}
          askingVoice={askingVoice}
          chatText={chatText}
          setChatText={setChatText}
          onSendChat={handleSendChat}
          meId={myId}
        />

        {endConfirmOpen && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEndConfirmOpen(false)}
          >
            <div
              className="bg-[#14141a] border border-white/10 rounded-2xl max-w-sm w-full p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-white mb-2">
                End for everyone?
              </h3>
              <p className="text-xs text-gray-400 mb-5">
                This will disconnect all participants. It cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEndConfirmOpen(false)}
                  className="py-2.5 border border-white/15 rounded-lg text-sm text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setEndConfirmOpen(false);
                    handleEndForAll();
                  }}
                  className="py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
                >
                  End call
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (connectionLost) {
    return (
      <FullScreen>
        <FaExclamationTriangle className="text-3xl text-amber-400 mb-3" />
        <h2 className="text-xl font-bold mb-2">Connection lost</h2>
        <p className="text-sm text-gray-400 mb-6 max-w-sm text-center">
          We couldn't reconnect to the call. Try again or leave.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setConnectionLost(false);
              leavingRef.current = false;
              hasJoinedRef.current = false;
              doJoin({ markAccepted: false });
            }}
            className="px-6 py-3 rounded-lg font-semibold text-white"
            style={{ backgroundColor: BRAND }}
          >
            Reconnect
          </button>
          <button
            onClick={handleHangUp}
            className="px-6 py-3 rounded-lg font-semibold bg-red-600 hover:bg-red-700 text-white"
          >
            Leave
          </button>
        </div>
      </FullScreen>
    );
  }

  return (
    <FullScreen>
      <FaSpinner className="animate-spin text-3xl text-white/70" />
      <p className="text-gray-400 text-sm mt-4">Preparing your call…</p>
    </FullScreen>
  );
};

export default CallScreen;