// src/hooks/useCallSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../components/SocketContext';
import {
  useJoinCallMutation,
  useRejectCallMutation,
  useEndCallMutation,
  useInviteToCallMutation,   // ← new
} from '../slices/callApiSlice';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add your TURN server here if needed
  ],
};

export const useCallSocket = (callData) => {
  // callData: { callId, roomId, type, participants: [{_id, name, email}], status }
  const { socket, isConnected } = useSocket();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [callStatus, setCallStatus] = useState(callData?.status || 'ringing');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const peerConnections = useRef({});        // userId -> RTCPeerConnection
  const connectedUsers = useRef(new Set()); // track already connected
  const localStreamRef = useRef(null);

  const [joinCall] = useJoinCallMutation();
  const [rejectCall] = useRejectCallMutation();
  const [endCall] = useEndCallMutation();
  const [inviteToCall] = useInviteToCallMutation(); // ← new

  // ── Release all media + peer connections (shared by hangUp and
  // remote call-ended handling, so the mic is never left locked) ──
  const releaseCallResources = useCallback(() => {
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    connectedUsers.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    setRemoteStreams({});
  }, []);

  // ── Get local media ──────────────────────────────────────────────
  const startLocalStream = useCallback(async (videoEnabled = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callData?.type === 'video' ? videoEnabled : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      return null;
    }
  }, [callData?.type]);

  // ── Create a peer connection for a specific user ────────────────
  const createPeerConnection = useCallback((remoteUserId) => {
    // Avoid duplicate connections
    if (connectedUsers.current.has(remoteUserId)) return null;
    if (peerConnections.current[remoteUserId]) return peerConnections.current[remoteUserId];

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [remoteUserId]: event.streams[0],
      }));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          toUserId: remoteUserId,
          roomId: callData.roomId,
          candidate: event.candidate,
        });
      }
    };

    peerConnections.current[remoteUserId] = pc;
    connectedUsers.current.add(remoteUserId);
    return pc;
  }, [socket, callData?.roomId]);

  // ── Send WebRTC offer to a specific user ────────────────────────
  const sendOfferToUser = useCallback(async (remoteUserId) => {
    const pc = createPeerConnection(remoteUserId);
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call-offer', {
        toUserId: remoteUserId,
        roomId: callData.roomId,
        sdp: offer,
      });
    } catch (err) {
      console.error('Failed to send offer to', remoteUserId, err);
    }
  }, [createPeerConnection, socket, callData?.roomId]);

  // ── Initiate connections to all other participants ───────────────
  const initiatePeerConnections = useCallback(async () => {
    const stream = await startLocalStream(true);
    if (!stream) return;

    const otherParticipants = (callData.participants || [])
      .filter(p => p._id !== socket?.userId);

    for (const participant of otherParticipants) {
      await sendOfferToUser(participant._id);
    }
  }, [callData, socket?.userId, startLocalStream, sendOfferToUser]);

  // ── Add a remote user (call this when a new participant joins) ──
  const addRemoteUser = useCallback(async (userId) => {
    if (userId === socket?.userId) return;
    if (connectedUsers.current.has(userId)) return;
    await sendOfferToUser(userId);
  }, [socket?.userId, sendOfferToUser]);

  // ── Join call room and set up signaling listeners ───────────────
  useEffect(() => {
    if (!socket || !callData?.roomId || !isConnected) return;

    socket.emit('join-call-room', callData.roomId);

    const handleOffer = async ({ from, sdp }) => {
      let pc = peerConnections.current[from];
      if (!pc) {
        pc = createPeerConnection(from);
        if (!pc) return; // already connected or failed
      }
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call-answer', {
        toUserId: from,
        roomId: callData.roomId,
        sdp: answer,
      });
    };

    const handleAnswer = async ({ from, sdp }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    };

    // ── Call ended from the other side (or server) — release media
    // so the mic/camera isn't left locked at the OS/WebView level. ──
    const handleCallEnded = () => {
      releaseCallResources();
      setCallStatus('ended');
    };

    const handleParticipantLeft = (userId) => {
      if (peerConnections.current[userId]) {
        peerConnections.current[userId].close();
        delete peerConnections.current[userId];
        connectedUsers.current.delete(userId);
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[userId];
          return newStreams;
        });
      }
    };

    // ── New participant joined the call (invitee or late joiner) ──
    const handleParticipantJoined = (userId) => {
      addRemoteUser(userId);
    };

    socket.on('call-offer', handleOffer);
    socket.on('call-answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('call-ended', handleCallEnded);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('participant-joined', handleParticipantJoined); // ← new

    return () => {
      socket.emit('leave-call-room', callData.roomId);
      socket.off('call-offer', handleOffer);
      socket.off('call-answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('call-ended', handleCallEnded);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('participant-joined', handleParticipantJoined);
    };
  }, [socket, callData?.roomId, isConnected, createPeerConnection, addRemoteUser, releaseCallResources]);

  // ── Call controls ────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    await startLocalStream(true);
    const result = await joinCall(callData.callId);
    setCallStatus('ongoing');

    // If the call is already ongoing (late join), connect to all participants
    if (callData.status === 'ongoing') {
      await initiatePeerConnections();
    }
    // If it was ringing, the caller will send offers; we just listen.
  }, [callData, joinCall, startLocalStream, initiatePeerConnections]);

  const rejectTheCall = useCallback(async () => {
    await rejectCall(callData.callId);
    setCallStatus('ended');
  }, [callData, rejectCall]);

  const hangUp = useCallback(async () => {
    releaseCallResources();
    await endCall(callData.callId);
    socket.emit('leave-call', callData.roomId);
    setCallStatus('ended');
  }, [callData, endCall, socket, releaseCallResources]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  }, []);

  // ── Invite / re‑ring users ──────────────────────────────────────
  const inviteUsers = useCallback(async (userIds) => {
    if (!callData?.callId) throw new Error('No active call');
    const result = await inviteToCall({
      callId: callData.callId,
      inviteUserIds: userIds,
    }).unwrap();
    // The server will emit 'participant-joined' for each invited user
    // when they actually join; we don't connect to them until they join.
    return result;
  }, [callData?.callId, inviteToCall]);

  // ── Clean up on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      releaseCallResources();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    localStream,
    remoteStreams,
    callStatus,
    isMuted,
    isCameraOff,
    acceptCall,
    rejectCall: rejectTheCall,
    hangUp,
    toggleMute,
    toggleCamera,
    initiatePeerConnections,
    inviteUsers,           // ← new: call this with an array of userIds
    addRemoteUser,         // ← expose in case you need to manually add a user
  };
};