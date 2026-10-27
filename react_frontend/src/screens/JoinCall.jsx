// src/screens/JoinCall.jsx
import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
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
import useCallAIRecorder from '../hooks/useCallAIRecorder';

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
const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 720;

const ROOM_OPTIONS = {
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

// Guests have no socket, so they poll. 6 s keeps the transcript feeling live
// without hammering the server (payload is capped server-side).
const GUEST_STATE_POLL_MS = 6_000;

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

// Human-readable text for the AI recorder state
const recorderMessage = (status, error) => {
  switch (status) {
    case 'muted':
      return 'Your microphone is muted — unmute so AI can hear you.';
    case 'unsupported':
      return "This device can't record audio for AI notes.";
    case 'no-mic':
      return 'Waiting for your microphone…';
    case 'error':
      return `AI audio problem: ${error || 'upload failed'}`;
    default:
      return 'Listening — first words appear within about 10 seconds.';
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
// useIsDesktop hook
// ─────────────────────────────────────────────────────────────────────
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener?.(handler);
    setIsDesktop(mq.matches);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener?.(handler);
    };
  }, []);
  return isDesktop;
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
// Avatar
// ═════════════════════════════════════════════════════════════════════
const Avatar = ({ info, size }) => {
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
      style={{ ...style, backgroundColor: BRAND }}
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
    >
      {info.name.charAt(0).toUpperCase()}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// Grid tile
// ═════════════════════════════════════════════════════════════════════
const GridTile = ({ participant, cameraRef, onClick }) => {
  const isSpeaking = useIsSpeaking(participant);
  const micMuted = useIsMuted(Track.Source.Microphone, { participant });
  const info = getInfo(participant);
  const camOn = !!cameraRef && !cameraRef.publication?.isMuted;

  return (
    <div
      onClick={onClick}
      className="relative w-full h-full overflow-hidden rounded-xl bg-[#1a1a24] cursor-pointer transition-shadow"
      style={isSpeaking ? { boxShadow: `0 0 0 3px ${BRAND}` } : undefined}
    >
      {camOn ? (
        <VideoTrack
          trackRef={cameraRef}
          className="w-full h-full object-cover"
          style={participant.isLocal ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center px-2">
          <Avatar info={info} size={56} />
        </div>
      )}

      <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 bg-black/55 rounded-md px-1.5 py-0.5 text-[10px] sm:text-xs pointer-events-none">
        {micMuted && (
          <FaMicrophoneSlash className="text-red-400 flex-shrink-0" />
        )}
        <span className="truncate">
          {participant.isLocal ? 'You' : info.name}
        </span>
      </div>

      {isSpeaking && (
        <div className="absolute top-1 right-1 flex items-end gap-[2px] h-4 bg-black/55 rounded-md px-1.5 py-1 pointer-events-none">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-[2px] rounded-full call-bar"
              style={{
                backgroundColor: BRAND,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// VideoGrid — responsive grid layout
// ═════════════════════════════════════════════════════════════════════
const VideoGrid = ({ participants, camRefFor, onSelect, isDesktop }) => {
  const count = participants.length;
  const wrapRef = useRef(null);
  const [wrapH, setWrapH] = useState(0);

  let cols = 1;
  let rows = 1;
  let special3 = false;
  let scrollable = false;

  if (isDesktop) {
    if (count === 1) {
      cols = 1;
      rows = 1;
    } else if (count === 2) {
      cols = 2;
      rows = 1;
    } else if (count <= 4) {
      cols = 2;
      rows = 2;
    } else if (count <= 6) {
      cols = 3;
      rows = 2;
    } else if (count <= 9) {
      cols = 3;
      rows = 3;
    } else {
      cols = 4;
      scrollable = true;
    }
  } else {
    if (count === 1) {
      cols = 1;
      rows = 1;
    } else if (count === 2) {
      cols = 1;
      rows = 2;
    } else if (count === 3) {
      cols = 2;
      rows = 2;
      special3 = true;
    } else if (count === 4) {
      cols = 2;
      rows = 2;
    } else if (count <= 6) {
      cols = 3;
      rows = 2;
    } else if (count <= 9) {
      cols = 3;
      rows = 3;
    } else {
      cols = 3;
      scrollable = true;
    }
  }

  useEffect(() => {
    if (!scrollable || !wrapRef.current) return undefined;
    const el = wrapRef.current;
    const update = () => setWrapH(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollable]);

  if (count === 0) return null;

  const items = participants.map((p, i) => (
    <div
      key={p.identity}
      className="min-h-0 min-w-0"
      style={special3 && i === 0 ? { gridColumn: 'span 2' } : undefined}
    >
      <GridTile
        participant={p}
        cameraRef={camRefFor(p)}
        onClick={() => onSelect?.(p)}
      />
    </div>
  ));

  if (scrollable) {
    const rowH = wrapH > 0 ? Math.max(120, (wrapH - 16) / 3) : undefined;
    return (
      <div ref={wrapRef} className="h-full overflow-y-auto join-scroll">
        <div
          className="grid gap-2 pb-2"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            ...(rowH ? { gridAutoRows: `${rowH}px` } : {}),
          }}
        >
          {items}
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid h-full gap-2"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {items}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// Participant popup
// ═════════════════════════════════════════════════════════════════════
const ParticipantPopup = ({ participant, cameraRef, onClose }) => {
  if (!participant) return null;
  const isSpeaking = useIsSpeaking(participant);
  const micMuted = useIsMuted(Track.Source.Microphone, { participant });
  const info = getInfo(participant);
  const camOn = !!cameraRef && !cameraRef.publication?.isMuted;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-10"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full aspect-video rounded-2xl overflow-hidden bg-[#1a1a24] shadow-2xl"
        style={isSpeaking ? { boxShadow: `0 0 0 3px ${BRAND}` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition"
          aria-label="Close"
        >
          <FaTimes />
        </button>

        {camOn ? (
          <VideoTrack
            trackRef={cameraRef}
            className="w-full h-full object-contain"
            style={
              participant.isLocal ? { transform: 'scaleX(-1)' } : undefined
            }
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <Avatar info={info} size={140} />
            <p className="text-xl font-semibold">
              {info.name}
              {participant.isLocal ? ' (You)' : ''}
            </p>
          </div>
        )}

        <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm">
          {micMuted && <FaMicrophoneSlash className="text-red-400" />}
          <span>{participant.isLocal ? 'You' : info.name}</span>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// Pip bubble (for screen share)
// ═════════════════════════════════════════════════════════════════════
const PipBubble = ({ participant, cameraRef }) => {
  const isSpeaking = useIsSpeaking(participant);
  const micMuted = useIsMuted(Track.Source.Microphone, { participant });
  const info = getInfo(participant);
  const camOn = !!cameraRef && !cameraRef.publication?.isMuted;

  return (
    <div
      className="absolute top-3 right-3 z-10 w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-[#1a1a24] shadow-2xl"
      style={{
        border: `3px solid ${
          isSpeaking ? BRAND : 'rgba(255,255,255,0.25)'
        }`,
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
          <Avatar info={info} size={56} />
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
// Guest AI panel content — shared between overlay + sidebar
// ═════════════════════════════════════════════════════════════════════
const GuestAIPanelContent = ({
  tab,
  setTab,
  aiEnabled,
  recorderStatus,
  recorderError,
  transcript,
  liveSummary,
  chatMessages,
  noteReady,
  onClose,
}) => {
  const tabs = [
    { id: 'summary', label: 'Summary', icon: <FaBrain /> },
    { id: 'transcript', label: 'Transcript', icon: <FaCommentDots /> },
    { id: 'chat', label: 'Chat', icon: <FaLightbulb /> },
  ];

  const recorderProblem =
    aiEnabled &&
    ['muted', 'unsupported', 'no-mic', 'error'].includes(recorderStatus);

  return (
    <>
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
          aria-label="Close panel"
        >
          <FaTimes />
        </button>
      </div>

      {aiEnabled && (
        <div className="mx-4 mt-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-[11px] text-gray-300 flex-shrink-0">
          AI notes are on — everyone's speech, including yours, is transcribed
          for the meeting notes. Mute your mic to pause it for you.
        </div>
      )}

      {recorderProblem && (
        <div className="mx-4 mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-300 flex-shrink-0">
          {recorderMessage(recorderStatus, recorderError)}
        </div>
      )}

      <div className="flex border-b border-white/10 flex-shrink-0 mt-2">
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
                {transcript.length === 0
                  ? 'Listening for context…'
                  : 'Building the summary — it appears after a few more sentences…'}
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
              <div className="text-sm text-gray-400 flex items-center gap-2">
                {recorderStatus === 'listening' ||
                recorderStatus === 'sending' ? (
                  <FaSpinner className="animate-spin flex-shrink-0" />
                ) : null}
                <span>{recorderMessage(recorderStatus, recorderError)}</span>
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
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════
// Guest AI panel — mobile overlay
// ═════════════════════════════════════════════════════════════════════
const GuestAIPanelOverlay = ({
  open,
  onClose,
  tab,
  setTab,
  aiEnabled,
  recorderStatus,
  recorderError,
  transcript,
  liveSummary,
  chatMessages,
  noteReady,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex sm:items-stretch sm:justify-end">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full sm:w-[420px] h-[85dvh] sm:h-full bg-[#0f0f15] border-l border-white/10 flex flex-col sm:rounded-none rounded-t-2xl shadow-2xl overflow-hidden">
        <GuestAIPanelContent
          tab={tab}
          setTab={setTab}
          aiEnabled={aiEnabled}
          recorderStatus={recorderStatus}
          recorderError={recorderError}
          transcript={transcript}
          liveSummary={liveSummary}
          chatMessages={chatMessages}
          noteReady={noteReady}
          onClose={onClose}
        />
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// Guest AI sidebar — desktop
// ═════════════════════════════════════════════════════════════════════
const GuestAISidebar = ({
  width,
  onClose,
  tab,
  setTab,
  aiEnabled,
  recorderStatus,
  recorderError,
  transcript,
  liveSummary,
  chatMessages,
  noteReady,
}) => (
  <div
    style={{ width }}
    className="h-full flex flex-col bg-[#0f0f15] border-l border-white/10 flex-shrink-0 min-w-0"
  >
    <GuestAIPanelContent
      tab={tab}
      setTab={setTab}
      aiEnabled={aiEnabled}
      recorderStatus={recorderStatus}
      recorderError={recorderError}
      transcript={transcript}
      liveSummary={liveSummary}
      chatMessages={chatMessages}
      noteReady={noteReady}
      onClose={onClose}
    />
  </div>
);

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
      <div className="fixed bottom-24 right-4 z-[69] bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl p-3 w-64">
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
// Guest stage (inside LiveKit)
// ═════════════════════════════════════════════════════════════════════
const GuestCallStage = ({
  isVideo,
  onHangUp,
  deviceError,
  code,
  aiEnabled,
  recorderStatus,
  recorderError,
  onUploadAudio,
  onRecorderStatus,
  transcript,
  liveSummary,
  chatMessages,
  noteReady,
  aiPanelOpen,
  setAiPanelOpen,
  aiTab,
  setAiTab,
  raisedHands,
  dataSaver,
  onDataSaverChange,
}) => {
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    microphoneTrack,
  } = useLocalParticipant();
  const isDesktop = useIsDesktop();

  const [popped, setPopped] = useState(null);
  const [secs, setSecs] = useState(0);
  const [dataSaverOpen, setDataSaverOpen] = useState(false);

  // Sidebar width + resize
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [resizing, setResizing] = useState(false);
  const resizeStartRef = useRef({ x: 0, width: 0 });

  const startResize = useCallback(
    (e) => {
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      resizeStartRef.current = { x: clientX, width: sidebarWidth };
      setResizing(true);
    },
    [sidebarWidth]
  );

  useEffect(() => {
    if (!resizing) return undefined;
    const onMove = (e) => {
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      const delta = resizeStartRef.current.x - clientX;
      const maxW = Math.min(
        MAX_SIDEBAR_WIDTH,
        (typeof window !== 'undefined' ? window.innerWidth : 1400) - 420
      );
      const next = Math.max(
        MIN_SIDEBAR_WIDTH,
        Math.min(maxW, resizeStartRef.current.width + delta)
      );
      setSidebarWidth(next);
    };
    const onUp = () => setResizing(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);

    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [resizing]);

  // Close popup if participant leaves
  useEffect(() => {
    if (
      popped &&
      !participants.find((p) => p.identity === popped.identity)
    ) {
      setPopped(null);
    }
  }, [participants, popped]);

  const localScreenShare = screenTracks.find(
    (t) => t.participant.isLocal && !t.publication?.isMuted
  );
  const remoteScreenShare = screenTracks.find(
    (t) => !t.participant.isLocal && !t.publication?.isMuted
  );
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
        return;
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

  // ── AI audio capture for guests ─────────────────────────────────────
  // Same recorder as logged-in users; uploads go to the public
  // guest-audio endpoint. Pauses automatically while the guest is muted.
  useCallAIRecorder({
    enabled: aiEnabled,
    micOn: isMicrophoneEnabled,
    micTrack: microphoneTrack?.track?.mediaStreamTrack || null,
    onUpload: onUploadAudio,
    onStatus: onRecorderStatus,
  });

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
    <>
      <div className="h-dvh bg-[#0b0b10] text-white flex flex-col overflow-hidden">
        <GlobalStyles />

        {/* Header */}
        <div
          className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between border-b border-white/10 gap-2 flex-shrink-0"
          style={{ paddingTop: 'calc(0.65rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-semibold truncate flex items-center gap-2">
              {isVideo ? 'Video Meeting' : 'Voice Meeting'}
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
            <p className="text-[11px] sm:text-xs text-gray-400 truncate">
              {participants.length} participant
              {participants.length === 1 ? '' : 's'}
              {code && <span className="ml-2 text-gray-500">· {code}</span>}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isDesktop && (
              <button
                onClick={() => setAiPanelOpen((v) => !v)}
                title={aiPanelOpen ? 'Hide AI panel' : 'Show AI panel'}
                className={`h-9 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition ${
                  aiPanelOpen
                    ? 'bg-teal-600 hover:bg-teal-700'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <FaRobot />
                <span className="hidden lg:inline">AI</span>
              </button>
            )}
            <span className="text-sm tabular-nums text-gray-300">
              {formatClock(secs)}
            </span>
          </div>
        </div>

        {deviceError && (
          <div className="mx-2 sm:mx-3 mt-2 flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-300 flex-shrink-0">
            <FaExclamationTriangle className="flex-shrink-0" />
            <span>{deviceError}</span>
          </div>
        )}

        {/* Main split area */}
        <div className="flex-1 min-h-0 flex">
          {/* LEFT: video area */}
          <div className="flex-1 min-w-0 flex flex-col relative">
            <div className="flex-1 min-h-0 p-2 sm:p-3">
              {activeScreen ? (
                <div className="h-full flex flex-col gap-2">
                  <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden bg-black">
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

                    <div className="absolute bottom-2 left-2 bg-black/70 rounded-full px-3 py-1 text-xs flex items-center gap-1.5 pointer-events-none">
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

                  {/* Participant strip below share */}
                  <div className="flex gap-2 overflow-x-auto flex-shrink-0 pb-1">
                    {participants
                      .filter(
                        (p) => p.identity !== activeScreen.participant.identity
                      )
                      .map((p) => (
                        <div
                          key={p.identity}
                          className="w-24 h-16 sm:w-32 sm:h-20 flex-shrink-0"
                        >
                          <GridTile
                            participant={p}
                            cameraRef={camRefFor(p)}
                            onClick={() => setPopped(p)}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <VideoGrid
                  participants={participants}
                  camRefFor={camRefFor}
                  onSelect={(p) => setPopped(p)}
                  isDesktop={isDesktop}
                />
              )}
            </div>

            <RoomAudioRenderer />
            <StartAudio
              label="Tap to enable audio"
              className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-white text-gray-900 font-medium shadow-lg"
            />

            {/* Floating AI panel button (inside video column) */}
            <button
              onClick={() => setAiPanelOpen((v) => !v)}
              className="absolute bottom-20 right-3 z-[65] w-12 h-12 rounded-xl flex items-center justify-center shadow-xl transition active:scale-95"
              style={{ backgroundColor: BRAND }}
              title="Open AI panel"
            >
              <FaRobot className="text-lg" />
              {transcript.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-md min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                  {transcript.length > 99 ? '99+' : transcript.length}
                </span>
              )}
            </button>

            {/* Controls */}
            <div
              className="px-2 sm:px-4 py-2.5 sm:py-4 bg-white/5 border-t border-white/10 flex items-center justify-center gap-2 sm:gap-3 relative flex-shrink-0"
              style={{
                paddingBottom: 'calc(0.65rem + env(safe-area-inset-bottom, 0px))',
              }}
            >
              <button
                onClick={toggleMic}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition ${
                  isMicrophoneEnabled
                    ? 'bg-gray-600 hover:bg-gray-500'
                    : 'bg-red-600'
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
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition ${
                    isCameraEnabled
                      ? 'bg-gray-600 hover:bg-gray-500'
                      : 'bg-red-600'
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
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition ${
                    isSharingScreen
                      ? 'bg-teal-600 hover:bg-teal-700'
                      : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                  aria-label={isSharingScreen ? 'Stop sharing' : 'Share screen'}
                >
                  <FaDesktop className="text-lg" />
                </button>
              )}

              <button
                onClick={() => setDataSaverOpen((v) => !v)}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition ${
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
                className="w-12 h-12 sm:w-14 sm:h-14 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition shadow-lg ml-1"
                aria-label="Leave call"
              >
                <FaPhoneSlash className="text-lg sm:text-xl" />
              </button>

              <GuestDataSaverMenu
                open={dataSaverOpen}
                onClose={() => setDataSaverOpen(false)}
                dataSaver={dataSaver}
                onChange={onDataSaverChange}
              />
            </div>
          </div>

          {/* RIGHT: AI sidebar (desktop only) */}
          {isDesktop && aiPanelOpen && (
            <>
              <div
                onMouseDown={startResize}
                onTouchStart={startResize}
                className={`w-1.5 cursor-col-resize flex-shrink-0 transition-colors ${
                  resizing ? 'bg-teal-500' : 'bg-white/5 hover:bg-teal-500/60'
                }`}
                style={{ touchAction: 'none' }}
              />
              <GuestAISidebar
                width={sidebarWidth}
                onClose={() => setAiPanelOpen(false)}
                tab={aiTab}
                setTab={setAiTab}
                aiEnabled={aiEnabled}
                recorderStatus={recorderStatus}
                recorderError={recorderError}
                transcript={transcript}
                liveSummary={liveSummary}
                chatMessages={chatMessages}
                noteReady={noteReady}
              />
            </>
          )}
        </div>
      </div>

      {/* Participant popup */}
      {popped && (
        <ParticipantPopup
          participant={popped}
          cameraRef={camRefFor(popped)}
          onClose={() => setPopped(null)}
        />
      )}

      {/* Mobile overlay */}
      {!isDesktop && (
        <GuestAIPanelOverlay
          open={aiPanelOpen}
          onClose={() => setAiPanelOpen(false)}
          tab={aiTab}
          setTab={setAiTab}
          aiEnabled={aiEnabled}
          recorderStatus={recorderStatus}
          recorderError={recorderError}
          transcript={transcript}
          liveSummary={liveSummary}
          chatMessages={chatMessages}
          noteReady={noteReady}
        />
      )}
    </>
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

  // ─── AI state ─────────────────────────────────────────────
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

  // AI audio recorder state (reported by useCallAIRecorder)
  const [recorderStatus, setRecorderStatus] = useState('idle');
  const [recorderError, setRecorderError] = useState('');

  // AI panel — default open on desktop, closed on mobile
  const [aiPanelOpen, setAiPanelOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768
  );
  const [aiTab, setAiTab] = useState('summary');

  const leavingRef = useRef(false);
  const aiNoticeShownRef = useRef(false);

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

  const handleGuestJoin = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.error('Please enter your name');
    if (trimmed.length > 50)
      return toast.error('Name is too long (max 50 chars)');

    setPhase('connecting');
    setErrorMsg('');
    setPermError('');

    try {
      const data = await fetchGuestToken(trimmed);
      setGuestTokenData(data);
      setCallType(data.type || 'video');

      if (data.ai?.enabled) setAiEnabled(true);
      if (Array.isArray(data.recentTranscript))
        setTranscript(data.recentTranscript);
      if (data.liveSummary) setLiveSummary(data.liveSummary);
      if (Array.isArray(data.recentMessages))
        setChatMessages(data.recentMessages);
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

  // Poll public state (AI on/off, transcript, summary, chat, hands)
  useEffect(() => {
    if (phase !== 'in-call' || !code) return undefined;
    let cancelled = false;

    const fetchState = async () => {
      try {
        const url = `${API_BASE}/calls/public/${encodeURIComponent(
          code.trim()
        )}/state`;
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
        if (Array.isArray(data.recentTranscript))
          setTranscript(data.recentTranscript);
        setLiveSummary(data.liveSummary || null);
        if (Array.isArray(data.recentMessages))
          setChatMessages(data.recentMessages);
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

  // Tell guests when AI starts recording (their speech gets transcribed)
  useEffect(() => {
    if (phase === 'in-call' && aiEnabled && !aiNoticeShownRef.current) {
      aiNoticeShownRef.current = true;
      toast.info(
        'AI notes are on — speech in this meeting is being transcribed for notes.',
        { autoClose: 6000 }
      );
    }
    if (!aiEnabled) aiNoticeShownRef.current = false;
  }, [phase, aiEnabled]);

  // Upload one standalone audio segment from the guest's mic.
  // Throws on failure so the recorder can show the problem in the AI panel.
  const handleUploadAudio = useCallback(
    async (blob, filename) => {
      const guestId = guestTokenData?.guestId;
      if (!guestId || !code) throw new Error('Not connected as a guest.');

      const form = new FormData();
      form.append('audio', blob, filename);
      form.append('guestId', guestId);

      const res = await fetch(
        `${API_BASE}/calls/guest-audio/${encodeURIComponent(code.trim())}`,
        { method: 'POST', body: form }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Upload failed (${res.status})`);
      }
      // ai-disabled right after the host stops AI is normal — not an error.
      return data;
    },
    [guestTokenData?.guestId, code]
  );

  const handleRecorderStatus = useCallback((status, msg) => {
    setRecorderStatus(status);
    setRecorderError(msg || '');
  }, []);

  const handleDataSaverChange = useCallback((patch) => {
    setDataSaver((prev) => ({ ...prev, ...patch }));
  }, []);

  const retryPermission = async () => {
    setPermError('');
    const perm = await ensureCallPermissions(false);
    if (!perm.ok) {
      setPermError(perm.message || 'Microphone permission is required.');
      return;
    }
    setPhase('in-call');
  };

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

  // ─── Phase: loading ───────────────────────────────────────
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

  // ─── Phase: connecting ────────────────────────────────────
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

  // ─── Phase: error ─────────────────────────────────────────
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
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              {errorMsg}
            </p>
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

  // ─── Phase: permission-denied ─────────────────────────────
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
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              {permError}
            </p>
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

  // ─── Phase: need-name ─────────────────────────────────────
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
                <FaLock className="text-[9px]" /> Your name is only shown in this
                call
              </p>
            </div>
          </div>
        </Shell>
      </>
    );
  }

  // ─── Phase: in-call ───────────────────────────────────────
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
            recorderStatus={recorderStatus}
            recorderError={recorderError}
            onUploadAudio={handleUploadAudio}
            onRecorderStatus={handleRecorderStatus}
            transcript={transcript}
            liveSummary={liveSummary}
            chatMessages={chatMessages}
            noteReady={noteReady}
            aiPanelOpen={aiPanelOpen}
            setAiPanelOpen={setAiPanelOpen}
            aiTab={aiTab}
            setAiTab={setAiTab}
            raisedHands={raisedHands}
            dataSaver={dataSaver}
            onDataSaverChange={handleDataSaverChange}
          />
        </LiveKitRoom>
      </>
    );
  }

  // ─── Phase: connection lost ───────────────────────────────
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

  // ─── Phase: ended ─────────────────────────────────────────
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