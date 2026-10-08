// src/components/CallScreen.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from './SocketContext.jsx';
import { useCallSocket } from '../hooks/useCallSocket';
import { ensureCallPermissions } from '../utils/callPermissions';
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
  FaPhoneSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaSpinner,
  FaExclamationTriangle,
} from 'react-icons/fa';

const CALL_DATA_GRACE_MS = 4000;

// Stable reference (LiveKitRoom re-creates the room if this changes)
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
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
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

// ─────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────
const Avatar = ({ info, size, brandColor }) => {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (info.profile) {
    return (
      <img
        src={info.profile}
        alt={info.name}
        style={style}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ ...style, backgroundColor: brandColor }}
      className="rounded-full flex items-center justify-center font-bold text-white"
    >
      {info.name.charAt(0).toUpperCase()}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// One participant tile (main or thumbnail)
// ─────────────────────────────────────────────────────────────────────
const ParticipantCard = ({
  participant,
  cameraRef,
  variant,
  brandColor,
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
      ? { boxShadow: `0 0 0 2px rgba(255,255,255,0.35)` }
      : {};

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

      {/* Name pill (thumbs, or main when camera is on) */}
      {(!isMain || camOn) && (
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1 bg-black/55 rounded-full px-2 py-0.5 text-[11px] sm:text-xs">
          {micMuted && <FaMicrophoneSlash className="text-red-400 flex-shrink-0" />}
          <span className="truncate">
            {participant.isLocal ? 'You' : info.name}
          </span>
        </div>
      )}

      {/* Main tile extras */}
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

// ─────────────────────────────────────────────────────────────────────
// In-call UI (must live INSIDE <LiveKitRoom>)
// ─────────────────────────────────────────────────────────────────────
const CallStage = ({ isVideo, brandColor, onHangUp, deviceError }) => {
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

  return (
    <div className="h-dvh bg-[#0b0b10] text-white flex flex-col">
      <style>{`
        @keyframes call-bar-anim { 0%,100% { height: 4px } 50% { height: 16px } }
        .call-bar { height: 4px; animation: call-bar-anim 0.8s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-white/10"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div>
          <h3 className="text-base font-semibold">
            {isVideo ? 'Video Call' : 'Voice Call'}
          </h3>
          <p className="text-xs text-gray-400">
            {participants.length} participant{participants.length === 1 ? '' : 's'}
          </p>
        </div>
        <span className="text-sm tabular-nums text-gray-300">{formatClock(secs)}</span>
      </div>

      {/* Device error banner */}
      {deviceError && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-300">
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

      {/* Main tile */}
      <div className="flex-1 min-h-0 px-3 pb-3">
        {mainP && (
          <ParticipantCard
            participant={mainP}
            cameraRef={camRefFor(mainP)}
            variant="main"
            brandColor={brandColor}
          />
        )}
      </div>

      {/* Audio output + autoplay unlock */}
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
            aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
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
          aria-label="End call"
        >
          <FaPhoneSlash className="text-2xl" />
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────
const CallScreen = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const socketContext = useSocket();
  const { incomingCall, clearIncomingCall } = socketContext || {};

  const stateCallData = location.state?.callData;
  const socketCallData =
    incomingCall && incomingCall.roomId === roomId ? incomingCall : null;
  const callData = stateCallData || socketCallData;

  const [waitedTooLong, setWaitedTooLong] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const [deviceError, setDeviceError] = useState('');
  const [permState, setPermState] = useState('idle'); // idle | checking | granted | denied
  const [permError, setPermError] = useState('');
  const leavingRef = useRef(false);
  const hasInitialized = useRef(false);
  const permStartedRef = useRef(false);

  const wantsVideo = callData?.type === 'video';

  const goBackFromCall = useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/my-workspaces', { replace: true });
    }
  }, [location.key, navigate]);

  useEffect(() => {
    if (callData) return;
    const timeout = setTimeout(() => setWaitedTooLong(true), CALL_DATA_GRACE_MS);
    return () => clearTimeout(timeout);
  }, [callData]);

  useEffect(() => {
    if (!callData && waitedTooLong) {
      navigate('/my-workspaces', { replace: true });
    }
  }, [callData, waitedTooLong, navigate]);

  useEffect(() => {
    if (socketCallData && clearIncomingCall) {
      clearIncomingCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketCallData?.roomId]);

  const { callStatus, media, mediaError, isVideo, acceptCall, hangUp, retryMedia } =
    useCallSocket(callData);

  // ── Ask for mic/camera permission as soon as the call screen opens ──
  const runPermissionCheck = useCallback(async () => {
    setPermState('checking');
    setPermError('');
    const res = await ensureCallPermissions(wantsVideo);
    if (res.ok) {
      setPermState('granted');
    } else {
      setPermState('denied');
      setPermError(res.message || 'Microphone permission is required.');
    }
  }, [wantsVideo]);

  useEffect(() => {
    if (!callData || permStartedRef.current) return;
    permStartedRef.current = true;
    runPermissionCheck();
  }, [callData, runPermissionCheck]);

  // ── Receiver: accept once callData exists ──
  useEffect(() => {
    if (!callData || hasInitialized.current) return;
    hasInitialized.current = true;
    if (!callData.isInitiator) {
      acceptCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callData]);

  const handleHangUp = useCallback(async () => {
    leavingRef.current = true;
    await hangUp();
    goBackFromCall();
  }, [hangUp, goBackFromCall]);

  const handleDisconnected = useCallback((reason) => {
    if (leavingRef.current) return;
    if (reason === DisconnectReason.CLIENT_INITIATED) return;
    setConnectionLost(true);
  }, []);

  const handleDeviceFailure = useCallback((failure) => {
    console.error('[call] media device failure:', failure);
    setDeviceError(deviceFailureMessage(failure));
  }, []);

  const handleReconnect = useCallback(() => {
    setConnectionLost(false);
    setDeviceError('');
    retryMedia();
  }, [retryMedia]);

  if (!socketContext || !callData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <FaSpinner className="animate-spin text-3xl" />
      </div>
    );
  }

  const { type = 'voice', workspaceColor = '#0d9488', participants = [] } = callData;

  // ── Call ended ──
  if (callStatus === 'ended') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0b10] text-white p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">📞</div>
          <h2 className="text-2xl font-bold mb-2">Call Ended</h2>
          <p className="text-gray-400 mb-8">
            {mediaError ||
              (type === 'video' ? 'Your video call has ended.' : 'Your voice call has ended.')}
          </p>
          <button
            onClick={goBackFromCall}
            className="px-6 py-3 rounded-full font-semibold text-white transition"
            style={{ backgroundColor: workspaceColor }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Permission denied ──
  if (permState === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0b10] text-white p-6">
        <div className="text-center max-w-sm">
          <FaMicrophoneSlash className="text-5xl text-red-400 mx-auto mb-5" />
          <h2 className="text-xl font-bold mb-2">Microphone needed</h2>
          <p className="text-gray-400 mb-6 text-sm">{permError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={runPermissionCheck}
              className="px-5 py-3 rounded-full font-semibold text-white"
              style={{ backgroundColor: workspaceColor }}
            >
              Try again
            </button>
            <button
              onClick={handleHangUp}
              className="px-5 py-3 rounded-full font-semibold bg-red-600 hover:bg-red-700"
            >
              Leave call
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Live call ──
  if (media && permState === 'granted' && !connectionLost) {
    return (
      <LiveKitRoom
        serverUrl={media.url}
        token={media.token}
        connect
        audio
        video={isVideo}
        options={ROOM_OPTIONS}
        onDisconnected={handleDisconnected}
        onMediaDeviceFailure={handleDeviceFailure}
      >
        <CallStage
          isVideo={isVideo}
          brandColor={workspaceColor}
          onHangUp={handleHangUp}
          deviceError={deviceError}
        />
      </LiveKitRoom>
    );
  }

  // ── Ringing / connecting / error / connection lost ──
  const isRinging = callStatus === 'ringing';
  const others = participants.filter((p) => p._id !== callData?.caller?._id).slice(0, 3);

  let statusText = 'Connecting to the call...';
  if (isRinging) statusText = 'Ringing...';
  if (permState === 'checking') statusText = 'Allow microphone access to continue...';

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col">
      <div
        className="p-4 flex items-center justify-between border-b border-white/10"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <h3 className="text-lg font-semibold">
          {type === 'video' ? 'Video Call' : 'Voice Call'}
        </h3>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          {mediaError || connectionLost ? (
            <>
              <p className="text-lg mb-4">{mediaError || 'Connection lost.'}</p>
              <button
                onClick={handleReconnect}
                className="px-6 py-3 rounded-full font-semibold text-white transition"
                style={{ backgroundColor: workspaceColor }}
              >
                Reconnect
              </button>
            </>
          ) : (
            <>
              <div className="flex justify-center gap-3 mb-6">
                {others.map((p) => (
                  <Avatar
                    key={p._id}
                    info={{ name: p.name || '?', profile: '' }}
                    size={72}
                    brandColor={workspaceColor}
                  />
                ))}
              </div>
              <FaSpinner
                className="animate-spin text-3xl mx-auto mb-4"
                style={{ color: workspaceColor }}
              />
              <p className="text-lg">{statusText}</p>
            </>
          )}
        </div>
      </div>

      <div
        className="p-4 bg-white/5 border-t border-white/10 flex items-center justify-center"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          onClick={handleHangUp}
          className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition shadow-lg"
          aria-label="End call"
        >
          <FaPhoneSlash className="text-2xl" />
        </button>
      </div>
    </div>
  );
};

export default CallScreen;