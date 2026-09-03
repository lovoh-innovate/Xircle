// controllers/personalTaskController.js
import PersonalTask from '../models/personalTaskModel.js';
import PersonalFolder from '../models/personalFolderModel.js';
import User from '../models/userModel.js';
import { createAndSendNotification } from './notificationController.js';
import { sendCollaborationInvitationEmail } from '../utils/sendCollabEmail.js';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────
// HELPERS (internal)
// ─────────────────────────────────────────────────────────────────────

const notifyUser = async (userId, { title, body, data = {} }) => {
  if (!userId) return;
  createAndSendNotification({
    recipient: userId,
    title,
    body,
    data,
    sendPush: true,
    emailEventType: 'taskUpdate',
    emailSubject: title,
    emailHtml: `<p>${body}</p>`,
  }).catch((err) => console.error(`Notification to ${userId} failed:`, err.message));
};

const notifyTaskCollaborators = async (task, message, data = {}) => {
  const userIds = new Set();
  userIds.add(task.user.toString());
  if (task.collaborators) {
    task.collaborators.forEach(c => {
      if (c.accepted && c.user) userIds.add(c.user.toString());
    });
  }
  for (const uid of userIds) {
    await notifyUser(uid, { title: 'Task Update', body: message, data: { ...data, taskId: task._id } });
  }
};

const calculateNextDueDate = (task, fromDate = null) => {
  if (task.recurrenceType === 'none') return null;

  const base = fromDate ? new Date(fromDate) : (task.dueDate ? new Date(task.dueDate) : new Date());
  if (!task.dueDate) {
    base.setHours(0, 0, 0, 0);
  }

  if (task.recurrenceEndDate && base >= new Date(task.recurrenceEndDate)) {
    return null;
  }

  let next = new Date(base);
  next.setHours(base.getHours(), base.getMinutes(), 0, 0);

  if (task.recurrenceType === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (task.recurrenceType === 'weekly') {
    const days = task.recurrenceDays || [];
    if (days.length === 0) {
      next.setDate(next.getDate() + 7);
    } else {
      const currentDay = next.getDay();
      const sortedDays = [...days].sort((a, b) => a - b);
      let nextDay = sortedDays.find(d => d > currentDay);
      if (nextDay === undefined) nextDay = sortedDays[0] + 7;
      const diff = nextDay - currentDay;
      next.setDate(next.getDate() + diff);
    }
  }

  if (task.recurrenceEndDate && next > new Date(task.recurrenceEndDate)) {
    return null;
  }

  const originalTime = task.dueDate ? new Date(task.dueDate) : new Date();
  next.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0);

  return next;
};

const parseRecurrence = (body) => {
  const { recurrenceType, recurrenceDays, recurrenceEndDate } = body;
  const type = recurrenceType || 'none';
  if (!['none', 'daily', 'weekly'].includes(type)) throw new Error('Invalid recurrence type');
  let days = recurrenceDays || [];
  if (type === 'weekly' && (!Array.isArray(days) || days.length === 0)) {
    throw new Error('Weekly recurrence requires at least one day');
  }
  if (type === 'weekly') {
    days = days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length === 0) throw new Error('Weekly recurrence days must be valid (0-6)');
  }
  return {
    recurrenceType: type,
    recurrenceDays: type === 'weekly' ? days : [],
    recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
  };
};

const updatePersonalTaskStatus = async (taskId) => {
  const task = await PersonalTask.findById(taskId);
  if (!task || task.isArchived || task.isTrash) return;

  const total = task.subtasks ? task.subtasks.length : 0;
  if (total === 0) return;

  const doneCount = task.subtasks.filter(st => st.done).length;
  if (doneCount === total) {
    task.status = 'completed';
    task.completedAt = new Date();
  } else if (doneCount > 0) {
    task.status = 'in-progress';
    task.completedAt = null;
  } else {
    task.status = 'pending';
    task.completedAt = null;
  }
  await task.save();
};

const canWrite = (task, userId) => {
  if (task.user.toString() === userId.toString()) return true;
  if (!task.collaborators) return false;
  const collab = task.collaborators.find(c => c.user && c.user.toString() === userId.toString() && c.accepted);
  return collab && collab.role === 'write';
};

const canRead = (task, userId) => {
  if (task.user.toString() === userId.toString()) return true;
  if (!task.collaborators) return false;
  return task.collaborators.some(c => c.user && c.user.toString() === userId.toString() && c.accepted);
};

// ─────────────────────────────────────────────────────────────────────
// FOLDER CRUD
// ─────────────────────────────────────────────────────────────────────

export const createPersonalFolder = async (req, res) => {
  try {
    const { name, color } = req.body;
    const folder = await PersonalFolder.create({
      name: name.trim(),
      user: req.user.id,
      color: color || '#4f46e5',
    });
    res.status(201).json({ success: true, folder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPersonalFolders = async (req, res) => {
  try {
    const folders = await PersonalFolder.find({ user: req.user.id }).sort({ order: 1 });
    res.status(200).json({ success: true, folders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePersonalFolder = async (req, res) => {
  try {
    const { name, color } = req.body;
    const folder = await PersonalFolder.findOne({ _id: req.params.folderId, user: req.user.id });
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found.' });
    if (name) folder.name = name.trim();
    if (color) folder.color = color;
    await folder.save();
    res.status(200).json({ success: true, folder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePersonalFolder = async (req, res) => {
  try {
    const folder = await PersonalFolder.findOne({ _id: req.params.folderId, user: req.user.id });
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found.' });
    await PersonalTask.updateMany({ folder: folder._id }, { $set: { folder: null } });
    await PersonalFolder.findByIdAndDelete(folder._id);
    res.status(200).json({ success: true, message: 'Folder deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// PERSONAL TASK CRUD (collaboration‑aware)
// ─────────────────────────────────────────────────────────────────────

export const createPersonalTask = async (req, res) => {
  try {
    const {
      folderId,
      title,
      description,
      priority,
      dueDate,
      dailyReminderTime,
      subtasks,
      notes,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Title required.' });
    }

    if (folderId) {
      const folder = await PersonalFolder.findOne({ _id: folderId, user: req.user.id });
      if (!folder) return res.status(400).json({ success: false, message: 'Invalid folder.' });
    }

    let recurrenceData;
    try {
      recurrenceData = parseRecurrence(req.body);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    // New tasks go to the top of the user's ordering (order 0)
    await PersonalTask.updateMany(
      { user: req.user.id, isTrash: { $ne: true } },
      { $inc: { order: 1 } }
    );

    // Ensure subtasks have toggledBy null initially
    const cleanedSubtasks = (subtasks || []).map(st => ({
      ...st,
      toggledBy: null,
    }));

    const task = await PersonalTask.create({
      user: req.user.id,
      folder: folderId || null,
      title: title.trim(),
      description: description || '',
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      dailyReminderTime: dailyReminderTime || null,
      subtasks: cleanedSubtasks,
      notes: notes || '',
      recurrenceType: recurrenceData.recurrenceType,
      recurrenceDays: recurrenceData.recurrenceDays,
      recurrenceEndDate: recurrenceData.recurrenceEndDate,
      reminderSentAt: null,
      order: 0,
      collaborators: [],
      completedBy: null,
    });

    res.status(201).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPersonalTasks = async (req, res) => {
  try {
    const { folderId, status, priority, archived, trash, type } = req.query;
    const userId = req.user.id;

    const isTrash = trash === 'true';
    const isArchived = archived === 'true';

    // Base filters
    const query = {
      isTrash: isTrash ? true : { $ne: true },
      isArchived: isArchived ? true : { $ne: true },
    };

    if (type === 'owner') {
      // Only tasks owned by the user
      query.user = userId;
      delete query.$or;
    } else if (type === 'collaborator') {
      // Tasks where user is either:
      // - an accepted collaborator, OR
      // - the owner AND there is at least one accepted collaborator
      query.$or = [
        { 'collaborators.user': userId, 'collaborators.accepted': true },
        {
          user: userId,
          collaborators: { $elemMatch: { accepted: true } }
        }
      ];
      delete query.user;
    } else {
      // Default: owner OR accepted collaborator
      query.$or = [
        { user: userId },
        { 'collaborators.user': userId, 'collaborators.accepted': true }
      ];
    }

    // Additional filters (only for owner view; collaborator view ignores them)
    if (type !== 'collaborator') {
      if (folderId) query.folder = folderId;
      if (status) query.status = status;
      if (priority) query.priority = priority;
    }

    // For trash, only owner's trash
    if (isTrash) {
      query.user = userId;
      delete query.$or;
      delete query['collaborators.user'];
      delete query['collaborators.accepted'];
      query.isArchived = { $ne: true };
    }

    const tasks = await PersonalTask.find(query)
      .populate('folder', 'name color')
      .populate('collaborators.user', 'name email')
      .populate('completedBy', 'name email')
      .populate('subtasks.toggledBy', 'name email')
      .sort({ order: 1, createdAt: -1 });

    res.status(200).json({ success: true, tasks, count: tasks.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePersonalTask = async (req, res) => {
  try {
    const task = await PersonalTask.findById(req.params.taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const userId = req.user.id;
    if (!canWrite(task, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this task.' });
    }

    const {
      folderId,
      title,
      description,
      priority,
      status,
      dueDate,
      dailyReminderTime,
      subtasks,
      notes,
    } = req.body;

    let recurrenceData = null;
    if (req.body.recurrenceType !== undefined) {
      try { recurrenceData = parseRecurrence(req.body); } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    // Only owner can change folder
    if (folderId !== undefined && task.user.toString() === userId) {
      if (folderId) {
        const folder = await PersonalFolder.findOne({ _id: folderId, user: userId });
        if (!folder) return res.status(400).json({ success: false, message: 'Invalid folder.' });
        task.folder = folderId;
      } else {
        task.folder = null;
      }
    } else if (folderId !== undefined) {
      return res.status(403).json({ success: false, message: 'Only the owner can change folder.' });
    }

    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description;
    if (priority) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (dailyReminderTime !== undefined) task.dailyReminderTime = dailyReminderTime;
    if (subtasks) {
      // Preserve existing toggledBy values for subtasks that are not being changed
      // We'll merge: for each new subtask, if it has no toggledBy, keep the old one if the title/done/dueDate didn't change?
      // For simplicity, we just accept the incoming subtasks as-is, but the frontend will send toggledBy when toggled.
      task.subtasks = subtasks;
    }
    if (notes !== undefined) task.notes = notes;
    if (recurrenceData) {
      task.recurrenceType = recurrenceData.recurrenceType;
      task.recurrenceDays = recurrenceData.recurrenceDays;
      task.recurrenceEndDate = recurrenceData.recurrenceEndDate;
    }

    // Status update with completedBy tracking
    if (status !== undefined) {
      const oldStatus = task.status;
      if (status === 'completed' && task.recurrenceType !== 'none') {
        const nextDue = calculateNextDueDate(task, task.dueDate);
        if (nextDue) {
          task.dueDate = nextDue;
          task.reminderSentAt = null;
          task.status = 'pending';
          task.completedAt = null;
          task.completedBy = null;
        } else {
          task.status = 'completed';
          task.completedAt = new Date();
          task.recurrenceType = 'none';
          task.completedBy = userId;
        }
      } else {
        task.status = status;
        task.completedAt = status === 'completed' ? new Date() : null;
        task.completedBy = status === 'completed' ? userId : null;
      }

      // Notify all collaborators about status change
      if (oldStatus !== task.status) {
        const updater = await User.findById(userId);
        const message = `${updater.name || 'A collaborator'} marked task "${task.title}" as ${task.status}`;
        await notifyTaskCollaborators(task, message, { status: task.status, updatedBy: userId });
      }
    }

    await task.save();

    const populated = await PersonalTask.findById(task._id)
      .populate('folder', 'name color')
      .populate('collaborators.user', 'name email')
      .populate('completedBy', 'name email')
      .populate('subtasks.toggledBy', 'name email');

    res.status(200).json({ success: true, task: populated });
  } catch (error) {
    console.error('Update personal task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const archivePersonalTask = async (req, res) => {
  try {
    const task = await PersonalTask.findOne({ _id: req.params.taskId, user: req.user.id });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    task.isArchived = true;
    task.archivedAt = new Date();
    await task.save();
    res.status(200).json({ success: true, message: 'Task archived.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const restorePersonalTask = async (req, res) => {
  try {
    const task = await PersonalTask.findOne({ _id: req.params.taskId, user: req.user.id });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    task.isArchived = false;
    task.isTrash = false;
    task.trashedAt = null;
    await task.save();
    res.status(200).json({ success: true, message: 'Task restored.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePersonalTask = async (req, res) => {
  try {
    const task = await PersonalTask.findOne({ _id: req.params.taskId, user: req.user.id });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    task.isTrash = true;
    task.trashedAt = new Date();
    await task.save();
    res.status(200).json({ success: true, message: 'Task moved to trash (auto‑delete in 30 days).' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const permanentlyDeletePersonalTask = async (req, res) => {
  try {
    const task = await PersonalTask.findOne({ _id: req.params.taskId, user: req.user.id });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    if (!task.isTrash) {
      return res.status(400).json({ success: false, message: 'Task must be in trash before permanent deletion.' });
    }
    await PersonalTask.findByIdAndDelete(task._id);
    res.status(200).json({ success: true, message: 'Task permanently deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// TASK REORDER (owner only)
// ─────────────────────────────────────────────────────────────────────

export const reorderPersonalTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderedTaskIds } = req.body;

    if (!Array.isArray(orderedTaskIds) || orderedTaskIds.length === 0) {
      return res.status(400).json({ success: false, message: 'orderedTaskIds must be a non-empty array.' });
    }

    const ownedCount = await PersonalTask.countDocuments({
      _id: { $in: orderedTaskIds },
      user: userId,
    });
    if (ownedCount !== orderedTaskIds.length) {
      return res.status(403).json({ success: false, message: 'One or more tasks not found or not authorized.' });
    }

    const bulkOps = orderedTaskIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, user: userId },
        update: { $set: { order: index } },
      },
    }));

    await PersonalTask.bulkWrite(bulkOps);

    const tasks = await PersonalTask.find({ user: userId, isTrash: { $ne: true } })
      .populate('folder', 'name color')
      .populate('collaborators.user', 'name email')
      .populate('completedBy', 'name email')
      .populate('subtasks.toggledBy', 'name email')
      .sort({ order: 1, createdAt: -1 });

    res.status(200).json({ success: true, message: 'Tasks reordered', tasks });
  } catch (error) {
    console.error('❌ reorderPersonalTasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// COLLABORATOR ENDPOINTS
// ─────────────────────────────────────────────────────────────────────

export const addCollaborator = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { email, role = 'write' } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Email required.' });
    if (!['read', 'write'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be "read" or "write".' });
    }

    const task = await PersonalTask.findOne({ _id: taskId, user: req.user.id });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found or not owner.' });

    // Check if already invited
    const existing = task.collaborators.find(c => c.email === email);
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already invited to this task.' });
    }

    const invitedUser = await User.findOne({ email });
    const token = crypto.randomBytes(32).toString('hex');

    const collaborator = {
      email,
      role,
      accepted: false,
      user: invitedUser ? invitedUser._id : null,
      invitationToken: token,
      invitedAt: new Date(),
    };
    task.collaborators.push(collaborator);
    await task.save();

    // Send email with invitation link
    const inviteLink = `${process.env.FRONTEND_URL}/accept-task-collab?token=${token}`;
    await sendCollaborationInvitationEmail({
      to: email,
      taskName: task.title,
      ownerName: req.user.name || 'User',
      inviteLink,
      existingUser: !!invitedUser,
    });

    // If user exists, send push notification
    if (invitedUser) {
      await notifyUser(invitedUser._id, {
        title: 'Collaboration Invitation',
        body: `${req.user.name || 'Someone'} invited you to collaborate on "${task.title}"`,
        data: { taskId: task._id, invitationToken: token },
      });
    }

    const updated = await PersonalTask.findById(task._id)
      .populate('collaborators.user', 'name email')
      .populate('completedBy', 'name email')
      .populate('subtasks.toggledBy', 'name email');

    res.status(201).json({ success: true, task: updated });
  } catch (error) {
    console.error('Add collaborator error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPendingInvitations = async (req, res) => {
  try {
    const userId = req.user.id;
    const tasks = await PersonalTask.find({
      'collaborators.user': userId,
      'collaborators.accepted': false,
    })
      .populate('user', 'name email')
      .populate('collaborators.user', 'name email')
      .select('title collaborators user');

    const invitations = tasks.map(task => {
      const inv = task.collaborators.find(c => c.user && c.user.toString() === userId && !c.accepted);
      return {
        taskId: task._id,
        taskTitle: task.title,
        owner: task.user,
        role: inv.role,
        invitedAt: inv.invitedAt,
        invitationToken: inv.invitationToken,
      };
    });
    res.status(200).json({ success: true, invitations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const acceptInvitationWithToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token required.' });

    const userId = req.user.id;
    const task = await PersonalTask.findOne({
      'collaborators.invitationToken': token,
    });
    if (!task) return res.status(404).json({ success: false, message: 'Invalid or expired invitation token.' });

    const collabIndex = task.collaborators.findIndex(c => c.invitationToken === token);
    if (collabIndex === -1) return res.status(404).json({ success: false, message: 'Invitation not found.' });
    const collab = task.collaborators[collabIndex];

    if (collab.accepted) return res.status(400).json({ success: false, message: 'Invitation already accepted.' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.email !== collab.email && collab.user && collab.user.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'This invitation is not for you.' });
    }

    if (!collab.user) {
      collab.user = userId;
    }
    collab.accepted = true;
    await task.save();

    // Notify owner
    await notifyUser(task.user, {
      title: 'Collaboration Accepted',
      body: `${user.name || 'Someone'} accepted your invitation to collaborate on "${task.title}"`,
      data: { taskId: task._id, collaborator: userId },
    });

    const updated = await PersonalTask.findById(task._id)
      .populate('collaborators.user', 'name email')
      .populate('completedBy', 'name email')
      .populate('subtasks.toggledBy', 'name email');

    res.status(200).json({ success: true, message: 'Invitation accepted.', task: updated });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// SUB‑TASK ENDPOINTS
// ─────────────────────────────────────────────────────────────────────

export const addPersonalSubTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, dueDate } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Title required.' });
    }

    const task = await PersonalTask.findOne({ _id: taskId, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    if (!canWrite(task, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    let recurrenceData;
    try {
      recurrenceData = parseRecurrence(req.body);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    task.subtasks.push({
      title: title.trim(),
      done: false,
      dueDate: dueDate || null,
      recurrenceType: recurrenceData.recurrenceType,
      recurrenceDays: recurrenceData.recurrenceDays,
      recurrenceEndDate: recurrenceData.recurrenceEndDate,
      toggledBy: null,
    });
    await task.save();

    // Return populated task
    const updated = await PersonalTask.findById(task._id)
      .populate('completedBy', 'name email')
      .populate('subtasks.toggledBy', 'name email');

    res.status(201).json({ success: true, message: 'Sub‑task added', task: updated });
  } catch (error) {
    console.error('Add personal sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePersonalSubTask = async (req, res) => {
  try {
    const { taskId, subTaskIndex } = req.params;
    const { title, dueDate } = req.body;

    const task = await PersonalTask.findOne({ _id: taskId, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    if (!canWrite(task, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subtasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    let recurrenceData = null;
    if (req.body.recurrenceType !== undefined) {
      try { recurrenceData = parseRecurrence(req.body); } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    const subtask = task.subtasks[index];
    if (title !== undefined) subtask.title = title.trim();
    if (dueDate !== undefined) subtask.dueDate = dueDate || null;
    if (recurrenceData) {
      subtask.recurrenceType = recurrenceData.recurrenceType;
      subtask.recurrenceDays = recurrenceData.recurrenceDays;
      subtask.recurrenceEndDate = recurrenceData.recurrenceEndDate;
    }

    await task.save();

    const updated = await PersonalTask.findById(task._id)
      .populate('completedBy', 'name email')
      .populate('subtasks.toggledBy', 'name email');

    res.status(200).json({ success: true, message: 'Sub‑task updated', task: updated });
  } catch (error) {
    console.error('Update personal sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const togglePersonalSubTask = async (req, res) => {
  try {
    const { taskId, subTaskIndex } = req.params;
    const { done } = req.body;
    const userId = req.user.id;

    const task = await PersonalTask.findOne({ _id: taskId, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    if (!canWrite(task, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subtasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    const subtask = task.subtasks[index];
    const newDone = done !== undefined ? (done === true || done === 'true') : !subtask.done;

    // Only record who toggled if the done state actually changes
    if (newDone !== subtask.done) {
      subtask.toggledBy = userId;
    }

    if (newDone && !subtask.done) {
      const hasRecurrence = subtask.recurrenceType && subtask.recurrenceType !== 'none';
      subtask.done = true;
      if (hasRecurrence) {
        const nextDue = calculateNextDueDate(subtask, subtask.dueDate);
        if (nextDue) {
          task.subtasks.splice(index + 1, 0, {
            title: subtask.title,
            done: false,
            dueDate: nextDue,
            recurrenceType: subtask.recurrenceType,
            recurrenceDays: subtask.recurrenceDays,
            recurrenceEndDate: subtask.recurrenceEndDate,
            toggledBy: null,
          });
        } else {
          subtask.recurrenceType = 'none';
        }
      }
    } else {
      subtask.done = newDone;
    }

    await task.save();
    await updatePersonalTaskStatus(taskId);

    // Notify collaborators about subtask toggle
    const updater = await User.findById(userId);
    const action = subtask.done ? 'completed' : 'unchecked';
    const message = `${updater.name || 'A collaborator'} ${action} subtask "${subtask.title}" in task "${task.title}"`;
    await notifyTaskCollaborators(task, message, { subtaskIndex: index, done: subtask.done, updatedBy: userId });

    const updated = await PersonalTask.findById(task._id)
      .populate('completedBy', 'name email')
      .populate('subtasks.toggledBy', 'name email');

    res.status(200).json({ success: true, message: 'Sub‑task toggled', task: updated });
  } catch (error) {
    console.error('Toggle personal sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePersonalSubTask = async (req, res) => {
  try {
    const { taskId, subTaskIndex } = req.params;

    const task = await PersonalTask.findOne({ _id: taskId, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    if (!canWrite(task, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subtasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    task.subtasks.splice(index, 1);
    await task.save();
    await updatePersonalTaskStatus(taskId);

    const updated = await PersonalTask.findById(task._id)
      .populate('completedBy', 'name email')
      .populate('subtasks.toggledBy', 'name email');

    res.status(200).json({ success: true, message: 'Sub‑task deleted', task: updated });
  } catch (error) {
    console.error('Delete personal sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const reorderPersonalSubTasks = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { orderedSubTaskIndices } = req.body;

    const task = await PersonalTask.findOne({ _id: taskId, isTrash: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    if (!canWrite(task, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    if (!Array.isArray(orderedSubTaskIndices) || orderedSubTaskIndices.length !== task.subtasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid order array.' });
    }
    const unique = new Set(orderedSubTaskIndices);
    if (unique.size !== task.subtasks.length) {
      return res.status(400).json({ success: false, message: 'Indices must be unique.' });
    }
    const reordered = orderedSubTaskIndices.map(idx => task.subtasks[idx]);
    task.subtasks = reordered;
    await task.save();

    const updated = await PersonalTask.findById(task._id)
      .populate('completedBy', 'name email')
      .populate('subtasks.toggledBy', 'name email');

    res.status(200).json({ success: true, message: 'Sub‑tasks reordered', task: updated });
  } catch (error) {
    console.error('Reorder personal sub‑tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};