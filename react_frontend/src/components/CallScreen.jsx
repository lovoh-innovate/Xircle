// src/components/CallScreen.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from './SocketContext.jsx';
import { useCallSocket } from '../hooks/useCallSocket';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  GridLayout,
  ParticipantTile,
  useTracks,
  useLocalParticipant,
  useParticipants,
} from '@livekit/components-react';
import { Track, DisconnectReason } from 'livekit-client';
import '@livekit/components-styles';
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

// ─────────────────────────────────────────────────────────────────────
// In-call UI. Must live INSIDE <LiveKitRoom> so the LiveKit hooks work.
// LiveKit handles all audio/video; this just renders tiles + controls.
// ─────────────────────────────────────────────────────────────────────
const CallStage = ({ isVideo, workspaceColor, onHangUp }) => {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  const toggleMute = () => {
    localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  const toggleCamera = () => {
    localParticipant?.setCameraEnabled(!isCameraEnabled);
  };

  const isMuted = !isMicrophoneEnabled;
  const isCameraOff = !isCameraEnabled;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-gray-800">
        <h3 className="text-lg font-semibold">
          {isVideo ? 'Video Call' : 'Voice Call'}
        </h3>
        <span className="text-sm text-gray-400">
          {participants.length} participant{participants.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Tiles */}
      <div className="flex-1 min-h-0 p-4" style={{ height: 'calc(100vh - 150px)' }}>
        <GridLayout tracks={tracks} style={{ height: '100%' }}>
          <ParticipantTile />
        </GridLayout>
      </div>

      {/* Audio output + autoplay unlock for mobile WebViews */}
      <RoomAudioRenderer />
      <StartAudio
        label="Tap to enable audio"
        className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-white text-gray-900 font-medium shadow-lg"
      />

      {/* Controls */}
      <div className="p-4 bg-gray-800/50 border-t border-gray-700 flex items-center justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
            isMuted ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'
          }`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <FaMicrophoneSlash className="text-xl" /> : <FaMicrophone className="text-xl" />}
        </button>

        {isVideo && (
          <button
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
              isCameraOff ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'
            }`}
            aria-label={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCameraOff ? <FaVideoSlash className="text-xl" /> : <FaVideo className="text-xl" />}
          </button>
        )}

        <button
          onClick={onHangUp}
          className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition shadow-lg"
          aria-label="End Call"
          style={{ boxShadow: `0 0 0 2px ${workspaceColor}22` }}
        >
          <FaPhoneSlash className="text-2xl" />
        </button>
      </div>
    </div>
  );
};

const CallScreen = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // ── Socket context ──────────────────────────────────────────────────
  // Never throw based on this value; every hook below must run
  // unconditionally on every render (see hook-order note in earlier
  // versions). We destructure with a safe fallback and bail out later.
  const socketContext = useSocket();
  const { incomingCall, clearIncomingCall } = socketContext || {};

  // ── Resolve callData from whichever source has it ──────────────────
  // 1. location.state – caller started the call from inside the app.
  // 2. incomingCall (SocketContext) – callee / push-notification flow.
  const stateCallData = location.state?.callData;
  const socketCallData =
    incomingCall && incomingCall.roomId === roomId ? incomingCall : null;
  const callData = stateCallData || socketCallData;

  const [waitedTooLong, setWaitedTooLong] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const leavingRef = useRef(false);
  const hasInitialized = useRef(false);

  // ── Go back to wherever the call was started from ───────────────────
  const goBackFromCall = useCallback(() => {
    if (location.key && location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/my-workspaces', { replace: true });
    }
  }, [location.key, navigate]);

  // Give callData a moment to arrive (covers native cold-start timing)
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

  // Clear the "incoming call" flag once consumed so IncomingCallModal
  // doesn't also try to render it.
  useEffect(() => {
    if (socketCallData && clearIncomingCall) {
      clearIncomingCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketCallData?.roomId]);

  // ── Call lifecycle hook (must run on every render) ──────────────────
  const {
    callStatus,
    media,
    mediaError,
    isVideo,
    acceptCall,
    hangUp,
    retryMedia,
  } = useCallSocket(callData);

  // ── Receiver: accept the call once callData exists ──────────────────
  // Caller: nothing to do. The caller is already an accepted participant
  // server-side; media connects automatically once someone joins and
  // the hook flips callStatus to 'ongoing'.
  useEffect(() => {
    if (!callData || hasInitialized.current) return;
    hasInitialized.current = true;

    if (!callData.isInitiator) {
      acceptCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callData]);

  // ── End the call and return to wherever it was started from ────────
  const handleHangUp = useCallback(async () => {
    leavingRef.current = true;
    await hangUp();
    goBackFromCall();
  }, [hangUp, goBackFromCall]);

  // LiveKit gave up reconnecting (network dropped, etc.). Don't end the
  // call for everyone, just let this user try to reconnect.
  const handleDisconnected = useCallback((reason) => {
    if (leavingRef.current) return;
    if (reason === DisconnectReason.CLIENT_INITIATED) return;
    setConnectionLost(true);
  }, []);

  const handleReconnect = useCallback(() => {
    setConnectionLost(false);
    retryMedia(); // clears media; the hook then fetches a fresh token
  }, [retryMedia]);

  // ── Safe to bail out now: all hooks have run ────────────────────────
  if (!socketContext || !callData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <FaSpinner className="animate-spin text-3xl" />
      </div>
    );
  }

  const {
    type = 'voice',
    workspaceColor = '#0d9488',
  } = callData;

  // ── Call ended ──────────────────────────────────────────────────────
  if (callStatus === 'ended') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
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

  // ── Live call (LiveKit connected) ───────────────────────────────────
  if (media && !connectionLost) {
    return (
      <div data-lk-theme="default" className="min-h-screen bg-gray-900">
        <LiveKitRoom
          serverUrl={media.url}
          token={media.token}
          connect
          audio
          video={isVideo}
          onDisconnected={handleDisconnected}
        >
          <CallStage
            isVideo={isVideo}
            workspaceColor={workspaceColor}
            onHangUp={handleHangUp}
          />
        </LiveKitRoom>
      </div>
    );
  }

  // ── Everything else: ringing / connecting / error / connection lost ─
  const isRinging = callStatus === 'ringing';

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-gray-800">
        <h3 className="text-lg font-semibold">
          {type === 'video' ? 'Video Call' : 'Voice Call'}
        </h3>
        <span className="text-sm text-gray-400">
          {isRinging ? 'Ringing...' : 'Connecting...'}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          {mediaError || connectionLost ? (
            <>
              <p className="text-lg mb-4">
                {mediaError || 'Connection lost.'}
              </p>
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
              <FaSpinner
                className="animate-spin text-4xl mx-auto mb-4"
                style={{ color: workspaceColor }}
              />
              <p className="text-lg">
                {isRinging ? 'Waiting for others to join...' : 'Connecting to the call...'}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="p-4 bg-gray-800/50 border-t border-gray-700 flex items-center justify-center">
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