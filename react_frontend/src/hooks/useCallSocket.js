// src/hooks/useCallSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../components/SocketContext';
import {
  useJoinCallMutation,
  useRejectCallMutation,
  useEndCallMutation,
  useInviteToCallMutation,
  useGetCallTokenMutation,
} from '../slices/callApiSlice';

// ─────────────────────────────────────────────────────────────────────
// Call lifecycle hook (LiveKit edition)
//
// Sockets  → ringing layer: who is calling, who joined, call ended.
// LiveKit  → all audio/video. No offers, answers, ICE or TURN here.
//
// callData: { callId, roomId, type, participants, status }
//
// Media connects only once callStatus === 'ongoing':
//   • callee: right after acceptCall() succeeds
//   • caller: when the server reports someone joined
// ─────────────────────────────────────────────────────────────────────

export const useCallSocket = (callData) => {
  const { socket, isConnected } = useSocket();

  const [callStatus, setCallStatus] = useState(callData?.status || 'ringing');
  const [media, setMedia] = useState(null); // { token, url, roomId, type }
  const [mediaError, setMediaError] = useState('');

  const fetchingTokenRef = useRef(false);

  const [joinCall] = useJoinCallMutation();
  const [rejectCall] = useRejectCallMutation();
  const [endCall] = useEndCallMutation();
  const [inviteToCall] = useInviteToCallMutation();
  const [getCallToken] = useGetCallTokenMutation();

  const callId = callData?.callId;
  const roomId = callData?.roomId;
  const isVideo = callData?.type === 'video';

  // ── Fetch the LiveKit token ─────────────────────────────────────
  const connectMedia = useCallback(async () => {
    if (!callId || fetchingTokenRef.current) return;
    fetchingTokenRef.current = true;
    setMediaError('');
    try {
      const data = await getCallToken(callId).unwrap();
      setMedia({
        token: data.token,
        url: data.url,
        roomId: data.roomId,
        type: data.type,
      });
    } catch (err) {
      console.error('[call] Failed to get media token:', err);
      setMediaError(err?.data?.message || 'Could not connect to the call.');
    } finally {
      fetchingTokenRef.current = false;
    }
  }, [callId, getCallToken]);

  // Connect media as soon as the call is live
  useEffect(() => {
    if (callStatus === 'ongoing' && !media && !mediaError) {
      connectMedia();
    }
  }, [callStatus, media, mediaError, connectMedia]);

  // ── Socket room + call events ───────────────────────────────────
  useEffect(() => {
    if (!socket || !roomId || !isConnected) return;

    // Needed to receive 'call-ended' (including ring timeout)
    socket.emit('join-call-room', roomId, (res) => {
      if (res?.error) {
        console.warn('[call] join-call-room refused:', res.error);
        setCallStatus((prev) => (prev === 'ended' ? prev : 'ended'));
      }
    });

    const handleParticipantUpdate = (payload) => {
      if (!payload) return;
      if (callId && payload.callId && String(payload.callId) !== String(callId)) return;

      // Someone accepted → the call is live for everyone
      if (payload.status === 'joined') {
        setCallStatus((prev) => (prev === 'ended' ? prev : 'ongoing'));
      }
    };

    const handleCallEnded = (payload) => {
      if (payload?.callId && callId && String(payload.callId) !== String(callId)) return;
      setMedia(null); // unmounts <LiveKitRoom>, which releases mic/camera
      setCallStatus('ended');
    };

    socket.on('call-participant-update', handleParticipantUpdate);
    socket.on('call-ended', handleCallEnded);

    return () => {
      socket.emit('leave-call-room', roomId);
      socket.off('call-participant-update', handleParticipantUpdate);
      socket.off('call-ended', handleCallEnded);
    };
  }, [socket, roomId, callId, isConnected]);

  // ── Call controls ───────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!callId) {
      console.warn('[call] acceptCall called with no callId — ignoring', callData);
      return;
    }
    try {
      await joinCall(callId).unwrap();
      setCallStatus('ongoing'); // effect above fetches the token
    } catch (err) {
      console.error('[call] Failed to join call:', err);
      setMediaError(err?.data?.message || 'This call is no longer available.');
      setCallStatus('ended');
    }
  }, [callId, callData, joinCall]);

  const rejectTheCall = useCallback(async () => {
    if (!callId) {
      console.warn('[call] rejectCall called with no callId — ignoring', callData);
      setCallStatus('ended');
      return;
    }
    try {
      await rejectCall(callId).unwrap();
    } catch (err) {
      console.error('[call] Failed to reject call:', err);
    }
    setCallStatus('ended');
  }, [callId, callData, rejectCall]);

  const hangUp = useCallback(async () => {
    setMedia(null); // disconnect from LiveKit immediately
    setCallStatus('ended');
    if (callId) {
      try {
        await endCall(callId).unwrap();
      } catch (err) {
        // Already ended by the other side — nothing to do
        console.warn('[call] endCall failed (probably already ended):', err);
      }
    } else {
      console.warn('[call] hangUp called with no callId — skipping endCall request', callData);
    }
    if (socket && roomId) {
      socket.emit('leave-call-room', roomId);
    }
  }, [callId, callData, endCall, socket, roomId]);

  const inviteUsers = useCallback(
    async (userIds) => {
      if (!callId) throw new Error('No active call');
      return inviteToCall({ callId, inviteUserIds: userIds }).unwrap();
    },
    [callId, inviteToCall]
  );

  const retryMedia = useCallback(() => {
    setMedia(null);
    setMediaError('');
  }, []);

  return {
    callStatus,     // 'ringing' | 'ongoing' | 'ended'
    media,          // null until live, then { token, url, roomId, type }
    mediaError,     // string, empty when OK
    isVideo,
    acceptCall,
    rejectCall: rejectTheCall,
    hangUp,
    inviteUsers,
    retryMedia,     // clears the error; the effect then fetches a fresh token
  };
}