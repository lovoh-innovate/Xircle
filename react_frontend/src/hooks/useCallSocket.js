// src/hooks/useCallSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../components/SocketContext';
import {
  useJoinCallMutation,
  useRejectCallMutation,
  useEndCallMutation,
  useInviteToCallMutation,   // ← new
} from '../slices/callApiSlice';

// ── ICE servers ──────────────────────────────────────────────────────
// STUN alone only works when both peers' NATs allow direct hole-punching.
// On localhost this always "worked" because both peers were the same
// machine — no NAT traversal was ever actually needed, which is exactly
// why this gap didn't show up until production. In production, two users
// on separate real networks (mobile carrier CGNAT, corporate firewalls,
// symmetric NATs) frequently CANNOT connect directly — ICE just sits at
// "checking" and eventually "failed", with no error surfaced to the UI.
// That's the "wants to connect, stuck at 0 participants" symptom. A TURN
// server relays media when a direct path isn't possible; without one,
// some real-world pairs of users will simply never connect.
//
// Replace the placeholder TURN entry with real credentials before
// shipping. Options: self-host coturn, or a managed service (Twilio
// Network Traversal Service, Xirsys, Cloudflare Calls, Metered TURN).
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        'turn:YOUR_TURN_HOST:3478?transport=udp',
        'turn:YOUR_TURN_HOST:3478?transport=tcp',
        'turns:YOUR_TURN_HOST:5349?transport=tcp',
      ],
      username: 'YOUR_TURN_USERNAME',
      credential: 'YOUR_TURN_CREDENTIAL',
    },
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
  const localStreamPromiseRef = useRef(null); // in-flight getUserMedia promise, so concurrent callers await the same one

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
    localStreamPromiseRef.current = null;

    setRemoteStreams({});
  }, []);

  // ── Get local media ──────────────────────────────────────────────
  const startLocalStream = useCallback(async (videoEnabled = true) => {
    if (localStreamRef.current) return localStreamRef.current;
    if (localStreamPromiseRef.current) return localStreamPromiseRef.current;

    const promise = (async () => {
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
      } finally {
        localStreamPromiseRef.current = null;
      }
    })();

    localStreamPromiseRef.current = promise;
    return promise;
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
    } else {
      console.warn(
        `[call] Creating peer connection to ${remoteUserId} with NO local stream yet — ` +
        `this pc will not send any tracks. Callers of createPeerConnection must await ` +
        `startLocalStream() first.`
      );
    }

    // ── ICE / connection diagnostics ───────────────────────────────
    // This is the key signal for the "0 participants, never connects"
    // production symptom: if this logs "failed" (and you never see
    // "connected"), it's ICE/TURN, not signaling — call-offer/answer
    // already succeeded or you wouldn't have a pc to log from.
    pc.oniceconnectionstatechange = () => {
      console.log(`[call:ice-state] peer=${remoteUserId} iceConnectionState=${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        console.error(
          `[call:ice-state] ICE FAILED for peer=${remoteUserId}. This almost always means ` +
          `no direct path exists between the two networks and no working TURN server is ` +
          `configured to relay media. Check ICE_SERVERS in useCallSocket.js.`
        );
      }
    };
    pc.onconnectionstatechange = () => {
      console.log(`[call:pc-state] peer=${remoteUserId} connectionState=${pc.connectionState}`);
    };
    pc.onicegatheringstatechange = () => {
      console.log(`[call:ice-gathering] peer=${remoteUserId} iceGatheringState=${pc.iceGatheringState}`);
    };
    pc.onicecandidateerror = (event) => {
      console.warn(`[call:ice-candidate-error] peer=${remoteUserId}`, {
        errorCode: event.errorCode,
        errorText: event.errorText,
        url: event.url,
      });
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(`[call:ontrack] received remote track from peer=${remoteUserId}`, event.track.kind);
      setRemoteStreams(prev => ({
        ...prev,
        [remoteUserId]: event.streams[0],
      }));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        // Candidate type (host/srflx/relay) tells you what kind of path
        // was found. If you only ever see "host"/"srflx" and never
        // "relay" candidates being generated locally, that's expected
        // without TURN — but if the OTHER side also has none, and
        // srflx/host don't reach each other, connection fails.
        console.log(`[call:ice-candidate] peer=${remoteUserId} type=${event.candidate.type} protocol=${event.candidate.protocol}`);
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

  // ── Initiate connections to all currently-known participants.
  // NOTE: this is intentionally NOT called automatically when a call
  // starts. Sending an offer immediately on mount races against the
  // other participant navigating to their call screen and registering
  // their 'call-offer' listener — if we're faster (which we usually
  // are, since we don't need to wait for a push notification tap),
  // the offer is emitted to a socket with no listener yet and is lost
  // forever, silently breaking the whole call.
  //
  // Instead, offers are sent reactively: whoever is *already in* the
  // call room gets a 'participant-joined' event the moment someone
  // else joins (see the socket effect below), and sends the offer at
  // that point — by which time the joiner's listeners are guaranteed
  // to be live. This function is kept around for cases where you
  // already know who's in the room (e.g. a manual retry/reconnect).
  // ──────────────────────────────────────────────────────────────
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
    await startLocalStream(true);
    await sendOfferToUser(userId);
  }, [socket?.userId, sendOfferToUser, startLocalStream]);

  // ── Join call room and set up signaling listeners ───────────────
  useEffect(() => {
    if (!socket || !callData?.roomId || !isConnected) return;

    socket.emit('join-call-room', callData.roomId);

    const handleOffer = async ({ from, sdp }) => {
      await startLocalStream(true);

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
      // Receiving a real offer means someone is actually on the call.
      setCallStatus((prev) => (prev === 'ended' ? prev : 'ongoing'));
    };

    const handleAnswer = async ({ from, sdp }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
      // We only get an answer once someone has actually joined and
      // accepted — flip the caller's UI out of "Ringing" here.
      setCallStatus((prev) => (prev === 'ended' ? prev : 'ongoing'));
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

    // ── New participant joined the call (invitee, late joiner, or —
    // in the normal two-party case — the callee finally accepting).
    // Whoever is already in the room sends the newcomer an offer. ──
    const handleParticipantJoined = (userId) => {
      addRemoteUser(userId);
      // Someone joining means the call is live now, regardless of
      // which side we are (caller or callee).
      setCallStatus((prev) => (prev === 'ended' ? prev : 'ongoing'));
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
  }, [socket, callData?.roomId, isConnected, createPeerConnection, addRemoteUser, releaseCallResources, startLocalStream]);

  // ── Call controls ────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!callData?.callId) {
      console.warn('[call] acceptCall called with no callId — ignoring', callData);
      return;
    }
    await startLocalStream(true);
    await joinCall(callData.callId);
    setCallStatus('ongoing');
    // Do NOT proactively send offers here. Joining the call room (in
    // the effect above) already triggers a 'participant-joined'
    // broadcast that every existing participant receives — they will
    // send *us* the offer. Sending our own offers too would race
    // against theirs and create duplicate/glaring SDP exchanges.
  }, [callData, joinCall, startLocalStream]);

  const rejectTheCall = useCallback(async () => {
    if (!callData?.callId) {
      console.warn('[call] rejectCall called with no callId — ignoring', callData);
      setCallStatus('ended');
      return;
    }
    await rejectCall(callData.callId);
    setCallStatus('ended');
  }, [callData, rejectCall]);

  const hangUp = useCallback(async () => {
    releaseCallResources();
    if (callData?.callId) {
      await endCall(callData.callId);
    } else {
      console.warn('[call] hangUp called with no callId — skipping endCall request', callData);
    }
    if (socket && callData?.roomId) {
      socket.emit('leave-call', callData.roomId);
    }
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
    startLocalStream,       // ← exposed: the initiator uses this to warm
                            //   up mic/camera without sending offers
    initiatePeerConnections, // kept for manual/late-join use if ever needed
    inviteUsers,           // ← new: call this with an array of userIds
    addRemoteUser,         // ← expose in case you need to manually add a user
  };
};