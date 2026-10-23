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
  const key = String(callId);
  if (callTimeouts.has(key)) {
    clearTimeout(callTimeouts.get(key));
    callTimeouts.delete(key);
  }

  const timeoutId = setTimeout(async () => {
    try {
      const call = await Call.findById(callId);
      if (!call) return;

      // Meetings never "time out" — they start ongoing
      if (call.isMeeting) return;

      if (call.status === 'ringing') {
        call.status = 'missed';
        call.endedAt = new Date();
        call.participants.forEach((p) => {
          if (p.status === 'ringing' || p.status === 'pending') p.status = 'missed';
        });
        await call.save();

        const io = getIO();
        io.to(`room:${call.roomId}`).emit('call-ended', {
          callId: call._id,
          roomId: call.roomId,
          reason: 'timeout',
        });

        if (call.workspace) {
          io.to(`workspace:${call.workspace}`).emit('call-log-updated', {
            callId: call._id,
            status: 'missed',
          });
        }

        const allIds = call.participants.map((p) => p.user.toString());
        await notifyParticipants(
          allIds,
          '⏰ Missed call',
          `The ${call.type} call was not answered in time.`,
          { callId: call._id.toString() }
        );
      }
    } catch (err) {
      console.error('Ring timeout error:', err);
    } finally {
      callTimeouts.delete(key);
    }
  }, seconds * 1000);

  callTimeouts.set(key, timeoutId);
};

const cancelRingTimeout = (callId) => {
  const key = String(callId);
  if (callTimeouts.has(key)) {
    clearTimeout(callTimeouts.get(key));
    callTimeouts.delete(key);
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
        _android: {
          priority: 'high',
          notification: {
            channelId: 'call_channel',
            sound: 'ringtone',
            priority: 'high',
            visibility: 'public',
            fullScreenIntent: true,
            clickAction: 'OPEN_CALL',
          },
        },
        _ios: {
          'content-available': 1,
          priority: 'high',
          sound: 'ringtone.caf',
          category: 'call',
        },
      },
      sendPush: true,
      emailEventType: 'teamInvite',
      emailSubject: title,
      emailHtml: `<p>${body}</p>`,
    }).catch((err) => console.error(`Notify ${uid} failed:`, err.message));
  }
};

const isWorkspaceMember = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);
  return workspace?.members.some(
    (m) => m.user.toString() === userId && m.status === 'active'
  );
};

const isWorkspaceAdminOrOwner = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return false;
  const m = workspace.members.find(
    (mm) => mm.user.toString() === userId && mm.status === 'active'
  );
  return !!m && ['admin', 'owner'].includes(m.role);
};

const generateMeetingCode = () => {
  const alpha = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += alpha[Math.floor(Math.random() * alpha.length)];
  return code;
};

const emitWorkspaceCallUpdate = (workspaceId, callId, status) => {
  if (!workspaceId) return;
  try {
    const io = getIO();
    io.to(`workspace:${workspaceId}`).emit('call-log-updated', {
      callId: String(callId),
      status,
    });
  } catch (err) {
    console.error('emitWorkspaceCallUpdate:', err.message);
  }
};

// Decide if a call should now fully end (after someone leaves)
const shouldCallEnd = (call) => {
  const activeParticipants = call.participants.filter(
    (p) => p.status === 'accepted'
  ).length;
  const activeGuests = (call.guests || []).filter((g) => !g.leftAt).length;
  const activeCount = activeParticipants + activeGuests;
  const ringingCount = call.participants.filter((p) => p.status === 'ringing').length;
  const invitedCount = call.participants.length;

  if (activeCount === 0) return true; // nobody left

  // 1-on-1 style (<=2 invitees) — when one side leaves, it ends
  if (activeCount === 1 && invitedCount <= 2 && ringingCount === 0) return true;

  // Meetings keep going while anyone is present
  return false;
};

// ─────────────────────────────────────────────────────────────
// Scheduled call trigger (called by cron or manual)
// ─────────────────────────────────────────────────────────────

const triggerScheduledCall = async (callId) => {
  const call = await Call.findById(callId)
    .populate('participants.user', 'name email username profile')
    .populate('creator', 'name email username profile');
  if (!call || call.status !== 'scheduled') return;

  call.status = 'ringing';
  call.participants.forEach((p) => {
    p.status = 'ringing';
    p.joinedAt = null;
    p.leftAt = null;
  });
  await call.save();

  const io = getIO();
  const participantIds = call.participants.map((p) => p.user._id.toString());

  for (const p of call.participants) {
    const uid = p.user._id.toString();
    io.to(`user:${uid}`).emit('incoming-call', {
      callId: call._id,
      roomId: call.roomId,
      type: call.type,
      workspaceId: call.workspace?.toString(),
      caller: call.creator,
      participants: call.participants.map((x) => ({
        _id: x.user._id,
        name: x.user.name,
        email: x.user.email,
      })),
    });
  }

  const callerName = call.creator?.name || 'Someone';

  await notifyParticipants(
    participantIds,
    `📞 ${callerName}`,
    `Scheduled ${call.type} call is starting. Tap to join.`,
    {
      callId: call._id.toString(),
      roomId: call.roomId,
      type: call.type,
      workspaceId: call.workspace?.toString(),
      callerId: call.creator._id.toString(),
      callerName,
      notificationType: 'call',
      actions: [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' },
      ],
    }
  );

  emitWorkspaceCallUpdate(call.workspace, call._id, 'ringing');
  startRingTimeout(call._id);
};

// ─────────────────────────────────────────────────────────────
// 1. Initiate Immediate Workspace Call
// ─────────────────────────────────────────────────────────────

const initiateCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId, type, participantIds } = req.body;

  if (!workspaceId || !type || !participantIds?.length) {
    res.status(400);
    throw new Error(
      'Workspace ID, call type, and at least one participant are required.'
    );
  }

  const isMember = await isWorkspaceMember(workspaceId, userId);
  if (!isMember) {
    res.status(403);
    throw new Error('You must be an active workspace member to start a call.');
  }

  const workspace = await Workspace.findById(workspaceId);
  const activeMembers = workspace.members
    .filter((m) => m.status === 'active')
    .map((m) => m.user.toString());
  const invalid = participantIds.filter((id) => !activeMembers.includes(id));
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
    participants: uniqueParticipants.map((uid) => ({
      user: uid,
      status: uid === userId ? 'accepted' : 'ringing',
      joinedAt: uid === userId ? new Date() : null,
    })),
  });

  await call.populate('participants.user', 'name email username profile');
  await call.populate('creator', 'name email username profile');

  const io = getIO();
  for (const p of call.participants) {
    const uid = p.user._id.toString();
    io.to(`user:${uid}`).emit('incoming-call', {
      callId: call._id,
      roomId: call.roomId,
      type: call.type,
      workspaceId,
      caller: call.creator,
      participants: call.participants.map((x) => ({
        _id: x.user._id,
        name: x.user.name,
        email: x.user.email,
      })),
    });
  }

  const otherIds = uniqueParticipants.filter((id) => id !== userId);
  const callerName = call.creator?.name || 'Someone';

  await notifyParticipants(otherIds, `📞 ${callerName}`, `Incoming ${type} call`, {
    callId: call._id.toString(),
    roomId: call.roomId,
    type,
    workspaceId: String(workspaceId),
    callerId: String(userId),
    callerName,
    notificationType: 'call',
    actions: [
      { action: 'answer', title: 'Answer' },
      { action: 'decline', title: 'Decline' },
    ],
  });

  emitWorkspaceCallUpdate(workspaceId, call._id, 'ringing');
  startRingTimeout(call._id);

  res.status(201).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 2. Direct Call (outside workspace, by username)
// ─────────────────────────────────────────────────────────────

const initiateDirectCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { username, type = 'audio' } = req.body;

  if (!username) {
    res.status(400);
    throw new Error('Username is required.');
  }

  const target = await User.findOne({ username: username.toLowerCase().trim() }).select(
    '_id name username email profile'
  );
  if (!target) {
    res.status(404);
    throw new Error('User not found.');
  }
  if (target._id.toString() === userId) {
    res.status(400);
    throw new Error('You cannot call yourself.');
  }

  const call = await Call.create({
    workspace: null,
    creator: userId,
    type,
    roomId: uuidv4(),
    isDirect: true,
    status: 'ringing',
    participants: [
      { user: userId, status: 'accepted', joinedAt: new Date() },
      { user: target._id, status: 'ringing' },
    ],
  });

  await call.populate('participants.user', 'name email username profile');
  await call.populate('creator', 'name email username profile');

  const io = getIO();
  const callerName = call.creator?.name || 'Someone';
  const payload = {
    callId: call._id,
    roomId: call.roomId,
    type: call.type,
    caller: call.creator,
    isDirect: true,
    participants: call.participants.map((x) => ({
      _id: x.user._id,
      name: x.user.name,
      email: x.user.email,
    })),
  };

  io.to(`user:${target._id}`).emit('incoming-call', payload);
  io.to(`user:${userId}`).emit('outgoing-call', payload);

  await notifyParticipants([target._id.toString()], `📞 ${callerName}`, `Incoming ${type} call`, {
    callId: call._id.toString(),
    roomId: call.roomId,
    type,
    callerId: String(userId),
    callerName,
    notificationType: 'call',
    actions: [
      { action: 'answer', title: 'Answer' },
      { action: 'decline', title: 'Decline' },
    ],
  });

  startRingTimeout(call._id);

  res.status(201).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 3. Schedule a Future Workspace Call (admin/owner only)
// ─────────────────────────────────────────────────────────────

const scheduleCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId, type, participantIds, scheduledAt } = req.body;

  if (!workspaceId || !type || !participantIds?.length || !scheduledAt) {
    res.status(400);
    throw new Error(
      'Workspace ID, call type, participants, and scheduledAt are required.'
    );
  }

  const scheduledDate = new Date(scheduledAt);
  if (scheduledDate <= new Date()) {
    res.status(400);
    throw new Error('Scheduled time must be in the future.');
  }

  const canSchedule = await isWorkspaceAdminOrOwner(workspaceId, userId);
  if (!canSchedule) {
    res.status(403);
    throw new Error('Only workspace admins or owners can schedule calls.');
  }

  const workspace = await Workspace.findById(workspaceId);
  const activeMembers = workspace.members
    .filter((m) => m.status === 'active')
    .map((m) => m.user.toString());
  const invalid = participantIds.filter((id) => !activeMembers.includes(id));
  if (invalid.length) {
    res.status(400);
    throw new Error('Some participants are not active members.');
  }

  const uniqueParticipants = [...new Set([...participantIds, userId])];

  const call = await Call.create({
    workspace: workspaceId,
    creator: userId,
    scheduledBy: userId,
    type,
    roomId: uuidv4(),
    scheduledAt: scheduledDate,
    status: 'scheduled',
    participants: uniqueParticipants.map((uid) => ({
      user: uid,
      status: 'pending',
    })),
  });

  await call.populate('participants.user', 'name email username profile');
  await call.populate('creator', 'name email username profile');

  await notifyParticipants(
    uniqueParticipants.filter((id) => id !== userId),
    `📅 Call scheduled`,
    `A ${type} call has been scheduled for ${scheduledDate.toLocaleString()}.`,
    {
      callId: call._id.toString(),
      roomId: call.roomId,
      type,
      workspaceId: String(workspaceId),
      notificationType: 'scheduled_call',
    }
  );

  emitWorkspaceCallUpdate(workspaceId, call._id, 'scheduled');

  res.status(201).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 4. Create a Meeting (shareable link, optional workspace)
// ─────────────────────────────────────────────────────────────

const createMeeting = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId, type = 'video', participantIds = [] } = req.body;

  if (workspaceId) {
    const isMember = await isWorkspaceMember(workspaceId, userId);
    if (!isMember) {
      res.status(403);
      throw new Error('You must be an active workspace member.');
    }
  }

  // Generate unique code (retry on collision)
  let code;
  for (let i = 0; i < 5; i++) {
    code = generateMeetingCode();
    const exists = await Call.exists({ meetingCode: code });
    if (!exists) break;
    code = null;
  }
  if (!code) {
    res.status(500);
    throw new Error('Could not generate a meeting code. Try again.');
  }

  const uniqueParticipants = [...new Set([...(participantIds || []), userId])];

  const call = await Call.create({
    workspace: workspaceId || null,
    creator: userId,
    type,
    roomId: uuidv4(),
    meetingCode: code,
    meetingLink: `${process.env.CLIENT_URL}/join/${code}`,
    isMeeting: true,
    status: 'ongoing',
    startedAt: new Date(),
    participants: uniqueParticipants.map((uid) => ({
      user: uid,
      status: uid === userId ? 'accepted' : 'ringing',
      joinedAt: uid === userId ? new Date() : null,
    })),
  });

  await call.populate('participants.user', 'name email username profile');
  await call.populate('creator', 'name email username profile');

  const io = getIO();

  // Ring invited participants (not the creator)
  for (const p of call.participants) {
    const uid = p.user._id.toString();
    if (uid === userId) continue;
    io.to(`user:${uid}`).emit('incoming-call', {
      callId: call._id,
      roomId: call.roomId,
      type: call.type,
      workspaceId: workspaceId || null,
      caller: call.creator,
      isMeeting: true,
      meetingLink: call.meetingLink,
      participants: call.participants.map((x) => ({
        _id: x.user._id,
        name: x.user.name,
        email: x.user.email,
      })),
    });
  }

  const callerName = call.creator?.name || 'Someone';
  const invitedIds = call.participants
    .map((p) => p.user._id.toString())
    .filter((id) => id !== userId);

  if (invitedIds.length) {
    await notifyParticipants(invitedIds, `📞 ${callerName}`, `You're invited to a ${type} meeting.`, {
      callId: call._id.toString(),
      roomId: call.roomId,
      type,
      meetingLink: call.meetingLink,
      callerId: String(userId),
      callerName,
      notificationType: 'call',
      actions: [
        { action: 'answer', title: 'Join' },
        { action: 'decline', title: 'Decline' },
      ],
    });
  }

  emitWorkspaceCallUpdate(workspaceId, call._id, 'ongoing');

  res.status(201).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 5. Accept / Join a Call by ID
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

  const participant = call.participants.find((p) => p.user.toString() === userId);
  if (!participant) {
    res.status(403);
    throw new Error('You are not a participant of this call.');
  }

  if (['rejected', 'left'].includes(participant.status)) {
    res.status(400);
    throw new Error('You cannot rejoin this call.');
  }

  if (participant.status === 'accepted') {
    return res.status(200).json({ success: true, call, message: 'Already joined.' });
  }

  // Allow late joining: ringing, pending, missed → accepted
  participant.status = 'accepted';
  participant.joinedAt = new Date();
  participant.leftAt = null;

  if (call.status === 'ringing') {
    call.status = 'ongoing';
    call.startedAt = call.startedAt || new Date();
    cancelRingTimeout(call._id);
    emitWorkspaceCallUpdate(call.workspace, call._id, 'ongoing');
  }

  await call.save();
  await call.populate('participants.user', 'name email username profile');
  await call.populate('creator', 'name email username profile');

  const io = getIO();
  call.participants.forEach((p) => {
    io.to(`user:${p.user._id}`).emit('call-participant-update', {
      callId: call._id,
      roomId: call.roomId,
      userId,
      status: 'joined',
    });
  });

  res.status(200).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 6. Join by Meeting Code (logged-in users)
// ─────────────────────────────────────────────────────────────

const joinByMeetingCode = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { code } = req.params;

  const call = await Call.findOne({
    meetingCode: code,
    status: { $in: ['ringing', 'ongoing'] },
  });
  if (!call) {
    res.status(404);
    throw new Error('Meeting not found or has ended.');
  }

  let participant = call.participants.find((p) => p.user.toString() === userId);

  if (!participant) {
    call.participants.push({
      user: userId,
      status: 'accepted',
      joinedAt: new Date(),
    });
  } else {
    if (participant.status === 'accepted') {
      await call.populate('participants.user', 'name email username profile');
      await call.populate('creator', 'name email username profile');
      return res.status(200).json({ success: true, call, message: 'Already in call.' });
    }
    participant.status = 'accepted';
    participant.joinedAt = new Date();
    participant.leftAt = null;
  }

  if (call.status === 'ringing') {
    call.status = 'ongoing';
    call.startedAt = call.startedAt || new Date();
    cancelRingTimeout(call._id);
    emitWorkspaceCallUpdate(call.workspace, call._id, 'ongoing');
  }

  await call.save();
  await call.populate('participants.user', 'name email username profile');
  await call.populate('creator', 'name email username profile');

  const io = getIO();
  call.participants.forEach((p) => {
    io.to(`user:${p.user._id}`).emit('call-participant-update', {
      callId: call._id,
      roomId: call.roomId,
      userId,
      status: 'joined',
    });
  });

  res.status(200).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 7. Reject / Decline
// ─────────────────────────────────────────────────────────────

const rejectCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { callId } = req.params;

  const call = await Call.findById(callId);
  if (!call) {
    res.status(404);
    throw new Error('Call not found.');
  }

  const participant = call.participants.find((p) => p.user.toString() === userId);
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
// 8. Leave a Call (group-aware)
//    - 1-on-1: leaving ends the call for both
//    - group:  only this participant leaves; call keeps going
//             until the last person leaves
// ─────────────────────────────────────────────────────────────

const leaveCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { callId } = req.params;

  const call = await Call.findById(callId);
  if (!call) {
    res.status(404);
    throw new Error('Call not found.');
  }

  const participant = call.participants.find((p) => p.user.toString() === userId);
  if (!participant) {
    res.status(403);
    throw new Error('You are not a participant.');
  }

  if (participant.status === 'left') {
    return res.status(200).json({
      success: true,
      ended: call.status === 'ended',
      call,
    });
  }

  participant.status = 'left';
  participant.leftAt = new Date();

  const ends = call.status === 'ongoing' && shouldCallEnd(call);

  const io = getIO();

  if (ends) {
    call.status = 'ended';
    call.endedAt = new Date();
    call.participants.forEach((p) => {
      if (p.status === 'ringing' || p.status === 'pending') p.status = 'missed';
      else if (p.status === 'accepted') {
        p.status = 'left';
        p.leftAt = p.leftAt || new Date();
      }
    });
    (call.guests || []).forEach((g) => {
      if (!g.leftAt) g.leftAt = new Date();
    });
    await call.save();

    io.to(`room:${call.roomId}`).emit('call-ended', {
      callId: call._id,
      roomId: call.roomId,
      reason: 'everyone-left',
    });
    emitWorkspaceCallUpdate(call.workspace, call._id, 'ended');

    const remainingIds = call.participants
      .filter((p) => p.status === 'left')
      .map((p) => p.user.toString());
    if (remainingIds.length) {
      await notifyParticipants(
        remainingIds,
        '📞 Call ended',
        `The ${call.type} call has ended.`,
        { callId: call._id.toString() }
      );
    }
  } else {
    await call.save();
    io.to(`room:${call.roomId}`).emit('call-participant-update', {
      callId: call._id,
      roomId: call.roomId,
      userId,
      status: 'left',
    });
  }

  res.status(200).json({ success: true, ended: ends, call });
});

// ─────────────────────────────────────────────────────────────
// 9. End Call — force-end for everyone
// ─────────────────────────────────────────────────────────────

const endCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { callId } = req.params;

  const call = await Call.findById(callId);
  if (!call) {
    res.status(404);
    throw new Error('Call not found.');
  }

  if (!['ongoing', 'ringing'].includes(call.status)) {
    res.status(400);
    throw new Error('Call is not active.');
  }

  const isParticipant = call.participants.some(
    (p) => p.user.toString() === userId
  );
  if (!isParticipant) {
    res.status(403);
    throw new Error('Only participants can end this call.');
  }

  call.status = 'ended';
  call.endedAt = new Date();
  call.participants.forEach((p) => {
    if (p.status === 'ringing' || p.status === 'pending') p.status = 'missed';
    else if (p.status === 'accepted') {
      p.status = 'left';
      p.leftAt = p.leftAt || new Date();
    }
  });
  (call.guests || []).forEach((g) => {
    if (!g.leftAt) g.leftAt = new Date();
  });
  await call.save();

  cancelRingTimeout(call._id);

  const io = getIO();
  io.to(`room:${call.roomId}`).emit('call-ended', {
    callId: call._id,
    roomId: call.roomId,
  });
  emitWorkspaceCallUpdate(call.workspace, call._id, 'ended');

  const participantIds = call.participants.map((p) => p.user.toString());
  await notifyParticipants(
    participantIds,
    '📞 Call ended',
    `The ${call.type} call has ended.`,
    { callId: call._id.toString() }
  );

  res.status(200).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 10. Cancel a Scheduled Call
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

  const isCreator = call.creator.toString() === userId;
  const isAdmin = call.workspace
    ? await isWorkspaceAdminOrOwner(call.workspace, userId)
    : false;
  if (!isCreator && !isAdmin) {
    res.status(403);
    throw new Error('Only the creator or a workspace admin can cancel.');
  }

  call.status = 'cancelled';
  await call.save();
  emitWorkspaceCallUpdate(call.workspace, call._id, 'cancelled');

  const participantIds = call.participants.map((p) => p.user.toString());
  await notifyParticipants(
    participantIds,
    '📅 Call cancelled',
    `The scheduled call has been cancelled.`,
    { callId: call._id.toString() }
  );

  res.status(200).json({ success: true, message: 'Call cancelled.' });
});

// ─────────────────────────────────────────────────────────────
// 11. Get Scheduled Calls
// ─────────────────────────────────────────────────────────────

const getScheduledCalls = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.query;

  const query = { status: 'scheduled', 'participants.user': userId };
  if (workspaceId) query.workspace = workspaceId;

  const calls = await Call.find(query)
    .populate('participants.user', 'name email username profile')
    .populate('creator', 'name email username profile')
    .sort({ scheduledAt: 1 });

  res.status(200).json({ success: true, calls });
});

// ─────────────────────────────────────────────────────────────
// 12. Call Logs (ongoing + ended + missed)
//     - with workspaceId: full workspace call log
//     - without: user's personal logs (workspace + direct + meetings)
// ─────────────────────────────────────────────────────────────

const getCallLogs = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId, status: statusFilter, limit = 100 } = req.query;

  let query;

  if (workspaceId) {
    const isMember = await isWorkspaceMember(workspaceId, userId);
    if (!isMember) {
      res.status(403);
      throw new Error('You must be a workspace member.');
    }
    query = { workspace: workspaceId };
  } else {
    query = {
      $or: [
        { 'participants.user': userId },
        { creator: userId },
      ],
    };
  }

  if (statusFilter) {
    query.status = statusFilter;
  } else {
    query.status = { $in: ['ringing', 'ongoing', 'ended', 'missed'] };
  }

  const calls = await Call.find(query)
    .populate('participants.user', 'name email username profile')
    .populate('creator', 'name email username profile')
    .sort({ updatedAt: -1 })
    .limit(Math.min(Number(limit) || 100, 200));

  // Add duration for convenience
  const out = calls.map((c) => {
    const obj = c.toObject();
    if (obj.startedAt && obj.endedAt) {
      obj.duration = Math.max(0, Math.floor((obj.endedAt - obj.startedAt) / 1000));
    }
    return obj;
  });

  res.status(200).json({ success: true, calls: out });
});

// ─────────────────────────────────────────────────────────────
// 13. Get Ongoing Calls (quick "join now" list)
// ─────────────────────────────────────────────────────────────

const getOngoingCalls = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.query;

  let query;

  if (workspaceId) {
    const isMember = await isWorkspaceMember(workspaceId, userId);
    if (!isMember) {
      res.status(403);
      throw new Error('You must be a workspace member.');
    }
    query = { workspace: workspaceId, status: { $in: ['ringing', 'ongoing'] } };
  } else {
    query = {
      status: { $in: ['ringing', 'ongoing'] },
      $or: [{ 'participants.user': userId }, { creator: userId }],
    };
  }

  const calls = await Call.find(query)
    .populate('participants.user', 'name email username profile')
    .populate('creator', 'name email username profile')
    .sort({ updatedAt: -1 });

  res.status(200).json({ success: true, calls });
});

// ─────────────────────────────────────────────────────────────
// 14. Get Single Call
// ─────────────────────────────────────────────────────────────

const getCallById = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const call = await Call.findById(callId)
    .populate('participants.user', 'name email username profile')
    .populate('creator', 'name email username profile');
  if (!call) {
    res.status(404);
    throw new Error('Call not found.');
  }
  res.status(200).json({ success: true, call });
});

// ─────────────────────────────────────────────────────────────
// 15. Invite by User IDs (existing — now also ring)
// ─────────────────────────────────────────────────────────────

const inviteToCall = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { callId } = req.params;
  const { inviteUserIds } = req.body;

  if (!inviteUserIds?.length) {
    res.status(400);
    throw new Error('At least one user ID to invite is required.');
  }

  const call = await Call.findById(callId);
  if (!call) {
    res.status(404);
    throw new Error('Call not found.');
  }
  if (!['ongoing', 'ringing'].includes(call.status)) {
    res.status(400);
    throw new Error('Call is not active.');
  }

  const inviter = call.participants.find((p) => p.user.toString() === userId);
  if (!inviter || inviter.status !== 'accepted') {
    res.status(403);
    throw new Error('You must be an active participant to invite others.');
  }

  let validIds;

  if (call.workspace) {
    const workspace = await Workspace.findById(call.workspace);
    if (!workspace) {
      res.status(404);
      throw new Error('Workspace not found.');
    }
    const activeMemberIds = workspace.members
      .filter((m) => m.status === 'active')
      .map((m) => m.user.toString());
    validIds = inviteUserIds.filter((id) => activeMemberIds.includes(id));
  } else {
    validIds = inviteUserIds;
  }

  const existingIds = call.participants.map((p) => p.user.toString());
  validIds = validIds.filter((id) => !existingIds.includes(id));

  if (!validIds.length) {
    res.status(400);
    throw new Error('No valid new participants to invite.');
  }

  call.participants.push(
    ...validIds.map((id) => ({ user: id, status: 'ringing', joinedAt: null }))
  );
  await call.save();
  await call.populate('participants.user', 'name email username profile');

  const io = getIO();
  const inviterUser = await User.findById(userId).select('name');
  const callerName = inviterUser?.name || 'Someone';

  for (const uid of validIds) {
    io.to(`user:${uid}`).emit('incoming-call', {
      callId: call._id,
      roomId: call.roomId,
      type: call.type,
      workspaceId: call.workspace?.toString(),
      caller: call.creator,
      isMeeting: call.isMeeting,
      meetingLink: call.meetingLink,
      participants: call.participants.map((p) => ({
        _id: p.user._id,
        name: p.user.name,
        email: p.user.email,
      })),
    });
  }

  await notifyParticipants(
    validIds,
    `📞 ${callerName}`,
    `Invited you to a ${call.type} call. Tap to join.`,
    {
      callId: call._id.toString(),
      roomId: call.roomId,
      type: call.type,
      workspaceId: call.workspace?.toString(),
      callerId: String(userId),
      callerName,
      notificationType: 'call',
      actions: [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' },
      ],
    }
  );

  res.status(200).json({
    success: true,
    message: `${validIds.length} user(s) invited.`,
    invitedUserIds: validIds,
  });
});

// ─────────────────────────────────────────────────────────────
// 16. Invite by Username (new)
// ─────────────────────────────────────────────────────────────

const inviteByUsername = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { callId } = req.params;
  const { usernames } = req.body;

  if (!usernames?.length) {
    res.status(400);
    throw new Error('Usernames are required.');
  }

  const call = await Call.findById(callId);
  if (!call) {
    res.status(404);
    throw new Error('Call not found.');
  }
  if (!['ongoing', 'ringing'].includes(call.status)) {
    res.status(400);
    throw new Error('Call is not active.');
  }

  const inviter = call.participants.find((p) => p.user.toString() === userId);
  if (!inviter || inviter.status !== 'accepted') {
    res.status(403);
    throw new Error('You must be an active participant to invite others.');
  }

  const cleaned = usernames.map((u) => String(u).toLowerCase().trim()).filter(Boolean);
  const users = await User.find({ username: { $in: cleaned } }).select(
    '_id name username email profile'
  );
  if (!users.length) {
    res.status(404);
    throw new Error('No matching users found.');
  }

  let validUsers = users;

  if (call.workspace) {
    const workspace = await Workspace.findById(call.workspace);
    const activeIds = new Set(
      workspace.members
        .filter((m) => m.status === 'active')
        .map((m) => m.user.toString())
    );
    validUsers = users.filter((u) => activeIds.has(u._id.toString()));
  }

  const existingIds = new Set(call.participants.map((p) => p.user.toString()));
  validUsers = validUsers.filter((u) => !existingIds.has(u._id.toString()));

  if (!validUsers.length) {
    res.status(400);
    throw new Error('No valid new participants to invite.');
  }

  call.participants.push(
    ...validUsers.map((u) => ({ user: u._id, status: 'ringing', joinedAt: null }))
  );
  await call.save();
  await call.populate('participants.user', 'name email username profile');

  const io = getIO();
  const inviterUser = await User.findById(userId).select('name');
  const callerName = inviterUser?.name || 'Someone';

  for (const u of validUsers) {
    io.to(`user:${u._id}`).emit('incoming-call', {
      callId: call._id,
      roomId: call.roomId,
      type: call.type,
      workspaceId: call.workspace?.toString(),
      caller: call.creator,
      isMeeting: call.isMeeting,
      meetingLink: call.meetingLink,
      participants: call.participants.map((p) => ({
        _id: p.user._id,
        name: p.user.name,
        email: p.user.email,
      })),
    });
  }

  await notifyParticipants(
    validUsers.map((u) => u._id.toString()),
    `📞 ${callerName}`,
    `Invited you to a ${call.type} call. Tap to join.`,
    {
      callId: call._id.toString(),
      roomId: call.roomId,
      type: call.type,
      workspaceId: call.workspace?.toString(),
      callerId: String(userId),
      callerName,
      notificationType: 'call',
      actions: [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' },
      ],
    }
  );

  res.status(200).json({
    success: true,
    message: `${validUsers.length} user(s) invited.`,
    invitedUserIds: validUsers.map((u) => u._id),
  });
});

// ─────────────────────────────────────────────────────────────
// 17. Background Scheduler
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

const startCallScheduler = (intervalMs = 30_000) => {
  const id = setInterval(() => {
    processScheduledCalls().catch((e) => console.error('Call scheduler error:', e));
  }, intervalMs);
  console.log('✅ Call scheduler started');
  return id;
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

export {
  initiateCall,
  initiateDirectCall,
  scheduleCall,
  createMeeting,
  joinCall,
  joinByMeetingCode,
  rejectCall,
  leaveCall,
  endCall,
  cancelScheduledCall,
  getScheduledCalls,
  getCallLogs,
  getOngoingCalls,
  getCallById,
  inviteToCall,
  inviteByUsername,
  processScheduledCalls,
  startCallScheduler,
  // back-compat alias
  getCallLogs as getCallHistory,
};