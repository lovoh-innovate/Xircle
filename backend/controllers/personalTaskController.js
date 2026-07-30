import PersonalTask from '../models/personalTaskModel.js';
import PersonalFolder from '../models/personalFolderModel.js';
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────
// HELPERS (internal – not exported)
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
      if (nextDay === undefined) {
        nextDay = sortedDays[0] + 7;
      }
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
  if (!['none', 'daily', 'weekly'].includes(type)) {
    throw new Error('Invalid recurrence type');
  }
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
// PERSONAL TASK CRUD
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

    const task = await PersonalTask.create({
      user: req.user.id,
      folder: folderId || null,
      title: title.trim(),
      description: description || '',
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      dailyReminderTime: dailyReminderTime || null,
      subtasks: subtasks || [],
      notes: notes || '',
      recurrenceType: recurrenceData.recurrenceType,
      recurrenceDays: recurrenceData.recurrenceDays,
      recurrenceEndDate: recurrenceData.recurrenceEndDate,
      reminderSentAt: null,
    });

    res.status(201).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPersonalTasks = async (req, res) => {
  try {
    const { folderId, status, priority, archived } = req.query;
    const query = { user: req.user.id };

    if (folderId) query.folder = folderId;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (archived === 'true') query.isArchived = true;
    else {
      query.isArchived = { $ne: true };
      query.isTrash = { $ne: true };
    }

    const tasks = await PersonalTask.find(query)
      .populate('folder', 'name color')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, tasks, count: tasks.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePersonalTask = async (req, res) => {
  try {
    const task = await PersonalTask.findOne({ _id: req.params.taskId, user: req.user.id });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

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
      try {
        recurrenceData = parseRecurrence(req.body);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }

    if (folderId !== undefined) {
      if (folderId) {
        const folder = await PersonalFolder.findOne({ _id: folderId, user: req.user.id });
        if (!folder) return res.status(400).json({ success: false, message: 'Invalid folder.' });
        task.folder = folderId;
      } else {
        task.folder = null;
      }
    }

    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description;
    if (priority) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (dailyReminderTime !== undefined) task.dailyReminderTime = dailyReminderTime;
    if (subtasks) task.subtasks = subtasks;
    if (notes !== undefined) task.notes = notes;

    if (recurrenceData) {
      task.recurrenceType = recurrenceData.recurrenceType;
      task.recurrenceDays = recurrenceData.recurrenceDays;
      task.recurrenceEndDate = recurrenceData.recurrenceEndDate;
    }

    if (status) {
      if (status === 'completed' && task.recurrenceType !== 'none') {
        const nextDue = calculateNextDueDate(task, task.dueDate);
        if (nextDue) {
          task.dueDate = nextDue;
          task.reminderSentAt = null;
          task.status = 'pending';
          task.completedAt = null;
        } else {
          task.status = 'completed';
          task.completedAt = new Date();
          task.recurrenceType = 'none';
        }
      } else {
        task.status = status;
        if (status === 'completed') {
          task.completedAt = new Date();
        } else {
          task.completedAt = null;
        }
      }
    }

    await task.save();
    res.status(200).json({ success: true, task });
  } catch (error) {
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