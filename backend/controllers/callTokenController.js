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
// Shared state builder — the client hydrates its entire call UI
// from this payload on join (no second round-trip needed).
// ─────────────────────────────────────────────────────────────
const buildCallState = (call, { qualityOverride } = {}) => {
  // ── Data saver ────────────────────────────────────────────
  // NOTE: `call.dataSaver` is the last value written on the call.
  // For strict per-user prefs, store them on the User model or in
  // the client — this field is a shared "current room setting".
  let dataSaver = call.dataSaver
    ? {
        enabled: !!call.dataSaver.enabled,
        audioOnly: !!call.dataSaver.audioOnly,
        videoQuality: call.dataSaver.videoQuality || 'auto',
      }
    : { enabled: false, audioOnly: false, videoQuality: 'auto' };

  // Query override — e.g. ?quality=low to force low bandwidth on this join
  if (['low', 'medium', 'high'].includes(qualityOverride)) {
    dataSaver = {
      ...dataSaver,
      enabled: true,
      videoQuality: qualityOverride,
    };
  }

  // ── AI / live-notes hints ─────────────────────────────────
  const transcriptArr = Array.isArray(call.transcript) ? call.transcript : [];
  const messagesArr = Array.isArray(call.inCallMessages) ? call.inCallMessages : [];
  const handsArr = Array.isArray(call.raisedHands) ? call.raisedHands : [];

  const ai = {
    enabled: !!call.ai?.enabled,
    noteDestination: call.ai?.noteDestination || null,
    startedAt: call.ai?.startedAt || null,
    stoppedAt: call.ai?.stoppedAt || null,
    transcriptCount: transcriptArr.length,
    summaryUpdatedAt: call.liveSummary?.updatedAt || null,
    // Present only after finalization — lets the UI deep-link
    // straight to the generated note when a user rejoins.
    generatedNoteId: call.ai?.generatedNoteId ? String(call.ai.generatedNoteId) : null,
    generatedNoteKind: call.ai?.generatedNoteKind || null,
  };

  const liveSummary = call.liveSummary?.updatedAt
    ? {
        text: call.liveSummary.text || '',
        keyPoints: Array.isArray(call.liveSummary.keyPoints)
          ? call.liveSummary.keyPoints
          : [],
        actionItems: Array.isArray(call.liveSummary.actionItems)
          ? call.liveSummary.actionItems
          : [],
        updatedAt: call.liveSummary.updatedAt,
      }
    : null;

  // Last 100 transcript turns — enough to rebuild the transcript panel
  // on rejoin without shipping the whole doc.
  const recentTranscript = transcriptArr.slice(-100).map((s) => ({
    speakerId: s.speakerId,
    speakerName: s.speakerName,
    text: s.text,
    at: s.at,
  }));

  // Last 50 in-call chat messages — hydrated into the chat panel
  const recentMessages = messagesArr.slice(-50).map((m) => ({
    sender: m.sender ? String(m.sender) : null,
    senderName: m.senderName,
    content: m.content,
    kind: m.kind,
    createdAt: m.createdAt,
  }));

  // Only currently-raised hands (lowered ones are ignored)
  const raisedHands = handsArr
    .filter((h) => !h.loweredAt)
    .map((h) => ({
      userId: String(h.user),
      raisedAt: h.raisedAt,
    }));

  // Lightweight participants — no emails, no profiles.
  // Detailed user data lives on the call detail endpoint.
  const participants = (call.participants || []).map((p) => ({
    userId: String(p.user),
    status: p.status,
    joinedAt: p.joinedAt,
    leftAt: p.leftAt,
  }));

  const guests = (call.guests || []).map((g) => ({
    identity: g.identity,
    name: g.name,
    joinedAt: g.joinedAt,
    leftAt: g.leftAt,
  }));

  const durationSec = call.startedAt
    ? Math.floor(
        ((call.endedAt ? new Date(call.endedAt) : Date.now()) -
          new Date(call.startedAt).getTime()) /
          1000
      )
    : 0;

  return {
    isMeeting: !!call.isMeeting,
    isDirect: !!call.isDirect,
    workspaceId: call.workspace ? String(call.workspace) : null,
    meetingCode: call.meetingCode || null,
    meetingLink: call.meetingLink || null,
    creatorId: call.creator ? String(call.creator) : null,
    startedAt: call.startedAt || null,
    durationSec,
    dataSaver,
    ai,
    liveSummary,
    recentTranscript,
    recentMessages,
    raisedHands,
    participants,
    guests,
  };
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
  at.addGrant({
    roomJoin: true,
    room: call.roomId,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();

  const qualityOverride = String(req.query.quality || '').toLowerCase();
  const state = buildCallState(call, { qualityOverride });

  res.status(200).json({
    success: true,
    token,
    url: process.env.LIVEKIT_URL,
    roomId: call.roomId,
    callId: call._id,
    type: call.type,
    isGuest: false,
    // Everything the client needs to hydrate the call UI in one shot
    ...state,
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
  at.addGrant({
    roomJoin: true,
    room: call.roomId,
    canPublish: true,
    canSubscribe: true,
  });

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

  const qualityOverride = String(req.query.quality || '').toLowerCase();
  const state = buildCallState(call, { qualityOverride });

  // Guests can SEE the transcript + summary if AI is on, but the client
  // is expected to hide the "Ask AI" button (no account = no ask access).
  res.status(200).json({
    success: true,
    token,
    url: process.env.LIVEKIT_URL,
    roomId: call.roomId,
    callId: call._id,
    type: call.type,
    isGuest: true,
    guestName: displayName,
    guestId,
    ...state,
  });
});

export { getCallToken, getGuestCallToken };