import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { useNavigate } from 'react-router-dom';
import { useRejectCallMutation } from '../slices/callApiSlice';
import { FaPhone, FaPhoneSlash } from 'react-icons/fa';

const IncomingCallModal = () => {
  const { incomingCall, clearIncomingCall } = useSocket();
  const navigate = useNavigate();
  const [rejectCall] = useRejectCallMutation();
  const audioRef = useRef(null);
  const [isRinging, setIsRinging] = useState(false);

  // Play ringtone when incoming call appears
  useEffect(() => {
    if (incomingCall) {
      setIsRinging(true);
      if (audioRef.current) {
        audioRef.current.loop = true;
        audioRef.current.play().catch(err => console.warn('Ringtone play failed:', err));
      }
    } else {
      setIsRinging(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  const { roomId, type, caller, callId, participants, workspaceColor } = incomingCall;
  const brandColor = workspaceColor || '#0d9488';

  const handleAccept = () => {
    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // Navigate to call screen with full call data and autoJoin flag
    navigate(`/call/${roomId}?autoJoin=true`, {
      state: {
        callData: {
          ...incomingCall,
          status: 'ringing',
          isInitiator: false,
        },
      },
    });
    clearIncomingCall();
  };

  const handleDecline = async () => {
    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // Tell the server we rejected
    try {
      await rejectCall(callId).unwrap();
    } catch (err) {
      console.error('Reject call error:', err);
    }
    clearIncomingCall();
  };

  const callerName = caller?.name || 'Unknown Caller';
  const callerAvatar = caller?.profile || null;

  return (
    <>
      {/* Ringtone audio element */}
      <audio ref={audioRef} src="/ringtone.mp3" preload="auto" />

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
          {/* Top gradient accent */}
          <div
            className="h-20"
            style={{ background: `linear-gradient(135deg, ${brandColor} 0%, #111827 100%)` }}
          />

          {/* Caller info */}
          <div className="flex flex-col items-center -mt-10 mb-6 px-6">
            {callerAvatar ? (
              <img
                src={callerAvatar}
                alt={callerName}
                className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-md"
                style={{ backgroundColor: brandColor }}
              >
                {callerName.charAt(0).toUpperCase()}
              </div>
            )}
            <h2 className="mt-4 text-xl font-bold text-gray-900">{callerName}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {type === 'video' ? 'Video Call' : 'Voice Call'} · Incoming
            </p>
            {isRinging && (
              <div className="flex items-center gap-1 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-gray-500">Ringing...</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-6 pb-8 px-6">
            <button
              onClick={handleDecline}
              className="flex flex-col items-center gap-2 group"
              aria-label="Decline call"
            >
              <div className="w-14 h-14 rounded-full bg-red-100 group-hover:bg-red-200 flex items-center justify-center transition">
                <FaPhoneSlash className="text-red-600 text-xl" />
              </div>
              <span className="text-xs text-gray-500 font-medium">Decline</span>
            </button>
            <button
              onClick={handleAccept}
              className="flex flex-col items-center gap-2 group"
              aria-label="Accept call"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center transition"
                style={{ backgroundColor: brandColor }}
              >
                <FaPhone className="text-white text-xl" />
              </div>
              <span className="text-xs text-gray-500 font-medium">Accept</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default IncomingCallModal;