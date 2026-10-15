// controllers/projectController.js
import crypto from 'crypto';
import Project from '../models/projectModel.js';
import Task from '../models/taskModel.js';
import Folder from '../models/folderModel.js';
import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import { Chat } from '../models/messagingModel.js';
import Feedback from '../models/feedbackModel.js';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

const isWorkspaceOwner = (workspace, userId) =>
  workspace.owner?._id
    ? workspace.owner._id.toString() === userId
    : workspace.owner?.toString() === userId;

const canManageWorkspace = (workspace, userId) => {
  if (isWorkspaceOwner(workspace, userId)) return true;
  return workspace.members.some(
    (m) => m.user.toString() === userId && m.role === 'Admin' && m.status === 'active'
  );
};

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

const canManageProject = (workspace, project, userId) =>
  canManageWorkspace(workspace, userId) || isProjectManager(project, userId);

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

// ─── Color helpers ───────────────────────────────────────────────

const NAMED_COLORS = new Set([
  'red', 'blue', 'green', 'yellow', 'orange', 'purple',
  'pink', 'teal', 'indigo', 'gray', 'grey', 'slate',
  'emerald', 'rose', 'amber', 'cyan', 'violet',
]);

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const DEFAULT_PROJECT_COLOR = '#6366F1';

const sanitizeColor = (value, fallback = DEFAULT_PROJECT_COLOR) => {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (HEX_RE.test(v)) return v;
  if (NAMED_COLORS.has(v)) return v;
  return null;
};

// ─── Token generation ───────────────────────────────────────────

const generateShareToken = () => crypto.randomBytes(24).toString('hex');

// ─── Notification helper ────────────────────────────────────────

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
    }).catch((err) => console.error(`Notification to ${recipient} failed:`, err.message));
  }
}

// ─── Access resolver ────────────────────────────────────────────
//
// Returns a rich object describing what the caller can do.
// Used by getProjectById and by the sanitisation paths.

const resolveProjectAccess = async (project, userId, workspace = null) => {
  const ws = workspace || (await Workspace.findById(project.workspace));
  if (!ws) return { role: 'none', canManage: false, canAct: false, canView: false, workspace: null, collaborator: null };

  if (!userId) {
    return { role: 'anonymous', canManage: false, canAct: false, canView: false, workspace: ws, collaborator: null };
  }

  if (isWorkspaceOwner(ws, userId)) {
    return { role: 'workspaceOwner', canManage: true, canAct: true, canView: true, workspace: ws, collaborator: null };
  }

  const isAdmin = ws.members.some(
    (m) => m.user.toString() === userId && m.role === 'Admin' && m.status === 'active'
  );
  if (isAdmin) {
    return { role: 'workspaceAdmin', canManage: true, canAct: true, canView: true, workspace: ws, collaborator: null };
  }

  if (isProjectManager(project, userId)) {
    return { role: 'projectManager', canManage: true, canAct: true, canView: true, workspace: ws, collaborator: null };
  }

  if (isProjectMember(project, userId)) {
    return { role: 'teamMember', canManage: false, canAct: true, canView: true, workspace: ws, collaborator: null };
  }

  // Collaborator?
  const collab = (project.collaborators || []).find(
    (c) => c.userId && c.userId.toString() === userId && c.status === 'active'
  );
  if (collab) {
    const isEditor = collab.role === 'editor';
    return {
      role: isEditor ? 'collaboratorEditor' : 'collaboratorViewer',
      canManage: false,
      // Editors can ONLY act on tasks where they are assignees — enforced in taskController
      canAct: isEditor,
      canView: true,
      workspace: ws,
      collaborator: collab,
    };
  }

  // Task assignee fallback (rare, but the existing code had it)
  const isTaskAssignee = await Task.exists({
    project: project._id,
    assignees: userId,
    isDeleted: false,
  });
  if (isTaskAssignee) {
    return { role: 'taskAssignee', canManage: false, canAct: true, canView: true, workspace: ws, collaborator: null };
  }

  return { role: 'none', canManage: false, canAct: false, canView: false, workspace: ws, collaborator: null };
};

// ─── Public-safe sanitisation ───────────────────────────────────

const sanitizeTaskForPublic = (task) => {
  const obj = typeof task.toObject === 'function' ? task.toObject() : task;
  return {
    _id: obj._id,
    title: obj.title,
    description: obj.description,
    status: obj.status,
    priority: obj.priority,
    startDate: obj.startDate,
    dueDate: obj.dueDate,
    progress: obj.progress,
    taskType: obj.taskType,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    assignees: (obj.assignees || []).map((a) => ({
      _id: a._id || a,
      name: a.name || null,
      profile: a.profile || '',
    })),
    subTasks: (obj.subTasks || []).map((st) => ({
      _id: st._id,
      title: st.title,
      status: st.status,
      dueDate: st.dueDate,
    })),
  };
};

const sanitizeProjectForPublic = (project, mode) => {
  const obj = typeof project.toObject === 'function' ? project.toObject() : project;
  return {
    _id: obj._id,
    name: obj.name,
    description: obj.description,
    detailedDescription: obj.detailedDescription,
    coverImage: obj.coverImage,
    color: obj.color,
    status: obj.status,
    progress: obj.progress,
    priority: obj.priority,
    projectType: obj.projectType,
    startDate: obj.startDate,
    endDate: obj.endDate,
    tags: obj.tags,
    links: obj.links,
    mode, // 'public' | 'collaborator'
    projectManagers: (obj.projectManagers || []).map((pm) => ({
      _id: pm._id || pm,
      name: pm.name || null,
      profile: pm.profile || '',
    })),
    teamMembers: (obj.teamMembers || []).map((tm) => ({
      user: {
        _id: tm.user?._id || tm.user,
        name: tm.user?.name || null,
        profile: tm.user?.profile || '',
      },
      role: tm.role,
      status: tm.status,
    })),
  };
};

// ─────────────────────────────────────────────────────────────────────
// CREATE PROJECT
// POST /api/projects?workspaceId=xxx
// ─────────────────────────────────────────────────────────────────────

const createProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const workspaceId = req.query.workspaceId || req.body.workspaceId;

    const {
      name,
      description = '',
      detailedDescription = '',
      priority = 'medium',
      projectType = 'general',
      dailyReportTime = '17:00',
      startDate = new Date(),
      endDate = null,
      color = DEFAULT_PROJECT_COLOR,
    } = req.body;

    const links = parseArrayField(req.body.links);
    const tags = parseArrayField(req.body.tags);
    const projectManagerIds = parseArrayField(req.body.projectManagerIds);
    const teamMemberIds = parseArrayField(req.body.teamMemberIds);

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace ID is required.' });
    }
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Project name is required.' });
    }

    const safeColor = sanitizeColor(color);
    if (safeColor === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid color. Use a hex code like #3B82F6 or a supported named color.',
      });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or admins can create projects.',
      });
    }

    const documents = [];
    if (req.files?.documents) {
      for (const file of req.files.documents) {
        documents.push({
          name: file.originalname,
          url: file.path,
          publicId: file.filename || file.public_id,
          size: file.size,
        });
      }
    }
    const coverImage = req.files?.coverImage?.[0]?.path || '';

    const validPMs = [];
    for (const pmId of projectManagerIds) {
      const ok = workspace.members.some(
        (m) => m.user.toString() === pmId && m.status === 'active'
      );
      if (ok && !validPMs.includes(pmId)) validPMs.push(pmId);
    }

    if (!validPMs.includes(userId)) validPMs.push(userId);

    const validTeamMembers = [];
    for (const memberId of teamMemberIds) {
      const ok = workspace.members.some(
        (m) => m.user.toString() === memberId && m.status === 'active'
      );
      const dupe =
        validPMs.includes(memberId) ||
        validTeamMembers.some((tm) => tm.user.toString() === memberId);
      if (ok && !dupe) {
        validTeamMembers.push({
          user: memberId,
          role: 'member',
          status: 'active',
          joinedAt: new Date(),
        });
      }
    }

    const project = await Project.create({
      workspace: workspaceId,
      name: name.trim(),
      description: description?.trim() || '',
      detailedDescription,
      links,
      documents,
      coverImage,
      createdBy: userId,
      projectManagers: validPMs,
      teamMembers: validTeamMembers,
      startDate,
      endDate,
      priority,
      status: 'planning',
      progress: 0,
      dailyReportTime,
      projectType,
      tags,
      color: safeColor,
      archivedBy: [],
      isTrash: false,
      collaborators: [],
      publicShareEnabled: false,
      publicShareToken: null,
    });

    const allNewMembers = [
      ...validPMs,
      ...validTeamMembers.map((tm) => tm.user),
    ].filter((id) => id.toString() !== userId);

    if (allNewMembers.length > 0) {
      const projectName = project.name;
      notifyUsers(allNewMembers, {
        title: `Added to project "${projectName}"`,
        body: `You have been added to the project "${projectName}".`,
        data: {
          notificationType: 'project',
          projectId: project._id.toString(),
          workspaceId: workspaceId.toString(),
        },
        emailEventType: 'teamInvite',
        emailHtml: `
          <h3>You've been added to a new project</h3>
          <p>You are now a member of <strong>${projectName}</strong>.</p>
          <p><a href="${process.env.CLIENT_URL}/projects/${project._id}">Open Project</a></p>
        `,
      });
    }

    const populated = await Project.findById(project._id)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project: populated,
    });
  } catch (error) {
    console.error('❌ Create project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET WORKSPACE PROJECTS
// GET /api/projects/workspace/:workspaceId
// ─────────────────────────────────────────────────────────────────────

const getWorkspaceProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { status, priority, projectType, archived, trash } = req.query;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    const isOwner = isWorkspaceOwner(workspace, userId);
    const isAdmin = workspace.members.some(
      (m) => m.user.toString() === userId && m.role === 'Admin' && m.status === 'active'
    );
    const isMember = workspace.members.some(
      (m) => m.user.toString() === userId && m.status === 'active'
    );
    if (!isOwner && !isAdmin && !isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const query = { workspace: workspaceId };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (projectType) query.projectType = projectType;

    if (trash === 'true' && (isOwner || isAdmin)) {
      query.isTrash = true;
    } else if (trash !== 'true') {
      query.isTrash = { $ne: true };
    } else {
      return res.status(200).json({ success: true, projects: [], count: 0 });
    }

    if (archived === 'true') {
      query['archivedBy.user'] = userId;
    } else if (archived !== 'true' && !query.isTrash) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { 'archivedBy.user': { $ne: userId } },
          { 'archivedBy.user': { $exists: false } },
          { archivedBy: { $size: 0 } },
        ],
      });
    }

    if (!isOwner && !isAdmin) {
      query.$or = [
        { projectManagers: userId },
        { teamMembers: { $elemMatch: { user: userId, status: 'active' } } },
      ];
    }

    const projects = await Project.find(query)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('createdBy', 'name email profile')
      .sort({ createdAt: -1 });

    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const taskCounts = await Task.aggregate([
          { $match: { project: project._id, isDeleted: false, isTrash: { $ne: true } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        const stats = { total: 0, completed: 0, inProgress: 0, pending: 0, review: 0 };
        taskCounts.forEach((item) => {
          stats.total += item.count;
          if (item._id === 'completed') stats.completed = item.count;
          else if (item._id === 'in-progress') stats.inProgress = item.count;
          else if (item._id === 'review') stats.review = item.count;
          else if (item._id !== 'cancelled') stats.pending += item.count;
        });

        const obj = project.toObject();
        obj.taskStats = stats;
        obj.userRole = isOwner
          ? 'workspaceOwner'
          : isAdmin
          ? 'workspaceAdmin'
          : isProjectManager(project, userId)
          ? 'projectManager'
          : 'teamMember';
        obj.isArchivedForMe = project.archivedBy.some((a) => a.user.toString() === userId);
        return obj;
      })
    );

    res.status(200).json({
      success: true,
      projects: projectsWithStats,
      count: projects.length,
    });
  } catch (error) {
    console.error('❌ Get workspace projects error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET MY COLLABORATED PROJECTS (projects where I am an active collaborator)
// GET /api/projects/collaborating
// ─────────────────────────────────────────────────────────────────────

const getMyCollaboratedProjects = async (req, res) => {
  try {
    const userId = req.user.id;

    const projects = await Project.find({
      isTrash: { $ne: true },
      collaborators: {
        $elemMatch: { userId, status: 'active' },
      },
    })
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('createdBy', 'name email profile')
      .sort({ createdAt: -1 });

    const shaped = projects.map((p) => {
      const obj = p.toObject();
      const collab = (p.collaborators || []).find(
        (c) => c.userId && c.userId.toString() === userId
      );
      obj.userRole = collab?.role === 'editor' ? 'collaboratorEditor' : 'collaboratorViewer';
      obj.collaboratorRole = collab?.role || 'viewer';
      return obj;
    });

    res.status(200).json({ success: true, projects: shaped, count: shaped.length });
  } catch (error) {
    console.error('❌ Get collaborated projects error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET SINGLE PROJECT
// GET /api/projects/:projectId
// ─────────────────────────────────────────────────────────────────────

const getProjectById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const access = await resolveProjectAccess(project, userId);
    if (!access.canView) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const populated = await Project.findById(projectId)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('completedBy', 'name email profile');

    const taskStats = await Task.aggregate([
      {
        $match: {
          project: new mongoose.Types.ObjectId(projectId),
          isDeleted: false,
          isTrash: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          inProgressTasks: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
          reviewTasks: { $sum: { $cond: [{ $eq: ['$status', 'review'] }, 1, 0] } },
          pendingTasks: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          overdueTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: [{ $in: ['$status', ['completed', 'cancelled']] }] },
                    { $lt: ['$dueDate', new Date()] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const obj = populated.toObject();
    obj.userRole = access.role;
    obj.taskStats = taskStats[0] || {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      reviewTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
    };
    obj.canManage = access.canManage;
    obj.access = {
      role: access.role,
      canManage: access.canManage,
      canAct: access.canAct,
      canView: access.canView,
      canCompleteAssignedTasks: access.canAct,
      collaboratorRole: access.collaborator?.role || null,
    };
    obj.isArchivedForMe = populated.archivedBy.some((a) => a.user.toString() === userId);

    // Collaborators shouldn't see the full collaborator list (privacy)
    if (access.role.startsWith('collaborator') || access.role === 'taskAssignee') {
      delete obj.collaborators;
      delete obj.publicShareToken;
    }

    res.status(200).json({ success: true, project: obj });
  } catch (error) {
    console.error('❌ Get project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// UPDATE PROJECT
// PUT /api/projects/:projectId
// ─────────────────────────────────────────────────────────────────────

const updateProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner, admins, or project managers can update projects.',
      });
    }

    const {
      name,
      description,
      detailedDescription,
      startDate,
      endDate,
      priority,
      status,
      dailyReportTime,
      projectType,
      color,
    } = req.body;

    if (req.body.status === 'completed') {
      return res.status(400).json({
        success: false,
        message:
          'Projects can only be completed via the confirm-completion endpoint once all tasks are done.',
      });
    }

    const oldStatus = project.status;

    if (req.files?.documents) {
      for (const file of req.files.documents) {
        project.documents.push({
          name: file.originalname,
          url: file.path,
          publicId: file.filename || file.public_id,
          size: file.size,
        });
      }
    }
    if (req.files?.coverImage) {
      project.coverImage = req.files.coverImage[0].path;
    }

    if (name !== undefined) project.name = name.trim();
    if (description !== undefined) project.description = description?.trim() || '';
    if (detailedDescription !== undefined) project.detailedDescription = detailedDescription;
    if (req.body.links !== undefined) project.links = parseArrayField(req.body.links);
    if (req.body.tags !== undefined) project.tags = parseArrayField(req.body.tags);
    if (startDate !== undefined) project.startDate = startDate;
    if (endDate !== undefined) project.endDate = endDate;
    if (priority !== undefined) project.priority = priority;
    if (status !== undefined) project.status = status;
    if (dailyReportTime !== undefined) project.dailyReportTime = dailyReportTime;
    if (projectType !== undefined) project.projectType = projectType;

    if (color !== undefined) {
      const safeColor = sanitizeColor(color, project.color);
      if (safeColor === null) {
        return res.status(400).json({
          success: false,
          message: 'Invalid color. Use a hex code like #3B82F6 or a supported named color.',
        });
      }
      project.color = safeColor;
    }

    await project.save();

    if (status && status !== oldStatus && status !== 'completed') {
      const recipients = [
        ...project.projectManagers.map((pm) => pm.toString()),
        ...project.teamMembers
          .filter((tm) => tm.status === 'active')
          .map((tm) => tm.user.toString()),
        ...project.collaborators
          .filter((c) => c.status === 'active' && c.userId)
          .map((c) => c.userId.toString()),
      ];
      notifyUsers(recipients, {
        title: `Project "${project.name}" updated`,
        body: `Status changed to "${status}".`,
        data: {
          notificationType: 'project',
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'projectUpdate',
      });
    }

    const updated = await Project.findById(projectId)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      project: updated,
    });
  } catch (error) {
    console.error('❌ Update project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// CONFIRM PROJECT COMPLETION
// PATCH /api/projects/:projectId/confirm-completion
// ─────────────────────────────────────────────────────────────────────

const confirmProjectCompletion = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or admins can confirm project completion.',
      });
    }

    if (project.status === 'completed') {
      return res.status(400).json({ success: false, message: 'This project is already completed.' });
    }

    const incompleteTasks = await Task.find({
      project: projectId,
      isDeleted: false,
      isTrash: { $ne: true },
      status: { $nin: ['completed', 'cancelled'] },
    }).select('title status progress assignee');

    if (incompleteTasks.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${incompleteTasks.length} task(s) are not completed yet.`,
        incompleteTasks,
      });
    }

    project.status = 'completed';
    project.progress = 100;
    project.readyForCompletion = false;
    project.completedAt = new Date();
    project.completedBy = userId;
    await project.save();

    const recipients = [
      ...project.projectManagers.map((pm) => pm.toString()),
      ...project.teamMembers.filter((tm) => tm.status === 'active').map((tm) => tm.user.toString()),
      ...project.collaborators.filter((c) => c.status === 'active' && c.userId).map((c) => c.userId.toString()),
    ];
    notifyUsers(recipients, {
      title: `Project "${project.name}" completed`,
      body: 'All tasks have been finished. Great work!',
      data: {
        notificationType: 'project',
        projectId: project._id.toString(),
        workspaceId: project.workspace.toString(),
      },
      emailEventType: 'projectUpdate',
      emailHtml: `
        <h2>Project Completed 🎉</h2>
        <p><strong>${project.name}</strong> has been marked as completed.</p>
        <p>Congratulations to the whole team!</p>
      `,
    });

    const updated = await Project.findById(projectId)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('completedBy', 'name email profile');

    res.status(200).json({
      success: true,
      message: 'Project marked as completed. 🎉',
      project: updated,
    });
  } catch (error) {
    console.error('❌ Confirm project completion error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// MANAGE PROJECT MANAGERS
// PATCH /api/projects/:projectId/managers
// ─────────────────────────────────────────────────────────────────────

const manageProjectManagers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { action, managerId } = req.body;

    if (!action || !managerId) {
      return res.status(400).json({ success: false, message: 'Action and managerId are required.' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or admins can manage project managers.',
      });
    }

    const isActiveMember = workspace.members.some(
      (m) => m.user.toString() === managerId && m.status === 'active'
    );
    if (!isActiveMember) {
      return res.status(400).json({ success: false, message: 'User must be an active workspace member.' });
    }

    if (action === 'add') {
      if (project.projectManagers.some((pm) => pm.toString() === managerId)) {
        return res.status(400).json({ success: false, message: 'User is already a project manager.' });
      }
      project.projectManagers.push(managerId);
      project.teamMembers = project.teamMembers.filter((tm) => tm.user.toString() !== managerId);
    } else if (action === 'remove') {
      project.projectManagers = project.projectManagers.filter((pm) => pm.toString() !== managerId);
    } else {
      return res.status(400).json({ success: false, message: "Action must be 'add' or 'remove'." });
    }

    await project.save();

    if (action === 'add') {
      notifyUsers(managerId, {
        title: `New role in "${project.name}"`,
        body: 'You have been promoted to Project Manager.',
        data: {
          notificationType: 'project',
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'teamInvite',
      });
    }

    const updated = await Project.findById(projectId)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile');

    res.status(200).json({ success: true, message: 'Project managers updated', project: updated });
  } catch (error) {
    console.error('❌ Manage project managers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// ADD TEAM MEMBER
// POST /api/projects/:projectId/team
// ─────────────────────────────────────────────────────────────────────

const addTeamMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { userId: memberId, role = 'member' } = req.body;

    if (!memberId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner, admins, or project managers can add team members.',
      });
    }

    const isActiveMember = workspace.members.some(
      (m) => m.user.toString() === memberId && m.status === 'active'
    );
    if (!isActiveMember) {
      return res.status(400).json({ success: false, message: 'User must be an active workspace member.' });
    }

    const existing = project.teamMembers.find((tm) => tm.user.toString() === memberId);
    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({ success: false, message: 'User is already on the project team.' });
      }
      existing.status = 'active';
      existing.leftAt = null;
      existing.role = role;
    } else {
      project.teamMembers.push({ user: memberId, role, status: 'active' });
    }

    await project.save();

    notifyUsers(memberId, {
      title: `Added to project "${project.name}"`,
      body: `You are now a team member (${role}) in this project.`,
      data: {
        notificationType: 'project',
        projectId: project._id.toString(),
        workspaceId: project.workspace.toString(),
      },
      emailEventType: 'teamInvite',
    });

    const updated = await Project.findById(projectId).populate('teamMembers.user', 'name email profile');

    res.status(200).json({ success: true, message: 'Team member added', project: updated });
  } catch (error) {
    console.error('❌ Add team member error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// REMOVE TEAM MEMBER
// DELETE /api/projects/:projectId/team/:memberId
// ─────────────────────────────────────────────────────────────────────

const removeTeamMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, memberId } = req.params;

    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing memberId.' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner, admins, or project managers can remove team members.',
      });
    }

    const openTasks = await Task.countDocuments({
      project: projectId,
      assignee: memberId,
      isDeleted: false,
      status: { $nin: ['completed', 'cancelled'] },
    });

    if (openTasks > 0) {
      return res.status(400).json({
        success: false,
        message: `This member still has ${openTasks} open task(s). Reassign them first.`,
      });
    }

    const member = project.teamMembers.find(
      (tm) => tm.user.toString() === memberId && tm.status === 'active'
    );

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found on this project.' });
    }

    member.status = 'removed';
    member.leftAt = new Date();
    await project.save();

    notifyUsers(memberId, {
      title: `Removed from project "${project.name}"`,
      body: 'You have been removed from the project.',
      data: {
        notificationType: 'workspace',
        workspaceId: project.workspace.toString(),
      },
      emailEventType: 'projectUpdate',
    });

    res.status(200).json({ success: true, message: 'Team member removed' });
  } catch (error) {
    console.error('❌ Remove team member error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET PROJECT TEAM WITH TASKS
// ─────────────────────────────────────────────────────────────────────

const getProjectTeamWithTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId).populate('teamMembers.user', 'name email profile');
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const activeMembers = project.teamMembers.filter((tm) => tm.status === 'active');

    const team = await Promise.all(
      activeMembers.map(async (tm) => {
        const tasks = await Task.find({
          project: projectId,
          assignee: tm.user._id,
          isDeleted: false,
          isTrash: { $ne: true },
        }).select('title status progress submittedProgress priority dueDate');

        return {
          user: tm.user,
          role: tm.role,
          joinedAt: tm.joinedAt,
          tasks,
          taskSummary: {
            total: tasks.length,
            completed: tasks.filter((t) => t.status === 'completed').length,
            inReview: tasks.filter((t) => t.status === 'review').length,
            open: tasks.filter((t) => !['completed', 'cancelled'].includes(t.status)).length,
          },
        };
      })
    );

    res.status(200).json({ success: true, team, count: team.length });
  } catch (error) {
    console.error('❌ Get project team error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET / CREATE DM WITH A TEAM MEMBER
// ─────────────────────────────────────────────────────────────────────

const getTeamMemberDM = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, userId: targetId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    let chat = await Chat.findOne({
      workspace: project.workspace,
      type: 'direct',
      'participants.user': { $all: [userId, targetId] },
    });

    if (!chat) {
      chat = await Chat.create({
        workspace: project.workspace,
        type: 'direct',
        participants: [
          { user: userId, role: 'member', joinedAt: new Date() },
          { user: targetId, role: 'member', joinedAt: new Date() },
        ],
        createdBy: userId,
        lastMessageAt: new Date(),
      });
    }

    res.status(200).json({ success: true, chat });
  } catch (error) {
    console.error('❌ Get team member DM error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// PROJECT STATS
// ─────────────────────────────────────────────────────────────────────

const getProjectStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const tasks = await Task.find({
      project: projectId,
      isDeleted: false,
      isTrash: { $ne: true },
    })
      .populate('assignee', 'name email profile')
      .select('title status progress submittedProgress priority dueDate assignee');

    const byStatus = { pending: 0, 'in-progress': 0, review: 0, completed: 0, cancelled: 0 };
    tasks.forEach((t) => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });

    const now = new Date();
    const overdue = tasks.filter(
      (t) => t.dueDate && t.dueDate < now && !['completed', 'cancelled'].includes(t.status)
    );

    const memberMap = {};
    tasks.forEach((t) => {
      if (!t.assignee) return;
      const id = t.assignee._id.toString();
      if (!memberMap[id]) {
        memberMap[id] = { user: t.assignee, total: 0, completed: 0, inReview: 0, overdue: 0 };
      }
      memberMap[id].total += 1;
      if (t.status === 'completed') memberMap[id].completed += 1;
      if (t.status === 'review') memberMap[id].inReview += 1;
      if (t.dueDate && t.dueDate < now && !['completed', 'cancelled'].includes(t.status)) {
        memberMap[id].overdue += 1;
      }
    });

    const allDone =
      tasks.length > 0 && tasks.every((t) => ['completed', 'cancelled'].includes(t.status));

    res.status(200).json({
      success: true,
      stats: {
        totalTasks: tasks.length,
        byStatus,
        overdueTasks: overdue.length,
        progress: project.progress,
        readyForCompletion: allDone && project.status !== 'completed',
        projectStatus: project.status,
        memberBreakdown: Object.values(memberMap),
      },
    });
  } catch (error) {
    console.error('❌ Get project stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// PERSONAL ARCHIVE / UNARCHIVE
// ─────────────────────────────────────────────────────────────────────

const archiveProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const access = await resolveProjectAccess(project, userId);
    if (!access.canView) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project.' });
    }

    const alreadyArchived = project.archivedBy.some((a) => a.user.toString() === userId);
    if (!alreadyArchived) {
      project.archivedBy.push({ user: userId, archivedAt: new Date() });
      await project.save();
    }

    res.status(200).json({ success: true, message: 'Project archived for you.' });
  } catch (error) {
    console.error('❌ Archive project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const unarchiveProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const access = await resolveProjectAccess(project, userId);
    if (!access.canView) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    project.archivedBy = project.archivedBy.filter((a) => a.user.toString() !== userId);
    await project.save();

    res.status(200).json({ success: true, message: 'Project unarchived for you.' });
  } catch (error) {
    console.error('❌ Unarchive project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// DELETE / RESTORE / PERMANENT DELETE
// ─────────────────────────────────────────────────────────────────────

const deleteProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or admins can delete projects.',
      });
    }

    project.isTrash = true;
    project.trashedAt = new Date();
    project.publicShareEnabled = false;
    await project.save();

    const recipients = [
      ...project.projectManagers.map((pm) => pm.toString()),
      ...project.teamMembers.filter((tm) => tm.status === 'active').map((tm) => tm.user.toString()),
      ...project.collaborators.filter((c) => c.status === 'active' && c.userId).map((c) => c.userId.toString()),
    ];
    notifyUsers(recipients, {
      title: `Project "${project.name}" moved to trash`,
      body: 'The project has been moved to trash and will be permanently deleted after 30 days.',
      data: {
        notificationType: 'workspace',
        workspaceId: workspace._id.toString(),
      },
      emailEventType: 'projectUpdate',
    });

    res.status(200).json({ success: true, message: 'Project moved to trash.' });
  } catch (error) {
    console.error('❌ Delete project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const restoreProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or admins can restore projects.',
      });
    }

    project.isTrash = false;
    project.trashedAt = null;
    await project.save();

    res.status(200).json({ success: true, message: 'Project restored.' });
  } catch (error) {
    console.error('❌ Restore project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const permanentlyDeleteProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or admins can permanently delete projects.',
      });
    }

    const tasks = await Task.find({ project: projectId });
    const taskIds = tasks.map((t) => t._id);
    await Feedback.deleteMany({ task: { $in: taskIds } });
    await Task.deleteMany({ project: projectId });
    await Folder.deleteMany({ project: projectId });

    for (const doc of project.documents || []) {
      if (doc.publicId) cloudinary.uploader.destroy(doc.publicId).catch(() => {});
    }

    await Project.findByIdAndDelete(projectId);

    res.status(200).json({ success: true, message: 'Project permanently deleted.' });
  } catch (error) {
    console.error('❌ Permanent delete project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const permanentlyDeleteOldTrashedProjects = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const projects = await Project.find({ isTrash: true, trashedAt: { $lte: thirtyDaysAgo } });

  for (const project of projects) {
    const tasks = await Task.find({ project: project._id });
    const taskIds = tasks.map((t) => t._id);
    await Feedback.deleteMany({ task: { $in: taskIds } });
    await Task.deleteMany({ project: project._id });
    await Folder.deleteMany({ project: project._id });

    for (const doc of project.documents || []) {
      if (doc.publicId) cloudinary.uploader.destroy(doc.publicId).catch(() => {});
    }
    await Project.findByIdAndDelete(project._id);
  }
  console.log(`🧹 Permanently deleted ${projects.length} trashed projects.`);
};

// ═════════════════════════════════════════════════════════════════════
// GUEST / COLLABORATOR MANAGEMENT
// ═════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────
// ENABLE PROJECT-WIDE READ-ONLY SHARE LINK
// POST /api/projects/:projectId/share-link
// ─────────────────────────────────────────────────────────────────────

const enableProjectShareLink = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    if (!project.publicShareToken) {
      project.publicShareToken = generateShareToken();
    }
    project.publicShareEnabled = true;
    await project.save();

    const url = `${process.env.CLIENT_URL}/public/project/${project.publicShareToken}`;

    res.status(200).json({
      success: true,
      message: 'Public share link enabled.',
      publicShareToken: project.publicShareToken,
      publicShareUrl: url,
    });
  } catch (error) {
    console.error('❌ Enable share link error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const disableProjectShareLink = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    project.publicShareEnabled = false;
    await project.save();

    res.status(200).json({ success: true, message: 'Public share link disabled.' });
  } catch (error) {
    console.error('❌ Disable share link error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// ADD COLLABORATOR
// POST /api/projects/:projectId/collaborators
// Body: { email, name?, role: 'viewer' | 'editor' }
// ─────────────────────────────────────────────────────────────────────

const addCollaborator = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { email, name = '', role = 'viewer' } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    if (!['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be 'viewer' or 'editor'." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    // Already a collaborator?
    const existing = (project.collaborators || []).find((c) => c.email === normalizedEmail);
    if (existing && existing.status !== 'revoked') {
      return res.status(400).json({
        success: false,
        message: 'This email is already a collaborator on this project.',
      });
    }

    // Does a Xircle account already exist for this email?
    const existingUser = await User.findOne({ email: normalizedEmail }).select('_id name');

    const inviteToken = generateShareToken();

    if (existing) {
      // Re-invite a previously revoked collaborator
      existing.name = name || existing.name;
      existing.role = role;
      existing.status = existingUser ? 'active' : 'invited';
      existing.inviteToken = inviteToken;
      existing.userId = existingUser?._id || null;
      existing.invitedBy = userId;
      existing.invitedAt = new Date();
      existing.acceptedAt = existingUser ? new Date() : null;
    } else {
      project.collaborators.push({
        email: normalizedEmail,
        name,
        role,
        userId: existingUser?._id || null,
        status: existingUser ? 'active' : 'invited',
        inviteToken,
        invitedBy: userId,
        invitedAt: new Date(),
        acceptedAt: existingUser ? new Date() : null,
      });
    }

    await project.save();

    const inviteUrl = `${process.env.CLIENT_URL}/collaborate/${inviteToken}`;

    // Notify the collaborator (email always; push only if they have an account)
    if (existingUser) {
      notifyUsers(existingUser._id, {
        title: `You've been invited to collaborate on "${project.name}"`,
        body: `You have ${role === 'editor' ? 'editor' : 'view-only'} access. Tasks assigned to you can be completed once you sign in.`,
        data: {
          notificationType: 'project',
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
          collaboratorInvite: 'true',
        },
        emailEventType: 'teamInvite',
        emailHtml: `
          <h3>You've been invited to collaborate</h3>
          <p>${req.user.name || 'A project manager'} invited you to <strong>${project.name}</strong> with <strong>${role}</strong> access.</p>
          <p><a href="${inviteUrl}">Open Project</a></p>
        `,
      });
    } else {
      // Send an email-only invite
      createAndSendNotification({
        recipient: null, // no user record
        emailTo: normalizedEmail,
        title: `You've been invited to collaborate on "${project.name}"`,
        body: 'Sign up for Xircle to participate.',
        sendPush: false,
        emailEventType: 'teamInvite',
        emailSubject: `Invitation to collaborate on ${project.name}`,
        emailHtml: `
          <h3>You've been invited to collaborate</h3>
          <p>${req.user.name || 'A project manager'} invited you to <strong>${project.name}</strong> with <strong>${role}</strong> access.</p>
          <p>You can view the project now, but you'll need a Xircle account to complete tasks assigned to you.</p>
          <p><a href="${inviteUrl}">Open Project</a></p>
        `,
      }).catch((err) => console.error('Collaborator invite email failed:', err.message));
    }

    res.status(201).json({
      success: true,
      message: existingUser
        ? 'Collaborator added and linked to their Xircle account.'
        : 'Invitation sent. They will appear as view-only until they sign up.',
      collaborator: project.collaborators.find((c) => c.email === normalizedEmail),
      inviteUrl,
    });
  } catch (error) {
    console.error('❌ Add collaborator error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// LIST COLLABORATORS
// GET /api/projects/:projectId/collaborators
// ─────────────────────────────────────────────────────────────────────

const getCollaborators = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate('collaborators.userId', 'name email profile')
      .populate('collaborators.invitedBy', 'name email profile');

    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({
      success: true,
      collaborators: project.collaborators,
      count: project.collaborators.length,
    });
  } catch (error) {
    console.error('❌ Get collaborators error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// UPDATE COLLABORATOR (role change)
// PATCH /api/projects/:projectId/collaborators/:collabId
// ─────────────────────────────────────────────────────────────────────

const updateCollaborator = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, collabId } = req.params;
    const { role, name } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const collab = project.collaborators.id(collabId);
    if (!collab) {
      return res.status(404).json({ success: false, message: 'Collaborator not found.' });
    }

    if (role && !['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be 'viewer' or 'editor'." });
    }

    if (role) collab.role = role;
    if (name !== undefined) collab.name = name;

    await project.save();

    res.status(200).json({ success: true, message: 'Collaborator updated.', collaborator: collab });
  } catch (error) {
    console.error('❌ Update collaborator error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// REMOVE COLLABORATOR
// DELETE /api/projects/:projectId/collaborators/:collabId
// ─────────────────────────────────────────────────────────────────────

const removeCollaborator = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, collabId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const collab = project.collaborators.id(collabId);
    if (!collab) {
      return res.status(404).json({ success: false, message: 'Collaborator not found.' });
    }

    // Block if they still have open tasks assigned
    if (collab.userId) {
      const openTasks = await Task.countDocuments({
        project: projectId,
        assignees: collab.userId,
        isDeleted: false,
        isTrash: { $ne: true },
        status: { $nin: ['completed', 'cancelled', 'confirmed_completed'] },
      });
      if (openTasks > 0) {
        return res.status(400).json({
          success: false,
          message: `This collaborator still has ${openTasks} open task(s). Reassign them first.`,
        });
      }
    }

    collab.status = 'revoked';
    collab.inviteToken = null;
    await project.save();

    res.status(200).json({ success: true, message: 'Collaborator removed.' });
  } catch (error) {
    console.error('❌ Remove collaborator error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// REGENERATE COLLABORATOR INVITE TOKEN
// POST /api/projects/:projectId/collaborators/:collabId/regenerate
// ─────────────────────────────────────────────────────────────────────

const regenerateCollaboratorToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, collabId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const collab = project.collaborators.id(collabId);
    if (!collab) {
      return res.status(404).json({ success: false, message: 'Collaborator not found.' });
    }

    collab.inviteToken = generateShareToken();
    await project.save();

    const inviteUrl = `${process.env.CLIENT_URL}/collaborate/${collab.inviteToken}`;
    res.status(200).json({ success: true, inviteUrl, inviteToken: collab.inviteToken });
  } catch (error) {
    console.error('❌ Regenerate collaborator token error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// PUBLIC: GET PROJECT BY SHARE OR INVITE TOKEN
// GET /api/projects/public/:token
// NO auth middleware required; pass-through optional auth to know req.user.
// ─────────────────────────────────────────────────────────────────────

const getPublicProjectByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user?.id || null;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required.' });
    }

    // Try project-wide token first
    let project = await Project.findOne({
      publicShareToken: token,
      publicShareEnabled: true,
      isTrash: { $ne: true },
    });

    let mode = 'public';
    let collaborator = null;

    // If not, try collaborator invite token
    if (!project) {
      project = await Project.findOne({
        'collaborators.inviteToken': token,
        isTrash: { $ne: true },
      });
      if (project) {
        collaborator = project.collaborators.find((c) => c.inviteToken === token);
        if (collaborator && collaborator.status === 'revoked') {
          return res.status(410).json({ success: false, message: 'This invite has been revoked.' });
        }
        mode = 'collaborator';
      }
    }

    if (!project) {
      return res.status(404).json({ success: false, message: 'Invalid or expired link.' });
    }

    await project.populate([
      { path: 'projectManagers', select: 'name email profile' },
      { path: 'teamMembers.user', select: 'name email profile' },
      { path: 'createdBy', select: 'name email profile' },
    ]);

    // Determine permissions
    const linkedUser =
      collaborator && userId && collaborator.userId?.toString() === userId;

    const access = await resolveProjectAccess(project, userId);

    const permissions = {
      canView: true,
      canActOnAssignedTasks: !!linkedUser && collaborator.role === 'editor',
      canComment: !!linkedUser && collaborator.role === 'editor',
      requiresSignup: !userId && mode === 'collaborator',
      role: collaborator?.role || 'viewer',
    };

    const payload = {
      success: true,
      mode,
      permissions,
      collaborator: collaborator
        ? {
            email: collaborator.email,
            name: collaborator.name,
            role: collaborator.role,
            status: collaborator.status,
            linkedToMe: !!linkedUser,
          }
        : null,
      project: sanitizeProjectForPublic(project, mode),
      // If caller happens to be a full member, surface that so the client
      // can jump into the normal flow:
      isFullMember: access.canView && access.role !== 'anonymous' && !access.role.startsWith('collaborator'),
    };

    res.status(200).json(payload);
  } catch (error) {
    console.error('❌ Public project fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// PUBLIC: GET TASKS FOR PROJECT BY TOKEN
// GET /api/projects/public/:token/tasks
// ─────────────────────────────────────────────────────────────────────

const getPublicProjectTasks = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user?.id || null;

    let project = await Project.findOne({
      publicShareToken: token,
      publicShareEnabled: true,
      isTrash: { $ne: true },
    });
    let collaborator = null;

    if (!project) {
      project = await Project.findOne({
        'collaborators.inviteToken': token,
        isTrash: { $ne: true },
      });
      if (project) {
        collaborator = project.collaborators.find((c) => c.inviteToken === token);
        if (collaborator?.status === 'revoked') {
          return res.status(410).json({ success: false, message: 'This invite has been revoked.' });
        }
      }
    }

    if (!project) {
      return res.status(404).json({ success: false, message: 'Invalid or expired link.' });
    }

    const linkedUser =
      collaborator && userId && collaborator.userId?.toString() === userId;

    const tasks = await Task.find({
      project: project._id,
      isDeleted: false,
      isTrash: { $ne: true },
      isArchived: { $ne: true },
    })
      .populate('assignees', 'name profile')
      .sort({ order: 1, createdAt: -1 });

    const sanitized = tasks.map((t) => {
      const s = sanitizeTaskForPublic(t);
      // Flag tasks the caller is allowed to complete (editor + assigned to them)
      s.assignedToMe =
        !!linkedUser &&
        collaborator.role === 'editor' &&
        (t.assignees || []).some((a) => (a._id || a).toString() === userId);
      return s;
    });

    res.status(200).json({ success: true, tasks: sanitized, count: sanitized.length });
  } catch (error) {
    console.error('❌ Public project tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// PUBLIC: GET SINGLE TASK BY TOKEN
// GET /api/projects/public/:token/tasks/:taskId
// ─────────────────────────────────────────────────────────────────────

const getPublicTaskById = async (req, res) => {
  try {
    const { token, taskId } = req.params;
    const userId = req.user?.id || null;

    let project = await Project.findOne({
      publicShareToken: token,
      publicShareEnabled: true,
      isTrash: { $ne: true },
    });
    let collaborator = null;

    if (!project) {
      project = await Project.findOne({
        'collaborators.inviteToken': token,
        isTrash: { $ne: true },
      });
      if (project) {
        collaborator = project.collaborators.find((c) => c.inviteToken === token);
        if (collaborator?.status === 'revoked') {
          return res.status(410).json({ success: false, message: 'This invite has been revoked.' });
        }
      }
    }

    if (!project) {
      return res.status(404).json({ success: false, message: 'Invalid or expired link.' });
    }

    const task = await Task.findOne({
      _id: taskId,
      project: project._id,
      isDeleted: false,
      isTrash: { $ne: true },
    }).populate('assignees', 'name profile');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const linkedUser =
      collaborator && userId && collaborator.userId?.toString() === userId;

    const sanitized = sanitizeTaskForPublic(task);
    sanitized.assignedToMe =
      !!linkedUser &&
      collaborator.role === 'editor' &&
      (task.assignees || []).some((a) => (a._id || a).toString() === userId);

    res.status(200).json({ success: true, task: sanitized });
  } catch (error) {
    console.error('❌ Public task fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────

export {
  createProject,
  getWorkspaceProjects,
  getMyCollaboratedProjects,
  getProjectById,
  updateProject,
  confirmProjectCompletion,
  manageProjectManagers,
  addTeamMember,
  removeTeamMember,
  getProjectTeamWithTasks,
  getTeamMemberDM,
  getProjectStats,
  archiveProject,
  unarchiveProject,
  deleteProject,
  restoreProject,
  permanentlyDeleteProject,
  permanentlyDeleteOldTrashedProjects,
  // ── Collaborators ──
  enableProjectShareLink,
  disableProjectShareLink,
  addCollaborator,
  getCollaborators,
  updateCollaborator,
  removeCollaborator,
  regenerateCollaboratorToken,
  // ── Public ──
  getPublicProjectByToken,
  getPublicProjectTasks,
  getPublicTaskById,
  // ── Access helper (re-exported so taskController can use it) ──
  resolveProjectAccess,
};