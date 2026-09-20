// controllers/todayController.js
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import PersonalTask from '../models/personalTaskModel.js';
import Task from '../models/taskModel.js';
import Project from '../models/projectModel.js';
import Workspace from '../models/workspaceModel.js';
import { Message, Chat } from '../models/messagingModel.js';
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────
// TIMEZONE  (same convention as clockInController)
// "Today" means today in Lagos, not wherever the server happens to run.
// ─────────────────────────────────────────────────────────────────────

const BUSINESS_TIMEZONE = 'Africa/Lagos';
const TIMEZONE_OFFSET_MINUTES = 60; // Lagos is UTC+1, no DST

const getLagosParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const result = {};
  for (const part of parts) {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
  }
  return result;
};

const getLagosDateKey = (date = new Date()) => {
  const p = getLagosParts(date);
  return [p.year, String(p.month).padStart(2, '0'), String(p.day).padStart(2, '0')].join('-');
};

const makeLagosDate = (dateKey, hhmm) => {
  if (!dateKey || !hhmm) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = hhmm.split(':').map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes, 0, 0) -
      TIMEZONE_OFFSET_MINUTES * 60 * 1000
  );
};

const getLagosDayStart = (date = new Date()) =>
  makeLagosDate(getLagosDateKey(date), '00:00');

const getLagosDayEnd = (date = new Date()) =>
  new Date(getLagosDayStart(date).getTime() + 24 * 60 * 60 * 1000 - 1);

const isOverdue = (dueDate, now = new Date()) =>
  dueDate && new Date(dueDate) < now;

// ─────────────────────────────────────────────────────────────────────
// SHARED POPULATE
// Project tasks always carry their workspace so the frontend can show
// a workspace chip on each row. One definition, used everywhere.
// ─────────────────────────────────────────────────────────────────────

const PROJECT_POPULATE = {
  path: 'project',
  select: 'name color workspace',
  populate: { path: 'workspace', select: 'name color' },
};

// ─────────────────────────────────────────────────────────────────────
// SECTION 1 — MY WORK  (from Today context: PersonalTask)
// ─────────────────────────────────────────────────────────────────────

const getMyWork = async (userId, dayEnd) => {
  const tasks = await PersonalTask.find({
    user: userId,
    isTrash: { $ne: true },
    isArchived: { $ne: true },
    status: { $ne: 'completed' },
    dueDate: { $ne: null, $lte: dayEnd },
  })
    .populate('folder', 'name color')
    .sort({ dueDate: 1, order: 1 })
    .limit(50)
    .lean();

  const now = new Date();
  const overdue = [];
  const dueToday = [];

  for (const t of tasks) {
    if (isOverdue(t.dueDate, now)) overdue.push(t);
    else dueToday.push(t);
  }

  return {
    overdue,
    dueToday,
    counts: { overdue: overdue.length, dueToday: dueToday.length },
  };
};

// ─────────────────────────────────────────────────────────────────────
// SECTION 2 — TEAM WORK  (from Projects context: Task assigned to me)
// ─────────────────────────────────────────────────────────────────────

const getTeamWork = async (userId, dayEnd) => {
  const tasks = await Task.find({
    assignees: userId,
    isDeleted: false,
    isTrash: { $ne: true },
    isArchived: { $ne: true },
    status: { $nin: ['confirmed_completed', 'cancelled'] },
    dueDate: { $ne: null, $lte: dayEnd },
  })
    .populate(PROJECT_POPULATE)
    .populate('folder', 'name')
    .sort({ dueDate: 1 })
    .limit(50)
    .lean();

  const now = new Date();
  const overdue = [];
  const dueToday = [];

  for (const t of tasks) {
    if (isOverdue(t.dueDate, now)) overdue.push(t);
    else dueToday.push(t);
  }

  return {
    overdue,
    dueToday,
    counts: { overdue: overdue.length, dueToday: dueToday.length },
  };
};

// ─────────────────────────────────────────────────────────────────────
// SECTION 3 — AWAITING ME  (things blocked on my review)
// ─────────────────────────────────────────────────────────────────────

const getManagedProjectIds = async (userId) => {
  const ownedWs = await Workspace.find({ owner: userId }).select('_id').lean();
  const adminWs = await Workspace.find({
    'members.user': userId,
    'members.role': 'Admin',
    'members.status': 'active',
  })
    .select('_id')
    .lean();

  const managedWsIds = [
    ...new Set([
      ...ownedWs.map((w) => w._id.toString()),
      ...adminWs.map((w) => w._id.toString()),
    ]),
  ];

  const projects = await Project.find({
    $or: [
      { projectManagers: userId },
      { createdBy: userId },
      { workspace: { $in: managedWsIds } },
    ],
  })
    .select('_id')
    .lean();

  return projects.map((p) => p._id);
};

const getAwaitingMe = async (userId) => {
  const projectIds = await getManagedProjectIds(userId);

  if (projectIds.length === 0) {
    return {
      taskConfirmations: [],
      subtaskReviews: [],
      counts: { taskConfirmations: 0, subtaskReviews: 0 },
    };
  }

  const [pendingConfirmations, tasksWithPendingSubtasks] = await Promise.all([
    Task.find({
      project: { $in: projectIds },
      status: 'completed',
      isDeleted: false,
      isTrash: { $ne: true },
      completedBy: { $ne: userId },
    })
      .populate(PROJECT_POPULATE)
      .populate('assignees', 'name profile')
      .populate('completedBy', 'name profile')
      .sort({ completedAt: -1 })
      .limit(30)
      .lean(),

    Task.find({
      project: { $in: projectIds },
      'subTasks.status': 'done',
      isDeleted: false,
      isTrash: { $ne: true },
    })
      .populate(PROJECT_POPULATE)
      .populate('assignees', 'name profile')
      .limit(30)
      .lean(),
  ]);

  const subtaskReviews = tasksWithPendingSubtasks
    .map((t) => ({
      taskId: t._id,
      taskTitle: t.title,
      project: t.project,
      assignees: t.assignees,
      pendingSubtasks: t.subTasks
        .map((st, index) => ({ ...st, index }))
        .filter((st) => st.status === 'done' && st.completedBy?.toString() !== userId),
    }))
    .filter((t) => t.pendingSubtasks.length > 0);

  return {
    taskConfirmations: pendingConfirmations,
    subtaskReviews,
    counts: {
      taskConfirmations: pendingConfirmations.length,
      subtaskReviews: subtaskReviews.reduce((s, t) => s + t.pendingSubtasks.length, 0),
    },
  };
};

// ─────────────────────────────────────────────────────────────────────
// SECTION 4 — CONVERSATIONS  (unread chats + mentions)
// ─────────────────────────────────────────────────────────────────────

const getConversations = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const chats = await Chat.find({
    'participants.user': userId,
    archivedBy: { $nin: [userId] },
  })
    .select('_id type name workspace participants')
    .lean();

  if (chats.length === 0) {
    return { unreadChats: [], counts: { unread: 0, mentions: 0 } };
  }

  const chatIds = chats.map((c) => c._id);

  const [unreadAgg, mentionAgg] = await Promise.all([
    Message.aggregate([
      {
        $match: {
          chat: { $in: chatIds },
          sender: { $ne: userObjectId },
          isDeleted: false,
          'readBy.user': { $ne: userObjectId },
        },
      },
      {
        $group: {
          _id: '$chat',
          count: { $sum: 1 },
          lastMessageAt: { $max: '$createdAt' },
        },
      },
    ]),
    Message.aggregate([
      {
        $match: {
          chat: { $in: chatIds },
          mentions: userObjectId,
          sender: { $ne: userObjectId },
          isDeleted: false,
          'readBy.user': { $ne: userObjectId },
        },
      },
      { $group: { _id: '$chat', count: { $sum: 1 } } },
    ]),
  ]);

  const unreadMap = Object.fromEntries(unreadAgg.map((u) => [u._id.toString(), u.count]));
  const mentionMap = Object.fromEntries(mentionAgg.map((u) => [u._id.toString(), u.count]));

  const unreadChats = chats
    .filter((c) => unreadMap[c._id.toString()] > 0)
    .map((c) => {
      const otherParticipant =
        c.type === 'direct'
          ? c.participants.find((p) => p.user.toString() !== userId)?.user
          : null;

      return {
        chatId: c._id,
        type: c.type,
        name: c.name || null,
        otherParticipantId: otherParticipant || null,
        workspace: c.workspace,
        unreadCount: unreadMap[c._id.toString()],
        mentionCount: mentionMap[c._id.toString()] || 0,
      };
    })
    .sort((a, b) => {
      if (b.mentionCount !== a.mentionCount) return b.mentionCount - a.mentionCount;
      return b.unreadCount - a.unreadCount;
    })
    .slice(0, 20);

  return {
    unreadChats,
    counts: {
      unread: unreadChats.reduce((s, c) => s + c.unreadCount, 0),
      mentions: unreadChats.reduce((s, c) => s + c.mentionCount, 0),
    },
  };
};

// ─────────────────────────────────────────────────────────────────────
// SECTION 5 — TEAM PULSE  (light workspace activity)
// ─────────────────────────────────────────────────────────────────────

const getTeamPulse = async (userId, dayStart) => {
  const workspaces = await Workspace.find({
    $or: [
      { owner: userId },
      { 'members.user': userId, 'members.status': 'active' },
    ],
  })
    .select('_id name color owner members')
    .lean();

  if (workspaces.length === 0) {
    return {
      pendingJoinRequests: [],
      recentProjects: [],
      counts: { pendingJoinRequests: 0, recentProjects: 0 },
    };
  }

  const wsIds = workspaces.map((w) => w._id);

  const pendingJoinRequests = workspaces
    .filter((w) => {
      const isOwner = w.owner.toString() === userId;
      const isAdmin = w.members.some(
        (m) =>
          m.user.toString() === userId &&
          m.role === 'Admin' &&
          m.status === 'active'
      );
      return isOwner || isAdmin;
    })
    .map((w) => {
      const pending = w.members.filter((m) => m.status === 'pending').length;
      return pending > 0
        ? {
            workspaceId: w._id,
            workspaceName: w.name,
            workspaceColor: w.color,
            count: pending,
          }
        : null;
    })
    .filter(Boolean);

  const recentProjects = await Project.find({
    workspace: { $in: wsIds },
    createdAt: { $gte: dayStart },
    isTrash: { $ne: true },
  })
    .select('name workspace createdAt createdBy')
    .populate('workspace', 'name color')
    .populate('createdBy', 'name profile')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return {
    pendingJoinRequests,
    recentProjects,
    counts: {
      pendingJoinRequests: pendingJoinRequests.reduce((s, w) => s + w.count, 0),
      recentProjects: recentProjects.length,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────
// GET /api/today
// ─────────────────────────────────────────────────────────────────────

export const getToday = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const dayStart = getLagosDayStart();
  const dayEnd = getLagosDayEnd();

  const [myWork, teamWork, awaitingMe, conversations, teamPulse] = await Promise.all([
    getMyWork(userId, dayEnd),
    getTeamWork(userId, dayEnd),
    getAwaitingMe(userId),
    getConversations(userId),
    getTeamPulse(userId, dayStart),
  ]);

  const totalAttention =
    myWork.counts.overdue +
    myWork.counts.dueToday +
    teamWork.counts.overdue +
    teamWork.counts.dueToday +
    awaitingMe.counts.taskConfirmations +
    awaitingMe.counts.subtaskReviews +
    conversations.counts.mentions;

  res.status(200).json({
    success: true,
    timezone: BUSINESS_TIMEZONE,
    generatedAt: new Date(),
    totalAttention,
    sections: {
      myWork,
      teamWork,
      awaitingMe,
      conversations,
      teamPulse,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────
// DAILY DIGEST  (called by cron — NOT by HTTP)
// ─────────────────────────────────────────────────────────────────────

export const sendDailyDigest = async () => {
  const dayEnd = getLagosDayEnd();

  const userIds = await Task.distinct('assignees', {
    isDeleted: false,
    isTrash: { $ne: true },
    status: { $nin: ['confirmed_completed', 'cancelled'] },
    dueDate: { $ne: null, $lte: dayEnd },
  });

  for (const userId of userIds) {
    if (!userId) continue;

    const [myWork, teamWork] = await Promise.all([
      getMyWork(userId, dayEnd),
      getTeamWork(userId, dayEnd),
    ]);

    const overdue = myWork.counts.overdue + teamWork.counts.overdue;
    const dueToday = myWork.counts.dueToday + teamWork.counts.dueToday;

    if (overdue === 0 && dueToday === 0) continue;

    const parts = [];
    if (overdue > 0) parts.push(`${overdue} overdue`);
    if (dueToday > 0) parts.push(`${dueToday} due today`);

    createAndSendNotification({
      recipient: userId,
      title: `Your day: ${parts.join(' • ')}`,
      body: `Open Today to see what needs you.`,
      data: { screen: 'Today', notificationType: 'daily_digest' },
      sendPush: true,
      emailEventType: 'dailyDigest',
      emailSubject: `Today: ${parts.join(' • ')}`,
      emailHtml: `
        <h3>Your day</h3>
        <p><strong>${overdue}</strong> overdue · <strong>${dueToday}</strong> due today</p>
        <p><a href="${process.env.CLIENT_URL}/today">Open Today</a></p>
      `,
    }).catch((err) => console.error(`Digest to ${userId} failed:`, err.message));
  }
};