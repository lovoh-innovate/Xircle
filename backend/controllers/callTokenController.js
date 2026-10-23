// controllers/callTokenController.js
import asyncHandler from 'express-async-handler';
import { AccessToken } from 'livekit-server-sdk';
import Call from '../models/call.js';
import User from '../models/userModel.js';
import { getIO } from './socket.js';

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────
const buildToken = async ({ identity, name, metadata }) => {
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity, name, ttl: '2h', metadata: JSON.stringify(metadata || {}) }
  );
  at.addGrant({
    roomJoin: true,
    room: undefined, // set by caller
    canPublish: true,
    canSubscribe: true,
  });
  return at;
};

// ─────────────────────────────────────────────────────────────
// Logged-in users: POST /api/calls/:callId/token
// ─────────────────────────────────────────────────────────────
const getCallToken = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { callId } = req.params;

  const call = await Call.findById(callId);
  if (!call) {
    res.status(404);
    throw new Error('Call not found.');
  }
  if (!['ringing', 'ongoing'].includes(call.status)) {
    res.status(400);
    throw new Error('This call is not active.');
  }

  const participant = call.participants.find(
    (p) => p.user.toString() === userId
  );
  if (!participant || participant.status !== 'accepted') {
    res.status(403);
    throw new Error('Join the call before requesting access.');
  }

  const user = await User.findById(userId).select('name username profile');

  const profile =
    typeof user?.profile === 'string' &&
    user.profile.startsWith('http') &&
    user.profile.length < 500
      ? user.profile
      : '';

  const at = await buildToken({
    identity: userId,
    name: user?.name || 'User',
    metadata: { username: user?.username || '', profile, isGuest: false },
  });
  at.addGrant({ roomJoin: true, room: call.roomId, canPublish: true, canSubscribe: true });

  const token = await at.toJwt();

  res.status(200).json({
    success: true,
    token,
    url: process.env.LIVEKIT_URL,
    roomId: call.roomId,
    callId: call._id,
    type: call.type,
  });
});

// ─────────────────────────────────────────────────────────────
// Guests: POST /api/calls/guest-token/:code   { name }
// Public (no auth) — only valid for meetings (isMeeting: true)
// ─────────────────────────────────────────────────────────────
const getGuestCallToken = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { name } = req.body;

  if (!name || !String(name).trim()) {
    res.status(400);
    throw new Error('Your name is required to join.');
  }

  const call = await Call.findOne({
    meetingCode: code,
    status: { $in: ['ringing', 'ongoing'] },
    isMeeting: true,
  });
  if (!call) {
    res.status(404);
    throw new Error('Meeting not found or has ended.');
  }

  const displayName = String(name).trim().slice(0, 50);
  const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (!call.guests) call.guests = [];
  call.guests.push({
    name: displayName,
    identity: guestId,
    joinedAt: new Date(),
  });
  await call.save();

  const at = await buildToken({
    identity: guestId,
    name: displayName,
    metadata: { isGuest: true },
  });
  at.addGrant({ roomJoin: true, room: call.roomId, canPublish: true, canSubscribe: true });

  const token = await at.toJwt();

  // Notify host(s) that a guest joined (socket clients already in room)
  try {
    const io = getIO();
    io.to(`room:${call.roomId}`).emit('call-guest-joined', {
      callId: call._id,
      roomId: call.roomId,
      name: displayName,
      identity: guestId,
    });
  } catch (err) {
    console.error('guest-join socket emit:', err.message);
  }

  res.status(200).json({
    success: true,
    token,
    url: process.env.LIVEKIT_URL,
    roomId: call.roomId,
    callId: call._id,
    type: call.type,
    guestName: displayName,
    isGuest: true,
  });
});

export { getCallToken, getGuestCallToken };