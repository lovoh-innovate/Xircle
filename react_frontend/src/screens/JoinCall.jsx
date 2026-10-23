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
import { Track, DisconnectReason, MediaDeviceFailure } from 'livekit-client';
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
  FaCheck,
  FaCopy,
  FaArrowLeft,
  FaLock,
  FaUsers,
  FaCircle,
} from 'react-icons/fa';

import { useJoinByMeetingCodeMutation } from '../slices/callApiSlice';
import { ensureCallPermissions } from '../utils/callPermissions';

// ─────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────
// Robust API_BASE builder to prevent missing /api prefix in production
const RAW_API_URL = import.meta.env.VITE_API_URL;
const API_BASE = (() => {
  // 1. Not set → default to same-origin /api
  if (!RAW_API_URL) return '/api';

  // 2. Strip trailing slashes
  const cleaned = String(RAW_API_URL).replace(/\/+$/, '');

  // 3. If it ends up empty (e.g. VITE_API_URL was "/"), fall back
  if (!cleaned) return '/api';

  // 4. If it's just an origin (no /api suffix), append /api
  //    e.g. "https://api.xircle.io" → "https://api.xircle.io/api"
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

const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
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

// ═════════════════════════════════════════════════════════════════════
// Guest stage (must live inside <LiveKitRoom>)
// ═════════════════════════════════════════════════════════════════════
const GuestCallStage = ({ isVideo, onHangUp, deviceError, code }) => {
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const speaking = useSpeakingParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();

  const [pinned, setPinned] = useState(null);
  const [lastSpeaker, setLastSpeaker] = useState(null);
  const [secs, setSecs] = useState(0);

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

  return (
    <div className="h-dvh bg-[#0b0b10] text-white flex flex-col">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-white/10 gap-2"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="min-w-0">
          <h3 className="text-base font-semibold truncate">
            {isVideo ? 'Video Meeting' : 'Voice Meeting'}
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

      {/* Main tile */}
      <div className="flex-1 min-h-0 px-3 pb-3">
        {mainP && (
          <ParticipantTile
            participant={mainP}
            cameraRef={camRefFor(mainP)}
            variant="main"
          />
        )}
      </div>

      <RoomAudioRenderer />
      <StartAudio
        label="Tap to enable audio"
        className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-white text-gray-900 font-medium shadow-lg"
      />

      {/* Controls */}
      <div
        className="px-4 py-4 bg-white/5 border-t border-white/10 flex items-center justify-center gap-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          onClick={toggleMic}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
            isMicrophoneEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-600'
          }`}
          aria-label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        >
          {isMicrophoneEnabled ? (
            <FaMicrophone className="text-xl" />
          ) : (
            <FaMicrophoneSlash className="text-xl" />
          )}
        </button>

        {isVideo && (
          <button
            onClick={toggleCam}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
              isCameraEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-600'
            }`}
            aria-label={isCameraEnabled ? 'Camera off' : 'Camera on'}
          >
            {isCameraEnabled ? (
              <FaVideo className="text-xl" />
            ) : (
              <FaVideoSlash className="text-xl" />
            )}
          </button>
        )}

        <button
          onClick={onHangUp}
          className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition shadow-lg"
          aria-label="Leave call"
        >
          <FaPhoneSlash className="text-2xl" />
        </button>
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

  // phases: loading | need-name | permission-denied | connecting | in-call | ended | error
  const [phase, setPhase] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [permError, setPermError] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const [connectionLost, setConnectionLost] = useState(false);
  const [name, setName] = useState('');
  const [guestTokenData, setGuestTokenData] = useState(null);
  const [callType, setCallType] = useState('video');

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

  // ─── Fetch guest token (public endpoint — no auth) ────────
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

      // Pre-check mic permission (video is best-effort via LiveKit)
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
  // Phase: connecting (logged-in auto-join, or guest awaiting token)
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
            {/* Header */}
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

            {/* Code chip */}
            <div className="flex items-center justify-center mb-6">
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs">
                <FaLink className="text-[10px] text-gray-400" />
                <span className="font-mono text-gray-300">{code}</span>
              </div>
            </div>

            {/* Form */}
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

            {/* Bottom links */}
            <div className="mt-6 text-center space-y-3">
              <p className="text-xs text-gray-500">
                Already have a Xircle account?{' '}
                <Link to="/login" className="text-teal-400 hover:text-teal-300 font-medium">
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
          />
        </LiveKitRoom>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: connection lost (rare — LiveKit gave up)
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