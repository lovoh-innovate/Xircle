// controllers/callController.js
import Call from '../models/call.js';
import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import asyncHandler from 'express-async-handler';
import { v4 as uuidv4 } from 'uuid';
import { createAndSendNotification } from './notificationController.js';
import { getIO } from './socket.js';

// ─────────────────────────────────────────────────────────────
// Ring timeout management
// ─────────────────────────────────────────────────────────────
const callTimeouts = new Map();

const startRingTimeout = (callId, seconds = 60) => {
  if (callTimeouts.has(callId)) {
    clearTimeout(callTimeouts.get(callId));
    callTimeouts.delete(callId);
  }

  const timeoutId = setTimeout(async () => {
    try {
      const call = await Call.findById(callId);
      if (!call) return;

      if (call.status === 'ringing') {
        call.status = 'ended';
        call.endedAt = new Date();
        call.participants.forEach(p => {
          if (p.status === 'ringing' || p.status === 'pending') {
            p.status = 'missed';
          }
        });
        await call.save();

        const io = getIO();
        io.to(`room:${call.roomId}`).emit('call-ended', {
          callId: call._id,
          roomId: call.roomId,
          reason: 'timeout',
        });

        const allIds = call.participants.map(p => p.user.toString());
        await notifyParticipants(allIds,
          '⏰ Call timed out',
          `The ${call.type} call was not answered in time.`,
          { callId: call._id }
        );
      }
    } catch (err) {
      console.error('Ring timeout error:', err);
    } finally {
      callTimeouts.delete(callId);
    }
  }, seconds * 1000);

  callTimeouts.set(callId, timeoutId);
};

const cancelRingTimeout = (callId) => {
  if (callTimeouts.has(callId)) {
    clearTimeout(callTimeouts.get(callId));
    callTimeouts.delete(callId);
  }
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const notifyParticipants = async (userIds, title, body, data = {}) => {
  for (const uid of userIds) {
    createAndSendNotification({
      recipient: uid,
      title,
      body,
      data: {
        ...data,
        notificationType: data.notificationType || 'default',
        actions: data.actions || [],
      },
      sendPush: true,
      emailEventType: 'teamInvite',
      emailSubject: title,
      emailHtml: `<p>${body}</p>`,
    }).catch(err => console.error(`Notify ${uid} failed:`, err.message));
  }
};

const isWorkspaceMember = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);
  return workspace?.members.some(
    m => m.user.toString() === userId && m.status === 'active'
  );
};

const triggerScheduledCall = async (callId) => {
  const call = await Call.findById(callId).populate('participants.user', 'name email pushTokens');
  if (!call || call.status !== 'scheduled') return;

  call.status = 'ringing';
  await call.save();

  const participantIds = call.participants.map(p => p.user._id.toString());
  const creatorId = call.creator.toString();

  const io = getIO();
  for (const p of call.participants) {
    const uid = p.user._id.toString();
    io.to(`user:${uid}`).emit('incoming-call', {
      callId: call._id,
      roomId: call.roomId,
      type: call.type,
      workspaceId: call.workspace.toString(),
      caller: call.creator,
      participants: call.participants.map(x => ({
        _id: x.user._id,
        name: x.user.name,
        email: x.user.email,
      })),
    });
    const participant = call.participants.find(x => x.user._id.toString() === uid);
    if (participant) {
      participant.status = 'ringing';
    }
  }
  await call.save();

  const otherIds = participantIds.filter(id => id !== creatorId);
  await notifyParticipants(otherIds,
    `📞 Incoming ${call.type} call`,
    `A call is starting in workspace. Tap to join.`,
    {
      callId: call._id.toString(),
      roomId: call.roomId,
      type: call.type,
      notificationType: 'call',
      actions: [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' }
      ]
    }
  );

  startRingTimeout(callId);
};

// ─────────────────────────────────────────────────────────────
// 1. Initiate Immediate Call
// ─────────────────────────────────────────────────────────────

const initiateCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId, type, participantIds } = req.body;

  if (!workspaceId || !type || !participantIds?.length) {
    res.status(400);
    throw new Error('Workspace ID, call type, and at least one participant are required.');
  }

  const isMember = await isWorkspaceMember(workspaceId, userId);
  if (!isMember) {
    res.status(403);
    throw new Error('You must be an active workspace member to start a call.');
  }

  const workspace = await Workspace.findById(workspaceId);
  const activeMembers = workspace.members
    .filter(m => m.status === 'active')
    .map(m => m.user.toString());
  const invalid = participantIds.filter(id => !activeMembers.includes(id));
  if (invalid.length) {
    res.status(400);
    throw new Error('Some participants are not active members of this workspace.');
  }

  const uniqueParticipants = [...new Set([...participantIds, userId])];

  const call = await Call.create({
    workspace: workspaceId,
    creator: userId,
    type,
    roomId: uuidv4(),
    status: 'ringing',
    participants: uniqueParticipants.map(uid => ({
      user: uid,
      status: uid === userId ? 'accepted' : 'ringing',
      joinedAt: uid === userId ? new Date() : null,
    })),
  });

  await call.populate('participants.user', 'name email profile');
  await call.populate('creator', 'name email profile');

  const io = getIO();
  for (const p of call.participants) {
    const uid = p.user._id.toString();
    io.to(`user:${uid}`).emit('incoming-call', {
      callId: call._id,
      roomId: call.roomId,
      type: call.type,
      workspaceId,
      caller: call.creator,
      participants: call.participants.map(x => ({
        _id: x.user._id,
        name: x.user.name,
        email: x.user.email,
      })),
    });
  }

  const otherIds = uniqueParticipants.filter(id => id !== userId);
  await notifyParticipants(otherIds,
    `📞 Incoming ${type} call`,
    `You have an incoming ${type} call. Tap to join.`,
    {
      callId: call._id.toString(),
      roomId: call.roomId,
      type,
      notificationType: 'call',
      actions: [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' }
      ]
    }
  );

  startRingTimeout(call._id);

  res.status(201).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 2. Schedule a Future Call
// ─────────────────────────────────────────────────────────────

const scheduleCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId, type, participantIds, scheduledAt } = req.body;

  if (!workspaceId || !type || !participantIds?.length || !scheduledAt) {
    res.status(400);
    throw new Error('Workspace ID, call type, participants, and scheduledAt are required.');
  }

  const scheduledDate = new Date(scheduledAt);
  if (scheduledDate <= new Date()) {
    res.status(400);
    throw new Error('Scheduled time must be in the future.');
  }

  const isMember = await isWorkspaceMember(workspaceId, userId);
  if (!isMember) {
    res.status(403);
    throw new Error('You must be an active workspace member.');
  }

  const workspace = await Workspace.findById(workspaceId);
  const activeMembers = workspace.members
    .filter(m => m.status === 'active')
    .map(m => m.user.toString());
  const invalid = participantIds.filter(id => !activeMembers.includes(id));
  if (invalid.length) {
    res.status(400);
    throw new Error('Some participants are not active members.');
  }

  const uniqueParticipants = [...new Set([...participantIds, userId])];

  const call = await Call.create({
    workspace: workspaceId,
    creator: userId,
    type,
    roomId: uuidv4(),
    scheduledAt: scheduledDate,
    status: 'scheduled',
    participants: uniqueParticipants.map(uid => ({
      user: uid,
      status: 'pending',
    })),
  });

  await call.populate('participants.user', 'name email profile');
  await call.populate('creator', 'name email profile');

  await notifyParticipants(
    uniqueParticipants.filter(id => id !== userId),
    `📅 Call scheduled`,
    `A ${type} call has been scheduled for ${scheduledDate.toLocaleString()}.`,
    {
      callId: call._id.toString(),
      roomId: call.roomId,
      type,
      notificationType: 'scheduled_call'
    }
  );

  res.status(201).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 3. Accept / Join a Call
// ─────────────────────────────────────────────────────────────

const joinCall = asyncHandler(async (req, res) => {
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
  if (!participant) {
    res.status(403);
    throw new Error('You are not a participant of this call.');
  }

  if (participant.status === 'accepted') {
    return res.status(200).json({ success: true, call, message: 'Already joined.' });
  }

  participant.status = 'accepted';
  participant.joinedAt = new Date();

  if (call.status === 'ringing') {
    call.startedAt = new Date();
    call.status = 'ongoing';
    cancelRingTimeout(call._id);
  }

  await call.save();
  await call.populate('participants.user', 'name email profile');
  await call.populate('creator', 'name email profile');

  const io = getIO();
  call.participants.forEach(p => {
    io.to(`user:${p.user._id}`).emit('call-participant-update', {
      callId: call._id,
      roomId: call.roomId,
      userId,
      status: 'joined',
    });
  });

  // Emit participant-joined for new peer connections
  io.to(`room:${call.roomId}`).emit('participant-joined', userId);

  res.status(200).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 4. Reject / Decline a Call
// ─────────────────────────────────────────────────────────────

const rejectCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { callId } = req.params;

  const call = await Call.findById(callId);
  if (!call) {
    res.status(404);
    throw new Error('Call not found.');
  }

  const participant = call.participants.find(p => p.user.toString() === userId);
  if (!participant) {
    res.status(403);
    throw new Error('You are not a participant.');
  }

  if (participant.status !== 'ringing') {
    return res.status(400).json({ message: 'You can only reject an incoming call.' });
  }

  participant.status = 'rejected';
  await call.save();

  const io = getIO();
  io.to(`room:${call.roomId}`).emit('call-participant-update', {
    callId: call._id,
    roomId: call.roomId,
    userId,
    status: 'rejected',
  });

  res.status(200).json({ success: true, message: 'Call rejected.' });
});

// ─────────────────────────────────────────────────────────────
// 5. End a Call
// ─────────────────────────────────────────────────────────────

const endCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { callId } = req.params;

  const call = await Call.findById(callId);
  if (!call) {
    res.status(404);
    throw new Error('Call not found.');
  }

  if (call.status !== 'ongoing' && call.status !== 'ringing') {
    res.status(400);
    throw new Error('Call is not active.');
  }

  call.status = 'ended';
  call.endedAt = new Date();
  call.participants.forEach(p => {
    if (p.status === 'ringing' || p.status === 'pending') {
      p.status = 'missed';
    }
  });
  await call.save();

  cancelRingTimeout(call._id);

  const io = getIO();
  io.to(`room:${call.roomId}`).emit('call-ended', {
    callId: call._id,
    roomId: call.roomId,
  });

  const participantIds = call.participants.map(p => p.user.toString());
  await notifyParticipants(participantIds,
    '📞 Call ended',
    `The ${call.type} call has ended.`,
    { callId: call._id }
  );

  res.status(200).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 6. Cancel a Scheduled Call
// ─────────────────────────────────────────────────────────────

const cancelScheduledCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { callId } = req.params;

  const call = await Call.findById(callId);
  if (!call) {
    res.status(404);
    throw new Error('Call not found.');
  }

  if (call.status !== 'scheduled') {
    res.status(400);
    throw new Error('Only scheduled calls can be cancelled.');
  }

  if (call.creator.toString() !== userId) {
    res.status(403);
    throw new Error('Only the creator can cancel a scheduled call.');
  }

  call.status = 'cancelled';
  await call.save();

  const participantIds = call.participants.map(p => p.user.toString());
  await notifyParticipants(participantIds,
    '📅 Call cancelled',
    `The scheduled call has been cancelled.`,
    { callId: call._id }
  );

  res.status(200).json({ success: true, message: 'Call cancelled.' });
});

// ─────────────────────────────────────────────────────────────
// 7. Get Scheduled Calls
// ─────────────────────────────────────────────────────────────

const getScheduledCalls = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.query;

  const query = { status: 'scheduled', 'participants.user': userId };
  if (workspaceId) query.workspace = workspaceId;

  const calls = await Call.find(query)
    .populate('participants.user', 'name email profile')
    .populate('creator', 'name email profile')
    .sort({ scheduledAt: 1 });

  res.status(200).json({ success: true, calls });
});

// ─────────────────────────────────────────────────────────────
// 8. Get Call History
// ─────────────────────────────────────────────────────────────

const getCallHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.query;

  const query = { 'participants.user': userId, status: { $in: ['ended', 'missed'] } };
  if (workspaceId) query.workspace = workspaceId;

  const calls = await Call.find(query)
    .populate('participants.user', 'name email profile')
    .populate('creator', 'name email profile')
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, calls });
});

// ─────────────────────────────────────────────────────────────
// 9. Background Scheduler
// ─────────────────────────────────────────────────────────────

const processScheduledCalls = async () => {
  try {
    const now = new Date();
    const calls = await Call.find({
      status: 'scheduled',
      scheduledAt: { $lte: now },
    });

    for (const call of calls) {
      console.log(`🕒 Triggering scheduled call ${call._id} at ${now}`);
      await triggerScheduledCall(call._id);
    }
  } catch (error) {
    console.error('Error processing scheduled calls:', error);
  }
};

// ─────────────────────────────────────────────────────────────
// 10. Invite / Re‑ring
// ─────────────────────────────────────────────────────────────

const inviteToCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { callId } = req.params;
  const { inviteUserIds } = req.body;

  if (!inviteUserIds || !inviteUserIds.length) {
    res.status(400);
    throw new Error('At least one user ID to invite is required.');
  }

  const call = await Call.findById(callId);
  if (!call) {
    res.status(404);
    throw new Error('Call not found.');
  }

  if (call.status !== 'ongoing' && call.status !== 'ringing') {
    res.status(400);
    throw new Error('Call is not active for inviting.');
  }

  const inviter = call.participants.find(p => p.user.toString() === userId);
  if (!inviter || inviter.status !== 'accepted') {
    res.status(403);
    throw new Error('You must be an active participant to invite others.');
  }

  const workspace = await Workspace.findById(call.workspace);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  const activeMemberIds = workspace.members
    .filter(m => m.status === 'active')
    .map(m => m.user.toString());

  const existingParticipantIds = call.participants.map(p => p.user.toString());
  const validNewUserIds = inviteUserIds.filter(id =>
    activeMemberIds.includes(id) &&
    !existingParticipantIds.includes(id)
  );

  if (!validNewUserIds.length) {
    res.status(400);
    throw new Error('No valid new participants to invite (they must be active members not already in the call).');
  }

  const newParticipants = validNewUserIds.map(id => ({
    user: id,
    status: 'ringing',
    joinedAt: null,
  }));
  call.participants.push(...newParticipants);
  await call.save();

  await call.populate('participants.user', 'name email');

  const io = getIO();
  for (const uid of validNewUserIds) {
    io.to(`user:${uid}`).emit('incoming-call', {
      callId: call._id,
      roomId: call.roomId,
      type: call.type,
      workspaceId: call.workspace.toString(),
      caller: call.creator,
      participants: call.participants.map(p => ({
        _id: p.user._id,
        name: p.user.name,
        email: p.user.email,
      })),
    });
  }

  await notifyParticipants(validNewUserIds,
    `📞 Incoming ${call.type} call (invite)`,
    `You've been invited to an ongoing ${call.type} call. Tap to join.`,
    {
      callId: call._id.toString(),
      roomId: call.roomId,
      type: call.type,
      notificationType: 'call',
      actions: [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' }
      ]
    }
  );

  res.status(200).json({
    success: true,
    message: `${validNewUserIds.length} user(s) invited.`,
    invitedUserIds: validNewUserIds,
  });
});

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

export {
  initiateCall,
  scheduleCall,
  joinCall,
  rejectCall,
  endCall,
  cancelScheduledCall,
  getScheduledCalls,
  getCallHistory,
  processScheduledCalls,
  inviteToCall,
};