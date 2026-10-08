import asyncHandler from 'express-async-handler';
import { AccessToken } from 'livekit-server-sdk';
import Call from '../models/call.js';
import User from '../models/userModel.js';

// POST /api/calls/:callId/token
// Only an accepted participant of an active call can get a media token.
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

  const participant = call.participants.find(p => p.user.toString() === userId);
  if (!participant || participant.status !== 'accepted') {
    res.status(403);
    throw new Error('Join the call before requesting access.');
  }

  const user = await User.findById(userId).select('name');

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: userId,
      name: user?.name || 'User',
      ttl: '2h',
    }
  );

  at.addGrant({
    roomJoin: true,
    room: call.roomId,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();

  res.status(200).json({
    success: true,
    token,
    url: process.env.LIVEKIT_URL,
    roomId: call.roomId,
    type: call.type,
  });
});

export { getCallToken };