import PersonalTask from '../models/personalTaskModel.js';
import PersonalFolder from '../models/personalFolderModel.js';
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────
// HELPERS
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

// ─────────────────────────────────────────────────────────────────────
// FOLDER CRUD
// ─────────────────────────────────────────────────────────────────────
const createPersonalFolder = async (req, res) => {
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

const getPersonalFolders = async (req, res) => {
  try {
    const folders = await PersonalFolder.find({ user: req.user.id }).sort({ order: 1 });
    res.status(200).json({ success: true, folders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updatePersonalFolder = async (req, res) => {
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

const deletePersonalFolder = async (req, res) => {
  try {
    const folder = await PersonalFolder.findOne({ _id: req.params.folderId, user: req.user.id });
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found.' });
    // Unlink tasks
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
const createPersonalTask = async (req, res) => {
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

    const task = await PersonalTask.create({
      user: req.user.id,
      folder: folderId || null,
      title: title.trim(),
      description: description || '',
      priority: priority || 'medium',
      dueDate: dueDate || null,
      dailyReminderTime: dailyReminderTime || null,
      subtasks: subtasks || [],
      notes: notes || '',
    });

    res.status(201).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPersonalTasks = async (req, res) => {
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

const updatePersonalTask = async (req, res) => {
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
    if (status) {
      task.status = status;
      if (status === 'completed') task.completedAt = new Date();
    }
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (dailyReminderTime !== undefined) task.dailyReminderTime = dailyReminderTime;
    if (subtasks) task.subtasks = subtasks;
    if (notes !== undefined) task.notes = notes;

    await task.save();
    res.status(200).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const archivePersonalTask = async (req, res) => {
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

const restorePersonalTask = async (req, res) => {
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

const deletePersonalTask = async (req, res) => {
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

// ─────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────
export {
  createPersonalFolder,
  getPersonalFolders,
  updatePersonalFolder,
  deletePersonalFolder,
  createPersonalTask,
  getPersonalTasks,
  updatePersonalTask,
  archivePersonalTask,
  restorePersonalTask,
  deletePersonalTask,
};