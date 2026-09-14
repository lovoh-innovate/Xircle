import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useSocket } from './SocketContext.jsx';
import { useCallSocket } from '../hooks/useCallSocket';
import {
  FaPhoneSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaSpinner,
} from 'react-icons/fa';

// How long we wait for callData to show up (via socket/incomingCall) before
// giving up and redirecting. Covers the brief gap between navigation and
// the SocketContext state update landing on a re-render.
const CALL_DATA_GRACE_MS = 4000;

// Resolve a display name for a remote participant given their WebRTC
// userId. `participants` can arrive in two different shapes depending on
// where callData came from:
//  - the flat socket/push shape:            { _id, name, email }
//  - the raw Mongoose-populated subdoc:      { user: { _id, name }, status }
// (the caller's callData currently comes from the raw REST response of
// initiateCall, which is the second shape; the callee's comes from the
// socket 'incoming-call' event / push payload, which is the first shape.)
// This handles both so the name resolves regardless of which flow built
// callData, instead of falling back to printing the raw uid.
const resolveParticipantName = (participants, uid) => {
  const participant = (participants || []).find((p) => {
    if (!p) return false;
    if (p._id === uid) return true;
    if (typeof p.user === 'string') return p.user === uid;
    if (p.user && typeof p.user === 'object') return p.user._id === uid;
    return false;
  });
  return participant?.name || participant?.user?.name || 'Participant';
};

const CallScreen = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Auto‑join flag from push notification
  const autoJoin = searchParams.get('autoJoin') === 'true';

  // Current user info
  const { userInfo } = useSelector((state) => state.auth);
  const userId = userInfo?._id || userInfo?.id;

  // ── Get socket context ──────────────────────────────────────────────
  // IMPORTANT: never throw here based on this value. socketContext can be
  // legitimately falsy for a render or two (StrictMode's double-invoke,
  // or a brief instant before SocketProvider finishes mounting), and a
  // component that sometimes throws mid-render and sometimes doesn't is
  // exactly what corrupts React's hook bookkeeping ("Should have a
  // queue" / "change in the order of Hooks"). Every hook below this line
  // must run unconditionally, every render, regardless of this value —
  // so we destructure with a safe fallback instead of bailing out.
  const socketContext = useSocket();
  const { incomingCall, clearIncomingCall } = socketContext || {};

  // ── Resolve callData from whichever source has it ──────────────────
  // 1. location.state – used when the caller initiates a call from within
  //    the app (e.g. clicking "Call" navigates with state directly).
  // 2. incomingCall (SocketContext) – used for the callee/push‑notification
  //    flow, populated either by the live socket 'incoming-call' event or
  //    by main.jsx's handlePushTapped before it navigates here.
  const stateCallData = location.state?.callData;
  const socketCallData =
    incomingCall && incomingCall.roomId === roomId ? incomingCall : null;

  // Prefer stateCallData, then socketCallData
  const callData = stateCallData || socketCallData;

  const [waitedTooLong, setWaitedTooLong] = useState(false);

  // ── Go back to wherever the call was started from ───────────────────
  // react-router marks the very first history entry in a browsing
  // session with location.key === 'default'. If that's what we're on,
  // there is no real "previous page" to go back to in-app (e.g. the
  // user arrived here fresh via a push-notification deep link) — in
  // that case navigate(-1) could exit the app or land somewhere
  // meaningless, so we fall back to /my-workspaces instead. Otherwise,
  // navigate(-1) genuinely returns to whatever screen the call was
  // started/received from.
  const goBackFromCall = useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/my-workspaces', { replace: true });
    }
  }, [location.key, navigate]);

  // Give callData a moment to arrive (covers native cold‑start timing)
  // before deciding there's genuinely nothing to show.
  useEffect(() => {
    if (callData) return;
    const timeout = setTimeout(() => setWaitedTooLong(true), CALL_DATA_GRACE_MS);
    return () => clearTimeout(timeout);
  }, [callData]);

  // Redirect only once we've genuinely given up waiting
  useEffect(() => {
    if (!callData && waitedTooLong) {
      navigate('/my-workspaces', { replace: true });
    }
  }, [callData, waitedTooLong, navigate]);

  // Clear the "incoming call" flag from context once we've consumed it into
  // this screen, so IncomingCallModal doesn't also try to render it.
  useEffect(() => {
    if (socketCallData && clearIncomingCall) {
      clearIncomingCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketCallData?.roomId]);

  // ── Use call socket hook — must run on every render regardless of
  // whether callData exists yet. The hook itself needs to tolerate
  // callData being null/undefined internally (return no-op state, don't
  // throw, don't skip calling it).
  const {
    localStream,
    remoteStreams,
    callStatus,
    isMuted,
    isCameraOff,
    hangUp,
    toggleMute,
    toggleCamera,
    acceptCall,
    startLocalStream,
  } = useCallSocket(callData);

  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const [isConnecting, setIsConnecting] = useState(false);
  const hasInitialized = useRef(false);

  // ── Set up local video stream ──────────────────────────────────────
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // ── Set up remote video streams ────────────────────────────────────
  useEffect(() => {
    Object.entries(remoteStreams || {}).forEach(([uid, stream]) => {
      if (remoteVideoRefs.current[uid]) {
        remoteVideoRefs.current[uid].srcObject = stream;
      }
    });
  }, [remoteStreams]);

  // ── Handle call initiation / acceptance — run once callData exists ─
  useEffect(() => {
    if (!callData || hasInitialized.current) return;
    hasInitialized.current = true;

    const initCall = async () => {
      setIsConnecting(true);
      try {
        if (callData.isInitiator) {
          // Caller: just warm up the mic/camera and wait. We do NOT
          // send a WebRTC offer here — the callee hasn't navigated to
          // their call screen yet, so nobody is listening for it and
          // it would be lost. Once the callee actually joins the call
          // room, the socket layer fires 'participant-joined' to us,
          // and *that* is what triggers sending them the offer (see
          // useCallSocket's handleParticipantJoined). This removes the
          // race that was causing calls to ring forever with no audio.
          await startLocalStream(true);
        } else {
          // Receiver: accept call (either via push auto‑join or manual accept)
          await acceptCall();
        }
      } catch (error) {
        console.error('Call initialization error:', error);
        // Optionally show a toast or redirect
      } finally {
        setIsConnecting(false);
      }
    };

    initCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callData]);

  // ── End the call and return to wherever it was started from ────────
  const handleHangUp = useCallback(async () => {
    await hangUp();
    goBackFromCall();
  }, [hangUp, goBackFromCall]);

  // ── NOW it's safe to bail out — every hook above has already run on
  // every render, so hook count stays constant whether callData exists,
  // or socketContext is momentarily missing, or not. ──────────────────
  if (!socketContext) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <FaSpinner className="animate-spin text-3xl" />
      </div>
    );
  }

  if (!callData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <FaSpinner className="animate-spin text-3xl" />
      </div>
    );
  }

  // ── Destructure callData with defaults ────────────────────────────
  const {
    callId,
    type = 'voice',
    participants = [],
    isInitiator = false,
    workspaceId,
    workspaceColor = '#0d9488',
  } = callData;

  // ── If call ended, show ended screen ──────────────────────────────
  if (callStatus === 'ended') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">📞</div>
          <h2 className="text-2xl font-bold mb-2">Call Ended</h2>
          <p className="text-gray-400 mb-8">
            {type === 'video' ? 'Your video call has ended.' : 'Your voice call has ended.'}
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

  const isRinging = callStatus === 'ringing';
  const isOngoing = callStatus === 'ongoing';

  // ── Render the call UI ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-gray-800">
        <h3 className="text-lg font-semibold">
          {type === 'video' ? 'Video Call' : 'Voice Call'}
        </h3>
        <span className="text-sm text-gray-400">
          {isRinging && 'Ringing...'}
          {isOngoing && `${Object.keys(remoteStreams).length} participant(s)`}
          {isConnecting && 'Connecting...'}
        </span>
      </div>

      {/* Main content area */}
      <div className="flex-1 p-4 overflow-auto">
        {isRinging && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FaSpinner className="animate-spin text-4xl mx-auto mb-4" style={{ color: workspaceColor }} />
              <p className="text-lg">Waiting for others to join...</p>
            </div>
          </div>
        )}

        {isOngoing && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
            {/* Local video tile */}
            {type === 'video' && localStream && (
              <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col items-center justify-center">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ minHeight: '200px' }}
                />
                <div className="absolute bottom-2 left-2 bg-black/60 px-3 py-1 rounded-full text-sm">
                  You {isMuted ? '(muted)' : ''}{isCameraOff ? '(camera off)' : ''}
                </div>
              </div>
            )}

            {/* Remote video tiles */}
            {Object.entries(remoteStreams).map(([uid, stream]) => {
              const name = resolveParticipantName(participants, uid);
              return (
                <div
                  key={uid}
                  className="relative bg-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col items-center justify-center"
                >
                  <video
                    ref={(el) => (remoteVideoRefs.current[uid] = el)}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ minHeight: '200px' }}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 px-3 py-1 rounded-full text-sm">
                    {name}
                  </div>
                </div>
              );
            })}

            {/* Audio‑only fallback */}
            {type === 'voice' && Object.keys(remoteStreams).length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center text-gray-400">
                <div className="text-6xl mb-4">🎙️</div>
                <p>Voice call in progress</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Call controls */}
      <div className="p-4 bg-gray-800/50 border-t border-gray-700 flex items-center justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
            isMuted ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'
          }`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          disabled={isRinging}
        >
          {isMuted ? <FaMicrophoneSlash className="text-xl" /> : <FaMicrophone className="text-xl" />}
        </button>

        {type === 'video' && (
          <button
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
              isCameraOff ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'
            }`}
            aria-label={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
            disabled={isRinging}
          >
            {isCameraOff ? <FaVideoSlash className="text-xl" /> : <FaVideo className="text-xl" />}
          </button>
        )}

        <button
          onClick={handleHangUp}
          className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition shadow-lg"
          aria-label="End Call"
        >
          <FaPhoneSlash className="text-2xl" />
        </button>
      </div>
    </div>
  );
};

export default CallScreen;