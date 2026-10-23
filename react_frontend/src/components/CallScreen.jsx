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
  FaLink,
  FaPhone,
  FaArrowLeft,
  FaCheck,
  FaSignOutAlt,
  FaCopy,
  FaCircle,
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
} from '../slices/callApiSlice';

// ─────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────
const BRAND = '#06b6d4'; // cyan-500 — matches GeneralSidebar accent
const POLL_MS = 20_000;

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

const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
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
}) => {
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const speaking = useSpeakingParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();

  const [pinned, setPinned] = useState(null);
  const [lastSpeaker, setLastSpeaker] = useState(null);
  const [secs, setSecs] = useState(0);
  const [endMenuOpen, setEndMenuOpen] = useState(false);

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

  // Show "End for everyone" only when creator AND (meeting OR 3+ people)
  const showEndMenu =
    isCreator &&
    remotes.length > 0 &&
    (call?.isMeeting || (call?.participants || []).length > 2);

  return (
    <div className="h-dvh bg-[#0b0b10] text-white flex flex-col">
      <style>{`
        @keyframes call-bar-anim { 0%,100% { height: 4px } 50% { height: 16px } }
        .call-bar { height: 4px; animation: call-bar-anim 0.8s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-white/10 gap-2"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="min-w-0">
          <h3 className="text-base font-semibold truncate">
            {call?.isMeeting
              ? 'Meeting'
              : isVideo
              ? 'Video Call'
              : 'Voice Call'}
          </h3>
          <p className="text-xs text-gray-400">
            {participants.length} participant{participants.length === 1 ? '' : 's'}
            {call?.isMeeting && call?.meetingCode && (
              <span className="ml-2 text-gray-500">· {call.meetingCode}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {call?.isMeeting && call?.meetingLink && (
            <button
              onClick={onCopyLink}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              title="Copy meeting link"
            >
              <FaLink className="text-sm" />
            </button>
          )}
          <span className="text-sm tabular-nums text-gray-300 ml-1">
            {formatClock(secs)}
          </span>
        </div>
      </div>

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

      <RoomAudioRenderer />
      <StartAudio
        label="Tap to enable audio"
        className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-white text-gray-900 font-medium shadow-lg"
      />

      {/* Controls */}
      <div
        className="px-4 py-4 bg-white/5 border-t border-white/10 flex items-center justify-center gap-4 relative"
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
          onClick={() => (showEndMenu ? setEndMenuOpen((v) => !v) : onHangUp())}
          onContextMenu={(e) => {
            if (showEndMenu) {
              e.preventDefault();
              setEndMenuOpen(true);
            }
          }}
          className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition shadow-lg"
          aria-label="Leave / End call"
        >
          <FaPhoneSlash className="text-2xl" />
        </button>

        {endMenuOpen && showEndMenu && (
          <>
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setEndMenuOpen(false)}
            />
            <div className="absolute bottom-24 z-[70] bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden w-52">
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

  // Accept both route shapes: /call/:callId  (new)  and  /call/:roomId  (legacy)
  const callId = params.callId || params.roomId;
  const myId = String(userInfo?._id || '');

  // ─── Queries ───────────────────────────────────────────────
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

  // ─── Mutations ─────────────────────────────────────────────
  const [getCallToken] = useGetCallTokenMutation();
  const [joinCall] = useJoinCallMutation();
  const [leaveCall] = useLeaveCallMutation();
  const [endCall] = useEndCallMutation();
  const [rejectCall] = useRejectCallMutation();

  // ─── Local state ───────────────────────────────────────────
  const [phase, setPhase] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [tokenData, setTokenData] = useState(null);
  const [permState, setPermState] = useState('idle');
  const [permError, setPermError] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const [connectionLost, setConnectionLost] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

  const leavingRef = useRef(false);
  const hasJoinedRef = useRef(false);

  // ─── My participant ────────────────────────────────────────
  const myParticipant = useMemo(
    () => call?.participants?.find((p) => getUserId(p) === myId),
    [call, myId]
  );
  const isCreator = String(call?.creator?._id || call?.creator || '') === myId;
  const wantsVideo = call?.type === 'video';

  // ─── Navigation helper ─────────────────────────────────────
  const goBack = useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/calls', { replace: true });
    }
  }, [location.key, navigate]);

  // ─── Auth guard ────────────────────────────────────────────
  useEffect(() => {
    if (!userInfo) navigate('/login', { replace: true });
  }, [userInfo, navigate]);

  // ─── Phase resolution ──────────────────────────────────────
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

  // ─── Permission pre-flight ─────────────────────────────────
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

  // ─── Join: permission → joinCall (if needed) → token ───────
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
    [callId, joinCall, getCallToken, myParticipant, permState, runPermissionCheck]
  );

  // Auto-join if already accepted (creator, or user accepted via Calls page)
  useEffect(() => {
    if (phase === 'joining' && !tokenData && myParticipant?.status === 'accepted') {
      doJoin({ markAccepted: false });
    }
  }, [phase, tokenData, myParticipant, doJoin]);

  // ─── Socket: room + call-ended listener ────────────────────
  useEffect(() => {
    if (!socket || !call?.roomId) return;
    socket.emit('join-call-room', call.roomId, () => {});

    const onEnded = () => {
      if (leavingRef.current) return;
      setPhase('ended');
      refetchCall?.();
    };

    socket.on('call-ended', onEnded);
    return () => {
      socket.off('call-ended', onEnded);
      socket.emit('leave-call-room', call.roomId);
    };
  }, [socket, call?.roomId, refetchCall]);

  // ─── Actions ───────────────────────────────────────────────
  const handleAnswer = () => doJoin({ markAccepted: true });

  const handleDecline = async () => {
    try {
      await rejectCall(callId).unwrap();
    } catch {
      /* ignore */
    }
    goBack();
  };

  const handleHangUp = useCallback(async () => {
    leavingRef.current = true;
    try {
      await leaveCall(callId).unwrap();
    } catch {
      /* ignore */
    }
    goBack();
  }, [callId, leaveCall, goBack]);

  const handleEndForAll = useCallback(async () => {
    leavingRef.current = true;
    try {
      await endCall(callId).unwrap();
    } catch {
      /* ignore */
    }
    goBack();
  }, [callId, endCall, goBack]);

  const handleDisconnected = useCallback(
    async (reason) => {
      if (leavingRef.current) return;
      if (reason === DisconnectReason.CLIENT_INITIATED) return;
      // Try to fetch latest state — maybe the call actually ended
      try {
        const result = await refetchCall().unwrap();
        if (['ended', 'missed', 'cancelled'].includes(result?.call?.status)) {
          setPhase('ended');
          return;
        }
      } catch {
        /* ignore */
      }
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

  // ─── Early returns ─────────────────────────────────────────
  if (!callId || !userInfo) {
    return (
      <FullScreen>
        <FaExclamationTriangle className="text-3xl text-amber-400 mb-3" />
        <p className="text-white text-base mb-4">Invalid call link.</p>
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-full text-white font-semibold"
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
          className="px-6 py-3 rounded-full text-white font-semibold"
          style={{ backgroundColor: BRAND }}
        >
          Go back
        </button>
      </FullScreen>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: error
  // ═══════════════════════════════════════════════════════════
  if (phase === 'error') {
    return (
      <FullScreen>
        <FaExclamationTriangle className="text-3xl text-red-400 mb-3" />
        <p className="text-white text-base mb-4">{errorMsg}</p>
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-full text-white font-semibold"
          style={{ backgroundColor: BRAND }}
        >
          Go back
        </button>
      </FullScreen>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: ended-for-you
  // ═══════════════════════════════════════════════════════════
  if (phase === 'ended-for-you') {
    const wasLeft = myParticipant?.status === 'left';
    return (
      <FullScreen>
        <div className="text-6xl mb-6">📞</div>
        <h2 className="text-2xl font-bold mb-2">
          {wasLeft ? 'You left this call' : 'You rejected this call'}
        </h2>
        <p className="text-gray-400 mb-8 text-sm max-w-sm mx-auto text-center">
          {call?.status === 'ongoing'
            ? 'The call is still going on for other participants.'
            : 'The call has ended.'}
        </p>
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-full font-semibold text-white transition"
          style={{ backgroundColor: BRAND }}
        >
          Back to calls
        </button>
      </FullScreen>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: ended
  // ═══════════════════════════════════════════════════════════
  if (phase === 'ended') {
    return (
      <FullScreen>
        <div className="text-6xl mb-6">📞</div>
        <h2 className="text-2xl font-bold mb-2">Call Ended</h2>
        <p className="text-gray-400 mb-8 text-sm">
          {call?.type === 'video' ? 'Your video call has ended.' : 'Your voice call has ended.'}
        </p>
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-full font-semibold text-white transition"
          style={{ backgroundColor: BRAND }}
        >
          Back to calls
        </button>
      </FullScreen>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Phase: can-join / joining
  // ═══════════════════════════════════════════════════════════
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
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
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
              <div className="mb-4 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-300">
                {permError}
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-sm text-amber-300">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              {isRinging && (
                <button
                  onClick={handleDecline}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition shadow-lg"
                  aria-label="Decline"
                >
                  <FaPhoneSlash className="text-xl" />
                </button>
              )}
              <button
                onClick={handleAnswer}
                disabled={phase === 'joining'}
                className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
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

  // ═══════════════════════════════════════════════════════════
  // Phase: in-call
  // ═══════════════════════════════════════════════════════════
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
          />
        </LiveKitRoom>

        {endConfirmOpen && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEndConfirmOpen(false)}
          >
            <div
              className="bg-[#14141a] border border-white/10 rounded-2xl max-w-sm w-full p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-white mb-2">End for everyone?</h3>
              <p className="text-xs text-gray-400 mb-5">
                This will disconnect all participants. It cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEndConfirmOpen(false)}
                  className="py-2.5 border border-white/15 rounded-xl text-sm text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setEndConfirmOpen(false);
                    handleEndForAll();
                  }}
                  className="py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium"
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

  // ═══════════════════════════════════════════════════════════
  // Phase: connection lost
  // ═══════════════════════════════════════════════════════════
  if (connectionLost) {
    return (
      <FullScreen>
        <FaExclamationTriangle className="text-3xl text-amber-400 mb-3" />
        <h2 className="text-xl font-bold mb-2">Connection lost</h2>
        <p className="text-sm text-gray-400 mb-6 max-w-sm text-center">
          We couldn’t reconnect to the call. Try again or leave.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setConnectionLost(false);
              leavingRef.current = false;
              hasJoinedRef.current = false;
              doJoin({ markAccepted: false });
            }}
            className="px-6 py-3 rounded-full font-semibold text-white"
            style={{ backgroundColor: BRAND }}
          >
            Reconnect
          </button>
          <button
            onClick={handleHangUp}
            className="px-6 py-3 rounded-full font-semibold bg-red-600 hover:bg-red-700 text-white"
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