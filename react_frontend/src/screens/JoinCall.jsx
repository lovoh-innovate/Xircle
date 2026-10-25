// src/screens/JoinCall.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
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
} from '@livekit/components-react';
import {
  Track,
  DisconnectReason,
  MediaDeviceFailure,
  VideoQuality,
} from 'livekit-client';
import {
  FaPhone,
  FaVideo,
  FaPhoneSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideoSlash,
  FaSpinner,
  FaExclamationTriangle,
  FaLink,
  FaLock,
  FaDesktop,
  // ── AI additions ──
  FaRobot,
  FaBrain,
  FaCommentDots,
  FaLightbulb,
  FaWifi,
  FaBookOpen,
  FaTimes,
  FaHandPaper,
} from 'react-icons/fa';

import { useJoinByMeetingCodeMutation } from '../slices/callApiSlice';
import { ensureCallPermissions } from '../utils/callPermissions';

// ─────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────
const RAW_API_URL = import.meta.env.VITE_API_URL;
const API_BASE = (() => {
  if (!RAW_API_URL) return '/api';
  const cleaned = String(RAW_API_URL).replace(/\/+$/, '');
  if (!cleaned) return '/api';
  if (/^https?:\/\//i.test(cleaned) && !/\/api$/.test(cleaned)) {
    return `${cleaned}/api`;
  }
  return cleaned;
})();

const BRAND = '#0d9488';

const ROOM_OPTIONS = {
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

const GUEST_STATE_POLL_MS = 15_000;

// Phones / WebViews don't expose getDisplayMedia, so the share button is hidden there.
const SCREEN_SHARE_SUPPORTED =
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getDisplayMedia === 'function';

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
const formatClock = (total) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
};

const getInfo = (p) => {
  let meta = {};
  try {
    meta = p?.metadata ? JSON.parse(p.metadata) : {};
  } catch {
    /* ignore */
  }
  return {
    name: p?.name || 'Participant',
    username: meta.username || '',
    profile: meta.profile || '',
  };
};

const deviceFailureMessage = (failure) => {
  switch (failure) {
    case MediaDeviceFailure.PermissionDenied:
      return 'Microphone/camera permission was denied.';
    case MediaDeviceFailure.NotFound:
      return 'No microphone or camera found.';
    case MediaDeviceFailure.DeviceInUse:
      return 'Microphone/camera is in use by another app.';
    default:
      return 'Could not start your microphone or camera.';
  }
};

/** Keep the screen awake while in a call (re-acquired after returning to the tab). */
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
// Global styles
// ─────────────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @keyframes call-bar-anim { 0%,100% { height: 4px } 50% { height: 16px } }
    .call-bar { height: 4px; animation: call-bar-anim 0.8s ease-in-out infinite; }

    .join-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .join-scroll::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.3);
      border-radius: 999px;
    }
    .join-scroll::-webkit-scrollbar-track { background: transparent; }
  `}</style>
);

// ═════════════════════════════════════════════════════════════════════
// Participant tile (shared for main + thumb)
// ═════════════════════════════════════════════════════════════════════
const ParticipantTile = ({
  participant,
  cameraRef,
  variant = 'thumb',
  active = false,
  onClick,
}) => {
  const isSpeaking = useIsSpeaking(participant);
  const micMuted = useIsMuted(Track.Source.Microphone, { participant });
  const info = getInfo(participant);
  const isMain = variant === 'main';
  const camOn = !!cameraRef && !cameraRef.publication?.isMuted;

  const ringStyle = isSpeaking
    ? { boxShadow: `0 0 0 3px ${BRAND}` }
    : active
    ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.35)' }
    : {};

  const avatarSize = isMain ? 112 : 36;

  return (
    <div
      onClick={onClick}
      style={ringStyle}
      className={`relative overflow-hidden bg-[#1a1a24] transition-shadow ${
        isMain
          ? 'w-full h-full rounded-3xl'
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
          {info.profile ? (
            <img
              src={info.profile}
              alt={info.name}
              className="rounded-full object-cover flex-shrink-0"
              style={{ width: avatarSize, height: avatarSize }}
            />
          ) : (
            <div
              className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
              style={{
                width: avatarSize,
                height: avatarSize,
                backgroundColor: BRAND,
                fontSize: Math.max(10, avatarSize * 0.4),
              }}
            >
              {info.name.charAt(0).toUpperCase()}
            </div>
          )}
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
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1 bg-black/55 rounded-full px-2 py-0.5 text-[11px] sm:text-xs">
          {micMuted && <FaMicrophoneSlash className="text-red-400 flex-shrink-0" />}
          <span className="truncate">{participant.isLocal ? 'You' : info.name}</span>
        </div>
      )}

      {isMain && (
        <>
          {micMuted && (
            <div className="absolute top-3 right-3 bg-black/55 rounded-full p-2">
              <FaMicrophoneSlash className="text-red-400" />
            </div>
          )}
          {isSpeaking && (
            <div className="absolute top-3 left-3 flex items-end gap-[3px] h-5 bg-black/55 rounded-full px-3 py-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full call-bar"
                  style={{
                    backgroundColor: BRAND,
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
 * Shows the presenter's face (or initial if their camera is off).
 */
const PipBubble = ({ participant, cameraRef }) => {
  const isSpeaking = useIsSpeaking(participant);
  const micMuted = useIsMuted(Track.Source.Microphone, { participant });
  const info = getInfo(participant);
  const camOn = !!cameraRef && !cameraRef.publication?.isMuted;

  return (
    <div
      className="absolute top-3 right-3 z-10 w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-[#1a1a24] shadow-2xl"
      style={{
        border: `3px solid ${isSpeaking ? BRAND : 'rgba(255,255,255,0.25)'}`,
      }}
    >
      {camOn ? (
        <VideoTrack
          trackRef={cameraRef}
          className="w-full h-full object-cover"
          style={participant.isLocal ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : info.profile ? (
        <img
          src={info.profile}
          alt={info.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-bold text-white text-3xl"
          style={{ backgroundColor: BRAND }}
        >
          {info.name.charAt(0).toUpperCase()}
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
// Guest AI panel (read-only)
// ═════════════════════════════════════════════════════════════════════
const GuestAIPanel = ({
  open,
  onClose,
  tab,
  setTab,
  aiEnabled,
  transcript,
  liveSummary,
  chatMessages,
  noteReady,
}) => {
  if (!open) return null;

  const tabs = [
    { id: 'summary', label: 'Summary', icon: <FaBrain /> },
    { id: 'transcript', label: 'Transcript', icon: <FaCommentDots /> },
    { id: 'chat', label: 'Chat', icon: <FaLightbulb /> },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex sm:items-stretch sm:justify-end">
      <div className="flex-1 bg-black/40" onClick={onClose} />

      <div className="w-full sm:w-[420px] h-[85dvh] sm:h-full bg-[#0f0f15] border-l border-white/10 flex flex-col sm:rounded-none rounded-t-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-2">
            <FaRobot style={{ color: BRAND }} />
            <h3 className="text-base font-semibold">Xircle AI</h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
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

        {/* Tabs */}
        <div className="flex border-b border-white/10 flex-shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-medium flex flex-col items-center gap-1 transition ${
                tab === t.id
                  ? 'text-white border-b-2'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              style={tab === t.id ? { borderBottomColor: BRAND } : undefined}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 join-scroll">
          {tab === 'summary' && (
            <div className="space-y-4">
              {!aiEnabled && (
                <div className="text-sm text-gray-400">
                  The host hasn't turned on AI notes for this meeting.
                </div>
              )}
              {aiEnabled && !liveSummary && (
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <FaSpinner className="animate-spin" />
                  Listening for context…
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
                            <span style={{ color: BRAND }}>•</span>
                            <span>
                              {a.text}
                              {a.assignee && (
                                <span className="text-gray-400">
                                  {' '}— {a.assignee}
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
                <div className="rounded-xl bg-teal-500/10 border border-teal-500/30 px-3 py-2 text-xs text-teal-200">
                  <FaBookOpen className="inline mr-1" />
                  Notes were saved. Sign in to view them in your workspace.
                </div>
              )}
            </div>
          )}

          {tab === 'transcript' && (
            <div className="space-y-2">
              {!aiEnabled && (
                <div className="text-sm text-gray-400">
                  AI notes are off for this meeting.
                </div>
              )}
              {aiEnabled && transcript.length === 0 && (
                <div className="text-sm text-gray-400">
                  Waiting for the first words…
                </div>
              )}
              {transcript.map((s, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium" style={{ color: BRAND }}>
                    {s.speakerName || 'Someone'}:
                  </span>{' '}
                  <span className="text-gray-200">{s.text}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'chat' && (
            <div className="space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-sm text-gray-500">No messages yet.</p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className="text-sm flex justify-start">
                  <div className="max-w-[85%] px-3 py-1.5 rounded-2xl rounded-bl-sm bg-white/10 text-gray-100">
                    {m.senderName && (
                      <p className="text-[10px] text-gray-400 mb-0.5">
                        {m.senderName}
                      </p>
                    )}
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer CTA — guests can't ask AI or chat */}
        <div className="border-t border-white/10 p-3 flex-shrink-0">
          <Link
            to="/signup"
            className="w-full py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            <FaRobot className="text-sm" />
            Sign up to ask AI & chat
          </Link>
          <p className="text-[10px] text-gray-500 text-center mt-2">
            Guests can view AI notes but need an account to interact.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Data saver menu (client-side only for guests)
// ─────────────────────────────────────────────────────────────────────
const GuestDataSaverMenu = ({ open, onClose, dataSaver, onChange }) => {
  if (!open) return null;
  const qualities = [
    { v: 'auto', label: 'Auto' },
    { v: 'low', label: 'Low (data saver)' },
    { v: 'medium', label: 'Medium' },
    { v: 'high', label: 'High' },
  ];
  return (
    <>
      <div className="fixed inset-0 z-[68]" onClick={onClose} />
      <div className="absolute bottom-24 right-4 z-[69] bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl p-3 w-64">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Data saver</p>
          <FaWifi className="text-xs text-gray-400" />
        </div>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!dataSaver.audioOnly}
            onChange={(e) => onChange({ audioOnly: e.target.checked })}
          />
          <span className="text-sm">Audio only (no video)</span>
        </label>
        <div className="mt-2">
          <p className="text-xs text-gray-400 mb-1">Video quality</p>
          <div className="grid grid-cols-2 gap-1">
            {qualities.map((q) => (
              <button
                key={q.v}
                onClick={() => onChange({ videoQuality: q.v })}
                className={`text-xs py-1.5 rounded-lg transition ${
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
      </div>
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════
// Guest stage (inside LiveKit) — screen share + data saver + AI button
// ═════════════════════════════════════════════════════════════════════
const GuestCallStage = ({
  isVideo,
  onHangUp,
  deviceError,
  code,
  aiEnabled,
  transcriptCount,
  onOpenAIPanel,
  raisedHands,
  dataSaver,
  onDataSaverChange,
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

  const [pinned, setPinned] = useState(null);
  const [lastSpeaker, setLastSpeaker] = useState(null);
  const [secs, setSecs] = useState(0);
  const [dataSaverOpen, setDataSaverOpen] = useState(false);

  const localScreenShare = screenTracks.find(
    (t) => t.participant.isLocal && !t.publication?.isMuted
  );
  const remoteScreenShare = screenTracks.find(
    (t) => !t.participant.isLocal && !t.publication?.isMuted
  );
  // A remote share always takes the main stage. Your own share shows as a
  // "you're sharing" card (rendering it back would create a mirror tunnel).
  const activeScreen = remoteScreenShare || localScreenShare;
  const isSharingScreen = !!isScreenShareEnabled;
  const presenter = activeScreen?.participant;

  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;

    if (!SCREEN_SHARE_SUPPORTED) {
      toast.info(
        'Screen sharing isn’t supported on this device. Use a desktop browser to share.'
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
      console.error('[guest][screen] failed:', err?.name, err?.message, err);
      const msg = String(err?.message || '');
      if (
        err?.name === 'NotAllowedError' &&
        /permission denied|cancel/i.test(msg)
      ) {
        return; // user closed the picker
      }
      if (err?.name === 'NotAllowedError') {
        toast.error('Screen share was blocked. Check browser permissions.');
      } else if (/permission|publish|not allowed/i.test(msg)) {
        toast.error('You are not allowed to share your screen in this call.');
      } else {
        toast.error(
          `Could not share screen: ${msg || err?.name || 'unknown error'}`
        );
      }
    }
  }, [localParticipant, isSharingScreen]);

  // Apply data saver to local publishing
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
      console.warn('[guest][dataSaver] apply failed:', err);
    }
  }, [dataSaver, localParticipant, isCameraEnabled]);

  // Bring the camera back if the browser stopped it while the tab was hidden
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
        console.warn('[guest][camera] resume failed:', err);
      }
    };

    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [localParticipant]);

  useWakeLock(true);

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
      console.error('[guest] toggle mic failed:', err);
    }
  };

  const toggleCam = async () => {
    try {
      await localParticipant?.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error('[guest] toggle camera failed:', err);
    }
  };

  const handsUpCount = raisedHands?.length || 0;
  const showCameraControls = isVideo || isSharingScreen || isCameraEnabled;

  return (
    <div className="h-dvh bg-[#0b0b10] text-white flex flex-col">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-white/10 gap-2"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="min-w-0">
          <h3 className="text-base font-semibold truncate flex items-center gap-2">
            {isVideo ? 'Video Meeting' : 'Voice Meeting'}
            {aiEnabled && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1">
                <FaRobot /> AI
              </span>
            )}
            {isSharingScreen && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 flex items-center gap-1">
                <FaDesktop /> Sharing
              </span>
            )}
            {handsUpCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 flex items-center gap-1">
                <FaHandPaper /> {handsUpCount}
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-400">
            {participants.length} participant{participants.length === 1 ? '' : 's'}
            {code && <span className="ml-2 text-gray-500">· {code}</span>}
          </p>
        </div>
        <span className="text-sm tabular-nums text-gray-300">{formatClock(secs)}</span>
      </div>

      {deviceError && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-300">
          <FaExclamationTriangle className="flex-shrink-0" />
          <span>{deviceError}</span>
        </div>
      )}

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto px-3 py-3 flex-shrink-0">
        {participants.map((p) => (
          <ParticipantTile
            key={p.identity}
            participant={p}
            cameraRef={camRefFor(p)}
            variant="thumb"
            active={p.identity === mainP?.identity}
            onClick={() => setPinned(p.identity)}
          />
        ))}
      </div>

      {/* Main stage — a shared screen takes priority, presenter's face in the corner */}
      <div className="flex-1 min-h-0 px-3 pb-3">
        {activeScreen ? (
          <div className="relative w-full h-full rounded-3xl overflow-hidden bg-black">
            {activeScreen.participant.isLocal ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center px-6">
                <FaDesktop className="text-4xl" style={{ color: BRAND }} />
                <div>
                  <p className="text-lg font-semibold">
                    You’re sharing your screen
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Everyone in the meeting can see it.
                  </p>
                </div>
                <button
                  onClick={toggleScreenShare}
                  className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-sm font-medium"
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

            <div className="absolute bottom-2 left-2 bg-black/70 rounded-full px-3 py-1 text-xs flex items-center gap-1.5">
              <FaDesktop className="text-[10px]" />
              {activeScreen.participant.isLocal
                ? 'Your screen'
                : `${getInfo(activeScreen.participant).name}'s screen`}
            </div>

            {presenter && (
              <PipBubble
                participant={presenter}
                cameraRef={camRefFor(presenter)}
              />
            )}
          </div>
        ) : (
          mainP && (
            <ParticipantTile
              participant={mainP}
              cameraRef={camRefFor(mainP)}
              variant="main"
            />
          )
        )}
      </div>

      <RoomAudioRenderer />
      <StartAudio
        label="Tap to enable audio"
        className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-white text-gray-900 font-medium shadow-lg"
      />

      {/* Floating AI panel button */}
      <button
        onClick={onOpenAIPanel}
        className="fixed bottom-28 right-4 z-[65] w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition"
        style={{ backgroundColor: BRAND }}
        title="Open AI notes"
      >
        <FaRobot className="text-xl" />
        {transcriptCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
            {transcriptCount > 99 ? '99+' : transcriptCount}
          </span>
        )}
      </button>

      {/* Controls */}
      <div
        className="px-4 py-4 bg-white/5 border-t border-white/10 flex items-center justify-center gap-3 relative"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
            isMicrophoneEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-600'
          }`}
          aria-label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        >
          {isMicrophoneEnabled ? (
            <FaMicrophone className="text-lg" />
          ) : (
            <FaMicrophoneSlash className="text-lg" />
          )}
        </button>

        {showCameraControls && (
          <button
            onClick={toggleCam}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
              isCameraEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-600'
            }`}
            aria-label={isCameraEnabled ? 'Camera off' : 'Camera on'}
          >
            {isCameraEnabled ? (
              <FaVideo className="text-lg" />
            ) : (
              <FaVideoSlash className="text-lg" />
            )}
          </button>
        )}

        {SCREEN_SHARE_SUPPORTED && (
          <button
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
              isSharingScreen
                ? 'bg-teal-600 hover:bg-teal-700'
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
            aria-label={isSharingScreen ? 'Stop sharing' : 'Share screen'}
            title={isSharingScreen ? 'Stop sharing' : 'Share screen'}
          >
            <FaDesktop className="text-lg" />
          </button>
        )}

        {/* Data saver */}
        <button
          onClick={() => setDataSaverOpen((v) => !v)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
            dataSaver?.enabled || dataSaver?.videoQuality !== 'auto'
              ? 'bg-yellow-500 text-black'
              : 'bg-gray-600 hover:bg-gray-500'
          }`}
          aria-label="Data saver"
          title="Data saver"
        >
          <FaWifi className="text-lg" />
        </button>

        <button
          onClick={onHangUp}
          className="w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition shadow-lg"
          aria-label="Leave call"
        >
          <FaPhoneSlash className="text-xl" />
        </button>

        <GuestDataSaverMenu
          open={dataSaverOpen}
          onClose={() => setDataSaverOpen(false)}
          dataSaver={dataSaver}
          onChange={onDataSaverChange}
        />
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// Full-screen shell
// ═════════════════════════════════════════════════════════════════════
const Shell = ({ children }) => (
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
// MAIN — JoinCall
// ═════════════════════════════════════════════════════════════════════
const JoinCall = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((s) => s.auth);
  const isLoggedIn = !!userInfo;

  const [joinByCode] = useJoinByMeetingCodeMutation();

  const [phase, setPhase] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [permError, setPermError] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const [connectionLost] = useState(false);
  const [name, setName] = useState('');
  const [guestTokenData, setGuestTokenData] = useState(null);
  const [callType, setCallType] = useState('video');

  // ─── AI state (populated on join + refreshed via polling) ──
  const [aiEnabled, setAiEnabled] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [liveSummary, setLiveSummary] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [raisedHands, setRaisedHands] = useState([]);
  const [noteReady, setNoteReady] = useState(null);
  const [dataSaver, setDataSaver] = useState({
    enabled: false,
    audioOnly: false,
    videoQuality: 'auto',
  });

  // AI panel
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiTab, setAiTab] = useState('summary');

  const leavingRef = useRef(false);

  // ─── Boot ─────────────────────────────────────────────────
  useEffect(() => {
    if (!code || code.trim().length < 4) {
      setPhase('error');
      setErrorMsg('Invalid meeting link.');
      return;
    }

    if (isLoggedIn) {
      (async () => {
        setPhase('connecting');
        try {
          const res = await joinByCode(code.trim()).unwrap();
          navigate(`/call/${res.call._id}`, { replace: true });
        } catch (err) {
          setPhase('error');
          setErrorMsg(err?.data?.message || 'Meeting not found or has ended.');
        }
      })();
    } else {
      setPhase('need-name');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isLoggedIn]);

  // ─── Fetch guest token (creates guest record — one-time) ──
  const fetchGuestToken = async (guestName) => {
    const url = `${API_BASE}/calls/guest-token/${encodeURIComponent(code.trim())}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: guestName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to join meeting.');
    return data;
  };

  // ─── Guest submits name ───────────────────────────────────
  const handleGuestJoin = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.error('Please enter your name');
    if (trimmed.length > 50) return toast.error('Name is too long (max 50 chars)');

    setPhase('connecting');
    setErrorMsg('');
    setPermError('');

    try {
      const data = await fetchGuestToken(trimmed);
      setGuestTokenData(data);
      setCallType(data.type || 'video');

      // Hydrate AI state from the token response
      if (data.ai?.enabled) setAiEnabled(true);
      if (Array.isArray(data.recentTranscript)) setTranscript(data.recentTranscript);
      if (data.liveSummary) setLiveSummary(data.liveSummary);
      if (Array.isArray(data.recentMessages)) setChatMessages(data.recentMessages);
      if (Array.isArray(data.raisedHands)) setRaisedHands(data.raisedHands);
      if (data.ai?.generatedNoteId) {
        setNoteReady({
          noteId: data.ai.generatedNoteId,
          kind: data.ai.generatedNoteKind,
        });
      }
      if (data.dataSaver) setDataSaver(data.dataSaver);

      const perm = await ensureCallPermissions(false);
      if (!perm.ok) {
        setPermError(perm.message || 'Microphone permission is required.');
        setPhase('permission-denied');
        return;
      }

      setPhase('in-call');
    } catch (err) {
      setPhase('need-name');
      setErrorMsg(err.message || 'Failed to join meeting.');
    }
  };

  // ─── Poll public state every 15s (while in-call) ──────────
  useEffect(() => {
    if (phase !== 'in-call' || !code) return undefined;
    let cancelled = false;

    const fetchState = async () => {
      try {
        const url = `${API_BASE}/calls/public/${encodeURIComponent(code.trim())}/state`;
        const res = await fetch(url);
        if (cancelled) return;
        if (res.status === 404) {
          setPhase('ended');
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.success) return;

        setAiEnabled(!!data.ai?.enabled);
        if (Array.isArray(data.recentTranscript)) setTranscript(data.recentTranscript);
        setLiveSummary(data.liveSummary || null);
        if (Array.isArray(data.recentMessages)) setChatMessages(data.recentMessages);
        if (Array.isArray(data.raisedHands)) setRaisedHands(data.raisedHands);
        if (data.ai?.generatedNoteId) {
          setNoteReady({
            noteId: data.ai.generatedNoteId,
            kind: data.ai.generatedNoteKind,
          });
        }
      } catch {
        // ignore network blips
      }
    };

    fetchState();
    const timer = setInterval(fetchState, GUEST_STATE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [phase, code]);

  // ─── Client-side data saver (no backend call — guests can't auth) ──
  const handleDataSaverChange = useCallback((patch) => {
    setDataSaver((prev) => ({ ...prev, ...patch }));
  }, []);

  // ─── Retry permission (token already cached) ──────────────
  const retryPermission = async () => {
    setPermError('');
    const perm = await ensureCallPermissions(false);
    if (!perm.ok) {
      setPermError(perm.message || 'Microphone permission is required.');
      return;
    }
    setPhase('in-call');
  };

  // ─── Disconnect handlers ──────────────────────────────────
  const handleDisconnected = useCallback((reason) => {
    if (leavingRef.current) return;
    if (reason === DisconnectReason.CLIENT_INITIATED) return;
    setPhase('ended');
  }, []);

  const handleHangUp = useCallback(() => {
    leavingRef.current = true;
    setPhase('ended');
  }, []);

  const handleDeviceFailure = useCallback((failure) => {
    console.error('[guest] media device failure:', failure);
    setDeviceError(deviceFailureMessage(failure));
  }, []);

  const goHome = () => navigate('/', { replace: true });

  // ═══════════════════════════════════════════════════════════
  // Phase: loading
  // ═══════════════════════════════════════════════════════════
  if (phase === 'loading') {
    return (
      <>
        <GlobalStyles />
        <Shell>
          <FaSpinner className="animate-spin text-3xl text-white/70" />
          <p className="text-gray-400 text-sm mt-4">Loading meeting…</p>
        </Shell>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: connecting
  // ═══════════════════════════════════════════════════════════
  if (phase === 'connecting') {
    return (
      <>
        <GlobalStyles />
        <Shell>
          <FaSpinner className="animate-spin text-3xl" style={{ color: BRAND }} />
          <p className="text-white text-base mt-4">Connecting to the meeting…</p>
          <p className="text-gray-500 text-xs mt-1">Code: {code}</p>
        </Shell>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: error
  // ═══════════════════════════════════════════════════════════
  if (phase === 'error') {
    return (
      <>
        <GlobalStyles />
        <Shell>
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <FaExclamationTriangle className="text-red-400 text-2xl" />
            </div>
            <h2 className="text-xl font-bold mb-2">Can't join this meeting</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">{errorMsg}</p>
            <div className="flex flex-col gap-2">
              {!isLoggedIn && (
                <Link
                  to="/login"
                  className="w-full py-3 text-white rounded-full font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  Sign in
                </Link>
              )}
              <button
                onClick={goHome}
                className="w-full py-3 border border-white/15 rounded-full text-gray-300 hover:bg-white/5 transition"
              >
                Back to Xircle
              </button>
            </div>
          </div>
        </Shell>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: permission-denied
  // ═══════════════════════════════════════════════════════════
  if (phase === 'permission-denied') {
    return (
      <>
        <GlobalStyles />
        <Shell>
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
              <FaMicrophoneSlash className="text-amber-400 text-2xl" />
            </div>
            <h2 className="text-xl font-bold mb-2">Microphone needed</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">{permError}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPhase('need-name')}
                className="flex-1 py-3 border border-white/15 rounded-full text-gray-300 hover:bg-white/5 transition"
              >
                Back
              </button>
              <button
                onClick={retryPermission}
                className="flex-1 py-3 text-white rounded-full font-semibold transition hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                Try again
              </button>
            </div>
          </div>
        </Shell>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: need-name (guest form)
  // ═══════════════════════════════════════════════════════════
  if (phase === 'need-name') {
    return (
      <>
        <GlobalStyles />
        <Shell>
          <div className="w-full max-w-sm">
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
                style={{ backgroundColor: BRAND }}
              >
                <FaVideo className="text-white text-2xl" />
              </div>
              <h1 className="text-2xl font-bold mb-1">Join the meeting</h1>
              <p className="text-gray-400 text-sm">
                Someone invited you to a Xircle call
              </p>
            </div>

            <div className="flex items-center justify-center mb-6">
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs">
                <FaLink className="text-[10px] text-gray-400" />
                <span className="font-mono text-gray-300">{code}</span>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
              <label className="block text-xs font-medium text-gray-300 mb-2">
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGuestJoin()}
                placeholder="e.g. Alex Johnson"
                maxLength={50}
                autoFocus
                className="w-full px-4 py-3 bg-[#0b0b10] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-teal-500 transition"
              />
              <p className="text-[11px] text-gray-500 mt-2">
                This is how you'll appear to other participants.
              </p>

              {errorMsg && (
                <div className="mt-3 rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-300">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleGuestJoin}
                disabled={!name.trim()}
                className="w-full mt-4 py-3 text-white rounded-xl font-semibold transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: BRAND }}
              >
                <FaPhone className="text-sm" />
                Join as guest
              </button>
            </div>

            <div className="mt-6 text-center space-y-3">
              <p className="text-xs text-gray-500">
                Already have a Xircle account?{' '}
                <Link
                  to="/login"
                  className="text-teal-400 hover:text-teal-300 font-medium"
                >
                  Sign in
                </Link>
              </p>
              <p className="text-[11px] text-gray-600 flex items-center justify-center gap-1">
                <FaLock className="text-[9px]" /> Your name is only shown in this call
              </p>
            </div>
          </div>
        </Shell>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: in-call (LiveKit)
  // ═══════════════════════════════════════════════════════════
  if (phase === 'in-call' && guestTokenData && !connectionLost) {
    return (
      <>
        <GlobalStyles />
        <LiveKitRoom
          serverUrl={guestTokenData.url}
          token={guestTokenData.token}
          connect
          audio
          video={callType === 'video'}
          options={ROOM_OPTIONS}
          onDisconnected={handleDisconnected}
          onMediaDeviceFailure={handleDeviceFailure}
        >
          <GuestCallStage
            isVideo={callType === 'video'}
            onHangUp={handleHangUp}
            deviceError={deviceError}
            code={code}
            aiEnabled={aiEnabled}
            transcriptCount={transcript.length}
            onOpenAIPanel={() => setAiPanelOpen(true)}
            raisedHands={raisedHands}
            dataSaver={dataSaver}
            onDataSaverChange={handleDataSaverChange}
          />
        </LiveKitRoom>

        <GuestAIPanel
          open={aiPanelOpen}
          onClose={() => setAiPanelOpen(false)}
          tab={aiTab}
          setTab={setAiTab}
          aiEnabled={aiEnabled}
          transcript={transcript}
          liveSummary={liveSummary}
          chatMessages={chatMessages}
          noteReady={noteReady}
        />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: connection lost
  // ═══════════════════════════════════════════════════════════
  if (connectionLost) {
    return (
      <>
        <GlobalStyles />
        <Shell>
          <div className="text-center max-w-sm">
            <FaExclamationTriangle className="text-3xl text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Connection lost</h2>
            <p className="text-sm text-gray-400 mb-6">
              We couldn't reconnect. Please rejoin using the same link.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 text-white rounded-full font-semibold transition hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              Rejoin
            </button>
          </div>
        </Shell>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: ended
  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <GlobalStyles />
      <Shell>
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-6">📞</div>
          <h2 className="text-2xl font-bold mb-2">Meeting ended</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Thanks for joining! The call has ended.
          </p>
          <div className="flex flex-col gap-2">
            {!isLoggedIn ? (
              <>
                <Link
                  to="/signup"
                  className="w-full py-3 text-white rounded-full font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  Create a Xircle account
                </Link>
                <Link
                  to="/login"
                  className="w-full py-3 border border-white/15 rounded-full text-gray-300 hover:bg-white/5 transition"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <Link
                to="/calls"
                className="w-full py-3 text-white rounded-full font-semibold transition hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                Back to calls
              </Link>
            )}
            <button
              onClick={goHome}
              className="w-full py-3 border border-white/15 rounded-full text-gray-300 hover:bg-white/5 transition"
            >
              Back to Xircle
            </button>
          </div>
        </div>
      </Shell>
    </>
  );
};

export default JoinCall;