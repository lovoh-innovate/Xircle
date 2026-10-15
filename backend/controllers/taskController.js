// controllers/taskController.js
import Task from '../models/taskModel.js';
import Project from '../models/projectModel.js';
import Workspace from '../models/workspaceModel.js';
import Folder from '../models/folderModel.js';
import Feedback from '../models/feedbackModel.js';
import PersonalNote from '../models/personalNoteModel.js';
import WorkspaceNote from '../models/workspaceNoteModel.js';
import { v2 as cloudinary } from 'cloudinary';
import { createAndSendNotification } from './notificationController.js';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../services/googleCalendarService.js';

// ═════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════

const getUserId = (u) => (u?._id ? u._id.toString() : u?.toString());

const isWorkspaceOwner = (workspace, userId) => {
  if (!workspace?.owner || !userId) return false;
  const ownerId = workspace.owner?._id
    ? workspace.owner._id.toString()
    : workspace.owner.toString();
  return ownerId === userId;
};

const getWorkspaceMember = (workspace, userId) => {
  if (!workspace?.members || !userId) return null;
  return (
    workspace.members.find((m) => {
      const uid = getUserId(m.user);
      return uid === userId && m.status === 'active';
    }) || null
  );
};

const isWorkspaceAdmin = (workspace, userId) => {
  if (!workspace?.members || !userId) return false;
  return workspace.members.some((m) => {
    const uid = getUserId(m.user);
    return (
      uid === userId &&
      m.role === 'Admin' &&
      m.status === 'active' &&
      m.memberType !== 'associate'
    );
  });
};

const isWorkspaceAssociate = (workspace, userId) => {
  const m = getWorkspaceMember(workspace, userId);
  return m?.memberType === 'associate';
};

const isProjectManager = (project, userId) =>
  (project.projectManagers || []).some((pm) => {
    const id = pm._id ? pm._id.toString() : pm?.toString();
    return id === userId;
  });

const isProjectMember = (project, userId) =>
  (project.teamMembers || []).some((tm) => {
    const user = tm.user;
    const memberId = user?._id ? user._id.toString() : user?.toString();
    return memberId === userId && tm.status === 'active';
  });

const isTaskAssignee = (task, userId) =>
  (task.assignees || []).some((a) => {
    const id = a?._id ? a._id.toString() : a?.toString();
    return id === userId;
  });

const canManageTasks = (workspace, project, userId) =>
  isWorkspaceOwner(workspace, userId) ||
  (project.createdBy && project.createdBy.toString() === userId) ||
  isProjectManager(project, userId);

// ── ASSOCIATE LOOKUP ────────────────────────────────────────────
const getActiveAssociate = (project, userId) => {
  if (!userId || !project.associates) return null;
  return (
    project.associates.find((a) => {
      const aid = getUserId(a.userId);
      return aid === userId && a.status === 'active';
    }) || null
  );
};

const getVisibleFolderIdsForUser = async (projectId, userId) => {
  const assignedFolders = await Task.distinct('folder', {
    project: projectId,
    assignees: userId,
    folder: { $ne: null },
    isDeleted: false,
    isTrash: { $ne: true },
  });
  const readOnlyFolders = await Folder.distinct('_id', {
    project: projectId,
    readOnlyUsers: userId,
  });
  return Array.from(new Set([...assignedFolders, ...readOnlyFolders]));
};

const canViewTask = (workspace, project, userId, task) => {
  const access = resolveTaskAccess(workspace, project, task, userId);
  return access.canView;
};

const parseArrayField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [value];
    }
  }
  return [];
};

const normalizeAttachments = (files) => {
  if (!files || !Array.isArray(files)) return [];
  return files.map((file) => ({
    name: file.originalname,
    url: file.path,
    publicId: file.filename || file.public_id,
    size: file.size,
    type: file.mimetype,
  }));
};

const ensureProjectMembers = async (project, workspace, assigneeIds) => {
  let modified = false;

  for (const assigneeId of assigneeIds) {
    const wsMember = workspace.members.find((m) => {
      const uid = getUserId(m.user);
      return uid === assigneeId && m.status === 'active';
    });

    if (!wsMember) {
      throw new Error(
        'Assignee must be an active workspace member or associate.'
      );
    }

    const isAssoc = wsMember.memberType === 'associate';

    if (isAssoc) {
      const existingAssoc = (project.associates || []).find(
        (a) => getUserId(a.userId) === assigneeId
      );

      if (existingAssoc) {
        if (existingAssoc.status !== 'active') {
          existingAssoc.status = 'active';
          existingAssoc.acceptedAt = existingAssoc.acceptedAt || new Date();
          modified = true;
        }
        if (existingAssoc.role === 'viewer') {
          existingAssoc.role = 'editor';
          modified = true;
        }
      } else {
        project.associates.push({
          email: wsMember.user?.email || '',
          name: wsMember.user?.name || '',
          role: 'editor',
          userId: assigneeId,
          status: 'active',
          addedBy: null,
          addedAt: new Date(),
          acceptedAt: new Date(),
          accessExpiresAt: wsMember.accessExpiresAt || null,
        });
        modified = true;
      }
      continue;
    }

    const alreadyActive = (project.teamMembers || []).some(
      (tm) => getUserId(tm.user) === assigneeId && tm.status === 'active'
    );
    if (alreadyActive) continue;

    const existing = (project.teamMembers || []).find(
      (tm) => getUserId(tm.user) === assigneeId
    );

    if (existing) {
      existing.status = 'active';
      existing.leftAt = null;
    } else {
      project.teamMembers.push({
        user: assigneeId,
        role: 'member',
        status: 'active',
        joinedAt: new Date(),
      });
    }
    modified = true;
  }

  if (modified) await project.save();
};

const extractAssigneeIds = (body) => {
  const raw = [
    ...parseArrayField(body.assigneeIds),
    ...(body.assigneeId ? [body.assigneeId] : []),
  ];
  return [...new Set(raw.map(String).filter(Boolean))];
};

// ═════════════════════════════════════════════════════════════════════
// UNIFIED TASK ACCESS RESOLVER
// ═════════════════════════════════════════════════════════════════════

const resolveTaskAccess = (workspace, project, task, userId) => {
  if (!userId) {
    return {
      role: 'none',
      canManage: false,
      canView: false,
      canComplete: false,
      canComment: false,
      associate: null,
    };
  }

  if (isWorkspaceOwner(workspace, userId)) {
    return {
      role: 'owner',
      canManage: true,
      canView: true,
      canComplete: true,
      canComment: true,
      associate: null,
    };
  }
  if (isWorkspaceAdmin(workspace, userId)) {
    return {
      role: 'admin',
      canManage: true,
      canView: true,
      canComplete: true,
      canComment: true,
      associate: null,
    };
  }
  if (
    isProjectManager(project, userId) ||
    project.createdBy?.toString() === userId
  ) {
    return {
      role: 'pm',
      canManage: true,
      canView: true,
      canComplete: true,
      canComment: true,
      associate: null,
    };
  }

  if (isProjectMember(project, userId)) {
    const assigned = isTaskAssignee(task, userId);
    return {
      role: 'member',
      canManage: false,
      canView: true,
      canComplete: assigned || !!task.allowAssigneeEditSubtasks,
      canComment: true,
      associate: null,
    };
  }

  const assoc = getActiveAssociate(project, userId);
  if (assoc) {
    const isEditor = assoc.role === 'editor';
    const assigned = isTaskAssignee(task, userId);
    return {
      role: isEditor ? 'associateEditor' : 'associateViewer',
      canManage: false,
      canView: true,
      canComplete: isEditor && assigned,
      canComment: isEditor && assigned,
      associate: assoc,
    };
  }

  if (isTaskAssignee(task, userId)) {
    return {
      role: 'assignee',
      canManage: false,
      canView: true,
      canComplete: true,
      canComment: true,
      associate: null,
    };
  }

  return {
    role: 'none',
    canManage: false,
    canView: false,
    canComplete: false,
    canComment: false,
    associate: null,
  };
};

// ═════════════════════════════════════════════════════════════════════
// SUBTASK ACCESS RESOLVER
// ═════════════════════════════════════════════════════════════════════

const resolveSubTaskAccess = (workspace, project, task, subTask, userId) => {
  const taskAccess = resolveTaskAccess(workspace, project, task, userId);

  if (!userId || !taskAccess.canView) {
    return {
      ...taskAccess,
      canCompleteSubTask: false,
      canAssignSubTask: false,
      isSubTaskAssignee: false,
    };
  }

  const isManager = taskAccess.canManage;
  const isTaskLevelAssignee = isTaskAssignee(task, userId);
  const subTaskAssigneeId = subTask.assignee?._id || subTask.assignee;
  const isSubTaskAssignee =
    !!subTaskAssigneeId && subTaskAssigneeId.toString() === userId;

  if (isManager) {
    return {
      ...taskAccess,
      canCompleteSubTask: true,
      canAssignSubTask: true,
      isSubTaskAssignee,
    };
  }

  if (isSubTaskAssignee) {
    return {
      ...taskAccess,
      canCompleteSubTask: true,
      canAssignSubTask: false,
      isSubTaskAssignee: true,
    };
  }

  if (isTaskLevelAssignee && task.allowAssigneeEditSubtasks) {
    return {
      ...taskAccess,
      canCompleteSubTask: !subTaskAssigneeId,
      canAssignSubTask: true,
      isSubTaskAssignee: false,
    };
  }

  if (isTaskLevelAssignee) {
    return {
      ...taskAccess,
      canCompleteSubTask: !subTaskAssigneeId,
      canAssignSubTask: false,
      isSubTaskAssignee: false,
    };
  }

  return {
    ...taskAccess,
    canCompleteSubTask: false,
    canAssignSubTask: false,
    isSubTaskAssignee: false,
  };
};

const isValidSubTaskAssignee = (task, targetUserId) =>
  (task.assignees || []).some((a) => {
    const id = a?._id ? a._id.toString() : a?.toString();
    return id === targetUserId.toString();
  });

// ═════════════════════════════════════════════════════════════════════
// LINKED NOTES  (unchanged)
// ═════════════════════════════════════════════════════════════════════

const parseLinkedNotes = (value) => {
  if (!value) return [];
  let arr = value;
  if (typeof value === 'string') {
    try { arr = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];

  const seen = new Set();
  const out = [];
  for (const item of arr) {
    if (!item) continue;
    const rawId = item.noteId || item._id || item.note;
    const source = item.source;
    if (!rawId || !['workspace', 'personal'].includes(source)) continue;
    const idStr = String(rawId);
    const key = `${source}:${idStr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ note: idStr, source });
  }
  return out;
};

const validateLinkedNotes = async (items, userId, workspaceId) => {
  if (!items || items.length === 0) return [];

  const personalIds = items.filter((i) => i.source === 'personal').map((i) => i.note);
  const workspaceIds = items.filter((i) => i.source === 'workspace').map((i) => i.note);

  const [personalNotes, workspaceNotes] = await Promise.all([
    personalIds.length
      ? PersonalNote.find({ _id: { $in: personalIds }, user: userId }).select('_id')
      : [],
    workspaceIds.length
      ? WorkspaceNote.find({ _id: { $in: workspaceIds }, workspace: workspaceId }).select('_id')
      : [],
  ]);

  const personalSet = new Set(personalNotes.map((n) => n._id.toString()));
  const workspaceSet = new Set(workspaceNotes.map((n) => n._id.toString()));

  const now = new Date();
  const validated = [];
  for (const item of items) {
    if (item.source === 'personal' && personalSet.has(item.note)) {
      validated.push({ note: item.note, source: 'personal', addedAt: now });
    } else if (item.source === 'workspace' && workspaceSet.has(item.note)) {
      validated.push({ note: item.note, source: 'workspace', addedAt: now });
    }
  }
  return validated;
};

const populateTaskLinkedNotes = async (task) => {
  if (!task) return task;
  const obj = typeof task.toObject === 'function' ? task.toObject() : task;
  const links = obj.linkedNotes || [];
  if (links.length === 0) { obj.linkedNotes = []; return obj; }

  const personalIds = links.filter((l) => l.source === 'personal').map((l) => l.note);
  const workspaceIds = links.filter((l) => l.source === 'workspace').map((l) => l.note);

  const [personalDocs, workspaceDocs] = await Promise.all([
    personalIds.length
      ? PersonalNote.find({ _id: { $in: personalIds } }).select('title content updatedAt')
      : [],
    workspaceIds.length
      ? WorkspaceNote.find({ _id: { $in: workspaceIds } }).select('title content updatedAt')
      : [],
  ]);

  const personalMap = new Map(personalDocs.map((n) => [n._id.toString(), n]));
  const workspaceMap = new Map(workspaceDocs.map((n) => [n._id.toString(), n]));

  obj.linkedNotes = links.map((ln) => {
    const idStr = ln.note.toString();
    const doc = ln.source === 'personal' ? personalMap.get(idStr) : workspaceMap.get(idStr);
    return {
      note: doc
        ? { _id: doc._id, title: doc.title, content: doc.content, updatedAt: doc.updatedAt }
        : { _id: ln.note, title: '[Deleted]', content: '' },
      source: ln.source,
      addedAt: ln.addedAt,
    };
  });
  return obj;
};

// ─── Google Calendar sync (unchanged) ───────────────────────────
const syncTaskToGoogle = async (task, action = 'create') => {
  if (!task.syncToGoogleCalendar) return;
  const ownerId = task.createdBy?.toString();
  if (!ownerId) return;

  try {
    if (action === 'create') {
      const eventId = await createCalendarEvent(ownerId, task);
      if (eventId) { task.googleEventId = eventId; await task.save(); }
    } else if (action === 'update' && task.googleEventId) {
      await updateCalendarEvent(ownerId, task.googleEventId, task);
    } else if (action === 'delete') {
      if (task.googleEventId) {
        await deleteCalendarEvent(ownerId, task.googleEventId);
        task.googleEventId = null;
        await task.save();
      }
    }
  } catch (err) {
    console.error('syncTaskToGoogle failed:', err.message);
  }
};

// ─── Recurrence helpers (unchanged) ─────────────────────────────
const calculateNextDueDate = (item, fromDate = null) => {
  if (!item.recurrenceType || item.recurrenceType === 'none') return null;

  const base = fromDate
    ? new Date(fromDate)
    : item.dueDate
    ? new Date(item.dueDate)
    : new Date();
  if (!item.dueDate) base.setHours(0, 0, 0, 0);
  if (item.recurrenceEndDate && base >= new Date(item.recurrenceEndDate)) return null;

  const next = new Date(base);
  next.setHours(base.getHours(), base.getMinutes(), 0, 0);

  if (item.recurrenceType === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (item.recurrenceType === 'weekly') {
    const days = item.recurrenceDays || [];
    if (days.length === 0) {
      next.setDate(next.getDate() + 7);
    } else {
      const currentDay = next.getDay();
      const sortedDays = [...days].sort((a, b) => a - b);
      let nextDay = sortedDays.find((d) => d > currentDay);
      if (nextDay === undefined) nextDay = sortedDays[0] + 7;
      next.setDate(next.getDate() + (nextDay - currentDay));
    }
  }

  if (item.recurrenceEndDate && next > new Date(item.recurrenceEndDate)) return null;
  const originalTime = item.dueDate ? new Date(item.dueDate) : new Date();
  next.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0);
  return next;
};

const parseRecurrence = (body) => {
  const { recurrenceType, recurrenceDays, recurrenceEndDate } = body;
  const type = recurrenceType || 'none';
  if (!['none', 'daily', 'weekly'].includes(type)) throw new Error('Invalid recurrence type');
  let days = recurrenceDays || [];
  if (type === 'weekly') {
    if (!Array.isArray(days) || days.length === 0) {
      throw new Error('Weekly recurrence requires at least one day');
    }
    days = days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length === 0) {
      throw new Error('Weekly recurrence days must be valid (0-6)');
    }
  }
  return {
    recurrenceType: type,
    recurrenceDays: type === 'weekly' ? days : [],
    recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
  };
};

const spawnNextTaskOccurrence = async (task) => {
  if (!task.recurrenceType || task.recurrenceType === 'none') return null;
  const nextDue = calculateNextDueDate(task, task.dueDate);
  if (!nextDue) { task.recurrenceType = 'none'; return null; }

  const data = task.toObject();
  delete data._id;
  delete data.createdAt;
  delete data.updatedAt;
  data.dueDate = nextDue;
  data.status = (data.assignees?.length || 0) > 0 ? 'ready_for_completion' : 'pending';
  data.progress = 0;
  data.completedBy = null;
  data.completedAt = null;
  data.confirmedBy = null;
  data.confirmedAt = null;
  data.rejectedBy = null;
  data.rejectedAt = null;
  data.completionNotes = null;
  data.completionFeedback = null;
  data.reminderSent = false;
  data.googleEventId = null;
  data.subTasks = (data.subTasks || []).map((st) => ({
    ...st,
    status: 'pending',
    completedBy: null,
    completedAt: null,
    confirmedBy: null,
    confirmedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    feedback: null,
    rejectionReason: null,
    reminderSent: false,
  }));

  const newTask = await Task.create(data);
  if (newTask.syncToGoogleCalendar) await syncTaskToGoogle(newTask, 'create');
  return newTask;
};

const spawnNextSubTaskOccurrence = (task, subTask, index) => {
  if (!subTask.recurrenceType || subTask.recurrenceType === 'none') return false;
  const nextDue = calculateNextDueDate(subTask, subTask.dueDate);
  if (!nextDue) { subTask.recurrenceType = 'none'; return false; }
  task.subTasks.splice(index + 1, 0, {
    title: subTask.title,
    description: subTask.description,
    startDate: subTask.startDate,
    dueDate: nextDue,
    bufferTime: subTask.bufferTime || 0,
    links: subTask.links || [],
    attachments: subTask.attachments || [],
    status: 'pending',
    reminderSent: false,
    recurrenceType: subTask.recurrenceType,
    recurrenceDays: subTask.recurrenceDays,
    recurrenceEndDate: subTask.recurrenceEndDate,
    assignee: subTask.assignee || null,
  });
  return true;
};

// ─── Notifications (unchanged) ──────────────────────────────────
const notifyUsers = async (userIds, {
  title, body, data = {}, emailEventType = null, emailHtml = null,
}) => {
  if (!userIds) return;
  const recipients = Array.isArray(userIds) ? userIds : [userIds];
  for (const recipient of recipients) {
    createAndSendNotification({
      recipient,
      title,
      body,
      data,
      sendPush: true,
      emailEventType,
      emailSubject: title,
      emailHtml: emailHtml || `<p>${body}</p>`,
    }).catch((err) =>
      console.error(`Notification to ${recipient} failed:`, err.message)
    );
  }
};

const getManagerRecipients = (project, workspace) => {
  const ids = new Set((project.projectManagers || []).map((pm) => pm.toString()));
  const ownerId = workspace.owner?._id
    ? workspace.owner._id.toString()
    : workspace.owner?.toString();
  if (ownerId) ids.add(ownerId);
  if (project.createdBy) ids.add(project.createdBy.toString());
  return Array.from(ids);
};

// ─── Progress recomputation (unchanged) ─────────────────────────
const updateTaskProgress = async (taskId, { preserveStatus = false } = {}) => {
  const task = await Task.findById(taskId);
  if (!task) return;

  const total = task.subTasks.length;
  const terminal = ['confirmed_completed', 'completed'];
  const isTerminal = terminal.includes(task.status);

  if (total === 0) {
    if (isTerminal) {
      task.progress = 100;
    } else if (!preserveStatus) {
      task.progress = 0;
      task.status = (task.assignees?.length || 0) > 0 ? 'ready_for_completion' : 'pending';
    }
  } else {
    const confirmed = task.subTasks.filter((st) => st.status === 'confirmed').length;
    task.progress = Math.round((confirmed / total) * 100);
    if (!preserveStatus && !isTerminal) {
      if (confirmed === total) task.status = 'ready_for_completion';
      else if (confirmed > 0) task.status = 'in-progress';
      else task.status = 'pending';
    }
  }

  await task.save();
  await updateProjectProgress(task.project);
};

const updateProjectProgress = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) return;

  const tasks = await Task.find({
    project: projectId,
    isDeleted: false,
    isTrash: { $ne: true },
  });

  if (tasks.length === 0) {
    project.progress = 0;
    project.readyForCompletion = false;
  } else {
    const total = tasks.reduce((sum, t) => sum + (t.progress || 0), 0);
    project.progress = Math.round(total / tasks.length);
    const allDone = tasks.every((t) => t.status === 'confirmed_completed');
    project.readyForCompletion = allDone;
    if (allDone && project.status !== 'completed') {
      project.status = 'in-progress';
    } else if (project.progress > 0 && project.status === 'planning') {
      project.status = 'in-progress';
    }
  }
  await project.save();
};

// ═════════════════════════════════════════════════════════════════════
// CREATE TASK  (managers only)
// ═════════════════════════════════════════════════════════════════════
export const createTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      projectId, folderId = null, title,
      description = '', detailedDescription = '',
      taskType = 'general', priority = 'medium',
      startDate = null, dueDate = null,
      estimatedHours = null, bufferTime = 0,
      dependencies, allowAssigneeEditSubtasks = false,
      dailyReminderTime = null,
    } = req.body;

    const links = parseArrayField(req.body.links);
    const deps = parseArrayField(dependencies);
    const assigneeIds = extractAssigneeIds(req.body);
    const rawLinkedNotes = parseLinkedNotes(req.body.linkedNotes);

    if (!projectId || !title?.trim()) {
      return res.status(400).json({ success: false, message: 'projectId and title are required.' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner, project creator, or PMs can create tasks.',
      });
    }

    if (folderId) {
      const folder = await Folder.findById(folderId);
      if (!folder || folder.project.toString() !== projectId) {
        return res.status(400).json({ success: false, message: 'Invalid folder.' });
      }
    }

    if (assigneeIds.length > 0) {
      try { await ensureProjectMembers(project, workspace, assigneeIds); }
      catch (err) { return res.status(400).json({ success: false, message: err.message }); }
    }

    let attachments = normalizeAttachments(req.files?.attachments);

    let recurrenceData;
    try { recurrenceData = parseRecurrence(req.body); }
    catch (err) { return res.status(400).json({ success: false, message: err.message }); }

    const validatedLinkedNotes = await validateLinkedNotes(
      rawLinkedNotes,
      userId,
      project.workspace.toString()
    );

    const lastOrderedTask = await Task.findOne({ project: projectId })
      .sort({ order: -1 })
      .select('order');
    const nextOrder = (lastOrderedTask?.order ?? -1) + 1;

    const hasAssignees = assigneeIds.length > 0;
    const initialStatus = hasAssignees ? 'ready_for_completion' : 'pending';

    const wantsGoogleSync =
      req.body.syncToGoogleCalendar === 'true' ||
      req.body.syncToGoogleCalendar === true;

    const task = await Task.create({
      project: projectId,
      workspace: project.workspace,
      folder: folderId,
      title: title.trim(),
      description,
      detailedDescription,
      taskType,
      assignees: assigneeIds,
      createdBy: userId,
      priority,
      startDate: startDate || null,
      dueDate: dueDate || null,
      bufferTime: bufferTime || 0,
      estimatedHours,
      dependencies: deps,
      links,
      attachments,
      allowAssigneeEditSubtasks,
      dailyReminderTime: dailyReminderTime || null,
      subTasks: [],
      status: initialStatus,
      progress: 0,
      reminderSent: false,
      order: nextOrder,
      recurrenceType: recurrenceData.recurrenceType,
      recurrenceDays: recurrenceData.recurrenceDays,
      recurrenceEndDate: recurrenceData.recurrenceEndDate,
      syncToGoogleCalendar: wantsGoogleSync,
      googleEventId: null,
      linkedNotes: validatedLinkedNotes,
    });

    if (task.syncToGoogleCalendar) await syncTaskToGoogle(task, 'create');

    const recipients = assigneeIds.filter((id) => id !== userId);
    if (recipients.length > 0) {
      notifyUsers(recipients, {
        title: `New task: "${task.title}"`,
        body: `You have been assigned a new task "${task.title}" in project "${project.name}".`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'taskAssignment',
        emailHtml: `<h3>New Task</h3><p><strong>${task.title}</strong></p><p><a href="${process.env.CLIENT_URL}/p/${project._id}/tasks/${task._id}">View Task</a></p>`,
      });
    }

    const populated = await Task.findById(task._id)
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('folder', 'name');

    const hydrated = await populateTaskLinkedNotes(populated);
    res.status(201).json({ success: true, message: 'Task created', task: hydrated });
  } catch (error) {
    console.error('❌ Create task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// UPDATE TASK
// ═════════════════════════════════════════════════════════════════════
export const updateTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = isTaskAssignee(task, userId);
    const access = resolveTaskAccess(workspace, project, task, userId);

    if (access.role.startsWith('associate') && !isManager) {
      if (!(isAssignee && task.allowAssigneeEditSubtasks)) {
        return res.status(403).json({
          success: false,
          message: 'Associates can only edit tasks assigned to them.',
        });
      }
    }

    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({ success: false, message: 'You are not allowed to edit this task.' });
    }

    const {
      title, description, detailedDescription, taskType, priority, status,
      startDate, dueDate, estimatedHours, bufferTime,
      allowAssigneeEditSubtasks, folderId, dailyReminderTime,
    } = req.body;

    let recurrenceData = null;
    if (req.body.recurrenceType !== undefined) {
      try { recurrenceData = parseRecurrence(req.body); }
      catch (err) { return res.status(400).json({ success: false, message: err.message }); }
    }

    const validStatuses = [
      'pending', 'in-progress', 'ready_for_completion',
      'completed', 'confirmed_completed', 'cancelled',
    ];
    let statusExplicitlySet = false;

    if (isManager) {
      if (title !== undefined) task.title = title.trim();
      if (description !== undefined) task.description = description;
      if (detailedDescription !== undefined) task.detailedDescription = detailedDescription;
      if (taskType !== undefined) task.taskType = taskType;
      if (priority !== undefined) task.priority = priority;

      if (status !== undefined && status !== '') {
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ success: false, message: 'Invalid status.' });
        }
        task.status = status;
        statusExplicitlySet = true;
      }

      if (startDate !== undefined) task.startDate = startDate === '' ? null : startDate;
      if (dueDate !== undefined) task.dueDate = dueDate === '' ? null : dueDate;
      if (bufferTime !== undefined) task.bufferTime = bufferTime;
      if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
      if (allowAssigneeEditSubtasks !== undefined) {
        task.allowAssigneeEditSubtasks =
          allowAssigneeEditSubtasks === 'true' || allowAssigneeEditSubtasks === true;
      }
      if (dailyReminderTime !== undefined) task.dailyReminderTime = dailyReminderTime;

      if (folderId !== undefined) {
        if (folderId) {
          const folder = await Folder.findById(folderId);
          if (!folder || folder.project.toString() !== task.project.toString()) {
            return res.status(400).json({ success: false, message: 'Invalid folder.' });
          }
          task.folder = folderId;
        } else {
          task.folder = null;
        }
      }

      if (req.body.linkedNotes !== undefined) {
        const rawItems = parseLinkedNotes(req.body.linkedNotes);
        task.linkedNotes = await validateLinkedNotes(
          rawItems,
          userId,
          project.workspace.toString()
        );
      }

      if (req.body.syncToGoogleCalendar !== undefined) {
        const wantsSync =
          req.body.syncToGoogleCalendar === 'true' ||
          req.body.syncToGoogleCalendar === true;
        const wasSync = task.syncToGoogleCalendar;
        task.syncToGoogleCalendar = wantsSync;
        if (wantsSync && !wasSync) {
          await task.save();
          await syncTaskToGoogle(task, 'create');
        } else if (!wantsSync && wasSync) {
          await task.save();
          await syncTaskToGoogle(task, 'delete');
        }
      }

      if (req.body.assigneeIds !== undefined || req.body.assigneeId !== undefined) {
        const newIds = extractAssigneeIds(req.body);
        if (newIds.length > 0) {
          try { await ensureProjectMembers(project, workspace, newIds); }
          catch (err) { return res.status(400).json({ success: false, message: err.message }); }
        }
        const oldIds = (task.assignees || []).map((a) => a.toString());
        const added = newIds.filter((id) => !oldIds.includes(id));
        task.assignees = newIds;

        const toNotify = added.filter((id) => id !== userId);
        if (toNotify.length > 0) {
          notifyUsers(toNotify, {
            title: `Task assigned to you: "${task.title}"`,
            body: `You have been assigned "${task.title}" in "${project.name}".`,
            data: {
              notificationType: 'task',
              taskId: task._id.toString(),
              projectId: project._id.toString(),
              workspaceId: project.workspace.toString(),
            },
            emailEventType: 'taskAssignment',
          });
        }
      }

      if (req.body.links !== undefined) task.links = parseArrayField(req.body.links);
      if (req.body.dependencies !== undefined) task.dependencies = parseArrayField(req.body.dependencies);
    }

    if (req.files?.attachments && isManager) {
      task.attachments.push(...normalizeAttachments(req.files.attachments));
    }

    if (recurrenceData) {
      task.recurrenceType = recurrenceData.recurrenceType;
      task.recurrenceDays = recurrenceData.recurrenceDays;
      task.recurrenceEndDate = recurrenceData.recurrenceEndDate;
    }

    await task.save();
    await updateTaskProgress(task._id, { preserveStatus: statusExplicitlySet });

    const freshTask = await Task.findById(task._id);
    await syncTaskToGoogle(freshTask, 'update');

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('folder', 'name');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({ success: true, message: 'Task updated', task: hydrated });
  } catch (error) {
    console.error('❌ Update task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// ASSIGN / REASSIGN  (managers only)
// ═════════════════════════════════════════════════════════════════════
export const assignTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const newIds = extractAssigneeIds(req.body);
    if (newIds.length > 0) {
      try { await ensureProjectMembers(project, workspace, newIds); }
      catch (err) { return res.status(400).json({ success: false, message: err.message }); }
    }

    const oldIds = (task.assignees || []).map((a) => a.toString());
    const added = newIds.filter((id) => !oldIds.includes(id));
    task.assignees = newIds;

    await task.save();
    await updateTaskProgress(task._id);

    const freshTask = await Task.findById(task._id);
    await syncTaskToGoogle(freshTask, 'update');

    const toNotify = added.filter((id) => id !== userId);
    if (toNotify.length > 0) {
      notifyUsers(toNotify, {
        title: `Task assigned to you: "${task.title}"`,
        body: `You have been assigned "${task.title}" in "${project.name}".`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'taskAssignment',
      });
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({ success: true, task: hydrated });
  } catch (error) {
    console.error('❌ Assign task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// SUBTASKS
// ═════════════════════════════════════════════════════════════════════

export const addSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const {
      title, description, startDate, dueDate,
      bufferTime = 0, links, attachments,
      assigneeId = null,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Sub-task title is required.' });
    }

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = isTaskAssignee(task, userId);
    const access = resolveTaskAccess(workspace, project, task, userId);

    if (access.role.startsWith('associate') && !isManager) {
      if (!(isAssignee && task.allowAssigneeEditSubtasks)) {
        return res.status(403).json({
          success: false,
          message: 'Associates can only add subtasks to tasks assigned to them.',
        });
      }
    }

    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({ success: false, message: 'You are not allowed to add sub-tasks.' });
    }

    if (assigneeId && !isValidSubTaskAssignee(task, assigneeId)) {
      return res.status(400).json({
        success: false,
        message: "Sub-task assignee must be one of the task's assignees.",
      });
    }

    let recurrenceData;
    try { recurrenceData = parseRecurrence(req.body); }
    catch (err) { return res.status(400).json({ success: false, message: err.message }); }

    task.subTasks.push({
      title: title.trim(),
      description: description || '',
      startDate: startDate || null,
      dueDate: dueDate || null,
      bufferTime: bufferTime || 0,
      links: parseArrayField(links),
      attachments: parseArrayField(attachments),
      status: 'pending',
      reminderSent: false,
      recurrenceType: recurrenceData.recurrenceType,
      recurrenceDays: recurrenceData.recurrenceDays,
      recurrenceEndDate: recurrenceData.recurrenceEndDate,
      assignee: assigneeId || null,
    });

    await task.save();
    await updateTaskProgress(task._id);

    const freshTask = await Task.findById(task._id);
    await syncTaskToGoogle(freshTask, 'update');

    if (assigneeId && assigneeId !== userId) {
      notifyUsers(assigneeId, {
        title: `New sub-task assigned: "${title}"`,
        body: `You were assigned a sub-task on "${task.title}".`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'taskAssignment',
      });
    } else if (isManager && (task.assignees || []).length > 0) {
      const targets = task.assignees
        .map((a) => a.toString())
        .filter((id) => id !== userId);
      if (targets.length > 0) {
        notifyUsers(targets, {
          title: `New sub-task added to "${task.title}"`,
          body: `A new sub-task "${title}" was added.`,
          data: {
            notificationType: 'task',
            taskId: task._id.toString(),
            projectId: project._id.toString(),
            workspaceId: project.workspace.toString(),
          },
          emailEventType: 'taskUpdate',
        });
      }
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(201).json({ success: true, message: 'Sub-task added', task: hydrated });
  } catch (error) {
    console.error('❌ Add sub-task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;
    const {
      title, description, startDate, dueDate,
      bufferTime, links, attachments,
      assigneeId,
    } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub-task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = isTaskAssignee(task, userId);

    const subTask = task.subTasks[index];
    const subAccess = resolveSubTaskAccess(workspace, project, task, subTask, userId);

    if (!subAccess.canAssignSubTask && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({ success: false, message: 'Not allowed.' });
    }

    if (subTask.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Cannot edit a confirmed sub-task.' });
    }

    let recurrenceData = null;
    if (req.body.recurrenceType !== undefined) {
      try { recurrenceData = parseRecurrence(req.body); }
      catch (err) { return res.status(400).json({ success: false, message: err.message }); }
    }

    if (title !== undefined) subTask.title = title.trim();
    if (description !== undefined) subTask.description = description;
    if (startDate !== undefined) subTask.startDate = startDate;
    if (dueDate !== undefined) subTask.dueDate = dueDate;
    if (bufferTime !== undefined) subTask.bufferTime = bufferTime;
    if (links !== undefined) subTask.links = parseArrayField(links);
    if (attachments !== undefined) subTask.attachments = parseArrayField(attachments);

    if (assigneeId !== undefined) {
      if (assigneeId === null || assigneeId === '') {
        subTask.assignee = null;
      } else {
        if (!isValidSubTaskAssignee(task, assigneeId)) {
          return res.status(400).json({
            success: false,
            message: "Sub-task assignee must be one of the task's assignees.",
          });
        }
        subTask.assignee = assigneeId;
      }
    }

    if (recurrenceData) {
      subTask.recurrenceType = recurrenceData.recurrenceType;
      subTask.recurrenceDays = recurrenceData.recurrenceDays;
      subTask.recurrenceEndDate = recurrenceData.recurrenceEndDate;
    }

    await task.save();
    await updateTaskProgress(task._id);

    const freshTask = await Task.findById(task._id);
    await syncTaskToGoogle(freshTask, 'update');

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({ success: true, message: 'Sub-task updated', task: hydrated });
  } catch (error) {
    console.error('❌ Update sub-task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;
    const { assigneeId } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub-task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const subTask = task.subTasks[index];
    const subAccess = resolveSubTaskAccess(workspace, project, task, subTask, userId);

    if (!subAccess.canAssignSubTask) {
      return res.status(403).json({
        success: false,
        message: 'You cannot assign subtasks on this task.',
      });
    }

    if (assigneeId === null || assigneeId === '' || assigneeId === undefined) {
      subTask.assignee = null;
      await task.save();
      await updateTaskProgress(task._id);

      const updated = await Task.findById(taskId)
        .populate('assignees', 'name email profile')
        .populate('subTasks.assignee', 'name email profile')
        .populate('createdBy', 'name email profile');
      const hydrated = await populateTaskLinkedNotes(updated);
      return res.status(200).json({ success: true, message: 'Sub-task unassigned', task: hydrated });
    }

    if (!isValidSubTaskAssignee(task, assigneeId)) {
      return res.status(400).json({
        success: false,
        message: "Sub-task assignee must be one of the task's assignees.",
      });
    }

    subTask.assignee = assigneeId;
    await task.save();
    await updateTaskProgress(task._id);

    if (assigneeId !== userId) {
      notifyUsers(assigneeId, {
        title: `Sub-task assigned: "${subTask.title}"`,
        body: `You were assigned the sub-task "${subTask.title}" on task "${task.title}".`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
          subTaskIndex: index,
        },
        emailEventType: 'taskAssignment',
      });
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({ success: true, message: 'Sub-task assigned', task: hydrated });
  } catch (error) {
    console.error('❌ Assign sub-task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bulkAssignSubTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { assignments } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ success: false, message: 'assignments array is required.' });
    }

    const task = await Task.findOne({ _id: taskId, isDeleted: false, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const firstSub = task.subTasks[0];
    if (!firstSub) {
      return res.status(400).json({ success: false, message: 'Task has no subtasks.' });
    }
    const subAccess = resolveSubTaskAccess(workspace, project, task, firstSub, userId);
    if (!subAccess.canAssignSubTask) {
      return res.status(403).json({ success: false, message: 'You cannot assign subtasks on this task.' });
    }

    const errors = [];
    const changes = [];

    for (const a of assignments) {
      const idx = parseInt(a.index);
      if (isNaN(idx) || idx < 0 || idx >= task.subTasks.length) {
        errors.push({ index: a.index, reason: 'Invalid index' });
        continue;
      }
      const assigneeId = a.assigneeId || null;
      if (assigneeId && !isValidSubTaskAssignee(task, assigneeId)) {
        errors.push({ index: idx, reason: "Assignee must be one of the task's assignees" });
        continue;
      }
      const prev = task.subTasks[idx].assignee?.toString() || null;
      task.subTasks[idx].assignee = assigneeId;
      if (prev !== (assigneeId ? String(assigneeId) : null)) {
        changes.push({ index: idx, assigneeId, prev });
      }
    }

    await task.save();
    await updateTaskProgress(task._id);

    const notified = new Set();
    for (const c of changes) {
      if (c.assigneeId && c.assigneeId !== userId && !notified.has(c.assigneeId)) {
        notified.add(c.assigneeId);
      }
    }
    if (notified.size > 0) {
      notifyUsers(Array.from(notified), {
        title: `Sub-tasks assigned to you on "${task.title}"`,
        body: 'Some subtasks were assigned to you. Check the task for details.',
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'taskAssignment',
      });
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({
      success: true,
      message: `${changes.length} sub-task(s) updated${errors.length ? `, ${errors.length} skipped` : ''}.`,
      task: hydrated,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error('❌ Bulk assign sub-tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markSubTaskDone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;
    const { notes, links } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub-task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const subTask = task.subTasks[index];
    const subAccess = resolveSubTaskAccess(workspace, project, task, subTask, userId);
    const isManager = canManageTasks(workspace, project, userId);

    if (!subAccess.canCompleteSubTask && !isManager) {
      if (subTask.assignee && subTask.assignee.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'This sub-task is assigned to someone else.',
        });
      }
      return res.status(403).json({
        success: false,
        message: 'Only assignees or project managers can mark this sub-task as done.',
      });
    }

    if (subTask.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Sub-task already confirmed.' });
    }
    if (subTask.status === 'done' && !isManager) {
      return res.status(400).json({
        success: false,
        message: 'Sub-task already marked done. Awaiting confirmation.',
      });
    }

    let uploadedAttachments = [];
    if (req.files?.attachments) {
      uploadedAttachments = normalizeAttachments(req.files.attachments);
    }

    const now = new Date();
    subTask.completedBy = userId;
    subTask.completedAt = now;
    if (notes) subTask.notes = notes;
    if (links) subTask.links = parseArrayField(links);
    if (uploadedAttachments.length > 0) subTask.attachments = uploadedAttachments;

    if (isManager) {
      subTask.status = 'confirmed';
      subTask.confirmedBy = userId;
      subTask.confirmedAt = now;
      spawnNextSubTaskOccurrence(task, subTask, index);
    } else {
      subTask.status = 'done';
    }

    await task.save();
    await updateTaskProgress(task._id);

    const freshTask = await Task.findById(task._id);
    await syncTaskToGoogle(freshTask, 'update');

    if (isManager) {
      const assignees = (task.assignees || [])
        .map((a) => a.toString())
        .filter((id) => id !== userId);
      if (assignees.length > 0) {
        notifyUsers(assignees, {
          title: `Sub-task completed: "${subTask.title}"`,
          body: `${req.user.name || 'A manager'} confirmed sub-task "${subTask.title}".`,
          data: {
            notificationType: 'task',
            taskId: task._id.toString(),
            projectId: project._id.toString(),
            workspaceId: project.workspace.toString(),
            subTaskIndex: index,
          },
          emailEventType: 'taskUpdate',
        });
      }
    } else {
      const recipients = new Set(getManagerRecipients(project, workspace));
      (task.assignees || []).forEach((a) => {
        const id = a._id ? a._id.toString() : a.toString();
        if (id !== userId) recipients.add(id);
      });
      recipients.delete(userId);

      if (recipients.size > 0) {
        notifyUsers(Array.from(recipients), {
          title: `Sub-task done: "${subTask.title}"`,
          body: `${req.user.name || 'An assignee'} marked sub-task "${subTask.title}" as done. Please confirm.`,
          data: {
            notificationType: 'task',
            taskId: task._id.toString(),
            projectId: project._id.toString(),
            workspaceId: project.workspace.toString(),
            subTaskIndex: index,
          },
          emailEventType: 'taskUpdate',
        });
      }
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({
      success: true,
      message: isManager
        ? 'Sub-task completed and confirmed.'
        : 'Sub-task marked done, awaiting confirmation.',
      task: hydrated,
    });
  } catch (error) {
    console.error('❌ Mark sub-task done error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const confirmSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;
    const { feedback } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub-task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const subTask = task.subTasks[index];
    if (subTask.status !== 'done') {
      return res.status(400).json({ success: false, message: 'Sub-task must be marked done first.' });
    }

    subTask.status = 'confirmed';
    subTask.confirmedBy = userId;
    subTask.confirmedAt = new Date();
    if (feedback) subTask.feedback = feedback;

    const spawned = spawnNextSubTaskOccurrence(task, subTask, index);

    await task.save();
    await updateTaskProgress(task._id);

    const freshTask = await Task.findById(task._id);
    await syncTaskToGoogle(freshTask, 'update');

    const notifySet = new Set();
    if (subTask.assignee) notifySet.add(subTask.assignee.toString());
    (task.assignees || []).forEach((a) =>
      notifySet.add(a._id ? a._id.toString() : a.toString())
    );
    notifySet.delete(userId);

    if (notifySet.size > 0) {
      notifyUsers(Array.from(notifySet), {
        title: `Sub-task confirmed: "${subTask.title}"`,
        body: `Sub-task "${subTask.title}" was confirmed by ${req.user.name}.`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
          subTaskIndex: index,
        },
        emailEventType: 'taskUpdate',
      });
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({
      success: true,
      message: spawned
        ? 'Sub-task confirmed; next occurrence created.'
        : 'Sub-task confirmed',
      task: hydrated,
    });
  } catch (error) {
    console.error('❌ Confirm sub-task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;
    const { reason = '' } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub-task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const subTask = task.subTasks[index];
    if (subTask.status !== 'done') {
      return res.status(400).json({ success: false, message: 'Sub-task must be marked done first.' });
    }

    subTask.status = 'pending';
    subTask.rejectedBy = userId;
    subTask.rejectedAt = new Date();
    subTask.rejectionReason = reason;

    await task.save();
    await updateTaskProgress(task._id);

    const freshTask = await Task.findById(task._id);
    await syncTaskToGoogle(freshTask, 'update');

    const notifySet = new Set();
    if (subTask.assignee) notifySet.add(subTask.assignee.toString());
    (task.assignees || []).forEach((a) =>
      notifySet.add(a._id ? a._id.toString() : a.toString())
    );
    notifySet.delete(userId);

    if (notifySet.size > 0) {
      notifyUsers(Array.from(notifySet), {
        title: `Sub-task rejected: "${subTask.title}"`,
        body: `Sub-task "${subTask.title}" was rejected by ${req.user.name}.${reason ? ` Reason: ${reason}` : ''}`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
          subTaskIndex: index,
        },
        emailEventType: 'taskUpdate',
      });
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({ success: true, message: 'Sub-task rejected', task: hydrated });
  } catch (error) {
    console.error('❌ Reject sub-task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub-task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = isTaskAssignee(task, userId);
    const access = resolveTaskAccess(workspace, project, task, userId);

    if (access.role.startsWith('associate') && !isManager) {
      if (!(isAssignee && task.allowAssigneeEditSubtasks)) {
        return res.status(403).json({
          success: false,
          message: 'Associates can only delete subtasks on tasks assigned to them.',
        });
      }
    }

    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({ success: false, message: 'Not allowed.' });
    }

    const subTask = task.subTasks[index];
    if (subTask.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Cannot delete a confirmed sub-task.' });
    }

    task.subTasks.splice(index, 1);
    await task.save();
    await updateTaskProgress(task._id);

    const freshTask = await Task.findById(task._id);
    await syncTaskToGoogle(freshTask, 'update');

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({ success: true, message: 'Sub-task deleted', task: hydrated });
  } catch (error) {
    console.error('❌ Delete sub-task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// TASK COMPLETION
// ═════════════════════════════════════════════════════════════════════

export const markTaskCompleted = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { notes, links, attachments } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const access = resolveTaskAccess(workspace, project, task, userId);
    const isManager = canManageTasks(workspace, project, userId);

    if (access.role.startsWith('associate') && !access.canComplete) {
      return res.status(403).json({
        success: false,
        message: 'Associates can only complete tasks assigned to them.',
      });
    }
    if (!isManager && !access.canComplete) {
      return res.status(403).json({
        success: false,
        message: 'Only assignees or PMs can mark this task as completed.',
      });
    }

    if (task.status === 'confirmed_completed') {
      return res.status(400).json({ success: false, message: 'Task is already confirmed as completed.' });
    }
    if (task.status === 'completed' && !isManager) {
      return res.status(400).json({
        success: false,
        message: 'Task is already marked done. Awaiting confirmation.',
      });
    }

    const parsedLinks = parseArrayField(links);
    let uploadedFiles = [];
    if (req.files?.completionAttachments) {
      uploadedFiles = normalizeAttachments(req.files.completionAttachments);
    }
    const attachmentUrls = parseArrayField(attachments);
    const allAttachments = [...uploadedFiles];
    attachmentUrls.forEach((item) => {
      if (typeof item === 'string') allAttachments.push({ url: item, name: 'Attachment' });
      else if (item && typeof item === 'object' && item.url) allAttachments.push(item);
    });

    task.completionNotes = notes || '';
    if (parsedLinks.length) task.finalLinks = parsedLinks;
    if (allAttachments.length) task.finalAttachments = allAttachments;

    const now = new Date();
    task.completedBy = userId;
    task.completedAt = now;

    if (isManager) {
      task.status = 'confirmed_completed';
      task.confirmedBy = userId;
      task.confirmedAt = now;
      task.progress = 100;
    } else {
      task.status = 'completed';
    }

    await task.save();

    let spawned = null;
    if (isManager) {
      spawned = await spawnNextTaskOccurrence(task);
      if (spawned) await task.save();
    }

    await updateProjectProgress(task.project);
    await syncTaskToGoogle(task, 'update');

    const assigneeIds = (task.assignees || []).map((a) => a.toString());

    if (isManager) {
      const targets = assigneeIds.filter((id) => id !== userId);
      if (targets.length > 0) {
        notifyUsers(targets, {
          title: `Task completed: "${task.title}"`,
          body: `${req.user.name || 'A manager'} confirmed "${task.title}".`,
          data: {
            notificationType: 'task',
            taskId: task._id.toString(),
            projectId: project._id.toString(),
            workspaceId: project.workspace.toString(),
          },
          emailEventType: 'taskUpdate',
        });
      }
    } else {
      const recipients = getManagerRecipients(project, workspace).filter((id) => id !== userId);
      if (recipients.length > 0) {
        notifyUsers(recipients, {
          title: `Task marked done: "${task.title}"`,
          body: `${req.user.name || 'An assignee'} marked "${task.title}" as done. Please confirm or reject.`,
          data: {
            notificationType: 'task',
            taskId: task._id.toString(),
            projectId: project._id.toString(),
            workspaceId: project.workspace.toString(),
          },
          emailEventType: 'taskUpdate',
        });
      }
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('completedBy', 'name email profile')
      .populate('confirmedBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({
      success: true,
      message: isManager
        ? spawned
          ? 'Task completed, confirmed, and next occurrence created.'
          : 'Task completed and confirmed.'
        : 'Task marked done, awaiting confirmation.',
      task: hydrated,
    });
  } catch (error) {
    console.error('❌ Mark task completed error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const confirmTaskCompletion = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { feedback, finalHours, finalLinks, finalAttachments } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    if (task.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Task must be marked done first.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to confirm.' });
    }

    task.status = 'confirmed_completed';
    task.confirmedBy = userId;
    task.confirmedAt = new Date();
    task.progress = 100;
    if (feedback) task.completionFeedback = feedback;
    if (finalHours !== undefined) task.actualHours = finalHours;
    if (finalLinks) task.finalLinks = parseArrayField(finalLinks);
    if (finalAttachments) task.finalAttachments = parseArrayField(finalAttachments);

    await task.save();
    const spawned = await spawnNextTaskOccurrence(task);
    if (spawned) await task.save();

    await updateProjectProgress(task.project);
    await syncTaskToGoogle(task, 'update');

    const assigneeIds = (task.assignees || []).map((a) => a.toString());
    const targets = assigneeIds.filter((id) => id !== userId);
    if (targets.length > 0) {
      notifyUsers(targets, {
        title: `Task completion confirmed: "${task.title}"`,
        body: `Confirmed by ${req.user.name}.`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'taskUpdate',
      });
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('confirmedBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({
      success: true,
      message: spawned ? 'Task confirmed; next occurrence created.' : 'Task completion confirmed',
      task: hydrated,
    });
  } catch (error) {
    console.error('❌ Confirm task completion error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { reason = '' } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    if (task.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Task must be marked done first.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject.' });
    }

    task.status = 'ready_for_completion';
    task.rejectedBy = userId;
    task.rejectedAt = new Date();
    task.rejectionReason = reason;
    task.completedBy = null;
    task.completedAt = null;

    await task.save();
    await syncTaskToGoogle(task, 'update');

    const assigneeIds = (task.assignees || []).map((a) => a.toString());
    const targets = assigneeIds.filter((id) => id !== userId);
    if (targets.length > 0) {
      notifyUsers(targets, {
        title: `Task rejected: "${task.title}"`,
        body: `Reason: ${reason || '(none provided)'}`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'taskUpdate',
      });
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({ success: true, message: 'Task rejected', task: hydrated });
  } catch (error) {
    console.error('❌ Reject task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// GET / LIST
// ═════════════════════════════════════════════════════════════════════

// ⬇ UPDATED — now supports public viewing when the project is
// public-shared and the caller has no relationship.
export const getProjectTasks = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { projectId } = req.params;
    const { status, priority, assigneeId, taskType, folderId, archived } = req.query;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);

    const isOwner  = userId ? isWorkspaceOwner(workspace, userId) : false;
    const isAdmin  = userId ? isWorkspaceAdmin(workspace, userId) : false;
    const isPM     = userId ? isProjectManager(project, userId)   : false;
    const isMember = userId ? isProjectMember(project, userId)    : false;
    const assoc    = userId ? getActiveAssociate(project, userId) : null;
    const isAssoc  = !!assoc;
    const isAssocPM = isAssoc && isPM;

    // Public fallback — project is shareable and caller is an outsider.
    const isPublic =
      !!project.publicShareEnabled &&
      !project.isTrash &&
      !isOwner && !isAdmin && !isPM && !isMember && !isAssoc;

    if (!isOwner && !isAdmin && !isPM && !isMember && !isAssoc && !isPublic) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const query = { project: projectId, isDeleted: false };
    if (archived === 'true') {
      query.isArchived = true;
    } else {
      query.isArchived = { $ne: true };
      query.isTrash = { $ne: true };
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (taskType) query.taskType = taskType;
    if (folderId) query.folder = folderId;

    // Visibility:
    //   owner/admin/PM/member → all tasks
    //   associate (non-PM)    → only their own tasks/folders
    //   public                → all tasks (read-only enforced by client)
    if (isOwner || isAdmin || isPM || isMember) {
      if (assigneeId) query.assignees = assigneeId;
    } else if (isAssoc && !isAssocPM) {
      const visibleFolderIds = await getVisibleFolderIdsForUser(projectId, userId);
      query.$or = [
        { assignees: userId },
        { folder: { $in: visibleFolderIds } },
      ];
    }
    // public: no extra filter

    const tasks = await Task.find(query)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('folder', 'name')
      .sort({ order: 1, createdAt: -1 });

    const hydratedTasks = await Promise.all(tasks.map((t) => populateTaskLinkedNotes(t)));

    // Attach per-task access info. Public viewers get everything flagged
    // read-only so the UI can hide action buttons.
    const decorated = hydratedTasks.map((t) => {
      const access = isPublic
        ? {
            role: 'publicViewer',
            canManage: false,
            canComplete: false,
            canComment: false,
          }
        : {
            role: 'member',
            canManage: isOwner || isAdmin || isPM,
            canComplete:
              !!userId &&
              (isOwner || isAdmin || isPM ||
                (t.assignees || []).some((a) => (a._id || a).toString() === userId)),
            canComment: true,
          };
      return { ...t, access };
    });

    res.status(200).json({
      success: true,
      tasks: decorated,
      count: decorated.length,
      viewer: {
        role: isPublic ? 'publicViewer' : 'member',
        canView: true,
        canManage: !isPublic && (isOwner || isAdmin || isPM),
        canAct: !isPublic && (isOwner || isAdmin || isPM || isMember || isAssoc),
      },
    });
  } catch (error) {
    console.error('❌ Get project tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, priority, workspaceId, projectId } = req.query;

    const query = { assignees: userId, isDeleted: false, isTrash: { $ne: true } };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (workspaceId) query.workspace = workspaceId;
    if (projectId) query.project = projectId;

    const tasks = await Task.find(query)
      .populate('project', 'name status dailyReportTime')
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile')
      .sort({ dueDate: 1, createdAt: -1 });

    const hydratedTasks = await Promise.all(tasks.map((t) => populateTaskLinkedNotes(t)));
    res.status(200).json({ success: true, tasks: hydratedTasks, count: hydratedTasks.length });
  } catch (error) {
    console.error('❌ Get my tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ⬇ UPDATED — now supports public viewing on public-shared projects.
export const getTaskById = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false })
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('completedBy', 'name email profile')
      .populate('confirmedBy', 'name email profile')
      .populate('rejectedBy', 'name email profile')
      .populate('comments.user', 'name email profile')
      .populate('folder', 'name');

    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isPublic =
      !!project.publicShareEnabled &&
      !project.isTrash &&
      (!userId || !canViewTask(workspace, project, userId, task));

    const canView = userId ? canViewTask(workspace, project, userId, task) : false;

    if (!canView && !isPublic) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const access = userId
      ? resolveTaskAccess(workspace, project, task, userId)
      : { role: 'none', canManage: false, canComplete: false, canComment: false };

    // Associates can only view tasks assigned to them.
    if (access.role.startsWith('associate') && !access.canManage) {
      const assignedToMe = isTaskAssignee(task, userId);
      if (!assignedToMe) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const hydrated = await populateTaskLinkedNotes(task);

    hydrated.access = isPublic
      ? {
          role: 'publicViewer',
          canManage: false,
          canComplete: false,
          canComment: false,
        }
      : {
          role: access.role,
          canManage: access.canManage,
          canComplete: access.canComplete,
          canComment: access.canComment,
        };

    res.status(200).json({
      success: true,
      task: hydrated,
      viewer: {
        role: isPublic ? 'publicViewer' : 'member',
        canView: true,
        canManage: !isPublic && access.canManage,
        canAct: !isPublic && (access.canManage || access.canComplete),
      },
    });
  } catch (error) {
    console.error('❌ Get task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// DELETE / ARCHIVE / RESTORE / PERMANENT DELETE  (unchanged)
// ═════════════════════════════════════════════════════════════════════
export const deleteTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    task.isTrash = true;
    task.trashedAt = new Date();
    task.isArchived = false;
    await task.save();

    await syncTaskToGoogle(task, 'delete');
    res.status(200).json({ success: true, message: 'Task moved to trash (auto-delete in 30 days).' });
  } catch (error) {
    console.error('❌ Delete task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const archiveTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    task.isArchived = true;
    task.archivedAt = new Date();
    task.isTrash = false;
    await task.save();

    res.status(200).json({ success: true, message: 'Task archived' });
  } catch (error) {
    console.error('❌ Archive task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const restoreTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const wasTrashed = task.isTrash;
    task.isArchived = false;
    task.isTrash = false;
    task.trashedAt = null;
    await task.save();

    if (wasTrashed && task.syncToGoogleCalendar && !task.googleEventId) {
      await syncTaskToGoogle(task, 'create');
    }

    res.status(200).json({ success: true, message: 'Task restored' });
  } catch (error) {
    console.error('❌ Restore task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const permanentlyDeleteTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    if (task.syncToGoogleCalendar && task.googleEventId) {
      await syncTaskToGoogle(task, 'delete');
    }

    await Feedback.deleteMany({ task: taskId });
    for (const att of task.attachments || []) {
      if (att.publicId) cloudinary.uploader.destroy(att.publicId).catch(() => {});
    }
    await Task.findByIdAndDelete(taskId);
    await updateProjectProgress(project._id);

    res.status(200).json({ success: true, message: 'Task permanently deleted.' });
  } catch (error) {
    console.error('❌ Permanent delete error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// COMMENTS / FEEDBACK  (unchanged)
// ═════════════════════════════════════════════════════════════════════
export const addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { comment } = req.body;
    const mentions = parseArrayField(req.body.mentions);
    const attachments = parseArrayField(req.body.attachments);

    if (!comment?.trim()) {
      return res.status(400).json({ success: false, message: 'Comment is required.' });
    }

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const access = resolveTaskAccess(workspace, project, task, userId);
    if (!access.canView) return res.status(403).json({ success: false, message: 'Access denied.' });
    if (access.role.startsWith('associate') && !access.canComment) {
      return res.status(403).json({
        success: false,
        message: 'Associates can only comment on tasks assigned to them.',
      });
    }

    task.comments.push({ user: userId, comment: comment.trim(), mentions, attachments });
    await task.save();

    const assigneeIds = (task.assignees || []).map((a) => a.toString());
    const validMentions = mentions.filter(
      (mentionId) =>
        (project.teamMembers || []).some(
          (tm) => tm.user.toString() === mentionId && tm.status === 'active'
        ) ||
        (project.projectManagers || []).some((pm) => pm.toString() === mentionId) ||
        (project.associates || []).some(
          (a) =>
            a.userId &&
            a.userId.toString() === mentionId &&
            a.status === 'active'
        ) ||
        assigneeIds.includes(mentionId)
    );

    if (validMentions.length > 0) {
      notifyUsers(validMentions, {
        title: `You were mentioned on "${task.title}"`,
        body: `${req.user.name || 'Someone'}: ${comment.substring(0, 100)}`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'taskUpdate',
      });
    }

    const updated = await Task.findById(taskId).populate('comments.user', 'name email profile');
    res.status(201).json({ success: true, message: 'Comment added', comments: updated.comments });
  } catch (error) {
    console.error('❌ Add comment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTaskFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { type } = req.query;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canViewTask(workspace, project, userId, task)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const query = { task: taskId };
    if (type && ['progress_update', 'daily_report', 'review'].includes(type)) query.type = type;

    const feedback = await Feedback.find(query)
      .populate('user', 'name email profile')
      .populate('reviewedBy', 'name email profile')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, feedback, count: feedback.length });
  } catch (error) {
    console.error('❌ Get task feedback error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// REMINDERS  (unchanged)
// ═════════════════════════════════════════════════════════════════════
export const sendTaskReminders = async (req, res) => {
  try {
    const count = await checkAndSendReminders();
    res.status(200).json({ success: true, message: `Reminders sent for ${count} tasks/sub-tasks.`, count });
  } catch (error) {
    console.error('❌ Send reminders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendManualReminder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { message } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false })
      .populate('assignees', 'name email');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    if (!task.assignees || task.assignees.length === 0) {
      return res.status(400).json({ success: false, message: 'Task has no assignees.' });
    }

    const customMessage = message || 'Please check your task and complete it.';
    const recipients = task.assignees
      .map((a) => a._id.toString())
      .filter((id) => id !== userId);

    if (recipients.length > 0) {
      await notifyUsers(recipients, {
        title: `📢 Manual Reminder: "${task.title}"`,
        body: `${req.user.name} reminded you: ${customMessage}`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'taskUpdate',
      });
    }

    res.status(200).json({ success: true, message: `Reminder sent to ${recipients.length} assignee(s).` });
  } catch (error) {
    console.error('❌ Manual reminder error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// FOLDERS  (unchanged)
// ═════════════════════════════════════════════════════════════════════
export const createFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, name } = req.body;

    if (!projectId || !name?.trim()) {
      return res.status(400).json({ success: false, message: 'projectId and name are required.' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const folder = await Folder.create({
      name: name.trim(),
      project: projectId,
      workspace: project.workspace,
      createdBy: userId,
    });

    res.status(201).json({ success: true, folder });
  } catch (error) {
    console.error('❌ Create folder error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderId } = req.params;
    const { name } = req.body;

    const folder = await Folder.findById(folderId);
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found.' });

    const project = await Project.findById(folder.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    folder.name = name?.trim() || folder.name;
    await folder.save();

    res.status(200).json({ success: true, folder });
  } catch (error) {
    console.error('❌ Update folder error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderId } = req.params;

    const folder = await Folder.findById(folderId);
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found.' });

    const project = await Project.findById(folder.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    await Task.updateMany({ folder: folderId }, { $set: { folder: null } });
    await Folder.findByIdAndDelete(folderId);

    res.status(200).json({ success: true, message: 'Folder deleted, tasks unlinked.' });
  } catch (error) {
    console.error('❌ Delete folder error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProjectFolders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    const isOwner = isWorkspaceOwner(workspace, userId);
    const isAdmin = isWorkspaceAdmin(workspace, userId);
    const isPM = isProjectManager(project, userId);
    const assoc = getActiveAssociate(project, userId);

    let folders;
    if (isOwner || isAdmin || isPM || assoc) {
      folders = await Folder.find({ project: projectId }).sort({ order: 1 });
    } else {
      const visibleFolderIds = await getVisibleFolderIdsForUser(projectId, userId);
      folders = await Folder.find({ project: projectId, _id: { $in: visibleFolderIds } }).sort({ order: 1 });
    }

    res.status(200).json({ success: true, folders });
  } catch (error) {
    console.error('❌ Get folders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addFolderReadOnly = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderId } = req.params;
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide an array of user IDs.' });
    }

    const folder = await Folder.findById(folderId);
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found.' });

    const project = await Project.findById(folder.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const activeIds = (workspace.members || [])
      .filter((m) => m.status === 'active')
      .map((m) => getUserId(m.user));

    const validUsers = users.filter((id) => activeIds.includes(id));
    if (validUsers.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid active members provided.' });
    }

    if (!folder.readOnlyUsers) folder.readOnlyUsers = [];
    const current = folder.readOnlyUsers.map((id) => id.toString());
    const toAdd = validUsers.filter((id) => !current.includes(id));
    folder.readOnlyUsers.push(...toAdd);
    await folder.save();

    res.status(200).json({
      success: true,
      message: `${toAdd.length} user(s) added to read-only access.`,
      folder,
    });
  } catch (error) {
    console.error('❌ Add folder read-only error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeFolderReadOnly = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderId } = req.params;
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide an array of user IDs.' });
    }

    const folder = await Folder.findById(folderId);
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found.' });

    const project = await Project.findById(folder.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const toRemove = users.map((id) => id.toString());
    const current = (folder.readOnlyUsers || []).map((id) => id.toString());
    folder.readOnlyUsers = current.filter((id) => !toRemove.includes(id));
    await folder.save();

    res.status(200).json({
      success: true,
      message: `${toRemove.length} user(s) removed from read-only access.`,
      folder,
    });
  } catch (error) {
    console.error('❌ Remove folder read-only error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// COPY / MOVE / REORDER  (unchanged)
// ═════════════════════════════════════════════════════════════════════
export const copyTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { targetFolderId } = req.body;

    const original = await Task.findOne({ _id: taskId, isDeleted: false, isTrash: { $ne: true } });
    if (!original) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(original.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    if (targetFolderId) {
      const folder = await Folder.findById(targetFolderId);
      if (!folder || folder.project.toString() !== original.project.toString()) {
        return res.status(400).json({ success: false, message: 'Invalid target folder.' });
      }
    }

    const taskData = original.toObject();
    delete taskData._id;
    delete taskData.createdAt;
    delete taskData.updatedAt;
    taskData.folder = targetFolderId || original.folder;
    taskData.title = `${taskData.title} (copy)`;
    taskData.status = (taskData.assignees?.length || 0) > 0 ? 'ready_for_completion' : 'pending';
    taskData.progress = 0;
    taskData.googleEventId = null;
    taskData.subTasks = taskData.subTasks.map((st) => ({ ...st, status: 'pending' }));

    const newTask = await Task.create(taskData);
    if (newTask.syncToGoogleCalendar) await syncTaskToGoogle(newTask, 'create');

    const populated = await Task.findById(newTask._id)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('folder', 'name');

    const hydrated = await populateTaskLinkedNotes(populated);
    res.status(201).json({ success: true, message: 'Task copied', task: hydrated });
  } catch (error) {
    console.error('❌ Copy task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const moveTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { targetFolderId } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    if (targetFolderId) {
      const folder = await Folder.findById(targetFolderId);
      if (!folder || folder.project.toString() !== task.project.toString()) {
        return res.status(400).json({ success: false, message: 'Invalid target folder.' });
      }
      task.folder = targetFolderId;
    } else {
      task.folder = null;
    }

    await task.save();
    const updated = await Task.findById(taskId)
      .populate('subTasks.assignee', 'name email profile')
      .populate('folder', 'name');
    const hydrated = await populateTaskLinkedNotes(updated);
    res.status(200).json({ success: true, message: 'Task moved', task: hydrated });
  } catch (error) {
    console.error('❌ Move task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const reorderTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { orderedTaskIds } = req.body;
    const userId = req.user.id;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updates = orderedTaskIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, project: projectId },
        update: { $set: { order: index } },
      },
    }));
    await Task.bulkWrite(updates);

    res.status(200).json({ success: true, message: 'Tasks reordered' });
  } catch (error) {
    console.error('Reorder tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const reorderSubTasks = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { orderedSubTaskIndices } = req.body;
    const userId = req.user.id;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = isTaskAssignee(task, userId);
    const access = resolveTaskAccess(workspace, project, task, userId);

    if (access.role.startsWith('associate') && !isManager) {
      if (!(isAssignee && task.allowAssigneeEditSubtasks)) {
        return res.status(403).json({
          success: false,
          message: 'Associates cannot reorder sub-tasks.',
        });
      }
    }

    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    task.subTasks = orderedSubTaskIndices.map((i) => task.subTasks[i]);
    task.subTasks.forEach((st, idx) => (st.order = idx));

    await task.save();
    res.status(200).json({ success: true, message: 'Sub-tasks reordered' });
  } catch (error) {
    console.error('Reorder sub-tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// URGENT TASKS
// ═════════════════════════════════════════════════════════════════════
export const getAllUrgentTasks = async (req, res) => {
  try {
    const userId = req.user.id;

    const userProjects = await Project.find({
      $or: [
        { projectManagers: userId },
        { 'teamMembers.user': userId, 'teamMembers.status': 'active' },
        { associates: { $elemMatch: { userId, status: 'active' } } },
      ],
    }).select('_id');

    const projectIds = userProjects.map((p) => p._id);

    const projectTasks = await Task.find({
      project: { $in: projectIds },
      isDeleted: false,
      isTrash: { $ne: true },
      isArchived: { $ne: true },
      status: { $nin: ['confirmed_completed', 'completed', 'cancelled'] },
      $or: [
        { assignees: userId },
        { createdBy: userId },
        { project: { $in: projectIds } },
      ],
    })
      .populate('project', 'name workspace')
      .populate('assignees', 'name email')
      .populate('folder', 'name')
      .lean();

    const now = new Date();
    const priorityWeight = { urgent: 100, high: 75, medium: 50, low: 25 };

    const scoreTask = (task) => {
      let score = priorityWeight[task.priority] || 0;
      if (task.dueDate) {
        const diffHours = (new Date(task.dueDate) - now) / (1000 * 60 * 60);
        if (diffHours <= 0) score += 200;
        else if (diffHours < 24) score += 100;
        else if (diffHours < 72) score += 50;
      }
      if (task.status === 'ready_for_completion') score += 30;
      return score;
    };

    const enrichedTasks = projectTasks
      .map((t) => ({ ...t, source: 'project', urgency: scoreTask(t) }))
      .sort((a, b) => b.urgency - a.urgency);

    res.status(200).json({ success: true, tasks: enrichedTasks, count: enrichedTasks.length });
  } catch (error) {
    console.error('❌ All urgent tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// CRON HELPERS  (unchanged)
// ═════════════════════════════════════════════════════════════════════
export const checkAndSendReminders = async () => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  let reminderCount = 0;

  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  const tasksDueSoon = await Task.find({
    isDeleted: false,
    isTrash: { $ne: true },
    dueDate: { $gte: now, $lte: oneHourLater },
    reminderSent: { $ne: true },
    status: { $nin: ['confirmed_completed', 'completed', 'cancelled'] },
  }).populate('assignees', 'name email');

  for (const task of tasksDueSoon) {
    const recipients = (task.assignees || []).map((a) => a._id);
    if (recipients.length > 0) {
      await notifyUsers(recipients, {
        title: `⏰ Reminder: "${task.title}" due soon`,
        body: `Due within 1 hour.`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: task.project.toString(),
          workspaceId: task.workspace?.toString(),
        },
        emailEventType: 'taskUpdate',
      });
      task.reminderSent = true;
      await task.save();
      reminderCount++;
    }
  }

  const tasksWithDaily = await Task.find({
    isDeleted: false,
    isTrash: { $ne: true },
    dailyReminderTime: currentTime,
    status: { $nin: ['confirmed_completed', 'completed', 'cancelled'] },
    $or: [
      { lastDailyReminderSent: { $lt: new Date(now.toDateString()) } },
      { lastDailyReminderSent: null },
    ],
  }).populate('assignees', 'name email');

  for (const task of tasksWithDaily) {
    const recipients = (task.assignees || []).map((a) => a._id);
    if (recipients.length > 0) {
      await notifyUsers(recipients, {
        title: `📅 Daily reminder: "${task.title}"`,
        body: `Your daily reminder.`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: task.project.toString(),
          workspaceId: task.workspace?.toString(),
        },
        emailEventType: 'taskUpdate',
      });
      task.lastDailyReminderSent = now;
      await task.save();
      reminderCount++;
    }
  }

  return reminderCount;
};

export const permanentlyDeleteTrashedTasks = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const trashedTasks = await Task.find({ isTrash: true, trashedAt: { $lte: thirtyDaysAgo } });

  for (const task of trashedTasks) {
    if (task.syncToGoogleCalendar && task.googleEventId) {
      await syncTaskToGoogle(task, 'delete');
    }
    await Feedback.deleteMany({ task: task._id });
    for (const att of task.attachments || []) {
      if (att.publicId) cloudinary.uploader.destroy(att.publicId).catch(() => {});
    }
    await Task.findByIdAndDelete(task._id);
  }
};

// ─── Re-exports for other controllers ────────────────────────────
export {
  resolveTaskAccess,
  resolveSubTaskAccess,
  getActiveAssociate,
};