// controllers/taskController.js
import Task from '../models/taskModel.js';
import Project from '../models/projectModel.js';
import Workspace from '../models/workspaceModel.js';
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

const canManageTasks = (workspace, project, userId) =>
  isWorkspaceOwner(workspace, userId) || isProjectManager(project, userId);

const canViewTask = (workspace, project, userId, task) => {
  if (canManageTasks(workspace, project, userId)) return true;
  if (task.assignee?.toString() === userId) return true;
  if (task.createdBy?.toString() === userId) return true;
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

const ensureProjectMember = async (project, workspace, assigneeId) => {
  const alreadyActive = project.teamMembers.some(
    (tm) => tm.user.toString() === assigneeId && tm.status === 'active'
  );
  if (alreadyActive) return;

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
  await project.save();
};

const updateTaskProgress = async (taskId) => {
  const task = await Task.findById(taskId);
  if (!task) return;

  const total = task.subTasks.length;
  if (total === 0) {
    task.progress = 0;
    task.status = 'pending';
  } else {
    const confirmed = task.subTasks.filter(st => st.status === 'confirmed').length;
    task.progress = Math.round((confirmed / total) * 100);
    if (confirmed === total) {
      task.status = 'ready_for_completion';
    } else if (confirmed > 0) {
      task.status = 'in-progress';
    } else {
      task.status = 'pending';
    }
  }
  await task.save();
  await updateProjectProgress(task.project);
};

const updateProjectProgress = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) return;

  const tasks = await Task.find({ project: projectId, isDeleted: false });
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

const notifyUsers = async (userIds, { title, body, data = {}, emailEventType = null, emailHtml = null }) => {
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
    }).catch(err => console.error(`Notification to ${recipient} failed:`, err.message));
  }
};

// ─────────────────────────────────────────────────────────────────────
// REMINDER ENGINE – pure logic (no Express req/res)
// ─────────────────────────────────────────────────────────────────────
const checkAndSendReminders = async () => {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const tasks = await Task.find({
    isDeleted: false,
    dueDate: { $gte: now, $lte: oneHourLater },
    reminderSent: { $ne: true },
    status: { $nin: ['completed', 'confirmed_completed', 'cancelled'] },
  }).populate('assignee', 'name email');

  const allTasks = await Task.find({
    isDeleted: false,
    'subTasks.dueDate': { $gte: now, $lte: oneHourLater },
    'subTasks.reminderSent': { $ne: true },
  }).populate('assignee', 'name email');

  let reminderCount = 0;

  for (const task of tasks) {
    if (task.assignee) {
      await notifyUsers(task.assignee._id, {
        title: `⏰ Reminder: Task "${task.title}" due soon`,
        body: `The task "${task.title}" is due within 1 hour (due at ${new Date(task.dueDate).toLocaleString()}).`,
        data: { taskId: task._id.toString(), projectId: task.project.toString() },
        emailEventType: 'taskUpdate',
      });
      task.reminderSent = true;
      await task.save();
      reminderCount++;
    }
  }

  for (const task of allTasks) {
    const assignee = task.assignee;
    if (!assignee) continue;

    let updated = false;
    for (const subTask of task.subTasks) {
      if (subTask.dueDate && subTask.dueDate >= now && subTask.dueDate <= oneHourLater && !subTask.reminderSent) {
        await notifyUsers(assignee._id, {
          title: `⏰ Reminder: Sub‑task "${subTask.title}" due soon`,
          body: `The sub‑task "${subTask.title}" of task "${task.title}" is due within 1 hour (due at ${new Date(subTask.dueDate).toLocaleString()}).`,
          data: { taskId: task._id.toString(), projectId: task.project.toString() },
          emailEventType: 'taskUpdate',
        });
        subTask.reminderSent = true;
        updated = true;
        reminderCount++;
      }
    }
    if (updated) {
      await task.save();
    }
  }

  return reminderCount;
};

// ─────────────────────────────────────────────────────────────────────
// CREATE TASK
// POST /api/tasks
// ─────────────────────────────────────────────────────────────────────
const createTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      projectId,
      title,
      description = '',
      detailedDescription = '',
      taskType = 'general',
      assigneeId = null,
      priority = 'medium',
      startDate = null,
      dueDate = null,
      estimatedHours = null,
      bufferTime = 0,
      dependencies,
      allowAssigneeEditSubtasks = false,
    } = req.body;

    const links = parseArrayField(req.body.links);
    const deps = parseArrayField(dependencies);

    if (!projectId || !title?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'projectId and title are required.',
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can create tasks.',
      });
    }

    let assignee = null;
    if (assigneeId) {
      await ensureProjectMember(project, workspace, assigneeId);
      assignee = assigneeId;
    }

    let attachments = normalizeAttachments(req.files?.attachments);
    if (!Array.isArray(attachments)) attachments = [];

    const task = await Task.create({
      project: projectId,
      workspace: project.workspace,
      title: title.trim(),
      description,
      detailedDescription,
      taskType,
      assignee,
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
      subTasks: [],
      status: 'pending',
      progress: 0,
      reminderSent: false,
    });

    if (assignee) {
      notifyUsers(assignee, {
        title: `New task: "${task.title}"`,
        body: `You have been assigned a new task "${task.title}" in project "${project.name}".`,
        data: { taskId: task._id.toString(), projectId: project._id.toString() },
        emailEventType: 'taskAssignment',
        emailHtml: `<h3>New Task</h3><p>Task: <strong>${task.title}</strong></p><p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>`,
      });
    }

    const populated = await Task.findById(task._id)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(201).json({ success: true, message: 'Task created', task: populated });
  } catch (error) {
    console.error('❌ Create task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// UPDATE TASK (Basic fields – only PM/Owner)
// PUT /api/tasks/:taskId
// ─────────────────────────────────────────────────────────────────────
const updateTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can edit tasks.',
      });
    }

    const {
      title,
      description,
      detailedDescription,
      taskType,
      priority,
      assigneeId,
      startDate,
      dueDate,
      estimatedHours,
      bufferTime,
      allowAssigneeEditSubtasks,
    } = req.body;

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description;
    if (detailedDescription !== undefined) task.detailedDescription = detailedDescription;
    if (taskType !== undefined) task.taskType = taskType;
    if (priority !== undefined) task.priority = priority;
    if (startDate !== undefined) task.startDate = startDate;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (bufferTime !== undefined) task.bufferTime = bufferTime;
    if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
    if (allowAssigneeEditSubtasks !== undefined) task.allowAssigneeEditSubtasks = allowAssigneeEditSubtasks;

    if (assigneeId !== undefined) {
      if (assigneeId && assigneeId !== task.assignee?.toString()) {
        await ensureProjectMember(project, workspace, assigneeId);
        task.assignee = assigneeId;
        notifyUsers(assigneeId, {
          title: `Task assigned to you: "${task.title}"`,
          body: `You have been assigned the task "${task.title}".`,
          data: { taskId: task._id.toString(), projectId: project._id.toString() },
          emailEventType: 'taskAssignment',
        });
      } else if (!assigneeId) {
        task.assignee = null;
      }
    }

    if (req.body.links !== undefined) task.links = parseArrayField(req.body.links);
    if (req.body.dependencies !== undefined) {
      task.dependencies = parseArrayField(req.body.dependencies);
    }

    if (req.files?.attachments) {
      let newAttachments = normalizeAttachments(req.files.attachments);
      if (!Array.isArray(newAttachments)) newAttachments = [];
      task.attachments.push(...newAttachments);
    }

    await task.save();
    await updateTaskProgress(task._id);

    const updated = await Task.findById(taskId)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Task updated', task: updated });
  } catch (error) {
    console.error('❌ Update task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// ASSIGN TASK – separate endpoint for assigning (or unassigning) a task
// PATCH /api/tasks/:taskId/assign
// ─────────────────────────────────────────────────────────────────────
const assignTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { assigneeId } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can assign tasks.',
      });
    }

    if (assigneeId !== undefined && assigneeId !== null && assigneeId !== '') {
      await ensureProjectMember(project, workspace, assigneeId);

      if (task.assignee?.toString() !== assigneeId) {
        task.assignee = assigneeId;
        await task.save();

        notifyUsers(assigneeId, {
          title: `Task assigned to you: "${task.title}"`,
          body: `You have been assigned the task "${task.title}" in project "${project.name}".`,
          data: { taskId: task._id.toString(), projectId: project._id.toString() },
          emailEventType: 'taskAssignment',
          emailHtml: `<p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>`,
        });

        const updated = await Task.findById(taskId)
          .populate('assignee', 'name email profile')
          .populate('createdBy', 'name email profile');

        return res.status(200).json({
          success: true,
          message: 'Task assigned successfully',
          task: updated,
        });
      } else {
        return res.status(200).json({
          success: true,
          message: 'Task already assigned to this user',
          task: await Task.findById(taskId)
            .populate('assignee', 'name email profile')
            .populate('createdBy', 'name email profile'),
        });
      }
    } else {
      if (task.assignee !== null) {
        task.assignee = null;
        await task.save();
        const updated = await Task.findById(taskId)
          .populate('assignee', 'name email profile')
          .populate('createdBy', 'name email profile');

        return res.status(200).json({
          success: true,
          message: 'Task unassigned successfully',
          task: updated,
        });
      } else {
        return res.status(200).json({
          success: true,
          message: 'Task is already unassigned',
          task: await Task.findById(taskId)
            .populate('assignee', 'name email profile')
            .populate('createdBy', 'name email profile'),
        });
      }
    }
  } catch (error) {
    console.error('❌ Assign task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// ADD SUB-TASK
// POST /api/tasks/:taskId/subtasks
// ─────────────────────────────────────────────────────────────────────
const addSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { title, description, startDate, dueDate, bufferTime = 0, links, attachments } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Sub‑task title is required.' });
    }

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = task.assignee?.toString() === userId;

    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to add sub‑tasks to this task.',
      });
    }

    const subTask = {
      title: title.trim(),
      description: description || '',
      startDate: startDate || null,
      dueDate: dueDate || null,
      bufferTime: bufferTime || 0,
      links: parseArrayField(links),
      attachments: parseArrayField(attachments),
      status: 'pending',
      reminderSent: false,
    };

    task.subTasks.push(subTask);
    await task.save();
    await updateTaskProgress(task._id);

    if (isManager && task.assignee) {
      notifyUsers(task.assignee.toString(), {
        title: `New sub‑task added to "${task.title}"`,
        body: `A new sub‑task "${title}" has been added to your task.`,
        data: { taskId: task._id.toString(), projectId: project._id.toString() },
        emailEventType: 'taskUpdate',
      });
    }

    const updated = await Task.findById(taskId)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(201).json({ success: true, message: 'Sub‑task added', task: updated });
  } catch (error) {
    console.error('❌ Add sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// UPDATE SUB-TASK
// PUT /api/tasks/:taskId/subtasks/:subTaskIndex
// ─────────────────────────────────────────────────────────────────────
const updateSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;
    const { title, description, startDate, dueDate, bufferTime, links, attachments } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = task.assignee?.toString() === userId;

    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to edit this sub‑task.',
      });
    }

    const subTask = task.subTasks[index];
    if (subTask.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a confirmed sub‑task.',
      });
    }

    if (title !== undefined) subTask.title = title.trim();
    if (description !== undefined) subTask.description = description;
    if (startDate !== undefined) subTask.startDate = startDate;
    if (dueDate !== undefined) subTask.dueDate = dueDate;
    if (bufferTime !== undefined) subTask.bufferTime = bufferTime;
    if (links !== undefined) subTask.links = parseArrayField(links);
    if (attachments !== undefined) subTask.attachments = parseArrayField(attachments);

    await task.save();
    await updateTaskProgress(task._id);

    const updated = await Task.findById(taskId)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Sub‑task updated', task: updated });
  } catch (error) {
    console.error('❌ Update sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// MARK SUB-TASK AS DONE (Assignee only) – with file upload support
// PATCH /api/tasks/:taskId/subtasks/:subTaskIndex/done
// ─────────────────────────────────────────────────────────────────────
const markSubTaskDone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;
    const { notes, links } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    const subTask = task.subTasks[index];
    if (subTask.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Sub‑task is already confirmed.' });
    }
    if (subTask.status === 'done') {
      return res.status(400).json({ success: false, message: 'Sub‑task already marked done.' });
    }

    if (task.assignee?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the assignee can mark a sub‑task as done.',
      });
    }

    // ── Handle uploaded files ──
    let uploadedAttachments = [];
    if (req.files && req.files.attachments) {
      uploadedAttachments = normalizeAttachments(req.files.attachments);
    }

    // ── Update sub‑task ──
    subTask.status = 'done';
    subTask.completedBy = userId;
    subTask.completedAt = new Date();
    if (notes) subTask.notes = notes;
    if (links) subTask.links = parseArrayField(links);
    if (uploadedAttachments.length > 0) {
      // Replace existing attachments with new ones (or you could merge)
      subTask.attachments = uploadedAttachments;
    }

    await task.save();
    await updateTaskProgress(task._id);

    const project = await Project.findById(task.project);
    const managerIds = project.projectManagers.map(pm => pm.toString());
    const ownerId = project.workspace.owner?._id ? project.workspace.owner._id.toString() : null;
    const recipients = [...managerIds];
    if (ownerId && !recipients.includes(ownerId)) recipients.push(ownerId);

    if (recipients.length > 0) {
      notifyUsers(recipients, {
        title: `Sub‑task done: "${subTask.title}"`,
        body: `${req.user.name || 'Assignee'} marked sub‑task "${subTask.title}" as done. Please confirm.`,
        data: { taskId: task._id.toString(), subTaskIndex: index },
        emailEventType: 'taskUpdate',
        emailHtml: `<p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>`,
      });
    }

    const updated = await Task.findById(taskId)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Sub‑task marked done', task: updated });
  } catch (error) {
    console.error('❌ Mark sub‑task done error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// CONFIRM SUB-TASK (PM/Owner only)
// PATCH /api/tasks/:taskId/subtasks/:subTaskIndex/confirm
// ─────────────────────────────────────────────────────────────────────
const confirmSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;
    const { feedback } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can confirm sub‑tasks.',
      });
    }

    const subTask = task.subTasks[index];
    if (subTask.status !== 'done') {
      return res.status(400).json({
        success: false,
        message: 'Sub‑task must be marked done before confirmation.',
      });
    }

    subTask.status = 'confirmed';
    subTask.confirmedBy = userId;
    subTask.confirmedAt = new Date();
    if (feedback) subTask.feedback = feedback;

    await task.save();
    await updateTaskProgress(task._id);

    if (task.assignee) {
      notifyUsers(task.assignee.toString(), {
        title: `Sub‑task confirmed: "${subTask.title}"`,
        body: `Your sub‑task "${subTask.title}" has been confirmed by ${req.user.name}.`,
        data: { taskId: task._id.toString(), subTaskIndex: index },
        emailEventType: 'taskUpdate',
      });
    }

    const updated = await Task.findById(taskId)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Sub‑task confirmed', task: updated });
  } catch (error) {
    console.error('❌ Confirm sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// REJECT SUB-TASK (PM/Owner only)
// PATCH /api/tasks/:taskId/subtasks/:subTaskIndex/reject
// ─────────────────────────────────────────────────────────────────────
const rejectSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;
    const { reason = '' } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can reject sub‑tasks.',
      });
    }

    const subTask = task.subTasks[index];
    if (subTask.status !== 'done') {
      return res.status(400).json({
        success: false,
        message: 'Sub‑task must be marked done before rejection.',
      });
    }

    subTask.status = 'pending';
    subTask.rejectedBy = userId;
    subTask.rejectedAt = new Date();
    subTask.rejectionReason = reason;

    await task.save();
    await updateTaskProgress(task._id);

    if (task.assignee) {
      notifyUsers(task.assignee.toString(), {
        title: `Sub‑task rejected: "${subTask.title}"`,
        body: `Your sub‑task "${subTask.title}" was rejected by ${req.user.name}. ${reason ? `Reason: ${reason}` : ''}`,
        data: { taskId: task._id.toString(), subTaskIndex: index },
        emailEventType: 'taskUpdate',
      });
    }

    const updated = await Task.findById(taskId)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Sub‑task rejected', task: updated });
  } catch (error) {
    console.error('❌ Reject sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// DELETE SUB-TASK (PM/Owner, or assignee if allowed)
// DELETE /api/tasks/:taskId/subtasks/:subTaskIndex
// ─────────────────────────────────────────────────────────────────────
const deleteSubTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, subTaskIndex } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const index = parseInt(subTaskIndex);
    if (isNaN(index) || index < 0 || index >= task.subTasks.length) {
      return res.status(400).json({ success: false, message: 'Invalid sub‑task index.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isManager = canManageTasks(workspace, project, userId);
    const isAssignee = task.assignee?.toString() === userId;

    if (!isManager && !(isAssignee && task.allowAssigneeEditSubtasks)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to delete this sub‑task.',
      });
    }

    const subTask = task.subTasks[index];
    if (subTask.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a confirmed sub‑task.',
      });
    }

    task.subTasks.splice(index, 1);
    await task.save();
    await updateTaskProgress(task._id);

    const updated = await Task.findById(taskId)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Sub‑task deleted', task: updated });
  } catch (error) {
    console.error('❌ Delete sub‑task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// MARK MAIN TASK AS COMPLETED (Assignee only)
// PATCH /api/tasks/:taskId/complete
// ─────────────────────────────────────────────────────────────────────
const markTaskCompleted = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { notes } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (task.assignee?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the assignee can mark the task as completed.',
      });
    }

    if (task.status !== 'ready_for_completion') {
      return res.status(400).json({
        success: false,
        message: 'All sub‑tasks must be confirmed before completing the task.',
      });
    }

    task.status = 'completed';
    task.completedBy = userId;
    task.completedAt = new Date();
    if (notes) task.completionNotes = notes;

    await task.save();

    const project = await Project.findById(task.project);
    const managerIds = project.projectManagers.map(pm => pm.toString());
    const ownerId = project.workspace.owner?._id ? project.workspace.owner._id.toString() : null;
    const recipients = [...managerIds];
    if (ownerId && !recipients.includes(ownerId)) recipients.push(ownerId);

    if (recipients.length > 0) {
      notifyUsers(recipients, {
        title: `Task completed: "${task.title}"`,
        body: `${req.user.name || 'Assignee'} marked task "${task.title}" as completed. Please confirm.`,
        data: { taskId: task._id.toString(), projectId: project._id.toString() },
        emailEventType: 'taskUpdate',
        emailHtml: `<p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>`,
      });
    }

    await updateProjectProgress(task.project);

    const updated = await Task.findById(taskId)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Task marked completed', task: updated });
  } catch (error) {
    console.error('❌ Mark task completed error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// CONFIRM TASK COMPLETION (PM/Owner only)
// PATCH /api/tasks/:taskId/confirm-completion
// ─────────────────────────────────────────────────────────────────────
const confirmTaskCompletion = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { feedback, finalHours, finalLinks, finalAttachments } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Task must be marked completed before confirmation.',
      });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can confirm task completion.',
      });
    }

    task.status = 'confirmed_completed';
    task.confirmedBy = userId;
    task.confirmedAt = new Date();
    if (feedback) task.completionFeedback = feedback;
    if (finalHours !== undefined) task.actualHours = finalHours;
    if (finalLinks) task.finalLinks = parseArrayField(finalLinks);
    if (finalAttachments) task.finalAttachments = parseArrayField(finalAttachments);

    await task.save();

    if (task.assignee) {
      notifyUsers(task.assignee.toString(), {
        title: `Task completion confirmed: "${task.title}"`,
        body: `Your task "${task.title}" has been confirmed as complete by ${req.user.name}.`,
        data: { taskId: task._id.toString(), projectId: project._id.toString() },
        emailEventType: 'taskUpdate',
      });
    }

    await updateProjectProgress(task.project);

    const updated = await Task.findById(taskId)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Task completion confirmed', task: updated });
  } catch (error) {
    console.error('❌ Confirm task completion error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET PROJECT TASKS
// GET /api/tasks/project/:projectId
// ─────────────────────────────────────────────────────────────────────
const getProjectTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { status, priority, assigneeId, taskType } = req.query;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const workspace = await Workspace.findById(project.workspace);
    const isOwner = isWorkspaceOwner(workspace, userId);
    const isPM = isProjectManager(project, userId);
    const isMember = isProjectMember(project, userId);

    if (!isOwner && !isPM && !isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const query = { project: projectId, isDeleted: false };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (taskType) query.taskType = taskType;

    if (isOwner || isPM) {
      if (assigneeId) query.assignee = assigneeId;
    } else {
      query.assignee = userId;
    }

    const tasks = await Task.find(query)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, tasks, count: tasks.length });
  } catch (error) {
    console.error('❌ Get project tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET MY TASKS
// GET /api/tasks/my-tasks
// ─────────────────────────────────────────────────────────────────────
const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, priority, workspaceId, projectId } = req.query;

    const query = { assignee: userId, isDeleted: false };
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

// ─────────────────────────────────────────────────────────────────────
// GET SINGLE TASK
// GET /api/tasks/:taskId
// ─────────────────────────────────────────────────────────────────────
const getTaskById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false })
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('completedBy', 'name email profile')
      .populate('confirmedBy', 'name email profile')
      .populate('rejectedBy', 'name email profile')
      .populate('comments.user', 'name email profile');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

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

// ─────────────────────────────────────────────────────────────────────
// DELETE TASK  (Owner / PM only)
// DELETE /api/tasks/:taskId
// ─────────────────────────────────────────────────────────────────────
const deleteTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can delete tasks.',
      });
    }

    const projectId = task.project;
    const assigneeId = task.assignee?.toString();

    task.isDeleted = true;
    await task.save();
    await Feedback.deleteMany({ task: taskId });

    for (const att of task.attachments || []) {
      if (att.publicId) {
        cloudinary.uploader.destroy(att.publicId).catch(() => {});
      }
    }

    await updateProjectProgress(projectId);

    if (assigneeId) {
      notifyUsers(assigneeId, {
        title: `Task deleted: "${task.title}"`,
        body: `The task "${task.title}" has been deleted from the project.`,
        data: { projectId: project._id.toString() },
        emailEventType: 'taskUpdate',
      });
    }

    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('❌ Delete task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// ADD COMMENT
// POST /api/tasks/:taskId/comments
// ─────────────────────────────────────────────────────────────────────
const addComment = async (req, res) => {
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
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canViewTask(workspace, project, userId, task)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    task.comments.push({ user: userId, comment: comment.trim(), mentions, attachments });
    await task.save();

    const validMentions = mentions.filter(mentionId =>
      project.teamMembers.some(tm => tm.user.toString() === mentionId && tm.status === 'active') ||
      project.projectManagers.some(pm => pm.toString() === mentionId) ||
      (task.assignee && task.assignee.toString() === mentionId)
    );
    if (validMentions.length > 0) {
      notifyUsers(validMentions, {
        title: `You were mentioned in a comment on "${task.title}"`,
        body: `${req.user.name || 'Someone'} mentioned you: ${comment.substring(0, 100)}`,
        data: { taskId: task._id.toString(), projectId: project._id.toString() },
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

// ─────────────────────────────────────────────────────────────────────
// GET TASK FEEDBACK
// GET /api/tasks/:taskId/feedback
// ─────────────────────────────────────────────────────────────────────
const getTaskFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { type } = req.query;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

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
// POST /api/tasks/reminders  (Controller – for manual trigger or cron)
// ─────────────────────────────────────────────────────────────────────
const sendTaskReminders = async (req, res) => {
  try {
    const count = await checkAndSendReminders();
    res.status(200).json({
      success: true,
      message: `Reminders sent for ${count} tasks/sub‑tasks.`,
      count,
    });
  } catch (error) {
    console.error('❌ Send reminders error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/tasks/:taskId/remind (Manual reminder – PM/Owner only)
// ─────────────────────────────────────────────────────────────────────
const sendManualReminder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { message } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false })
      .populate('assignee', 'name email');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can send manual reminders.',
      });
    }

    if (!task.assignee) {
      return res.status(400).json({
        success: false,
        message: 'This task has no assignee to remind.',
      });
    }

    const customMessage = message || 'Please check your task and complete it.';
    await notifyUsers(task.assignee._id, {
      title: `📢 Manual Reminder: Task "${task.title}"`,
      body: `${req.user.name} reminded you about the task "${task.title}". ${customMessage}`,
      data: { taskId: task._id.toString(), projectId: project._id.toString() },
      emailEventType: 'taskUpdate',
      emailHtml: `
        <h3>Task Reminder</h3>
        <p>Task: <strong>${task.title}</strong></p>
        <p>Project: ${project.name}</p>
        <p>Message: ${customMessage}</p>
        <p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>
      `,
    });

    res.status(200).json({
      success: true,
      message: `Manual reminder sent to ${task.assignee.name}.`,
    });
  } catch (error) {
    console.error('❌ Manual reminder error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────
export {
  createTask,
  updateTask,
  assignTask,
  addSubTask,
  updateSubTask,
  markSubTaskDone,
  confirmSubTask,
  rejectSubTask,
  deleteSubTask,
  markTaskCompleted,
  confirmTaskCompletion,
  getProjectTasks,
  getMyTasks,
  getTaskById,
  deleteTask,
  addComment,
  getTaskFeedback,
  sendTaskReminders,
  sendManualReminder,
  checkAndSendReminders,
};