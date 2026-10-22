// controllers/projectController.js
import crypto from 'crypto';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import Project from '../models/projectModel.js';
import Task from '../models/taskModel.js';
import Folder from '../models/folderModel.js';
import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import { Chat } from '../models/messagingModel.js';
import Feedback from '../models/feedbackModel.js';
import { createAndSendNotification } from './notificationController.js';
import { sendAssociateInviteEmail } from '../utils/xircleMail.js';

// ═════════════════════════════════════════════════════════════════════
// BASIC HELPERS
// ═════════════════════════════════════════════════════════════════════

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
      const uid = m.user?._id ? m.user._id.toString() : m.user?.toString();
      return uid === userId && m.status === 'active';
    }) || null
  );
};

const isWorkspaceAdmin = (workspace, userId) => {
  const member = getWorkspaceMember(workspace, userId);
  if (!member) return false;
  // Associates never count as admins
  if (member.memberType === 'associate') return false;
  return member.role === 'Admin';
};

const isWorkspaceAssociate = (workspace, userId) => {
  const member = getWorkspaceMember(workspace, userId);
  return member?.memberType === 'associate';
};

const canManageWorkspace = (workspace, userId) =>
  isWorkspaceOwner(workspace, userId) || isWorkspaceAdmin(workspace, userId);

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

const getActiveAssociate = (project, userId) => {
  if (!userId || !project.associates) return null;
  return (
    project.associates.find((a) => {
      const aid = a.userId?._id ? a.userId._id.toString() : a.userId?.toString();
      return aid === userId && a.status === 'active';
    }) || null
  );
};

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

// ─── Color helpers ──────────────────────────────────────────────
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

// ─── Icon helpers ──────────────────────────────────────────────
// Icon keys are simple alphanumeric identifiers (e.g. "bookStack", "rocket").
// The frontend maps these to react-icons components and falls back to bookStack.
const DEFAULT_PROJECT_ICON = 'bookStack';
const ICON_KEY_RE = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;

const sanitizeIcon = (value, fallback = DEFAULT_PROJECT_ICON) => {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).trim();
  if (!ICON_KEY_RE.test(v)) return null;
  return v;
};

// ─── Token generation (public share ONLY) ───────────────────────
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

// ═════════════════════════════════════════════════════════════════════
// IDENTIFIER RESOLUTION
//
// Supported identifiers:
//   - Project ObjectId          → resolved as 'workspace' (may be
//                                 upgraded to 'public' later if the
//                                 caller has no relationship and the
//                                 project is public-shared)
//   - Public share token        → 'public' (permanent read-only link)
// ═════════════════════════════════════════════════════════════════════

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const resolveIdentifier = async (identifier) => {
  if (!identifier) return null;

  if (OBJECT_ID_RE.test(identifier)) {
    const project = await Project.findById(identifier);
    if (project) {
      const workspace = await Workspace.findById(project.workspace);
      return { project, workspace, mode: 'workspace' };
    }
  }

  const sharedProject = await Project.findOne({
    publicShareToken: identifier,
    publicShareEnabled: true,
    isTrash: { $ne: true },
  });
  if (sharedProject) {
    const workspace = await Workspace.findById(sharedProject.workspace);
    return { project: sharedProject, workspace, mode: 'public' };
  }

  return null;
};

// ═════════════════════════════════════════════════════════════════════
// PUBLIC-SHARE HELPERS
//
// The standard `/workspace/.../project/:id` route is shared by members
// and (optionally) the public. When an outsider hits it and the project
// has `publicShareEnabled === true`, we serve a read-only public view.
// ═════════════════════════════════════════════════════════════════════

/**
 * Does the caller have any meaningful relationship with this project?
 * Owner / admin / PM / member / active associate — anyone who should
 * see the full member-scoped view.
 */
const hasAnyProjectRelationship = (workspace, project, userId) => {
  if (!userId) return false;
  return (
    isWorkspaceOwner(workspace, userId) ||
    isWorkspaceAdmin(workspace, userId) ||
    isProjectManager(project, userId) ||
    isProjectMember(project, userId) ||
    !!getActiveAssociate(project, userId)
  );
};

/**
 * Effective mode for the current request.
 *   - token route resolves to 'public' → keep it
 *   - trash project → no public fallback
 *   - caller has a relationship → 'workspace'
 *   - caller is an outsider & project is public-shared → 'public'
 *   - otherwise → 'workspace' (viewer will reject with 403)
 */
const deriveEffectiveMode = (project, workspace, userId, fallbackMode) => {
  if (fallbackMode === 'public') return 'public';
  if (!project || project.isTrash) return 'workspace';
  if (hasAnyProjectRelationship(workspace, project, userId)) return 'workspace';
  if (project.publicShareEnabled) return 'public';
  return 'workspace';
};

// ═════════════════════════════════════════════════════════════════════
// VIEWER RESOLUTION
// ═════════════════════════════════════════════════════════════════════

const shapeUser = (u) => {
  if (!u) return null;
  if (typeof u === 'string') return { _id: u, name: null, profile: '' };
  return {
    _id: u._id || u,
    name: u.name || null,
    profile: u.profile || '',
  };
};

const shapeAssociate = (assoc, linkedToMe) => {
  if (!assoc) return null;
  return {
    _id: assoc._id,
    email: assoc.email,
    name: assoc.name,
    role: assoc.role,
    status: assoc.status,
    accessExpiresAt: assoc.accessExpiresAt || null,
    linkedToMe: !!linkedToMe,
  };
};

const fullWorkspaceViewer = (role) => ({
  role,
  canView: true,
  canViewInternal: true,
  canManage: true,
  canEdit: true,
  canAct: true,
  canComment: true,
  canViewAssociates: true,
  requiresSignup: false,
  associate: null,
});

const teamMemberViewer = () => ({
  role: 'teamMember',
  canView: true,
  canViewInternal: true,
  canManage: false,
  canEdit: false,
  canAct: true,
  canComment: true,
  canViewAssociates: false,
  requiresSignup: false,
  associate: null,
});

const associateViewer = (assoc) => {
  const isEditor = assoc?.role === 'editor';
  return {
    role: isEditor ? 'associateEditor' : 'associateViewer',
    canView: true,
    canViewInternal: false,
    canManage: false,
    canEdit: false,
    canAct: isEditor,
    canComment: isEditor,
    canViewAssociates: false,
    requiresSignup: false,
    associate: shapeAssociate(assoc, true),
  };
};

const publicViewer = () => ({
  role: 'publicViewer',
  canView: true,
  canViewInternal: false,
  canManage: false,
  canEdit: false,
  canAct: false,
  canComment: false,
  canViewAssociates: false,
  requiresSignup: false,
  associate: null,
});

const noAccessViewer = (role = 'none') => ({
  role,
  canView: false,
  canViewInternal: false,
  canManage: false,
  canEdit: false,
  canAct: false,
  canComment: false,
  canViewAssociates: false,
  requiresSignup: role === 'anonymous',
  associate: null,
});

const resolveViewer = (project, workspace, userId, mode) => {
  // ── ANONYMOUS ─────────────────────────────────────────────
  if (!userId) {
    if (mode === 'public') return publicViewer();
    return noAccessViewer('anonymous');
  }

  // ── WORKSPACE-LEVEL FULL CONTROL ──────────────────────────
  if (isWorkspaceOwner(workspace, userId)) return fullWorkspaceViewer('workspaceOwner');
  if (isWorkspaceAdmin(workspace, userId)) return fullWorkspaceViewer('workspaceAdmin');

  // ── PROJECT MANAGER (associate or permanent — same power) ─
  if (isProjectManager(project, userId)) return fullWorkspaceViewer('projectManager');

  // ── PERMANENT TEAM MEMBER ─────────────────────────────────
  if (isProjectMember(project, userId)) return teamMemberViewer();

  // ── PROJECT ASSOCIATE ─────────────────────────────────────
  const assoc = getActiveAssociate(project, userId);
  if (assoc) return associateViewer(assoc);

  // ── PUBLIC MODE (either token route, or standard route where
  //    the caller is an outsider and public sharing is on) ────
  if (mode === 'public') return publicViewer();

  // ── WORKSPACE MODE, NO RELATION ───────────────────────────
  return noAccessViewer('none');
};

// ═════════════════════════════════════════════════════════════════════
// SANITIZERS
// ═════════════════════════════════════════════════════════════════════

const sanitizeProject = (project, viewer) => {
  const obj = typeof project.toObject === 'function' ? project.toObject() : project;

  const base = {
    _id: obj._id,
    workspaceId: obj.workspace,
    name: obj.name,
    description: obj.description,
    detailedDescription: obj.detailedDescription,
    coverImage: obj.coverImage,
    color: obj.color,
    icon: obj.icon || DEFAULT_PROJECT_ICON,
    status: obj.status,
    progress: obj.progress,
    priority: obj.priority,
    projectType: obj.projectType,
    startDate: obj.startDate,
    endDate: obj.endDate,
    tags: obj.tags,
    links: obj.links,
    projectManagers: (obj.projectManagers || []).map(shapeUser),
    teamMembers: (obj.teamMembers || [])
      .filter((tm) => tm.status === 'active')
      .map((tm) => ({
        user: shapeUser(tm.user),
        role: tm.role,
        status: tm.status,
      })),
  };

  if (viewer.canViewInternal) {
    base.documents = obj.documents || [];
    base.dailyReportTime = obj.dailyReportTime;
    base.createdBy = shapeUser(obj.createdBy);
    base.completedBy = shapeUser(obj.completedBy);
    base.completedAt = obj.completedAt;
    base.readyForCompletion = obj.readyForCompletion;
  }

  if (viewer.canViewAssociates) {
    base.associates = (obj.associates || []).map((a) => shapeAssociate(a, false));
    base.publicShareEnabled = !!obj.publicShareEnabled;
    base.publicShareToken = obj.publicShareToken || null;
  }

  return base;
};

const sanitizeSubTask = (st, viewer, userId) => {
  const obj = typeof st.toObject === 'function' ? st.toObject() : st;
  const assigneeId = obj.assignee?._id || obj.assignee;
  const assignedToMe = !!userId && assigneeId && assigneeId.toString() === userId;

  const base = {
    _id: obj._id,
    title: obj.title,
    description: obj.description,
    status: obj.status,
    startDate: obj.startDate,
    dueDate: obj.dueDate,
    assignee: obj.assignee ? shapeUser(obj.assignee) : null,
    assignedToMe,
    order: obj.order,
  };

  if (viewer.canViewInternal) {
    base.attachments = obj.attachments || [];
    base.links = obj.links || [];
    base.notes = obj.notes;
    base.completedBy = shapeUser(obj.completedBy);
    base.completedAt = obj.completedAt;
    base.confirmedBy = shapeUser(obj.confirmedBy);
    base.confirmedAt = obj.confirmedAt;
    base.feedback = obj.feedback;
    base.recurrenceType = obj.recurrenceType;
    base.bufferTime = obj.bufferTime;
  }

  return base;
};

const sanitizeTask = (task, viewer, userId) => {
  const obj = typeof task.toObject === 'function' ? task.toObject() : task;

  const assignedToMe =
    !!userId &&
    (obj.assignees || []).some((a) => {
      const id = a._id ? a._id.toString() : a.toString();
      return id === userId;
    });

  const isDone = ['confirmed_completed', 'completed', 'cancelled'].includes(obj.status);

  const base = {
    _id: obj._id,
    project: obj.project,
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
    order: obj.order,
    assignees: (obj.assignees || []).map(shapeUser),
    subTasks: (obj.subTasks || []).map((st) => sanitizeSubTask(st, viewer, userId)),
    assignedToMe,
  };

  const canComplete =
    viewer.canManage || (viewer.canAct && assignedToMe && !isDone);

  base.access = {
    canManage: viewer.canManage,
    canComplete,
    canComment:
      viewer.canComment &&
      (viewer.canManage ||
        !viewer.role.startsWith('associate') ||
        assignedToMe),
    canAssignSubTasks: viewer.canManage || (viewer.canAct && assignedToMe),
  };

  if (viewer.canViewInternal) {
    base.folder = obj.folder;
    base.detailedDescription = obj.detailedDescription;
    base.dependencies = obj.dependencies || [];
    base.linkedNotes = obj.linkedNotes || [];
    base.attachments = obj.attachments || [];
    base.comments = obj.comments || [];
    base.completedBy = shapeUser(obj.completedBy);
    base.completedAt = obj.completedAt;
    base.confirmedBy = shapeUser(obj.confirmedBy);
    base.confirmedAt = obj.confirmedAt;
    base.completionNotes = obj.completionNotes;
    base.recurrenceType = obj.recurrenceType;
    base.syncToGoogleCalendar = obj.syncToGoogleCalendar;
    base.createdBy = shapeUser(obj.createdBy);
  }

  return base;
};

// ─── Legacy wrapper ─────────────────────────────────────────────
const resolveProjectAccess = async (project, userId, workspace = null) => {
  const ws = workspace || (await Workspace.findById(project.workspace));
  if (!ws) {
    return { role: 'none', canManage: false, canAct: false, canView: false, workspace: null, associate: null };
  }
  const viewer = resolveViewer(project, ws, userId, 'workspace');
  return {
    role: viewer.role,
    canManage: viewer.canManage,
    canAct: viewer.canAct,
    canView: viewer.canView,
    workspace: ws,
    associate: viewer.associate,
  };
};

// ─── Task stats helper ──────────────────────────────────────────
const computeTaskStats = async (projectId) => {
  const rows = await Task.aggregate([
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
        completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'confirmed_completed'] }, 1, 0] } },
        inProgressTasks: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
        reviewTasks: { $sum: { $cond: [{ $eq: ['$status', 'review'] }, 1, 0] } },
        pendingTasks: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        overdueTasks: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $not: [{ $in: ['$status', ['completed', 'cancelled', 'confirmed_completed']] }] },
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
  return rows[0] || {
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    reviewTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
  };
};

// ═════════════════════════════════════════════════════════════════════
// CREATE PROJECT
// POST /api/projects?workspaceId=xxx
// ═════════════════════════════════════════════════════════════════════
const createProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const workspaceId = req.query.workspaceId || req.body.workspaceId;
    const {
      name, description = '', detailedDescription = '',
      priority = 'medium', projectType = 'general',
      dailyReportTime = '17:00',
      startDate = new Date(), endDate = null,
      color = DEFAULT_PROJECT_COLOR,
      icon = DEFAULT_PROJECT_ICON,
    } = req.body;

    const links = parseArrayField(req.body.links);
    const tags = parseArrayField(req.body.tags);
    const projectManagerIds = parseArrayField(req.body.projectManagerIds);
    const teamMemberIds = parseArrayField(req.body.teamMemberIds);

    if (!workspaceId) return res.status(400).json({ success: false, message: 'Workspace ID is required.' });
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Project name is required.' });

    const safeColor = sanitizeColor(color);
    if (safeColor === null) {
      return res.status(400).json({ success: false, message: 'Invalid color. Use a hex code or named color.' });
    }

    const safeIcon = sanitizeIcon(icon);
    if (safeIcon === null) {
      return res.status(400).json({ success: false, message: 'Invalid icon.' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found.' });
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner or admins can create projects.' });
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
      const ok = workspace.members.some((m) => {
        const uid = m.user?._id ? m.user._id.toString() : m.user.toString();
        return uid === pmId && m.status === 'active';
      });
      if (ok && !validPMs.includes(pmId)) validPMs.push(pmId);
    }
    if (!validPMs.includes(userId)) validPMs.push(userId);

    const validTeamMembers = [];
    for (const memberId of teamMemberIds) {
      const ok = workspace.members.some((m) => {
        const uid = m.user?._id ? m.user._id.toString() : m.user.toString();
        return uid === memberId && m.status === 'active';
      });
      const dupe = validPMs.includes(memberId) || validTeamMembers.some((tm) => tm.user.toString() === memberId);
      if (ok && !dupe) {
        validTeamMembers.push({ user: memberId, role: 'member', status: 'active', joinedAt: new Date() });
      }
    }

    const project = await Project.create({
      workspace: workspaceId,
      name: name.trim(),
      description: description?.trim() || '',
      detailedDescription,
      links, documents, coverImage,
      createdBy: userId,
      projectManagers: validPMs,
      teamMembers: validTeamMembers,
      startDate, endDate, priority,
      status: 'planning',
      progress: 0,
      dailyReportTime, projectType, tags,
      color: safeColor,
      icon: safeIcon,
      archivedBy: [],
      isTrash: false,
      associates: [],
      publicShareEnabled: false,
      publicShareToken: null,
    });

    const allNewMembers = [...validPMs, ...validTeamMembers.map((tm) => tm.user)]
      .filter((id) => id.toString() !== userId);

    if (allNewMembers.length > 0) {
      notifyUsers(allNewMembers, {
        title: `Added to project "${project.name}"`,
        body: `You have been added to the project "${project.name}".`,
        data: { notificationType: 'project', projectId: project._id.toString(), workspaceId: workspaceId.toString() },
        emailEventType: 'teamInvite',
        emailHtml: `<h3>You've been added to a new project</h3><p>You are now a member of <strong>${project.name}</strong>.</p><p><a href="${process.env.CLIENT_URL}/p/${project._id}">Open Project</a></p>`,
      });
    }

    const populated = await Project.findById(project._id)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(201).json({ success: true, message: 'Project created successfully', project: populated });
  } catch (error) {
    console.error('❌ Create project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// GET WORKSPACE PROJECTS
// GET /api/projects/workspace/:workspaceId
// ═════════════════════════════════════════════════════════════════════
const getWorkspaceProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { status, priority, projectType, archived, trash } = req.query;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found.' });

    const isOwner = isWorkspaceOwner(workspace, userId);
    const isAdmin = isWorkspaceAdmin(workspace, userId);
    const member = getWorkspaceMember(workspace, userId);
    const isAssociate = member?.memberType === 'associate';
    const isPermanentMember = !!member && !isAssociate;

    if (!isOwner && !isAdmin && !member) {
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

    // Associates only see projects they're explicitly on.
    if (!isOwner && !isAdmin) {
      if (isAssociate) {
        query.$or = [
          { projectManagers: userId },
          { teamMembers: { $elemMatch: { user: userId, status: 'active' } } },
          { associates: { $elemMatch: { userId, status: 'active' } } },
        ];
      } else if (!isPermanentMember) {
        return res.status(200).json({ success: true, projects: [], count: 0 });
      } else {
        // Permanent members see everything in workspace
      }
    }

    const projects = await Project.find(query)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('createdBy', 'name email profile')
      .sort({ createdAt: -1 });

    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const rows = await Task.aggregate([
          { $match: { project: project._id, isDeleted: false, isTrash: { $ne: true } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        const stats = { total: 0, completed: 0, inProgress: 0, pending: 0, review: 0 };
        rows.forEach((item) => {
          stats.total += item.count;
          if (item._id === 'completed' || item._id === 'confirmed_completed') stats.completed += item.count;
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
          : isAssociate
          ? 'associate'
          : 'teamMember';
        obj.isArchivedForMe = (project.archivedBy || []).some(
          (a) => a.user.toString() === userId
        );
        return obj;
      })
    );

    res.status(200).json({ success: true, projects: projectsWithStats, count: projects.length });
  } catch (error) {
    console.error('❌ Get workspace projects error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// GET MY ASSOCIATE PROJECTS
// GET /api/projects/associating
// ═════════════════════════════════════════════════════════════════════
const getMyAssociateProjects = async (req, res) => {
  try {
    const userId = req.user.id;

    const projects = await Project.find({
      isTrash: { $ne: true },
      associates: { $elemMatch: { userId, status: 'active' } },
    })
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('createdBy', 'name email profile')
      .sort({ createdAt: -1 });

    const shaped = projects.map((p) => {
      const obj = p.toObject();
      const assoc = (p.associates || []).find(
        (a) => a.userId && a.userId.toString() === userId
      );
      const isPM = isProjectManager(p, userId);
      obj.userRole = isPM
        ? 'projectManager'
        : assoc?.role === 'editor'
        ? 'associateEditor'
        : 'associateViewer';
      obj.associateRole = assoc?.role || 'viewer';
      obj.isProjectManager = isPM;
      return obj;
    });

    res.status(200).json({ success: true, projects: shaped, count: shaped.length });
  } catch (error) {
    console.error('❌ Get associate projects error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// GET PROJECT
// GET /api/projects/:identifier
//
// Serves BOTH:
//   - workspace members (via ObjectId or token)
//   - public viewers (via token, OR via ObjectId when project is
//     public-shared and caller has no relationship)
// ═════════════════════════════════════════════════════════════════════
const getProject = async (req, res) => {
  try {
    const { identifier } = req.params;
    const userId = req.user?.id || null;

    if (!identifier) return res.status(400).json({ success: false, message: 'Identifier is required.' });

    const resolved = await resolveIdentifier(identifier);
    if (!resolved) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { project, workspace } = resolved;
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found.' });

    // ⬇ upgrade the mode to 'public' if an outsider hits the
    // standard route on a public-shared project.
    const mode = deriveEffectiveMode(project, workspace, userId, resolved.mode);

    if (project.isTrash) {
      const isOwner = isWorkspaceOwner(workspace, userId);
      const isAdmin = isWorkspaceAdmin(workspace, userId);
      if (!isOwner && !isAdmin) {
        return res.status(404).json({ success: false, message: 'Project not found.' });
      }
    }

    const viewer = resolveViewer(project, workspace, userId, mode);
    if (!viewer.canView) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await project.populate([
      { path: 'projectManagers', select: 'name email profile' },
      { path: 'teamMembers.user', select: 'name email profile' },
      { path: 'createdBy', select: 'name email profile' },
      { path: 'completedBy', select: 'name email profile' },
      { path: 'associates.userId', select: 'name email profile' },
      { path: 'associates.addedBy', select: 'name email profile' },
    ]);

    const taskStats = await computeTaskStats(project._id);

    const sanitized = sanitizeProject(project, viewer);
    sanitized.taskStats = taskStats;
    sanitized.userRole = viewer.role;
    sanitized.canManage = viewer.canManage;
    sanitized.isArchivedForMe = userId
      ? (project.archivedBy || []).some((a) => a.user.toString() === userId)
      : false;

    const isFullMember =
      viewer.canViewInternal &&
      !viewer.role.startsWith('associate') &&
      viewer.role !== 'publicViewer' &&
      viewer.role !== 'anonymous' &&
      viewer.role !== 'none';

    res.status(200).json({
      success: true,
      mode,
      project: sanitized,
      viewer: {
        role: viewer.role,
        canView: viewer.canView,
        canViewInternal: viewer.canViewInternal,
        canManage: viewer.canManage,
        canEdit: viewer.canEdit,
        canAct: viewer.canAct,
        canComment: viewer.canComment,
        canViewAssociates: viewer.canViewAssociates,
        requiresSignup: viewer.requiresSignup,
        associate: viewer.associate,
      },
      permissions: {
        canActOnAssignedTasks: viewer.canAct,
        canComment: viewer.canComment,
        requiresSignup: viewer.requiresSignup,
        role: viewer.associate?.role || 'viewer',
      },
      associate: viewer.associate,
      isFullMember,
    });
  } catch (error) {
    console.error('❌ Get project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// GET PROJECT TASKS
// GET /api/projects/:identifier/tasks
// ═════════════════════════════════════════════════════════════════════
const getProjectTasks = async (req, res) => {
  try {
    const { identifier } = req.params;
    const userId = req.user?.id || null;
    const { status, priority, taskType, folderId, archived } = req.query;

    const resolved = await resolveIdentifier(identifier);
    if (!resolved) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { project, workspace } = resolved;
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found.' });

    const mode = deriveEffectiveMode(project, workspace, userId, resolved.mode);

    const viewer = resolveViewer(project, workspace, userId, mode);
    if (!viewer.canView) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const query = { project: project._id, isDeleted: false };
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

    // Associates only see tasks assigned to them.
    // Public viewers see everything (read-only via viewer flags).
    if (viewer.role.startsWith('associate') && !viewer.canManage) {
      query.assignees = userId;
    }

    const tasks = await Task.find(query)
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('folder', 'name')
      .sort({ order: 1, createdAt: -1 });

    const sanitized = tasks.map((t) => sanitizeTask(t, viewer, userId));

    res.status(200).json({
      success: true,
      tasks: sanitized,
      count: sanitized.length,
      viewer: {
        role: viewer.role,
        canView: viewer.canView,
        canManage: viewer.canManage,
        canAct: viewer.canAct,
      },
    });
  } catch (error) {
    console.error('❌ Get project tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// GET SINGLE TASK
// GET /api/projects/:identifier/tasks/:taskId
// ═════════════════════════════════════════════════════════════════════
const getTask = async (req, res) => {
  try {
    const { identifier, taskId } = req.params;
    const userId = req.user?.id || null;

    const resolved = await resolveIdentifier(identifier);
    if (!resolved) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { project, workspace } = resolved;
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found.' });

    const mode = deriveEffectiveMode(project, workspace, userId, resolved.mode);

    const viewer = resolveViewer(project, workspace, userId, mode);
    if (!viewer.canView) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const task = await Task.findOne({
      _id: taskId,
      project: project._id,
      isDeleted: false,
    })
      .populate('assignees', 'name email profile')
      .populate('subTasks.assignee', 'name email profile')
      .populate('createdBy', 'name email profile')
      .populate('completedBy', 'name email profile')
      .populate('confirmedBy', 'name email profile')
      .populate('comments.user', 'name email profile')
      .populate('folder', 'name');

    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    // Associates only see tasks assigned to them
    if (viewer.role.startsWith('associate') && !viewer.canManage) {
      const assignedToMe = (task.assignees || []).some((a) => {
        const id = a._id ? a._id.toString() : a.toString();
        return id === userId;
      });
      if (!assignedToMe) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const sanitized = sanitizeTask(task, viewer, userId);

    res.status(200).json({
      success: true,
      task: sanitized,
      viewer: {
        role: viewer.role,
        canView: viewer.canView,
        canManage: viewer.canManage,
        canAct: viewer.canAct,
      },
    });
  } catch (error) {
    console.error('❌ Get task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// UPDATE PROJECT
// PUT /api/projects/:projectId
// ═════════════════════════════════════════════════════════════════════
const updateProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Only workspace owner, admins, or PMs can update projects.' });
    }

    const {
      name, description, detailedDescription, startDate, endDate,
      priority, status, dailyReportTime, projectType, color,
      icon,
    } = req.body;

    if (req.body.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Projects can only be completed via the confirm-completion endpoint once all tasks are done.',
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
    if (req.files?.coverImage) project.coverImage = req.files.coverImage[0].path;

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
        return res.status(400).json({ success: false, message: 'Invalid color.' });
      }
      project.color = safeColor;
    }

    if (icon !== undefined) {
      const safeIcon = sanitizeIcon(icon, project.icon || DEFAULT_PROJECT_ICON);
      if (safeIcon === null) {
        return res.status(400).json({ success: false, message: 'Invalid icon.' });
      }
      project.icon = safeIcon;
    }

    await project.save();

    if (status && status !== oldStatus && status !== 'completed') {
      const recipients = new Set();
      project.projectManagers.forEach((pm) => recipients.add(pm.toString()));
      project.teamMembers
        .filter((tm) => tm.status === 'active')
        .forEach((tm) => recipients.add(tm.user.toString()));
      (project.associates || [])
        .filter((a) => a.status === 'active' && a.userId)
        .forEach((a) => recipients.add(a.userId.toString()));

      notifyUsers(Array.from(recipients), {
        title: `Project "${project.name}" updated`,
        body: `Status changed to "${status}".`,
        data: { notificationType: 'project', projectId: project._id.toString(), workspaceId: project.workspace.toString() },
        emailEventType: 'projectUpdate',
      });
    }

    const updated = await Project.findById(projectId)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Project updated successfully', project: updated });
  } catch (error) {
    console.error('❌ Update project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// CONFIRM PROJECT COMPLETION
// PATCH /api/projects/:projectId/confirm-completion
// ═════════════════════════════════════════════════════════════════════
const confirmProjectCompletion = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner or admins can confirm project completion.' });
    }

    if (project.status === 'completed') {
      return res.status(400).json({ success: false, message: 'This project is already completed.' });
    }

    const incompleteTasks = await Task.find({
      project: projectId,
      isDeleted: false,
      isTrash: { $ne: true },
      status: { $nin: ['confirmed_completed', 'cancelled'] },
    }).select('title status progress assignees');

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

    const recipients = new Set();
    project.projectManagers.forEach((pm) => recipients.add(pm.toString()));
    project.teamMembers
      .filter((tm) => tm.status === 'active')
      .forEach((tm) => recipients.add(tm.user.toString()));
    (project.associates || [])
      .filter((a) => a.status === 'active' && a.userId)
      .forEach((a) => recipients.add(a.userId.toString()));

    notifyUsers(Array.from(recipients), {
      title: `Project "${project.name}" completed`,
      body: 'All tasks have been finished. Great work!',
      data: { notificationType: 'project', projectId: project._id.toString(), workspaceId: project.workspace.toString() },
      emailEventType: 'projectUpdate',
      emailHtml: `<h2>Project Completed 🎉</h2><p><strong>${project.name}</strong> is done.</p>`,
    });

    const updated = await Project.findById(projectId)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('completedBy', 'name email profile');

    res.status(200).json({ success: true, message: 'Project marked as completed. 🎉', project: updated });
  } catch (error) {
    console.error('❌ Confirm project completion error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// MANAGE PROJECT MANAGERS
// PATCH /api/projects/:projectId/managers
// ═════════════════════════════════════════════════════════════════════
const manageProjectManagers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { action, managerId } = req.body;

    if (!action || !managerId) return res.status(400).json({ success: false, message: 'Action and managerId are required.' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner or admins can manage project managers.' });
    }

    const isActiveMember = workspace.members.some((m) => {
      const uid = m.user?._id ? m.user._id.toString() : m.user.toString();
      return uid === managerId && m.status === 'active';
    });
    if (!isActiveMember) return res.status(400).json({ success: false, message: 'User must be an active workspace member or associate.' });

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
        data: { notificationType: 'project', projectId: project._id.toString(), workspaceId: project.workspace.toString() },
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

// ═════════════════════════════════════════════════════════════════════
// ADD TEAM MEMBER
// POST /api/projects/:projectId/team
// ═════════════════════════════════════════════════════════════════════
const addTeamMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { userId: memberId, role = 'member' } = req.body;

    if (!memberId) return res.status(400).json({ success: false, message: 'userId is required.' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const isActiveMember = workspace.members.some((m) => {
      const uid = m.user?._id ? m.user._id.toString() : m.user.toString();
      return uid === memberId && m.status === 'active';
    });
    if (!isActiveMember) return res.status(400).json({ success: false, message: 'User must be an active workspace member.' });

    const existing = project.teamMembers.find((tm) => tm.user.toString() === memberId);
    if (existing) {
      if (existing.status === 'active') return res.status(400).json({ success: false, message: 'User is already on the project team.' });
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
      data: { notificationType: 'project', projectId: project._id.toString(), workspaceId: project.workspace.toString() },
      emailEventType: 'teamInvite',
    });

    const updated = await Project.findById(projectId).populate('teamMembers.user', 'name email profile');
    res.status(200).json({ success: true, message: 'Team member added', project: updated });
  } catch (error) {
    console.error('❌ Add team member error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// REMOVE TEAM MEMBER
// DELETE /api/projects/:projectId/team/:memberId
// ═════════════════════════════════════════════════════════════════════
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
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const openTasks = await Task.countDocuments({
      project: projectId,
      assignees: memberId,
      isDeleted: false,
      isTrash: { $ne: true },
      status: { $nin: ['confirmed_completed', 'cancelled'] },
    });

    if (openTasks > 0) {
      return res.status(400).json({
        success: false,
        message: `This member still has ${openTasks} open task(s). Reassign them first.`,
      });
    }

    const member = project.teamMembers.find((tm) => tm.user.toString() === memberId && tm.status === 'active');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found on this project.' });

    member.status = 'removed';
    member.leftAt = new Date();
    await project.save();

    notifyUsers(memberId, {
      title: `Removed from project "${project.name}"`,
      body: 'You have been removed from the project.',
      data: { notificationType: 'workspace', workspaceId: project.workspace.toString() },
      emailEventType: 'projectUpdate',
    });

    res.status(200).json({ success: true, message: 'Team member removed' });
  } catch (error) {
    console.error('❌ Remove team member error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// GET PROJECT TEAM WITH TASKS
// ═════════════════════════════════════════════════════════════════════
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
          assignees: tm.user._id,
          isDeleted: false,
          isTrash: { $ne: true },
        }).select('title status progress priority dueDate');

        return {
          user: tm.user,
          role: tm.role,
          joinedAt: tm.joinedAt,
          tasks,
          taskSummary: {
            total: tasks.length,
            completed: tasks.filter((t) => t.status === 'confirmed_completed').length,
            open: tasks.filter((t) => !['confirmed_completed', 'cancelled'].includes(t.status)).length,
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

// ═════════════════════════════════════════════════════════════════════
// GET / CREATE DM WITH A TEAM MEMBER
// ═════════════════════════════════════════════════════════════════════
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

// ═════════════════════════════════════════════════════════════════════
// PROJECT STATS
// ═════════════════════════════════════════════════════════════════════
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
      .populate('assignees', 'name email profile')
      .select('title status progress priority dueDate assignees');

    const byStatus = { pending: 0, 'in-progress': 0, review: 0, completed: 0, cancelled: 0 };
    tasks.forEach((t) => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

    const now = new Date();
    const overdue = tasks.filter(
      (t) => t.dueDate && t.dueDate < now && !['confirmed_completed', 'completed', 'cancelled'].includes(t.status)
    );

    const memberMap = {};
    tasks.forEach((t) => {
      (t.assignees || []).forEach((a) => {
        const id = a._id ? a._id.toString() : a.toString();
        if (!memberMap[id]) memberMap[id] = { user: a, total: 0, completed: 0, overdue: 0 };
        memberMap[id].total += 1;
        if (t.status === 'confirmed_completed') memberMap[id].completed += 1;
        if (t.dueDate && t.dueDate < now && !['confirmed_completed', 'completed', 'cancelled'].includes(t.status)) {
          memberMap[id].overdue += 1;
        }
      });
    });

    const allDone =
      tasks.length > 0 && tasks.every((t) => ['confirmed_completed', 'cancelled'].includes(t.status));

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

// ═════════════════════════════════════════════════════════════════════
// PERSONAL ARCHIVE / UNARCHIVE
// ═════════════════════════════════════════════════════════════════════
const archiveProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    const viewer = resolveViewer(project, workspace, userId, 'workspace');
    if (!viewer.canView) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project.' });
    }

    const alreadyArchived = (project.archivedBy || []).some((a) => a.user.toString() === userId);
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
    const viewer = resolveViewer(project, workspace, userId, 'workspace');
    if (!viewer.canView) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    project.archivedBy = (project.archivedBy || []).filter((a) => a.user.toString() !== userId);
    await project.save();

    res.status(200).json({ success: true, message: 'Project unarchived for you.' });
  } catch (error) {
    console.error('❌ Unarchive project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// DELETE / RESTORE / PERMANENT DELETE
// ═════════════════════════════════════════════════════════════════════
const deleteProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner or admins can delete projects.' });
    }

    project.isTrash = true;
    project.trashedAt = new Date();
    project.publicShareEnabled = false;
    await project.save();

    const recipients = new Set();
    project.projectManagers.forEach((pm) => recipients.add(pm.toString()));
    project.teamMembers
      .filter((tm) => tm.status === 'active')
      .forEach((tm) => recipients.add(tm.user.toString()));
    (project.associates || [])
      .filter((a) => a.status === 'active' && a.userId)
      .forEach((a) => recipients.add(a.userId.toString()));

    notifyUsers(Array.from(recipients), {
      title: `Project "${project.name}" moved to trash`,
      body: 'The project has been moved to trash and will be permanently deleted after 30 days.',
      data: { notificationType: 'workspace', workspaceId: workspace._id.toString() },
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
      return res.status(403).json({ success: false, message: 'Only workspace owner or admins can restore projects.' });
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
      return res.status(403).json({ success: false, message: 'Only workspace owner or admins can permanently delete projects.' });
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
// PUBLIC SHARE LINK  (read-only, token-based)
// ═════════════════════════════════════════════════════════════════════

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

    if (!project.publicShareToken) project.publicShareToken = generateShareToken();
    project.publicShareEnabled = true;
    await project.save();

    const url = `${process.env.CLIENT_URL}/workspace/${workspace._id}/project/${project._id}`;
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

// ═════════════════════════════════════════════════════════════════════
// ASSOCIATES
// ═════════════════════════════════════════════════════════════════════

const addAssociate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { email, name = '', role = 'editor', accessExpiresAt = null } = req.body;

    if (!email?.trim()) return res.status(400).json({ success: false, message: 'Email is required.' });
    if (!['viewer', 'editor', 'projectManager'].includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be 'viewer', 'editor', or 'projectManager'." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const existing = (project.associates || []).find((a) => a.email === normalizedEmail);
    if (existing && existing.status !== 'revoked') {
      return res.status(400).json({ success: false, message: 'This email is already an associate on this project.' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).select('_id name email');

    if (existingUser) {
      const permMember = workspace.members.find((m) => {
        const uid = m.user?._id ? m.user._id.toString() : m.user.toString();
        return uid === existingUser._id.toString() && m.status === 'active';
      });
      if (permMember && permMember.memberType !== 'associate') {
        if (role === 'projectManager') {
          if (!project.projectManagers.some((pm) => pm.toString() === existingUser._id.toString())) {
            project.projectManagers.push(existingUser._id);
          }
        } else {
          const existingTm = project.teamMembers.find((tm) => tm.user.toString() === existingUser._id.toString());
          if (existingTm) {
            existingTm.status = 'active';
            existingTm.leftAt = null;
          } else {
            project.teamMembers.push({
              user: existingUser._id,
              role: 'member',
              status: 'active',
              joinedAt: new Date(),
            });
          }
        }
        await project.save();
        notifyUsers(existingUser._id.toString(), {
          title: `Added to project "${project.name}"`,
          body: `You have been added to "${project.name}".`,
          data: { notificationType: 'project', projectId: project._id.toString(), workspaceId: project.workspace.toString() },
          emailEventType: 'teamInvite',
        });
        return res.status(200).json({
          success: true,
          message: 'Existing workspace member added to project.',
          project: await Project.findById(projectId)
            .populate('projectManagers', 'name email profile')
            .populate('teamMembers.user', 'name email profile'),
        });
      }
    }

    let associateWorkspaceMember = null;
    if (existingUser) {
      associateWorkspaceMember = workspace.members.find((m) => {
        const uid = m.user?._id ? m.user._id.toString() : m.user.toString();
        return uid === existingUser._id.toString();
      });
    }

    const now = new Date();
    let associateRecord;

    if (existing) {
      existing.name = name || existing.name;
      existing.role = role;
      existing.status = existingUser ? 'active' : 'invited';
      existing.userId = existingUser?._id || null;
      existing.addedBy = userId;
      existing.addedAt = now;
      existing.acceptedAt = existingUser ? now : null;
      existing.accessExpiresAt = accessExpiresAt ? new Date(accessExpiresAt) : null;
      associateRecord = existing;
    } else {
      project.associates.push({
        email: normalizedEmail,
        name,
        role,
        userId: existingUser?._id || null,
        status: existingUser ? 'active' : 'invited',
        addedBy: userId,
        addedAt: now,
        acceptedAt: existingUser ? now : null,
        accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null,
      });
      associateRecord = project.associates[project.associates.length - 1];
    }

    if (role === 'projectManager' && existingUser) {
      if (!project.projectManagers.some((pm) => pm.toString() === existingUser._id.toString())) {
        project.projectManagers.push(existingUser._id);
      }
    }

    await project.save();

    if (existingUser) {
      if (!associateWorkspaceMember) {
        workspace.members.push({
          user: existingUser._id,
          role: 'Associate',
          memberType: 'associate',
          department: null,
          status: 'active',
          joinedAt: now,
          addedBy: userId,
          accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null,
        });
        await workspace.save();
      }

      await User.findByIdAndUpdate(existingUser._id, {
        $addToSet: { joinedWorkspaces: workspace._id },
      });

      notifyUsers(existingUser._id.toString(), {
        title: `You've been added to "${project.name}"`,
        body: `You were added as an associate with ${role === 'projectManager' ? 'Project Manager' : role} access.`,
        data: {
          notificationType: 'project',
          projectId: project._id.toString(),
          workspaceId: project.workspace.toString(),
        },
        emailEventType: 'teamInvite',
        emailHtml: `
          <h3>You've been added to ${project.name}</h3>
          <p>You now have <strong>${role}</strong> access to this project.</p>
          <p><a href="${process.env.CLIENT_URL}/workspace/${workspace._id}/project/${project._id}">Open Project</a></p>
        `,
      });
    } else {
      const projectUrl = `${process.env.CLIENT_URL}/workspace/${workspace._id}/project/${project._id}`;
      try {
        await sendAssociateInviteEmail({
          to: normalizedEmail,
          associateName: name || 'there',
          inviterName: req.user.name || 'A teammate',
          workspaceName: workspace.name,
          projectName: project.name,
          projectUrl,
          role,
          expiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null,
        });
      } catch (mailErr) {
        console.error('❌ Associate invite email failed:', mailErr.message);
      }
    }

    const freshAssociate = project.associates.find((a) => a.email === normalizedEmail);

    res.status(201).json({
      success: true,
      message: existingUser
        ? 'Associate added.'
        : 'Invitation sent. They will get access once they sign up with that email.',
      associate: shapeAssociate(freshAssociate, false),
    });
  } catch (error) {
    console.error('❌ Add associate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAssociates = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate('associates.userId', 'name email profile')
      .populate('associates.addedBy', 'name email profile');

    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({
      success: true,
      associates: project.associates || [],
      count: (project.associates || []).length,
    });
  } catch (error) {
    console.error('❌ Get associates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateAssociate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, associateId } = req.params;
    const { role, name, accessExpiresAt } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const assoc = project.associates.id(associateId);
    if (!assoc) return res.status(404).json({ success: false, message: 'Associate not found.' });
    if (role && !['viewer', 'editor', 'projectManager'].includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be 'viewer', 'editor', or 'projectManager'." });
    }

    const oldRole = assoc.role;

    if (role) assoc.role = role;
    if (name !== undefined) assoc.name = name;
    if (accessExpiresAt !== undefined) {
      assoc.accessExpiresAt = accessExpiresAt ? new Date(accessExpiresAt) : null;
    }

    if (assoc.userId) {
      const uid = assoc.userId.toString();
      const isPM = project.projectManagers.some((pm) => pm.toString() === uid);

      if (role === 'projectManager' && !isPM) {
        project.projectManagers.push(assoc.userId);
      } else if (role && role !== 'projectManager' && oldRole === 'projectManager' && isPM) {
        project.projectManagers = project.projectManagers.filter((pm) => pm.toString() !== uid);
      }
    }

    await project.save();

    if (assoc.userId && role && role !== oldRole) {
      notifyUsers(assoc.userId.toString(), {
        title: `Your role in "${project.name}" changed`,
        body: `You are now ${role === 'projectManager' ? 'a Project Manager' : `an ${role}`}.`,
        data: { notificationType: 'project', projectId: project._id.toString(), workspaceId: project.workspace.toString() },
        emailEventType: 'teamInvite',
      });
    }

    res.status(200).json({ success: true, message: 'Associate updated.', associate: assoc });
  } catch (error) {
    console.error('❌ Update associate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const removeAssociate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, associateId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const workspace = await Workspace.findById(project.workspace);
    if (!canManageProject(workspace, project, userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const assoc = project.associates.id(associateId);
    if (!assoc) return res.status(404).json({ success: false, message: 'Associate not found.' });

    if (assoc.userId) {
      const openTasks = await Task.countDocuments({
        project: projectId,
        assignees: assoc.userId,
        isDeleted: false,
        isTrash: { $ne: true },
        status: { $nin: ['confirmed_completed', 'completed', 'cancelled'] },
      });
      if (openTasks > 0) {
        return res.status(400).json({
          success: false,
          message: `This associate still has ${openTasks} open task(s). Reassign them first.`,
        });
      }
    }

    const removedUserId = assoc.userId ? assoc.userId.toString() : null;

    assoc.status = 'revoked';
    assoc.revokedAt = new Date();
    assoc.revokedBy = userId;

    if (removedUserId) {
      project.projectManagers = project.projectManagers.filter(
        (pm) => pm.toString() !== removedUserId
      );
    }

    await project.save();

    if (removedUserId) {
      const otherProject = await Project.findOne({
        workspace: workspace._id,
        _id: { $ne: project._id },
        associates: { $elemMatch: { userId: removedUserId, status: 'active' } },
      }).select('_id');

      if (!otherProject) {
        workspace.members = workspace.members.filter((m) => {
          const uid = m.user?._id ? m.user._id.toString() : m.user.toString();
          return !(uid === removedUserId && m.memberType === 'associate');
        });
        await workspace.save();

        await User.findByIdAndUpdate(removedUserId, {
          $pull: { joinedWorkspaces: workspace._id },
        });
      }

      notifyUsers(removedUserId, {
        title: `Removed from "${project.name}"`,
        body: 'Your associate access to this project has been revoked.',
        data: { notificationType: 'project', projectId: project._id.toString(), workspaceId: workspace._id.toString() },
        emailEventType: 'projectUpdate',
      });
    }

    res.status(200).json({ success: true, message: 'Associate removed.' });
  } catch (error) {
    console.error('❌ Remove associate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════

export {
  // CRUD
  createProject,
  getWorkspaceProjects,
  getMyAssociateProjects,
  getProject,
  getProjectTasks,
  getTask,
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
  // Public share (token-based, read-only)
  enableProjectShareLink,
  disableProjectShareLink,
  // Associates
  addAssociate,
  getAssociates,
  updateAssociate,
  removeAssociate,
  // Shared helpers
  resolveIdentifier,
  resolveViewer,
  deriveEffectiveMode,
  hasAnyProjectRelationship,
  sanitizeProject,
  sanitizeTask,
  sanitizeSubTask,
  // Legacy
  resolveProjectAccess,
};