// controllers/projectController.js
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
  isWorkspaceOwner(workspace, userId) || isProjectManager(project, userId);

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
// CREATE PROJECT  (Workspace owner only)
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

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }
    if (!isWorkspaceOwner(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner can create projects.',
      });
    }

    // Uploaded files
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

    // Validate PMs against active workspace members
    const validPMs = [];
    for (const pmId of projectManagerIds) {
      const ok = workspace.members.some(
        (m) => m.user.toString() === pmId && m.status === 'active'
      );
      if (ok && !validPMs.includes(pmId)) validPMs.push(pmId);
    }

    // Validate team members (skip anyone already a PM)
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
      archivedBy: [],            // per‑user archive
      isTrash: false,
    });

    // ⛔ REMOVED: automatic creation of team chat
    // The project chat is no longer created automatically.

    // ── Notify all newly added members ────────────────────────
    const allNewMembers = [
      ...validPMs,
      ...validTeamMembers.map(tm => tm.user)
    ];
    if (allNewMembers.length > 0) {
      const projectName = project.name;
      notifyUsers(allNewMembers, {
        title: `Added to project "${projectName}"`,
        body: `You have been added to the project "${projectName}".`,
        data: { projectId: project._id.toString(), workspaceId },
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
// GET WORKSPACE PROJECTS  (respects personal archive & global trash)
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
    const isMember = workspace.members.some(
      (m) => m.user.toString() === userId && m.status === 'active'
    );
    if (!isOwner && !isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const query = { workspace: workspaceId };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (projectType) query.projectType = projectType;

    // Global trash filter – only owner can see trashed projects
    if (trash === 'true' && isOwner) {
      query.isTrash = true;
    } else if (trash !== 'true') {
      query.isTrash = { $ne: true };
    } else {
      // non-owner asking for trash – return empty array
      return res.status(200).json({ success: true, projects: [], count: 0 });
    }

    // Personal archive: if not explicitly asking for archived, exclude projects archived by this user
    if (archived === 'true') {
      query['archivedBy.user'] = userId;
    } else if (archived !== 'true' && !query.isTrash) {
      // Exclude projects that the user has archived (unless we're in trash view)
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { 'archivedBy.user': { $ne: userId } },
          { 'archivedBy.user': { $exists: false } },
          { archivedBy: { $size: 0 } }
        ]
      });
    }

    // Permissions: non-owners only see projects they belong to
    if (!isOwner) {
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
          : isProjectManager(project, userId)
          ? 'projectManager'
          : 'teamMember';
        obj.isArchivedForMe = project.archivedBy.some(a => a.user.toString() === userId);
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

    const workspace = await Workspace.findById(project.workspace);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    const isOwner = isWorkspaceOwner(workspace, userId);
    const isPM = isProjectManager(project, userId);
    const isMember = isProjectMember(project, userId);
    const isTaskAssignee = await Task.exists({
      project: projectId,
      assignee: userId,
      isDeleted: false,
    });

    if (!isOwner && !isPM && !isMember && !isTaskAssignee) {
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
          isTrash: { $ne: true }
        },
      },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          inProgressTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] },
          },
          reviewTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'review'] }, 1, 0] },
          },
          pendingTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
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
    obj.userRole = isOwner
      ? 'workspaceOwner'
      : isPM
      ? 'projectManager'
      : isMember
      ? 'teamMember'
      : 'taskAssignee';
    obj.taskStats = taskStats[0] || {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      reviewTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
    };
    obj.canManage = isOwner || isPM;
    obj.isArchivedForMe = populated.archivedBy.some(a => a.user.toString() === userId);

    res.status(200).json({ success: true, project: obj });
  } catch (error) {
    console.error('❌ Get project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// UPDATE PROJECT  (Owner / PM)
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
        message: 'Only the workspace owner or project managers can update projects.',
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
    } = req.body;

    if (req.body.status === 'completed') {
      return res.status(400).json({
        success: false,
        message:
          'Projects can only be completed via the confirm-completion endpoint once all tasks are done.',
      });
    }

    const oldStatus = project.status;

    // Files
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

    await project.save();

    // ── Notify if status changed (excluding completed) ─────────
    if (status && status !== oldStatus && status !== 'completed') {
      const recipients = [
        ...project.projectManagers.map(pm => pm.toString()),
        ...project.teamMembers
          .filter(tm => tm.status === 'active')
          .map(tm => tm.user.toString()),
      ];
      notifyUsers(recipients, {
        title: `Project "${project.name}" updated`,
        body: `Status changed to "${status}".`,
        data: { projectId: project._id.toString() },
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
// CONFIRM PROJECT COMPLETION  (Workspace OWNER only)
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
    if (!isWorkspaceOwner(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner can confirm project completion.',
      });
    }

    if (project.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'This project is already completed.',
      });
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

    // ── Notify all active members and PMs ─────────────────────
    const recipients = [
      ...project.projectManagers.map(pm => pm.toString()),
      ...project.teamMembers
        .filter(tm => tm.status === 'active')
        .map(tm => tm.user.toString()),
    ];
    notifyUsers(recipients, {
      title: `Project "${project.name}" completed`,
      body: 'All tasks have been finished. Great work!',
      data: { projectId: project._id.toString() },
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
// MANAGE PROJECT MANAGERS  (Workspace owner only)
// PATCH /api/projects/:projectId/managers  { action: 'add'|'remove', managerId }
// ─────────────────────────────────────────────────────────────────────

const manageProjectManagers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { action, managerId } = req.body;

    if (!action || !managerId) {
      return res.status(400).json({
        success: false,
        message: 'Action and managerId are required.',
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const workspace = await Workspace.findById(project.workspace);
    if (!isWorkspaceOwner(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner can manage project managers.',
      });
    }

    const isActiveMember = workspace.members.some(
      (m) => m.user.toString() === managerId && m.status === 'active'
    );
    if (!isActiveMember) {
      return res.status(400).json({
        success: false,
        message: 'User must be an active workspace member.',
      });
    }

    if (action === 'add') {
      if (project.projectManagers.some((pm) => pm.toString() === managerId)) {
        return res.status(400).json({
          success: false,
          message: 'User is already a project manager.',
        });
      }
      project.projectManagers.push(managerId);
      // Remove from teamMembers if present
      project.teamMembers = project.teamMembers.filter(
        (tm) => tm.user.toString() !== managerId
      );
    } else if (action === 'remove') {
      project.projectManagers = project.projectManagers.filter(
        (pm) => pm.toString() !== managerId
      );
    } else {
      return res.status(400).json({
        success: false,
        message: "Action must be 'add' or 'remove'.",
      });
    }

    await project.save();

    // ── Notify the manager if added ───────────────────────────
    if (action === 'add') {
      notifyUsers(managerId, {
        title: `New role in "${project.name}"`,
        body: 'You have been promoted to Project Manager.',
        data: { projectId: project._id.toString() },
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
// ADD TEAM MEMBER  (Owner / PM)
// POST /api/projects/:projectId/team  { userId, role? }
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
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can add team members.',
      });
    }

    const isActiveMember = workspace.members.some(
      (m) => m.user.toString() === memberId && m.status === 'active'
    );
    if (!isActiveMember) {
      return res.status(400).json({
        success: false,
        message: 'User must be an active workspace member.',
      });
    }

    const existing = project.teamMembers.find(
      (tm) => tm.user.toString() === memberId
    );
    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'User is already on the project team.',
        });
      }
      existing.status = 'active';
      existing.leftAt = null;
      existing.role = role;
    } else {
      project.teamMembers.push({ user: memberId, role, status: 'active' });
    }

    await project.save();

    // ── Notify the added member ───────────────────────────────
    notifyUsers(memberId, {
      title: `Added to project "${project.name}"`,
      body: `You are now a team member (${role}) in this project.`,
      data: { projectId: project._id.toString() },
      emailEventType: 'teamInvite',
    });

    const updated = await Project.findById(projectId).populate(
      'teamMembers.user',
      'name email profile'
    );

    res.status(200).json({ success: true, message: 'Team member added', project: updated });
  } catch (error) {
    console.error('❌ Add team member error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// REMOVE TEAM MEMBER  (Owner / PM)
// DELETE /api/projects/:projectId/team/:memberId
// ─────────────────────────────────────────────────────────────────────

const removeTeamMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, memberId } = req.params;

    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing memberId.',
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or project managers can remove team members.',
      });
    }

    // Block removal while the member still has open tasks
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
      return res.status(404).json({
        success: false,
        message: 'Member not found on this project.',
      });
    }

    member.status = 'removed';
    member.leftAt = new Date();
    await project.save();

    // ── Notify the removed member ─────────────────────────────
    notifyUsers(memberId, {
      title: `Removed from project "${project.name}"`,
      body: 'You have been removed from the project.',
      data: { projectId: project._id.toString() },
      emailEventType: 'projectUpdate',
    });

    res.status(200).json({ success: true, message: 'Team member removed' });
  } catch (error) {
    console.error('❌ Remove team member error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET PROJECT TEAM WITH TASKS  (Owner / PM)
// GET /api/projects/:projectId/team
// ─────────────────────────────────────────────────────────────────────

const getProjectTeamWithTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId).populate(
      'teamMembers.user',
      'name email profile'
    );
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

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
// GET / CREATE DM WITH A TEAM MEMBER  (Owner / PM)
// GET /api/projects/:projectId/dm/:userId
// ─────────────────────────────────────────────────────────────────────

const getTeamMemberDM = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, userId: targetId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

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
// PROJECT STATS  (Owner / PM)
// GET /api/projects/:projectId/stats
// ─────────────────────────────────────────────────────────────────────

const getProjectStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

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
    tasks.forEach((t) => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

    const now = new Date();
    const overdue = tasks.filter(
      (t) => t.dueDate && t.dueDate < now && !['completed', 'cancelled'].includes(t.status)
    );

    // Per-member breakdown
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
// PERSONAL ARCHIVE / UNARCHIVE (any project member)
// ─────────────────────────────────────────────────────────────────────

const archiveProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    const isOwner = isWorkspaceOwner(workspace, userId);
    const isPM = isProjectManager(project, userId);
    const isMember = isProjectMember(project, userId);
    if (!isOwner && !isPM && !isMember) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project.' });
    }

    const alreadyArchived = project.archivedBy.some(a => a.user.toString() === userId);
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

    const workspace = await Workspace.findById(project.workspace);
    const isOwner = isWorkspaceOwner(workspace, userId);
    const isPM = isProjectManager(project, userId);
    const isMember = isProjectMember(project, userId);
    if (!isOwner && !isPM && !isMember) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    project.archivedBy = project.archivedBy.filter(a => a.user.toString() !== userId);
    await project.save();

    res.status(200).json({ success: true, message: 'Project unarchived for you.' });
  } catch (error) {
    console.error('❌ Unarchive project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// DELETE PROJECT – Soft‑delete (workspace owner only)
// DELETE /api/projects/:projectId
// ─────────────────────────────────────────────────────────────────────

const deleteProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!isWorkspaceOwner(workspace, userId)) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner can delete projects.' });
    }

    // Move to trash (soft‑delete)
    project.isTrash = true;
    project.trashedAt = new Date();
    await project.save();

    const recipients = [
      ...project.projectManagers.map(pm => pm.toString()),
      ...project.teamMembers.filter(tm => tm.status === 'active').map(tm => tm.user.toString()),
    ];
    notifyUsers(recipients, {
      title: `Project "${project.name}" moved to trash`,
      body: 'The project has been moved to trash and will be permanently deleted after 30 days.',
      data: { workspaceId: workspace._id.toString() },
      emailEventType: 'projectUpdate',
    });

    res.status(200).json({ success: true, message: 'Project moved to trash.' });
  } catch (error) {
    console.error('❌ Delete project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// RESTORE PROJECT FROM TRASH (owner only)
// PATCH /api/projects/:projectId/restore
// ─────────────────────────────────────────────────────────────────────

const restoreProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!isWorkspaceOwner(workspace, userId)) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner can restore projects.' });
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

// ─────────────────────────────────────────────────────────────────────
// PERMANENTLY DELETE PROJECT (owner only)
// DELETE /api/projects/:projectId/permanent
// ─────────────────────────────────────────────────────────────────────

const permanentlyDeleteProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!isWorkspaceOwner(workspace, userId)) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner can permanently delete projects.' });
    }

    // Remove associated data
    const tasks = await Task.find({ project: projectId });
    const taskIds = tasks.map(t => t._id);
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

// ─────────────────────────────────────────────────────────────────────
// CRON: Auto‑purge projects in trash > 30 days
// ─────────────────────────────────────────────────────────────────────

const permanentlyDeleteOldTrashedProjects = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const projects = await Project.find({ isTrash: true, trashedAt: { $lte: thirtyDaysAgo } });

  for (const project of projects) {
    const tasks = await Task.find({ project: project._id });
    const taskIds = tasks.map(t => t._id);
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

// ─────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────

export {
  createProject,
  getWorkspaceProjects,
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
};