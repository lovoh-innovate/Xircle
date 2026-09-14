// controllers/taskController.js
import Task from '../models/taskModel.js';
import Project from '../models/projectModel.js';
import Workspace from '../models/workspaceModel.js';
import Folder from '../models/folderModel.js';
import Feedback from '../models/feedbackModel.js';
import { v2 as cloudinary } from 'cloudinary';
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

const isWorkspaceOwner = (workspace, userId) =>
  workspace.owner?._id
    ? workspace.owner._id.toString() === userId
    : workspace.owner?.toString() === userId;

const isProjectManager = (project, userId) =>
  project.projectManagers.some((pm) => {
    const id = pm._id ? pm._id.toString() : pm?.toString();
    return id === userId;
  });

const isProjectMember = (project, userId) =>
  project.teamMembers.some((tm) => {
    const user = tm.user;
    const memberId = user?._id ? user._id.toString() : user?.toString();
    return memberId === userId && tm.status === 'active';
  });

const isTaskAssignee = (task, userId) =>
  (task.assignees || []).some((a) => {
    const id = a?._id ? a._id.toString() : a?.toString();
    return id === userId;
  });

// Manager-level rights over this task: workspace owner, project creator, or PM
const canManageTasks = (workspace, project, userId) =>
  isWorkspaceOwner(workspace, userId) ||
  (project.createdBy && project.createdBy.toString() === userId) ||
  isProjectManager(project, userId);

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
  if (canManageTasks(workspace, project, userId)) return true;
  if (isTaskAssignee(task, userId)) return true;
  if (task.createdBy?.toString() === userId) return true;
  if (isProjectMember(project, userId)) return true;
  return false;
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

/**
 * Ensure every provided user is an active workspace member and (if needed)
 * auto-add them to the project's team members.
 */
const ensureProjectMembers = async (project, workspace, assigneeIds) => {
  let modified = false;
  for (const assigneeId of assigneeIds) {
    const alreadyActive = project.teamMembers.some(
      (tm) => tm.user.toString() === assigneeId && tm.status === 'active'
    );
    if (alreadyActive) continue;

    const isWorkspaceMember = workspace.members.some(
      (m) => m.user.toString() === assigneeId && m.status === 'active'
    );
    if (!isWorkspaceMember) {
      throw new Error('Assignee must be an active member of the workspace.');
    }

    const existing = project.teamMembers.find(
      (tm) => tm.user.toString() === assigneeId
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

/**
 * Extract the assignee list from the request body. Accepts:
 *   - assigneeIds: array | JSON string | single id
 *   - assigneeId : single id (backward compat)
 * Returns a deduped array of string IDs.
 */
const extractAssigneeIds = (body) => {
  const raw = [
    ...parseArrayField(body.assigneeIds),
    ...(body.assigneeId ? [body.assigneeId] : []),
  ];
  return [...new Set(raw.map(String).filter(Boolean))];
};

// ─── Recurrence helpers ──────────────────────────────────────────

const calculateNextDueDate = (item, fromDate = null) => {
  if (!item.recurrenceType || item.recurrenceType === 'none') return null;

  const base = fromDate ? new Date(fromDate) : (item.dueDate ? new Date(item.dueDate) : new Date());
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
  if (!['none', 'daily', 'weekly'].includes(type)) {
    throw new Error('Invalid recurrence type');
  }
  let days = recurrenceDays || [];
  if (type === 'weekly') {
    if (!Array.isArray(days) || days.length === 0) {
      throw new Error('Weekly recurrence requires at least one day');
    }
    days = days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length === 0) throw new Error('Weekly recurrence days must be valid (0-6)');
  }
  return {
    recurrenceType: type,
    recurrenceDays: type === 'weekly' ? days : [],
    recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
  };
};

/**
 * If the task recurs, clone it into a fresh `pending` occurrence.
 * Mutates `task.recurrenceType` to 'none' when the chain ends.
 * Returns the new task or null.
 */
const spawnNextTaskOccurrence = async (task) => {
  if (!task.recurrenceType || task.recurrenceType === 'none') return null;
  const nextDue = calculateNextDueDate(task, task.dueDate);
  if (!nextDue) {
    task.recurrenceType = 'none';
    return null;
  }

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

  return Task.create(data);
};

/**
 * If a subtask recurs, insert a fresh pending occurrence right after it.
 */
const spawnNextSubTaskOccurrence = (task, subTask, index) => {
  if (!subTask.recurrenceType || subTask.recurrenceType === 'none') return false;
  const nextDue = calculateNextDueDate(subTask, subTask.dueDate);
  if (!nextDue) {
    subTask.recurrenceType = 'none';
    return false;
  }
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
  });
  return true;
};

// ─── Notifications ────────────────────────────────────────────────

const notifyUsers = async (
  userIds,
  { title, body, data = {}, emailEventType = null, emailHtml = null }
) => {
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
    }).catch((err) => console.error(`Notification to ${recipient} failed:`, err.message));
  }
};

const getManagerRecipients = (project, workspace) => {
  const ids = new Set(project.projectManagers.map((pm) => pm.toString()));
  const ownerId = workspace.owner?._id
    ? workspace.owner._id.toString()
    : workspace.owner?.toString();
  if (ownerId) ids.add(ownerId);
  if (project.createdBy) ids.add(project.createdBy.toString());
  return Array.from(ids);
};

// ─── Progress recomputation ──────────────────────────────────────

const updateTaskProgress = async (taskId, { preserveStatus = false } = {}) => {
  const task = await Task.findById(taskId);
  if (!task) return;

  const total = task.subTasks.length;
  const terminal = ['completed', 'confirmed_completed'];
  const isTerminal = terminal.includes(task.status);

  if (total === 0) {
    if (isTerminal) {
      task.progress = 100;
    } else if (!preserveStatus) {
      // No subtasks → assignment alone makes it ready. This is the whole
      // point: assign once, work it, click done.
      task.progress = 0;
      task.status = (task.assignees?.length || 0) > 0 ? 'ready_for_completion' : 'pending';
    }
  } else {
    const confirmed = task.subTasks.filter((st) => st.status === 'confirmed').length;
    task.progress = Math.round((confirmed / total) * 100);

    if (!preserveStatus && !isTerminal) {
      if (confirmed === total) {
        task.status = 'ready_for_completion';
      } else if (confirmed > 0) {
        task.status = 'in-progress';
      } else {
        task.status = 'pending';
      }
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

// ─────────────────────────────────────────────────────────────────────
// CREATE TASK
// ─────────────────────────────────────────────────────────────────────

export const createTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      projectId,
      folderId = null,
      title,
      description = '',
      detailedDescription = '',
      taskType = 'general',
      priority = 'medium',
      startDate = null,
      dueDate = null,
      estimatedHours = null,
      bufferTime = 0,
      dependencies,
      allowAssigneeEditSubtasks = false,
      dailyReminderTime = null,
    } = req.body;

    const links = parseArrayField(req.body.links);
    const deps = parseArrayField(dependencies);
    const assigneeIds = extractAssigneeIds(req.body);

    if (!projectId || !title?.trim()) {
      return res.status(400).json({ success: false, message: 'projectId and title are required.' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner, project creator, or project managers can create tasks.',
      });
    }

    if (folderId) {
      const folder = await Folder.findById(folderId);
      if (!folder || folder.project.toString() !== projectId) {
        return res.status(400).json({ success: false, message: 'Invalid folder.' });
      }
    }

    if (assigneeIds.length > 0) {
      try {
        await ensureProjectMembers(project, workspace, assigneeIds);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    let attachments = normalizeAttachments(req.files?.attachments);

    let recurrenceData;
    try {
      recurrenceData = parseRecurrence(req.body);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const lastOrderedTask = await Task.findOne({ project: projectId })
      .sort({ order: -1 })
      .select('order');
    const nextOrder = (lastOrderedTask?.order ?? -1) + 1;

    // ─── Auto-ready: assigned tasks skip the ceremony ─────────
    const hasAssignees = assigneeIds.length > 0;
    const initialStatus = hasAssignees ? 'ready_for_completion' : 'pending';

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
    });

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
        emailHtml: `<h3>New Task</h3><p>Task: <strong>${task.title}</strong></p><p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>`,
      });
    }

    const populated = await Task.findById(task._id)
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('folder', 'name');

    res.status(201).json({ success: true, message: 'Task created', task: populated });
  } catch (error) {
    console.error('❌ Create task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// UPDATE TASK
// ─────────────────────────────────────────────────────────────────────

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

    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to edit this task.',
      });
    }

    const {
      title,
      description,
      detailedDescription,
      taskType,
      priority,
      status,
      startDate,
      dueDate,
      estimatedHours,
      bufferTime,
      allowAssigneeEditSubtasks,
      folderId,
      dailyReminderTime,
    } = req.body;

    let recurrenceData = null;
    if (req.body.recurrenceType !== undefined) {
      try {
        recurrenceData = parseRecurrence(req.body);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const validStatuses = ['pending', 'in-progress', 'ready_for_completion', 'completed', 'confirmed_completed', 'cancelled'];
    let statusExplicitlySet = false;

    if (isManager) {
      if (title !== undefined) task.title = title.trim();
      if (description !== undefined) task.description = description;
      if (detailedDescription !== undefined) task.detailedDescription = detailedDescription;
      if (taskType !== undefined) task.taskType = taskType;
      if (priority !== undefined) task.priority = priority;

      if (status !== undefined && status !== '') {
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ success: false, message: 'Invalid status value.' });
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

      // ─── Assignees update ────────────────────────────────
      if (req.body.assigneeIds !== undefined || req.body.assigneeId !== undefined) {
        const newIds = extractAssigneeIds(req.body);
        if (newIds.length > 0) {
          try {
            await ensureProjectMembers(project, workspace, newIds);
          } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
          }
        }

        const oldIds = (task.assignees || []).map((a) => a.toString());
        const added = newIds.filter((id) => !oldIds.includes(id));
        task.assignees = newIds;

        // Newly assigned → notify them (don't spam existing ones).
        const toNotify = added.filter((id) => id !== userId);
        if (toNotify.length > 0) {
          notifyUsers(toNotify, {
            title: `Task assigned to you: "${task.title}"`,
            body: `You have been assigned the task "${task.title}" in project "${project.name}".`,
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

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('folder', 'name');

    res.status(200).json({ success: true, message: 'Task updated', task: updated });
  } catch (error) {
    console.error('❌ Update task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// ASSIGN / REASSIGN
// ─────────────────────────────────────────────────────────────────────

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
      try {
        await ensureProjectMembers(project, workspace, newIds);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const oldIds = (task.assignees || []).map((a) => a.toString());
    const added = newIds.filter((id) => !oldIds.includes(id));
    task.assignees = newIds;

    await task.save();
    await updateTaskProgress(task._id);

    const toNotify = added.filter((id) => id !== userId);
    if (toNotify.length > 0) {
      notifyUsers(toNotify, {
        title: `Task assigned to you: "${task.title}"`,
        body: `You have been assigned the task "${task.title}" in project "${project.name}".`,
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
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, task: updated });
  } catch (error) {
    console.error('❌ Assign task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// SUBTASKS
// ─────────────────────────────────────────────────────────────────────

export const addSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { title, description, startDate, dueDate, bufferTime = 0, links, attachments } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Sub‑task title is required.' });
    }

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = isTaskAssignee(task, userId);

    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to add sub‑tasks to this task.',
      });
    }

    let recurrenceData;
    try {
      recurrenceData = parseRecurrence(req.body);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

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
    });

    await task.save();
    await updateTaskProgress(task._id);

    if (isManager && (task.assignees || []).length > 0) {
      const targets = task.assignees.map((a) => a.toString()).filter((id) => id !== userId);
      if (targets.length > 0) {
        notifyUsers(targets, {
          title: `New sub‑task added to "${task.title}"`,
          body: `A new sub‑task "${title}" has been added to your task.`,
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
      .populate('createdBy', 'name email profile');

    res.status(201).json({ success: true, message: 'Sub‑task added', task: updated });
  } catch (error) {
    console.error('❌ Add sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;
    const { title, description, startDate, dueDate, bufferTime, links, attachments } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = isTaskAssignee(task, userId);

    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({ success: false, message: 'Not allowed.' });
    }

    const subTask = task.subTasks[index];
    if (subTask.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Cannot edit a confirmed sub‑task.' });
    }

    let recurrenceData = null;
    if (req.body.recurrenceType !== undefined) {
      try {
        recurrenceData = parseRecurrence(req.body);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    if (title !== undefined) subTask.title = title.trim();
    if (description !== undefined) subTask.description = description;
    if (startDate !== undefined) subTask.startDate = startDate;
    if (dueDate !== undefined) subTask.dueDate = dueDate;
    if (bufferTime !== undefined) subTask.bufferTime = bufferTime;
    if (links !== undefined) subTask.links = parseArrayField(links);
    if (attachments !== undefined) subTask.attachments = parseArrayField(attachments);
    if (recurrenceData) {
      subTask.recurrenceType = recurrenceData.recurrenceType;
      subTask.recurrenceDays = recurrenceData.recurrenceDays;
      subTask.recurrenceEndDate = recurrenceData.recurrenceEndDate;
    }

    await task.save();
    await updateTaskProgress(task._id);

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Sub‑task updated', task: updated });
  } catch (error) {
    console.error('❌ Update sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Mark a subtask done.
 *   - If a manager marks it → immediately `confirmed` (no second click).
 *   - If an assignee marks it → `done`, awaiting manager confirmation.
 */
export const markSubTaskDone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;
    const { notes, links } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = isTaskAssignee(task, userId);

    if (!isManager && !isAssignee) {
      return res.status(403).json({
        success: false,
        message: 'Only assignees or project managers can mark this sub‑task as done.',
      });
    }

    const subTask = task.subTasks[index];
    if (subTask.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Sub‑task already confirmed.' });
    }
    if (subTask.status === 'done' && !isManager) {
      return res.status(400).json({
        success: false,
        message: 'Sub‑task already marked done. Awaiting confirmation.',
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
      // Manager click = auto-confirm.
      subTask.status = 'confirmed';
      subTask.confirmedBy = userId;
      subTask.confirmedAt = now;
      spawnNextSubTaskOccurrence(task, subTask, index);
    } else {
      subTask.status = 'done';
    }

    await task.save();
    await updateTaskProgress(task._id);

    const assigneeIds = (task.assignees || []).map((a) => a.toString());

    if (isManager) {
      const targets = assigneeIds.filter((id) => id !== userId);
      if (targets.length > 0) {
        notifyUsers(targets, {
          title: `Sub‑task completed: "${subTask.title}"`,
          body: `${req.user.name || 'A manager'} marked sub‑task "${subTask.title}" as done and confirmed it.`,
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
      const recipients = getManagerRecipients(project, workspace).filter((id) => id !== userId);
      if (recipients.length > 0) {
        notifyUsers(recipients, {
          title: `Sub‑task done: "${subTask.title}"`,
          body: `${req.user.name || 'An assignee'} marked sub‑task "${subTask.title}" as done. Please confirm.`,
          data: {
            notificationType: 'task',
            taskId: task._id.toString(),
            projectId: project._id.toString(),
            workspaceId: project.workspace.toString(),
            subTaskIndex: index,
          },
          emailEventType: 'taskUpdate',
          emailHtml: `<p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>`,
        });
      }
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({
      success: true,
      message: isManager ? 'Sub‑task completed and confirmed.' : 'Sub‑task marked done, awaiting confirmation.',
      task: updated,
    });
  } catch (error) {
    console.error('❌ Mark sub‑task done error:', error);
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
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const subTask = task.subTasks[index];
    if (subTask.status !== 'done') {
      return res.status(400).json({ success: false, message: 'Sub‑task must be marked done first.' });
    }

    subTask.status = 'confirmed';
    subTask.confirmedBy = userId;
    subTask.confirmedAt = new Date();
    if (feedback) subTask.feedback = feedback;

    const spawned = spawnNextSubTaskOccurrence(task, subTask, index);

    await task.save();
    await updateTaskProgress(task._id);

    const assigneeIds = (task.assignees || []).map((a) => a.toString());
    const targets = assigneeIds.filter((id) => id !== userId);
    if (targets.length > 0) {
      notifyUsers(targets, {
        title: `Sub‑task confirmed: "${subTask.title}"`,
        body: `Your sub‑task "${subTask.title}" has been confirmed by ${req.user.name}.`,
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
      .populate('createdBy', 'name email profile');

    res.status(200).json({
      success: true,
      message: spawned ? 'Sub‑task confirmed; next occurrence created.' : 'Sub‑task confirmed',
      task: updated,
    });
  } catch (error) {
    console.error('❌ Confirm sub‑task error:', error);
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
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const subTask = task.subTasks[index];
    if (subTask.status !== 'done') {
      return res.status(400).json({ success: false, message: 'Sub‑task must be marked done first.' });
    }

    subTask.status = 'pending';
    subTask.rejectedBy = userId;
    subTask.rejectedAt = new Date();
    subTask.rejectionReason = reason;

    await task.save();
    await updateTaskProgress(task._id);

    const assigneeIds = (task.assignees || []).map((a) => a.toString());
    const targets = assigneeIds.filter((id) => id !== userId);
    if (targets.length > 0) {
      notifyUsers(targets, {
        title: `Sub‑task rejected: "${subTask.title}"`,
        body: `Your sub‑task "${subTask.title}" was rejected by ${req.user.name}. ${reason ? `Reason: ${reason}` : ''}`,
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
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Sub‑task rejected', task: updated });
  } catch (error) {
    console.error('❌ Reject sub‑task error:', error);
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
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = isTaskAssignee(task, userId);

    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({ success: false, message: 'Not allowed.' });
    }

    const subTask = task.subTasks[index];
    if (subTask.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Cannot delete a confirmed sub‑task.' });
    }

    task.subTasks.splice(index, 1);
    await task.save();
    await updateTaskProgress(task._id);

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Sub‑task deleted', task: updated });
  } catch (error) {
    console.error('❌ Delete sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// TASK COMPLETION
//   - Assignee clicks "mark done" → `completed`, awaits PM confirm.
//   - PM/owner clicks "mark done" → `confirmed_completed` instantly.
// ─────────────────────────────────────────────────────────────────────

export const markTaskCompleted = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { notes, links, attachments } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = isTaskAssignee(task, userId);

    if (!isManager && !isAssignee) {
      return res.status(403).json({
        success: false,
        message: 'Only assignees or project managers can mark this task as completed.',
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

    // ── Save submission data ──────────────────────────────
    const parsedLinks = parseArrayField(links);
    let uploadedFiles = [];
    if (req.files?.completionAttachments) {
      uploadedFiles = normalizeAttachments(req.files.completionAttachments);
    }
    const attachmentUrls = parseArrayField(attachments);
    const allAttachments = [...uploadedFiles];
    attachmentUrls.forEach((item) => {
      if (typeof item === 'string') {
        allAttachments.push({ url: item, name: 'Attachment' });
      } else if (item && typeof item === 'object' && item.url) {
        allAttachments.push(item);
      }
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
      if (spawned) await task.save(); // persist any recurrenceType reset
    }

    await updateProjectProgress(task.project);

    // ── Notifications ─────────────────────────────────────
    const assigneeIds = (task.assignees || []).map((a) => a.toString());

    if (isManager) {
      const targets = assigneeIds.filter((id) => id !== userId);
      if (targets.length > 0) {
        notifyUsers(targets, {
          title: `Task completed: "${task.title}"`,
          body: `${req.user.name || 'A manager'} marked task "${task.title}" as done and confirmed it.`,
          data: {
            notificationType: 'task',
            taskId: task._id.toString(),
            projectId: project._id.toString(),
            workspaceId: project.workspace.toString(),
          },
          emailEventType: 'taskUpdate',
        });
      }
      if (spawned) {
        notifyUsers(assigneeIds, {
          title: `New occurrence for recurring task: "${task.title}"`,
          body: `The next occurrence of "${task.title}" has been created. Due: ${spawned.dueDate}`,
          data: {
            notificationType: 'task',
            taskId: spawned._id.toString(),
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
          body: `${req.user.name || 'An assignee'} marked task "${task.title}" as done. Please confirm or reject.`,
          data: {
            notificationType: 'task',
            taskId: task._id.toString(),
            projectId: project._id.toString(),
            workspaceId: project.workspace.toString(),
          },
          emailEventType: 'taskUpdate',
          emailHtml: `<p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>`,
        });
      }
    }

    const updated = await Task.findById(taskId)
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('completedBy', 'name email profile')
      .populate('confirmedBy', 'name email profile');

    res.status(200).json({
      success: true,
      message: isManager
        ? spawned
          ? 'Task completed, confirmed, and next occurrence created.'
          : 'Task completed and confirmed.'
        : 'Task marked done, awaiting confirmation.',
      task: updated,
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
      return res.status(400).json({
        success: false,
        message: 'Task must be marked done by an assignee before it can be confirmed.',
      });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to confirm this task.' });
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

    const assigneeIds = (task.assignees || []).map((a) => a.toString());
    const targets = assigneeIds.filter((id) => id !== userId);
    if (targets.length > 0) {
      notifyUsers(targets, {
        title: `Task completion confirmed: "${task.title}"`,
        body: `Your task "${task.title}" has been confirmed as complete by ${req.user.name}.`,
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
      .populate('createdBy', 'name email profile')
      .populate('confirmedBy', 'name email profile');

    res.status(200).json({
      success: true,
      message: spawned ? 'Task confirmed; next occurrence created.' : 'Task completion confirmed',
      task: updated,
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
      return res.status(400).json({
        success: false,
        message: 'Task must be marked done by an assignee before it can be rejected.',
      });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject this task.' });
    }

    task.status = 'ready_for_completion';
    task.rejectedBy = userId;
    task.rejectedAt = new Date();
    task.rejectionReason = reason;
    task.completedBy = null;
    task.completedAt = null;

    await task.save();

    const assigneeIds = (task.assignees || []).map((a) => a.toString());
    const targets = assigneeIds.filter((id) => id !== userId);
    if (targets.length > 0) {
      notifyUsers(targets, {
        title: `Task rejected: "${task.title}"`,
        body: `Your task "${task.title}" was rejected. ${reason ? `Reason: ${reason}` : ''}`,
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
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Task rejected', task: updated });
  } catch (error) {
    console.error('❌ Reject task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET / LIST
// ─────────────────────────────────────────────────────────────────────

export const getProjectTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { status, priority, assigneeId, taskType, folderId, archived } = req.query;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    const isOwner = isWorkspaceOwner(workspace, userId);
    const isAdmin = workspace.members.some(
      (m) => m.user.toString() === userId && m.role === 'Admin' && m.status === 'active'
    );
    const isPM = isProjectManager(project, userId);
    const isMember = isProjectMember(project, userId);

    if (!isOwner && !isAdmin && !isPM && !isMember) {
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

    if (isOwner || isAdmin || isPM) {
      if (assigneeId) query.assignees = assigneeId;
    } else {
      const visibleFolderIds = await getVisibleFolderIdsForUser(projectId, userId);
      query.$or = [
        { assignees: userId },
        { folder: { $in: visibleFolderIds } },
      ];
    }

    const tasks = await Task.find(query)
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('folder', 'name')
      .sort({ order: 1, createdAt: -1 });

    res.status(200).json({ success: true, tasks, count: tasks.length });
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
      .populate('createdBy', 'name email profile')
      .sort({ dueDate: 1, createdAt: -1 });

    res.status(200).json({ success: true, tasks, count: tasks.length });
  } catch (error) {
    console.error('❌ Get my tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTaskById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false })
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('completedBy', 'name email profile')
      .populate('confirmedBy', 'name email profile')
      .populate('rejectedBy', 'name email profile')
      .populate('comments.user', 'name email profile')
      .populate('folder', 'name');

    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canViewTask(workspace, project, userId, task)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({ success: true, task });
  } catch (error) {
    console.error('❌ Get task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

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

    res.status(200).json({ success: true, message: 'Task moved to trash (auto‑delete in 30 days).' });
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

    task.isArchived = false;
    task.isTrash = false;
    task.trashedAt = null;
    await task.save();

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

// ─────────────────────────────────────────────────────────────────────
// COMMENTS / FEEDBACK
// ─────────────────────────────────────────────────────────────────────

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

    if (!canViewTask(workspace, project, userId, task)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    task.comments.push({ user: userId, comment: comment.trim(), mentions, attachments });
    await task.save();

    const assigneeIds = (task.assignees || []).map((a) => a.toString());
    const validMentions = mentions.filter((mentionId) =>
      project.teamMembers.some((tm) => tm.user.toString() === mentionId && tm.status === 'active') ||
      project.projectManagers.some((pm) => pm.toString() === mentionId) ||
      assigneeIds.includes(mentionId)
    );

    if (validMentions.length > 0) {
      notifyUsers(validMentions, {
        title: `You were mentioned in a comment on "${task.title}"`,
        body: `${req.user.name || 'Someone'} mentioned you: ${comment.substring(0, 100)}`,
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
    if (type && ['progress_update', 'daily_report', 'review'].includes(type)) {
      query.type = type;
    }

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

// ─────────────────────────────────────────────────────────────────────
// REMINDERS
// ─────────────────────────────────────────────────────────────────────

export const sendTaskReminders = async (req, res) => {
  try {
    const count = await checkAndSendReminders();
    res.status(200).json({ success: true, message: `Reminders sent for ${count} tasks/sub‑tasks.`, count });
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
    const recipients = task.assignees.map((a) => a._id.toString()).filter((id) => id !== userId);

    if (recipients.length > 0) {
      await notifyUsers(recipients, {
        title: `📢 Manual Reminder: Task "${task.title}"`,
        body: `${req.user.name} reminded you: ${customMessage}`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'taskUpdate',
        emailHtml: `<p>${customMessage}</p><p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Reminder sent to ${recipients.length} assignee(s).`,
    });
  } catch (error) {
    console.error('❌ Manual reminder error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// FOLDERS
// ─────────────────────────────────────────────────────────────────────

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
    const isAdmin = workspace.members.some(
      (m) => m.user.toString() === userId && m.role === 'Admin' && m.status === 'active'
    );
    const isPM = isProjectManager(project, userId);

    let folders;
    if (isOwner || isAdmin || isPM) {
      folders = await Folder.find({ project: projectId }).sort({ order: 1 });
    } else {
      const visibleFolderIds = await getVisibleFolderIdsForUser(projectId, userId);
      folders = await Folder.find({
        project: projectId,
        _id: { $in: visibleFolderIds },
      }).sort({ order: 1 });
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

    const activeMemberIds = project.teamMembers
      .filter((tm) => tm.status === 'active')
      .map((tm) => tm.user.toString());

    const validUsers = users.filter((id) => activeMemberIds.includes(id));
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
      message: `${toAdd.length} user(s) added to read‑only access.`,
      folder,
    });
  } catch (error) {
    console.error('❌ Add folder read‑only error:', error);
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
      message: `${toRemove.length} user(s) removed from read‑only access.`,
      folder,
    });
  } catch (error) {
    console.error('❌ Remove folder read‑only error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// COPY / MOVE / REORDER
// ─────────────────────────────────────────────────────────────────────

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
    taskData.subTasks = taskData.subTasks.map((st) => ({ ...st, status: 'pending' }));

    const newTask = await Task.create(taskData);

    const populated = await Task.findById(newTask._id)
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('folder', 'name');

    res.status(201).json({ success: true, message: 'Task copied', task: populated });
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
    const updated = await Task.findById(taskId).populate('folder', 'name');
    res.status(200).json({ success: true, message: 'Task moved', task: updated });
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
      updateOne: { filter: { _id: id, project: projectId }, update: { $set: { order: index } } },
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
    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({ success: false, message: 'Not authorized to reorder sub‑tasks' });
    }

    task.subTasks = orderedSubTaskIndices.map((i) => task.subTasks[i]);
    task.subTasks.forEach((st, idx) => (st.order = idx));

    await task.save();
    res.status(200).json({ success: true, message: 'Sub‑tasks reordered' });
  } catch (error) {
    console.error('Reorder sub‑tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// URGENT TASKS
// ─────────────────────────────────────────────────────────────────────

export const getAllUrgentTasks = async (req, res) => {
  try {
    const userId = req.user.id;

    const userProjects = await Project.find({
      $or: [
        { projectManagers: userId },
        { 'teamMembers.user': userId, 'teamMembers.status': 'active' },
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

// ─────────────────────────────────────────────────────────────────────
// CRON HELPERS
// ─────────────────────────────────────────────────────────────────────

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
        title: `⏰ Reminder: Task "${task.title}" due soon`,
        body: `The task "${task.title}" is due within 1 hour.`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: task.project.toString(),
          workspaceId: task.workspace ? task.workspace.toString() : undefined,
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
        body: `Your daily reminder for task "${task.title}".`,
        data: {
          notificationType: 'task',
          taskId: task._id.toString(),
          projectId: task.project.toString(),
          workspaceId: task.workspace ? task.workspace.toString() : undefined,
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
    await Feedback.deleteMany({ task: task._id });
    for (const att of task.attachments || []) {
      if (att.publicId) cloudinary.uploader.destroy(att.publicId).catch(() => {});
    }
    await Task.findByIdAndDelete(task._id);
  }
};