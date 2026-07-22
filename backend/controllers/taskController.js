// controllers/taskController.js
import Task from '../models/taskModel.js';
import Project from '../models/projectModel.js';
import Workspace from '../models/workspaceModel.js';
import Feedback from '../models/feedbackModel.js';
import { v2 as cloudinary } from 'cloudinary';

// ── Notification service ──────────────────────────────────────────
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

// Parse a field that may arrive as JSON string (FormData) or real array
const parseArrayField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [value]; // fallback: single string
    }
  }
  return [];
};

// Normalize multer file objects into our attachment schema
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

// Ensure a user is an active member of the project team
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

// ── Recalculate project progress from CONFIRMED task progress ──
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

    const allDone = tasks.every((t) =>
      ['completed', 'cancelled'].includes(t.status)
    );

    if (project.status !== 'completed') {
      project.readyForCompletion = allDone;
      if (allDone) {
        project.status = 'in-progress';
      } else if (project.progress > 0 && project.status === 'planning') {
        project.status = 'in-progress';
      }
    }
  }

  await project.save();
};

// ─────────────────────────────────────────────────────────────────────
// NOTIFICATION HELPER
// ─────────────────────────────────────────────────────────────────────

async function notifyUsers(userIds, { title, body, data = {}, emailEventType = null, emailHtml = null }) {
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
}

// ─────────────────────────────────────────────────────────────────────
// CREATE TASK  (Owner / PM only)
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
      assigneeId,
      priority = 'medium',
      dueDate = null,
      estimatedHours = null,
      dependencies,
    } = req.body;

    const links = parseArrayField(req.body.links);
    const stages = parseArrayField(req.body.stages);
    const deps = parseArrayField(dependencies);

    if (!projectId || !title?.trim() || !assigneeId) {
      return res.status(400).json({
        success: false,
        message: 'projectId, title and assigneeId are required.',
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

    await ensureProjectMember(project, workspace, assigneeId);

    // ─── Attachments from files (multer) ─────────────────────────
    let attachments = normalizeAttachments(req.files?.attachments);
    if (!Array.isArray(attachments)) {
      console.warn('❌ attachments is not an array! Raw value:', req.body.attachments);
      attachments = [];
    }

    // ─── Normalize stages ────────────────────────────────────────
    const normalizedStages = stages.map((s, i) => ({
      name: typeof s === 'string' ? s : s.name,
      order: typeof s === 'string' ? i + 1 : s.order ?? i + 1,
    }));

    const task = await Task.create({
      project: projectId,
      workspace: project.workspace,
      title: title.trim(),
      description,
      detailedDescription,
      taskType,
      assignee: assigneeId,
      createdBy: userId,
      priority,
      dueDate,
      estimatedHours,
      dependencies: deps,
      links,
      attachments,
      stages: normalizedStages,
      status: 'pending',
      progress: 0,
      submittedProgress: 0,
    });

    // ── Notify assignee ─────────────────────────────────────────
    notifyUsers(assigneeId, {
      title: `New task assigned: "${task.title}"`,
      body: `You have been assigned a new task "${task.title}" in project "${project.name}".`,
      data: { taskId: task._id.toString(), projectId: project._id.toString() },
      emailEventType: 'taskAssignment',
      emailHtml: `
        <h3>New Task Assigned</h3>
        <p>Task: <strong>${task.title}</strong></p>
        <p>Project: ${project.name}</p>
        <p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>
      `,
    });

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
      .populate('approvedBy', 'name email profile')
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
// UPDATE TASK  (Owner / PM only)
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
      status,
      dueDate,
      estimatedHours,
      actualHours,
    } = req.body;

    const oldStatus = task.status;

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description;
    if (detailedDescription !== undefined) task.detailedDescription = detailedDescription;
    if (taskType !== undefined) task.taskType = taskType;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
    if (actualHours !== undefined) task.actualHours = actualHours;

    if (status !== undefined && !['completed'].includes(status)) {
      task.status = status;
    }

    if (req.body.links !== undefined) task.links = parseArrayField(req.body.links);
    if (req.body.dependencies !== undefined) {
      task.dependencies = parseArrayField(req.body.dependencies);
    }

    // Append new attachments from files (multer)
    if (req.files?.attachments) {
      let newAttachments = normalizeAttachments(req.files.attachments);
      if (!Array.isArray(newAttachments)) {
        console.warn('❌ attachments is not an array! Raw value:', req.body.attachments);
        newAttachments = [];
      }
      task.attachments.push(...newAttachments);
    }

    await task.save();

    // ── Notify assignee if status changed (and not completed, which is handled by review) ──
    if (status && status !== oldStatus && status !== 'completed') {
      notifyUsers(task.assignee.toString(), {
        title: `Task status updated: "${task.title}"`,
        body: `The task "${task.title}" status changed to "${status}".`,
        data: { taskId: task._id.toString(), projectId: project._id.toString() },
        emailEventType: 'taskUpdate',
      });
    }

    await updateProjectProgress(task.project);

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
    const assigneeId = task.assignee.toString();

    task.isDeleted = true;
    await task.save();
    await Feedback.deleteMany({ task: taskId });

    for (const att of task.attachments || []) {
      if (att.publicId) {
        cloudinary.uploader.destroy(att.publicId).catch(() => {});
      }
    }

    await updateProjectProgress(projectId);

    // ── Notify assignee about deletion ─────────────────────────
    notifyUsers(assigneeId, {
      title: `Task deleted: "${task.title}"`,
      body: `The task "${task.title}" has been deleted from the project.`,
      data: { projectId: project._id.toString() },
      emailEventType: 'taskUpdate',
    });

    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('❌ Delete task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// SUBMIT PROGRESS  (Assignee only)
// PATCH /api/tasks/:taskId/progress
// ─────────────────────────────────────────────────────────────────────
const updateTaskProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { progress, notes = '' } = req.body;
    const links = parseArrayField(req.body.links);

    // Safety net for attachments
    let attachments = normalizeAttachments(req.files?.attachments);
    if (!Array.isArray(attachments)) {
      console.warn('❌ attachments is not an array! Raw value:', req.body.attachments);
      attachments = [];
    }

    if (progress === undefined || progress === null || progress < 0 || progress > 100) {
      return res.status(400).json({
        success: false,
        message: 'Progress must be a number between 0 and 100.',
      });
    }

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (task.assignee?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the assignee can submit progress for this task.',
      });
    }

    if (task.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'This task is already completed.',
      });
    }

    // Create Feedback entry
    await Feedback.create({
      task: taskId,
      user: userId,
      type: 'progress_update',
      progress,
      notes,
      links,
      attachments,
    });

    // Update task status
    task.submittedProgress = progress;
    task.status = progress >= 100 ? 'review' : 'in-progress';
    await task.save();

    // ── Notify project managers about progress submission ──────
    const project = await Project.findById(task.project);
    const managerIds = project.projectManagers.map(pm => pm.toString());
    if (managerIds.length > 0) {
      notifyUsers(managerIds, {
        title: `Progress submitted for "${task.title}"`,
        body: `Assignee submitted progress of ${progress}% on task "${task.title}".`,
        data: { taskId: task._id.toString(), projectId: project._id.toString() },
        emailEventType: 'taskUpdate',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Progress submitted, awaiting review.',
      task,
      feedback, // feedback not returned due to scope but ok
    });
  } catch (error) {
    console.error('❌ Submit progress error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// REVIEW PROGRESS  (Owner / PM only)
// PATCH /api/tasks/:taskId/review
// ─────────────────────────────────────────────────────────────────────
const reviewTaskProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { approved, feedback: reviewFeedback = '', approvedProgress } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: '"approved" (boolean) is required.',
      });
    }

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can review progress.',
      });
    }

    if (approved) {
      const confirmed =
        approvedProgress !== undefined && approvedProgress !== null
          ? Math.min(100, Math.max(0, approvedProgress))
          : task.submittedProgress;

      task.progress = confirmed;
      task.submittedProgress = confirmed;
      task.approved = true;
      task.approvedBy = userId;
      task.approvedAt = new Date();

      if (confirmed >= 100) {
        task.status = 'completed';
        task.completedAt = new Date();
        task.completedBy = task.assignee;
        task.completionFeedback = reviewFeedback;
        task.stages.forEach((s) => {
          if (!s.completed) {
            s.completed = true;
            s.completedAt = new Date();
            s.completedBy = userId;
          }
        });
      } else {
        task.status = confirmed > 0 ? 'in-progress' : 'pending';
      }

      await Feedback.create({
        task: taskId,
        user: userId,
        type: 'review',
        progress: confirmed,
        notes: reviewFeedback,
        approved: true,
        feedback: reviewFeedback,
        reviewedBy: userId,
        reviewedAt: new Date(),
      });
    } else {
      task.submittedProgress = task.progress;
      task.approved = false;
      if (task.status === 'review') {
        task.status = task.progress > 0 ? 'in-progress' : 'pending';
      }

      await Feedback.create({
        task: taskId,
        user: userId,
        type: 'review',
        progress: task.progress,
        notes: reviewFeedback,
        approved: false,
        feedback: reviewFeedback,
        reviewedBy: userId,
        reviewedAt: new Date(),
      });
    }

    await task.save();
    await updateProjectProgress(task.project);

    // ── Notify assignee about review decision ─────────────────
    const decision = approved ? 'approved' : 'rejected';
    notifyUsers(task.assignee.toString(), {
      title: `Progress ${decision} for "${task.title}"`,
      body: `Your submitted progress on task "${task.title}" has been ${decision}.`,
      data: { taskId: task._id.toString(), projectId: project._id.toString() },
      emailEventType: 'taskUpdate',
      emailHtml: `
        <h3>Task Progress ${decision.charAt(0).toUpperCase() + decision.slice(1)}</h3>
        <p>Task: <strong>${task.title}</strong></p>
        <p>Status: ${task.status}</p>
        <p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>
      `,
    });

    const updated = await Task.findById(taskId)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({
      success: true,
      message: approved ? 'Progress approved.' : 'Progress rejected.',
      task: updated,
    });
  } catch (error) {
    console.error('❌ Review progress error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// DAILY CHECK-IN  (Assignee only)
// POST /api/tasks/:taskId/daily-report
// ─────────────────────────────────────────────────────────────────────
const submitDailyReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { notes = '', progress } = req.body;
    const links = parseArrayField(req.body.links);
    const blocks = parseArrayField(req.body.blocks);

    // Safety net for attachments
    let attachments = normalizeAttachments(req.files?.attachments);
    if (!Array.isArray(attachments)) {
      console.warn('❌ attachments is not an array! Raw value:', req.body.attachments);
      attachments = [];
    }

    if (!notes.trim() && blocks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please describe what you worked on today.',
      });
    }

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (task.assignee?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the assignee can check in on this task.',
      });
    }

    const project = await Project.findById(task.project);

    const now = new Date();
    const [h, m] = (project.dailyReportTime || '17:00').split(':').map(Number);
    const cutoff = new Date(now);
    cutoff.setHours(h || 17, m || 0, 0, 0);
    const isLate = now > cutoff;

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    let report = await Feedback.findOne({
      task: taskId,
      user: userId,
      type: 'daily_report',
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    if (report) {
      report.notes = notes;
      report.links = links;
      report.blocks = blocks;
      report.attachments = attachments;
      report.isLate = report.isLate || isLate;
      if (progress !== undefined && progress !== null) report.progress = progress;
      await report.save();
    } else {
      report = await Feedback.create({
        task: taskId,
        user: userId,
        type: 'daily_report',
        progress: progress ?? task.submittedProgress,
        notes,
        links,
        blocks,
        attachments,
        isLate,
      });
    }

    if (progress !== undefined && progress !== null && task.status !== 'completed') {
      task.submittedProgress = progress;
      task.status = progress >= 100 ? 'review' : 'in-progress';
      await task.save();
    }

    // No notification for daily report (optional; could add later)

    res.status(report.createdAt >= startOfDay && report.updatedAt > report.createdAt ? 200 : 201).json({
      success: true,
      message: report.createdAt < startOfDay ? 'Daily report submitted.' : 'Daily report saved.',
      dailyReport: report,
      isLate: report.isLate,
    });
  } catch (error) {
    console.error('❌ Daily report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// REASSIGN TASK  (Owner / PM only)
// PATCH /api/tasks/:taskId/reassign
// ─────────────────────────────────────────────────────────────────────
const reassignTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { assigneeId, reason = '' } = req.body;

    if (!assigneeId) {
      return res.status(400).json({ success: false, message: 'assigneeId is required.' });
    }

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    if (!canManageTasks(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can reassign tasks.',
      });
    }

    await ensureProjectMember(project, workspace, assigneeId);

    task.reassignmentHistory.push({
      from: task.assignee,
      to: assigneeId,
      reassignedBy: userId,
      reason,
    });
    task.assignee = assigneeId;
    task.submittedProgress = task.progress;
    if (task.status === 'review') {
      task.status = task.progress > 0 ? 'in-progress' : 'pending';
    }

    await task.save();

    // ── Notify new assignee ────────────────────────────────────
    notifyUsers(assigneeId, {
      title: `Task reassigned to you: "${task.title}"`,
      body: `You have been assigned the task "${task.title}". ${reason ? `Reason: ${reason}` : ''}`,
      data: { taskId: task._id.toString(), projectId: project._id.toString() },
      emailEventType: 'taskAssignment',
      emailHtml: `
        <h3>Task Reassigned</h3>
        <p>Task: <strong>${task.title}</strong></p>
        <p>Project: ${project.name}</p>
        <p><a href="${process.env.CLIENT_URL}/tasks/${task._id}">View Task</a></p>
      `,
    });

    const updated = await Task.findById(taskId)
      .populate('assignee', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Task reassigned', task: updated });
  } catch (error) {
    console.error('❌ Reassign task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// UPDATE TASK STAGE
// PATCH /api/tasks/:taskId/stage
// ─────────────────────────────────────────────────────────────────────
const updateTaskStage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { stageName, notes = '', actualHours } = req.body;

    const task = await Task.findOne({ _id: taskId, isDeleted: false });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const project = await Project.findById(task.project);
    const workspace = await Workspace.findById(project.workspace);

    const isAssignee = task.assignee?.toString() === userId;
    if (!isAssignee && !canManageTasks(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const stage = task.stages.find((s) => s.name === stageName);
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found.' });
    }

    stage.completed = true;
    stage.completedAt = new Date();
    stage.completedBy = userId;
    if (notes) stage.notes = notes;
    if (actualHours !== undefined) task.actualHours = actualHours;

    const next = task.stages
      .filter((s) => !s.completed)
      .sort((a, b) => a.order - b.order)[0];
    task.currentStage = next ? next.name : 'Done';

    await task.save();

    // Notification could be added for stage completion if desired, but omitted for brevity.

    res.status(200).json({ success: true, message: 'Stage updated', task });
  } catch (error) {
    console.error('❌ Update stage error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// APPROVE TASK COMPLETION  (Owner / PM)
// PATCH /api/tasks/:taskId/approve
// ─────────────────────────────────────────────────────────────────────
const approveTaskCompletion = async (req, res) => {
  req.body.approved = true;
  req.body.approvedProgress = 100;
  req.body.feedback = req.body.feedback || req.body.completionFeedback || '';
  if (req.body.finalHours !== undefined) {
    await Task.findByIdAndUpdate(req.params.taskId, {
      actualHours: req.body.finalHours,
      finalLinks: parseArrayField(req.body.finalLinks),
      finalAttachments: parseArrayField(req.body.finalAttachments),
    });
  }
  // Review progress will handle notification
  return reviewTaskProgress(req, res);
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

    // ── Notify mentioned users ─────────────────────────────────
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

    const updated = await Task.findById(taskId).populate(
      'comments.user',
      'name email profile'
    );

    res.status(201).json({
      success: true,
      message: 'Comment added',
      comments: updated.comments,
    });
  } catch (error) {
    console.error('❌ Add comment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET TASK FEEDBACK
// GET /api/tasks/:taskId/feedback?type=progress_update|daily_report|review
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

// ─── EXPORTS ──────────────────────────────────────────────────────────
export {
  createTask,
  getProjectTasks,
  getMyTasks,
  getTaskById,
  updateTask,
  deleteTask,
  updateTaskProgress,
  reviewTaskProgress,
  submitDailyReport,
  reassignTask,
  updateTaskStage,
  approveTaskCompletion,
  addComment,
  getTaskFeedback,
};