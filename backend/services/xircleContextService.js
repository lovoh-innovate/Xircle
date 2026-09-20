// services/xircleContextService.js
import mongoose from 'mongoose';
import PersonalTask from '../models/personalTaskModel.js';
import PersonalFolder from '../models/personalFolderModel.js';
import PersonalNote from '../models/personalNoteModel.js';
import Task from '../models/taskModel.js';
import Project from '../models/projectModel.js';
import Workspace from '../models/workspaceModel.js';
import WorkspaceNote from '../models/workspaceNoteModel.js';
import { Message, Chat } from '../models/messagingModel.js';
import User from '../models/userModel.js';

// ─────────────────────────────────────────────────────────────────────
// TIMEZONE  (same convention as todayController)
// ─────────────────────────────────────────────────────────────────────
const BUSINESS_TIMEZONE = 'Africa/Lagos';
const TIMEZONE_OFFSET_MINUTES = 60;

const getLagosParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  });
  const result = {};
  for (const p of formatter.formatToParts(date)) {
    if (p.type !== 'literal') result[p.type] = Number(p.value);
  }
  return result;
};

const getLagosDateKey = (date = new Date()) => {
  const p = getLagosParts(date);
  return [p.year, String(p.month).padStart(2, '0'), String(p.day).padStart(2, '0')].join('-');
};

const makeLagosDate = (dateKey, hhmm) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = hhmm.split(':').map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes, 0, 0) -
      TIMEZONE_OFFSET_MINUTES * 60 * 1000
  );
};

const getLagosDayStart = (d = new Date()) => makeLagosDate(getLagosDateKey(d), '00:00');
const getLagosDayEnd   = (d = new Date()) => new Date(getLagosDayStart(d).getTime() + 86400000 - 1);

const daysAgo = (n, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
};

// ─────────────────────────────────────────────────────────────────────
// TRIMMERS  — keep each item small so the payload stays prompt-friendly
// ─────────────────────────────────────────────────────────────────────

const trimTask = (t) => ({
  id: t._id.toString(),
  title: t.title,
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate || null,
  projectId: t.project?._id?.toString() || t.project?.toString() || null,
  projectName: t.project?.name || null,
  assigneeNames: (t.assignees || []).map((a) => a.name).filter(Boolean),
  progress: t.progress ?? null,
  isOverdue: t.dueDate ? new Date(t.dueDate) < new Date() : false,
});

const trimPersonalTask = (t) => ({
  id: t._id.toString(),
  title: t.title,
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate || null,
  folderName: t.folder?.name || null,
  subtaskCount: (t.subtasks || []).length,
  subtaskDone: (t.subtasks || []).filter((s) => s.done).length,
  isOverdue: t.dueDate ? new Date(t.dueDate) < new Date() : false,
});

const trimProject = (p, userId) => {
  const isPM = (p.projectManagers || []).some(
    (pm) => (pm._id || pm).toString() === userId
  );
  return {
    id: p._id.toString(),
    name: p.name,
    status: p.status,
    priority: p.priority,
    progress: p.progress,
    role: isPM ? 'Project Manager' : 'Team Member',
    startDate: p.startDate,
    endDate: p.endDate,
    teamMemberCount: (p.teamMembers || []).filter((t) => t.status === 'active').length,
  };
};

const trimNote = (n, extra = {}) => ({
  id: n._id.toString(),
  title: n.title,
  updatedAt: n.updatedAt || n.createdAt,
  preview: (n.content || '').slice(0, 240),
  ...extra,
});

const trimChat = (c, unread, mentions) => ({
  chatId: c._id.toString(),
  type: c.type,
  name: c.name || null,
  workspaceId: c.workspace?.toString() || null,
  unreadCount: unread,
  mentionCount: mentions,
});

// ─────────────────────────────────────────────────────────────────────
// MANAGED PROJECT IDS  (owner/admin/PM)
// ─────────────────────────────────────────────────────────────────────

const getManagedProjectIds = async (userId) => {
  const ownedWs = await Workspace.find({ owner: userId }).select('_id').lean();
  const adminWs = await Workspace.find({
    'members.user': userId, 'members.role': 'Admin', 'members.status': 'active',
  }).select('_id').lean();
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
  }).select('_id').lean();
  return projects.map((p) => p._id);
};

// ─────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────

const buildStats = async (userId) => {
  const now = new Date();
  const weekStart = daysAgo(7, now);
  const monthStart = daysAgo(30, now);

  const [
    personalDoneWeek,
    personalDoneMonth,
    projectTasksDoneWeek,
    projectTasksDoneMonth,
    projectTasksAssignedTotal,
    projectTasksOnTime,
    projectTasksLate,
  ] = await Promise.all([
    PersonalTask.countDocuments({
      user: userId, isTrash: { $ne: true },
      completedAt: { $gte: weekStart },
    }),
    PersonalTask.countDocuments({
      user: userId, isTrash: { $ne: true },
      completedAt: { $gte: monthStart },
    }),
    Task.countDocuments({
      assignees: userId, status: 'confirmed_completed',
      confirmedAt: { $gte: weekStart },
      isDeleted: false, isTrash: { $ne: true },
    }),
    Task.countDocuments({
      assignees: userId, status: 'confirmed_completed',
      confirmedAt: { $gte: monthStart },
      isDeleted: false, isTrash: { $ne: true },
    }),
    Task.countDocuments({
      assignees: userId, isDeleted: false, isTrash: { $ne: true },
    }),
    Task.countDocuments({
      assignees: userId, status: 'confirmed_completed',
      isDeleted: false, isTrash: { $ne: true },
      $expr: { $lte: ['$confirmedAt', '$dueDate'] },
    }),
    Task.countDocuments({
      assignees: userId, status: 'confirmed_completed',
      isDeleted: false, isTrash: { $ne: true },
      $expr: { $gt: ['$confirmedAt', '$dueDate'] },
    }),
  ]);

  const onTimeTotal = projectTasksOnTime + projectTasksLate;
  const onTimeRate = onTimeTotal > 0 ? Math.round((projectTasksOnTime / onTimeTotal) * 100) : null;

  return {
    completedThisWeek: personalDoneWeek + projectTasksDoneWeek,
    completedThisMonth: personalDoneMonth + projectTasksDoneMonth,
    personalCompletedThisWeek: personalDoneWeek,
    projectCompletedThisWeek: projectTasksDoneWeek,
    totalAssignedProjectTasks: projectTasksAssignedTotal,
    onTimeRatePercent: onTimeRate,
    onTimeTasks: projectTasksOnTime,
    lateTasks: projectTasksLate,
  };
};

// ─────────────────────────────────────────────────────────────────────
// MAIN  — build the whole context for a user
// ─────────────────────────────────────────────────────────────────────

export const buildUserContext = async (userId, opts = {}) => {
  const {
    completedLookbackDays = 60,
    recentNotesLimit = 15,
    recentChatLimit = 15,
    maxTasksPerBucket = 40,
  } = opts;

  const user = await User.findById(userId).select('name email').lean();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const now = new Date();
  const todayStart = getLagosDayStart(now);
  const todayEnd = getLagosDayEnd(now);
  const lookback = daysAgo(completedLookbackDays, now);

  // ── 1. TODAY  (my work + due today) ─────────────────────────────
  const [myPersonalOpen, myProjectOpen] = await Promise.all([
    PersonalTask.find({
      user: userId, isTrash: { $ne: true }, isArchived: { $ne: true },
      status: { $ne: 'completed' },
    })
      .populate('folder', 'name')
      .sort({ dueDate: 1, order: 1 })
      .limit(200)
      .lean(),
    Task.find({
      assignees: userId, isDeleted: false, isTrash: { $ne: true }, isArchived: { $ne: true },
      status: { $nin: ['confirmed_completed', 'cancelled'] },
    })
      .populate('project', 'name')
      .sort({ dueDate: 1 })
      .limit(200)
      .lean(),
  ]);

  const myWorkOverdue = myPersonalOpen
    .filter((t) => t.dueDate && new Date(t.dueDate) < now)
    .slice(0, maxTasksPerBucket)
    .map(trimPersonalTask);
  const myWorkDueToday = myPersonalOpen
    .filter((t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd)
    .slice(0, maxTasksPerBucket)
    .map(trimPersonalTask);
  const myWorkNoDue = myPersonalOpen
    .filter((t) => !t.dueDate)
    .slice(0, 15)
    .map(trimPersonalTask);

  const teamWorkOverdue = myProjectOpen
    .filter((t) => t.dueDate && new Date(t.dueDate) < now)
    .slice(0, maxTasksPerBucket)
    .map(trimTask);
  const teamWorkDueToday = myProjectOpen
    .filter((t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd)
    .slice(0, maxTasksPerBucket)
    .map(trimTask);
  const teamWorkNoDue = myProjectOpen
    .filter((t) => !t.dueDate)
    .slice(0, 15)
    .map(trimTask);

  // ── 2. AWAITING ME  (things blocked on my review) ───────────────
  const managedProjectIds = await getManagedProjectIds(userId);

  let taskConfirmations = [];
  let subtaskReviews = [];
  if (managedProjectIds.length > 0) {
    const [pendingTasks, tasksWithDoneSubtasks] = await Promise.all([
      Task.find({
        project: { $in: managedProjectIds },
        status: 'completed', isDeleted: false, isTrash: { $ne: true },
        completedBy: { $ne: userId },
      })
        .populate('project', 'name')
        .populate('assignees', 'name')
        .populate('completedBy', 'name')
        .sort({ completedAt: -1 })
        .limit(20)
        .lean(),
      Task.find({
        project: { $in: managedProjectIds },
        'subTasks.status': 'done',
        isDeleted: false, isTrash: { $ne: true },
      })
        .populate('project', 'name')
        .populate('assignees', 'name')
        .limit(20)
        .lean(),
    ]);

    taskConfirmations = pendingTasks.map((t) => ({
      id: t._id.toString(),
      title: t.title,
      projectName: t.project?.name || null,
      completedBy: t.completedBy?.name || null,
      completedAt: t.completedAt,
      assigneeNames: (t.assignees || []).map((a) => a.name).filter(Boolean),
    }));

    subtaskReviews = tasksWithDoneSubtasks
      .map((t) => ({
        taskId: t._id.toString(),
        taskTitle: t.title,
        projectName: t.project?.name || null,
        pendingSubtasks: t.subTasks
          .map((st, idx) => ({ ...st, idx }))
          .filter((st) => st.status === 'done' && st.completedBy?.toString() !== userId)
          .map((st) => ({ title: st.title, completedAt: st.completedAt })),
      }))
      .filter((t) => t.pendingSubtasks.length > 0);
  }

  // ── 3. CONVERSATIONS ─────────────────────────────────────────────
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const chats = await Chat.find({
    'participants.user': userId,
    archivedBy: { $nin: [userId] },
  })
    .select('_id type name workspace participants')
    .lean();

  const chatIds = chats.map((c) => c._id);
  let unreadChats = [];
  let unreadTotal = 0;
  let mentionTotal = 0;

  if (chatIds.length > 0) {
    const [unreadAgg, mentionAgg] = await Promise.all([
      Message.aggregate([
        { $match: { chat: { $in: chatIds }, sender: { $ne: userObjectId }, isDeleted: false, 'readBy.user': { $ne: userObjectId } } },
        { $group: { _id: '$chat', count: { $sum: 1 } } },
      ]),
      Message.aggregate([
        { $match: { chat: { $in: chatIds }, mentions: userObjectId, sender: { $ne: userObjectId }, isDeleted: false, 'readBy.user': { $ne: userObjectId } } },
        { $group: { _id: '$chat', count: { $sum: 1 } } },
      ]),
    ]);
    const unreadMap = Object.fromEntries(unreadAgg.map((u) => [u._id.toString(), u.count]));
    const mentionMap = Object.fromEntries(mentionAgg.map((u) => [u._id.toString(), u.count]));
    unreadChats = chats
      .filter((c) => unreadMap[c._id.toString()] > 0)
      .map((c) => trimChat(c, unreadMap[c._id.toString()], mentionMap[c._id.toString()] || 0))
      .sort((a, b) => b.mentionCount - a.mentionCount || b.unreadCount - a.unreadCount)
      .slice(0, recentChatLimit);
    unreadTotal = unreadChats.reduce((s, c) => s + c.unreadCount, 0);
    mentionTotal = unreadChats.reduce((s, c) => s + c.mentionCount, 0);
  }

  // ── 4. WORKSPACE PULSE ───────────────────────────────────────────
  const workspaces = await Workspace.find({
    $or: [{ owner: userId }, { 'members.user': userId, 'members.status': 'active' }],
  })
    .select('_id name owner members')
    .lean();

  const pendingJoinRequests = workspaces
    .filter((w) => {
      const isOwner = w.owner.toString() === userId;
      const isAdmin = w.members.some((m) => m.user.toString() === userId && m.role === 'Admin' && m.status === 'active');
      return isOwner || isAdmin;
    })
    .map((w) => {
      const pending = w.members.filter((m) => m.status === 'pending').length;
      return pending > 0 ? { workspaceId: w._id.toString(), workspaceName: w.name, count: pending } : null;
    })
    .filter(Boolean);

  // ── 5. PROJECTS  (my open list, capped) ─────────────────────────
  const myProjects = await Project.find({
    isTrash: { $ne: true },
    $or: [
      { projectManagers: userId },
      { 'teamMembers.user': userId, 'teamMembers.status': 'active' },
      { workspace: { $in: workspaces.map((w) => w._id) } },
    ],
  })
    .select('name status priority progress projectManagers teamMembers startDate endDate')
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  const projects = myProjects.map((p) => trimProject(p, userId));

  // ── 6. RECENTLY COMPLETED  (done + undone context) ──────────────
  const [recentPersonalDone, recentProjectDone, recentlyRejected] = await Promise.all([
    PersonalTask.find({
      user: userId, isTrash: { $ne: true },
      status: 'completed',
      completedAt: { $gte: lookback },
    })
      .select('title completedAt priority folder')
      .populate('folder', 'name')
      .sort({ completedAt: -1 })
      .limit(40)
      .lean(),
    Task.find({
      assignees: userId, status: 'confirmed_completed',
      confirmedAt: { $gte: lookback },
      isDeleted: false, isTrash: { $ne: true },
    })
      .select('title confirmedAt priority project')
      .populate('project', 'name')
      .sort({ confirmedAt: -1 })
      .limit(40)
      .lean(),
    Task.find({
      assignees: userId, status: { $in: ['ready_for_completion', 'pending', 'in-progress'] },
      rejectedAt: { $gte: lookback },
      isDeleted: false, isTrash: { $ne: true },
    })
      .select('title rejectionReason rejectedAt project')
      .populate('project', 'name')
      .sort({ rejectedAt: -1 })
      .limit(20)
      .lean(),
  ]);

  const recentlyCompleted = [
    ...recentPersonalDone.map((t) => ({
      source: 'personal', title: t.title, completedAt: t.completedAt,
      folderName: t.folder?.name || null,
    })),
    ...recentProjectDone.map((t) => ({
      source: 'project', title: t.title, completedAt: t.confirmedAt,
      projectName: t.project?.name || null,
    })),
  ].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).slice(0, 50);

  const recentlyRejectedTasks = recentlyRejected.map((t) => ({
    title: t.title,
    projectName: t.project?.name || null,
    rejectionReason: t.rejectionReason || null,
    rejectedAt: t.rejectedAt,
  }));

  // ── 7. NOTES ─────────────────────────────────────────────────────
  const [personalNotes, workspaceNotes] = await Promise.all([
    PersonalNote.find({ user: userId })
      .select('title content updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .limit(recentNotesLimit)
      .lean(),
    WorkspaceNote.find({ workspace: { $in: workspaces.map((w) => w._id) } })
      .select('title content updatedAt createdAt workspace author')
      .populate('workspace', 'name')
      .sort({ updatedAt: -1 })
      .limit(recentNotesLimit)
      .lean(),
  ]);

  const notes = {
    personal: personalNotes.map((n) => trimNote(n, { source: 'personal' })),
    workspace: workspaceNotes.map((n) => trimNote(n, {
      source: 'workspace',
      workspaceName: n.workspace?.name || null,
    })),
  };

  // ── 8. STATS ─────────────────────────────────────────────────────
  const stats = await buildStats(userId);

  // ── 9. ASSEMBLE ──────────────────────────────────────────────────
  return {
    user: { name: user.name, email: user.email },
    now: now.toISOString(),
    timezone: BUSINESS_TIMEZONE,
    today: {
      myWork: {
        overdue: myWorkOverdue,
        dueToday: myWorkDueToday,
        noDueDate: myWorkNoDue,
      },
      teamWork: {
        overdue: teamWorkOverdue,
        dueToday: teamWorkDueToday,
        noDueDate: teamWorkNoDue,
      },
      awaitingMe: {
        taskConfirmations,
        subtaskReviews,
      },
      conversations: {
        unreadChats,
        unreadTotal,
        mentionTotal,
      },
      teamPulse: {
        pendingJoinRequests,
      },
    },
    projects,
    recentlyCompleted,
    recentlyRejectedTasks,
    notes,
    stats,
    counts: {
      openPersonalTasks: myPersonalOpen.length,
      openProjectTasks: myProjectOpen.length,
      activeProjects: projects.length,
      unreadMessages: unreadTotal,
      unreadMentions: mentionTotal,
      pendingConfirmations: taskConfirmations.length,
      subtaskReviews: subtaskReviews.length,
    },
  };
};