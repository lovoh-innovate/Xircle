import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCallSocket } from '../hooks/useCallSocket';
import {
  FaPhoneSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaSpinner,
} from 'react-icons/fa';

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

  // Extract call data passed via navigation state
  const callData = location.state?.callData;

  // Redirect if no call data
  useEffect(() => {
    if (!callData || !callData.roomId) {
      navigate('/my-workspaces', { replace: true });
    }
  }, [callData, navigate]);

  if (!callData) return null;

  const {
    callId,
    roomId: callRoomId,
    type,
    participants = [],
    isInitiator = false,
    workspaceId,
    workspaceColor,
  } = callData;

  const brandColor = workspaceColor || '#0d9488';

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
    initiatePeerConnections,
  } = useCallSocket(callData);

  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const [isConnecting, setIsConnecting] = useState(false);

  // Set up local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Set up remote video streams
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([userId, stream]) => {
      if (remoteVideoRefs.current[userId]) {
        remoteVideoRefs.current[userId].srcObject = stream;
      }
    });
  }, [remoteStreams]);

  // Handle call initiation / acceptance
  useEffect(() => {
    if (!callData) return;

    const initCall = async () => {
      setIsConnecting(true);
      if (isInitiator) {
        // Caller: start peer connections
        await initiatePeerConnections();
      } else {
        // Receiver: accept call (either manually or via auto‑join)
        await acceptCall();
      }
      setIsConnecting(false);
    };

    // If autoJoin is true, we automatically accept (from push notification)
    // Otherwise, the user already clicked Accept in the modal, so we accept anyway.
    // For the caller, we just initiate.
    if (isInitiator) {
      initCall();
    } else {
      // Auto‑join or manual accept – either way we accept the call
      initCall();
    }
  }, []); // run once on mount

  // If call ended, show ended screen
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
            onClick={() => navigate('/my-workspaces')}
            className="px-6 py-3 rounded-full font-semibold text-white transition"
            style={{ backgroundColor: brandColor }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isRinging = callStatus === 'ringing';
  const isOngoing = callStatus === 'ongoing';

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
              <FaSpinner className="animate-spin text-4xl mx-auto mb-4" style={{ color: brandColor }} />
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
              const participant = participants.find((p) => p._id === uid || p.user === uid);
              const name = participant?.name || participant?.user?.name || uid;
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
          onClick={hangUp}
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