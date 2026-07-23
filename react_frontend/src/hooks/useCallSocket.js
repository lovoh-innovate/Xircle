// src/hooks/useCallSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../components/SocketContext';
import {
  useJoinCallMutation,
  useRejectCallMutation,
  useEndCallMutation,
} from '../slices/callApiSlice';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add your TURN server here if needed
  ],
};

export const useCallSocket = (callData) => {
  // callData: { callId, roomId, type, participants: [{_id, name, email}] }
  const { socket, isConnected } = useSocket();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [callStatus, setCallStatus] = useState(callData?.status || 'ringing'); // ringing/ongoing/ended
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const peerConnections = useRef({}); // userId -> RTCPeerConnection
  const localStreamRef = useRef(null);
  const [joinCall] = useJoinCallMutation();
  const [rejectCall] = useRejectCallMutation();
  const [endCall] = useEndCallMutation();

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

    // Store
    peerConnections.current[remoteUserId] = pc;
    return pc;
  }, [socket, callData?.roomId]);

  // ── Join call room and set up signaling listeners ───────────────
  useEffect(() => {
    if (!socket || !callData?.roomId || !isConnected) return;

    // Join the socket room for this call
    socket.emit('join-call-room', callData.roomId);

    // Listen for WebRTC signaling
    const handleOffer = async ({ from, sdp }) => {
      let pc = peerConnections.current[from];
      if (!pc) {
        pc = createPeerConnection(from);
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

    const handleCallEnded = () => {
      setCallStatus('ended');
    };

    const handleParticipantLeft = (userId) => {
      if (peerConnections.current[userId]) {
        peerConnections.current[userId].close();
        delete peerConnections.current[userId];
        setRemoteStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[userId];
          return newStreams;
        });
      }
    };

    socket.on('call-offer', handleOffer);
    socket.on('call-answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('call-ended', handleCallEnded);
    socket.on('participant-left', handleParticipantLeft);

    return () => {
      socket.emit('leave-call-room', callData.roomId);
      socket.off('call-offer', handleOffer);
      socket.off('call-answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('call-ended', handleCallEnded);
      socket.off('participant-left', handleParticipantLeft);
    };
  }, [socket, callData?.roomId, isConnected, createPeerConnection]);

  // ── Initiate connections to other participants ───────────────────
  const initiatePeerConnections = useCallback(async () => {
    const stream = await startLocalStream(true);
    if (!stream) return;

    const otherParticipants = (callData.participants || []).filter(
      p => p._id !== (socket?.userId)
    );

    for (const participant of otherParticipants) {
      const pc = createPeerConnection(participant._id);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call-offer', {
        toUserId: participant._id,
        roomId: callData.roomId,
        sdp: offer,
      });
    }
  }, [callData, socket, startLocalStream, createPeerConnection]);

  // ── Call controls ────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    await startLocalStream(true);
    await joinCall(callData.callId);
    setCallStatus('ongoing');
    // The offer/answer exchange will happen via socket listeners
  }, [callData, joinCall, startLocalStream]);

  const rejectTheCall = useCallback(async () => {
    await rejectCall(callData.callId);
    setCallStatus('ended');
  }, [callData, rejectCall]);

  const hangUp = useCallback(async () => {
    // Close all peer connections
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    // Notify server
    await endCall(callData.callId);
    socket.emit('leave-call', callData.roomId);
    setCallStatus('ended');
  }, [callData, endCall, socket]);

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

  // ── Clean up on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(peerConnections.current).forEach(pc => pc.close());
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
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
    initiatePeerConnections, // used when starting a call from caller side
  };
};