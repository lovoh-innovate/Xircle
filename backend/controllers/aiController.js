// controllers/aiController.js
import mongoose from 'mongoose';
import Project from '../models/projectModel.js';
import Task from '../models/taskModel.js';
import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import {
  planProject,
  reviewProject,
  summarizeProject,
  explainContext,
  generateProjectDocs,
} from '../services/geminiService.js';
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────
// ENUMS — pulled straight from the schemas so nothing can drift.
// ─────────────────────────────────────────────────────────────────────
const PROJECT_TYPE_ENUM =
  Project.schema.path('projectType')?.enumValues || ['general'];
const PROJECT_PRIORITY_ENUM =
  Project.schema.path('priority')?.enumValues || ['low', 'medium', 'high', 'urgent'];
const TASK_PRIORITY_ENUM =
  Task.schema.path('priority')?.enumValues || PROJECT_PRIORITY_ENUM;

const DEFAULT_PROJECT_TYPE = PROJECT_TYPE_ENUM[0];
const DEFAULT_PROJECT_PRIORITY = PROJECT_PRIORITY_ENUM.includes('medium')
  ? 'medium'
  : PROJECT_PRIORITY_ENUM[0];
const DEFAULT_TASK_PRIORITY = TASK_PRIORITY_ENUM.includes('medium')
  ? 'medium'
  : TASK_PRIORITY_ENUM[0];

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
    (m) =>
      (m.user?._id || m.user)?.toString() === userId &&
      m.role === 'Admin' &&
      m.status === 'active'
  );
};

const addDays = (base, days) => {
  if (days == null || Number.isNaN(Number(days))) return null;
  const d = new Date(base);
  d.setDate(d.getDate() + Number(days));
  d.setHours(17, 0, 0, 0);
  return d;
};

// Never trust LLM output — drop invented member IDs, clamp enums.
const sanitizePlan = (rawPlan, validMemberIds) => {
  const valid = new Set(validMemberIds.map(String));
  const warnings = [];

  const proj = rawPlan?.project || {};

  const cleanedTeam = (proj.teamMemberIds || []).filter((id) => {
    if (valid.has(String(id))) return true;
    warnings.push(`Dropped unknown member ${id} from project team.`);
    return false;
  });

  const cleanedProject = {
    name: String(proj.name || 'Untitled Project').slice(0, 120),
    description: String(proj.description || '').slice(0, 500),
    detailedDescription: String(proj.detailedDescription || '').slice(0, 5000),
    priority: PROJECT_PRIORITY_ENUM.includes(proj.priority)
      ? proj.priority
      : DEFAULT_PROJECT_PRIORITY,
    projectType: PROJECT_TYPE_ENUM.includes(proj.projectType)
      ? proj.projectType
      : DEFAULT_PROJECT_TYPE,
    tags: Array.isArray(proj.tags) ? proj.tags.map(String).slice(0, 20) : [],
    teamMemberIds: cleanedTeam,
  };

  const cleanedTasks = (rawPlan?.tasks || []).map((t) => {
    const assignees = (t.assigneeIds || []).filter((id) => {
      if (valid.has(String(id))) return true;
      warnings.push(`Dropped unknown assignee ${id} from task "${t.title}".`);
      return false;
    });
    return {
      title: String(t.title || 'Untitled task').slice(0, 200),
      description: String(t.description || '').slice(0, 2000),
      priority: TASK_PRIORITY_ENUM.includes(t.priority)
        ? t.priority
        : DEFAULT_TASK_PRIORITY,
      assigneeIds: assignees,
      dueDateOffsetDays:
        typeof t.dueDateOffsetDays === 'number' ? t.dueDateOffsetDays : null,
      subtasks: (t.subtasks || []).map((s) => ({
        title: String(s.title || 'Subtask').slice(0, 200),
        description: String(s.description || '').slice(0, 1000),
        dueDateOffsetDays:
          typeof s.dueDateOffsetDays === 'number' ? s.dueDateOffsetDays : null,
      })),
    };
  });

  return { project: cleanedProject, tasks: cleanedTasks, warnings };
};

// Fetch project + tasks + unique members, with full access check.
// Used by review / summarize / explain / document.
const loadProjectContext = async (projectId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw Object.assign(new Error('Invalid projectId.'), { status: 400 });
  }

  const project = await Project.findById(projectId)
    .populate('projectManagers', 'name email profile title skills')
    .populate('teamMembers.user', 'name email profile title skills');

  if (!project) throw Object.assign(new Error('Project not found.'), { status: 404 });

  const workspace = await Workspace.findById(project.workspace).populate(
    'owner',
    'name email profile title skills'
  );
  if (!workspace) throw Object.assign(new Error('Workspace not found.'), { status: 404 });

  const ownerId = (workspace.owner?._id || workspace.owner)?.toString();
  const isOwner = ownerId === userId;
  const isAdmin = workspace.members.some(
    (m) =>
      (m.user?._id || m.user)?.toString() === userId &&
      m.role === 'Admin' &&
      m.status === 'active'
  );
  const isPM = (project.projectManagers || []).some(
    (pm) => (pm._id || pm).toString() === userId
  );
  const isMember = (project.teamMembers || []).some(
    (tm) =>
      (tm.user?._id || tm.user)?.toString() === userId && tm.status === 'active'
  );

  if (!isOwner && !isAdmin && !isPM && !isMember) {
    throw Object.assign(new Error('Access denied.'), { status: 403 });
  }

  const tasks = await Task.find({
    project: projectId,
    isDeleted: false,
    isTrash: { $ne: true },
  })
    .populate('assignees', 'name email profile')
    .sort({ order: 1, createdAt: -1 });

  const memberMap = new Map();
  if (workspace.owner) {
    memberMap.set(workspace.owner._id.toString(), {
      _id: workspace.owner._id,
      name: workspace.owner.name,
      email: workspace.owner.email,
      title: workspace.owner.title,
      skills: workspace.owner.skills || [],
      workspaceRole: 'Owner',
    });
  }
  (project.projectManagers || []).forEach((pm) => {
    const id = (pm._id || pm).toString();
    if (!memberMap.has(id)) {
      memberMap.set(id, {
        _id: pm._id || pm,
        name: pm.name || 'Unknown',
        email: pm.email || '',
        title: pm.title,
        skills: pm.skills || [],
        workspaceRole: 'Project Manager',
      });
    }
  });
  (project.teamMembers || [])
    .filter((tm) => tm.status === 'active')
    .forEach((tm) => {
      const u = tm.user;
      if (!u?._id) return;
      const id = u._id.toString();
      if (!memberMap.has(id)) {
        memberMap.set(id, {
          _id: u._id,
          name: u.name,
          email: u.email,
          title: u.title,
          skills: u.skills || [],
          workspaceRole: 'Member',
        });
      }
    });

  return {
    project,
    workspace,
    tasks,
    members: Array.from(memberMap.values()),
    isOwner,
    isAdmin,
    isPM,
    canManage: isOwner || isAdmin || isPM,
  };
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/plan
// Preview only — no DB writes.
// ─────────────────────────────────────────────────────────────────────
export const planWithAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, prompt } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId is required.' });
    }
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'prompt is required.' });
    }
    if (prompt.length > 4000) {
      return res.status(400).json({ success: false, message: 'Prompt is too long (max 4000 chars).' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or admins can use AI planning.',
      });
    }

    const activeMemberships = workspace.members.filter((m) => m.status === 'active');
    const userIds = activeMemberships.map((m) => m.user?._id || m.user).filter(Boolean);
    const ownerId = workspace.owner?._id || workspace.owner;
    if (ownerId && !userIds.some((id) => id.toString() === ownerId.toString())) {
      userIds.push(ownerId);
    }

    const users = await User.find({ _id: { $in: userIds } }).select(
      'name email profile title skills'
    );

    const roleMap = new Map();
    activeMemberships.forEach((m) => {
      const id = (m.user?._id || m.user)?.toString();
      if (id) roleMap.set(id, m.role);
    });
    if (ownerId) roleMap.set(ownerId.toString(), 'Owner');

    const memberContext = users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      title: u.title || null,
      skills: u.skills || [],
      workspaceRole: roleMap.get(u._id.toString()) || 'Member',
    }));

    const rawPlan = await planProject({
      prompt: prompt.trim(),
      members: memberContext,
      workspaceName: workspace.name,
    });

    const validIds = memberContext.map((m) => m._id);
    const plan = sanitizePlan(rawPlan, validIds);

    const idToUser = new Map(memberContext.map((m) => [String(m._id), m]));
    const hydratedPlan = {
      project: {
        ...plan.project,
        teamMembers: plan.project.teamMemberIds
          .map((id) => idToUser.get(String(id)))
          .filter(Boolean),
      },
      tasks: plan.tasks.map((t) => ({
        ...t,
        assignees: t.assigneeIds.map((id) => idToUser.get(String(id))).filter(Boolean),
      })),
      warnings: plan.warnings,
    };

    res.status(200).json({ success: true, plan: hydratedPlan });
  } catch (error) {
    console.error('❌ AI plan error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'AI planning failed.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/execute
// Commit the plan. Accepts any user-edited version of the preview.
// ─────────────────────────────────────────────────────────────────────
export const executeAIPlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, plan } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId is required.' });
    }
    if (!plan || !plan.project || !Array.isArray(plan.tasks)) {
      return res.status(400).json({ success: false, message: 'A valid plan is required.' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or admins can execute AI plans.',
      });
    }

    const activeMemberIds = workspace.members
      .filter((m) => m.status === 'active')
      .map((m) => (m.user?._id || m.user)?.toString())
      .filter(Boolean);
    const ownerId = (workspace.owner?._id || workspace.owner)?.toString();
    if (ownerId) activeMemberIds.push(ownerId);

    const sanitized = sanitizePlan(plan, activeMemberIds);

    const validTeamIds = sanitized.project.teamMemberIds.filter(
      (id) => id !== userId
    );

    const teamMembers = validTeamIds.map((id) => ({
      user: id,
      role: 'member',
      status: 'active',
      joinedAt: new Date(),
    }));

    const project = await Project.create({
      workspace: workspaceId,
      name: sanitized.project.name,
      description: sanitized.project.description,
      detailedDescription: sanitized.project.detailedDescription,
      createdBy: userId,
      projectManagers: [userId],
      teamMembers,
      priority: sanitized.project.priority,
      projectType: sanitized.project.projectType,
      tags: sanitized.project.tags,
      status: 'planning',
      progress: 0,
      links: [],
      documents: [],
      coverImage: '',
      archivedBy: [],
      isTrash: false,
      aiGenerated: true,
    });

    const now = new Date();
    const createdTasks = [];
    let taskOrder = 0;

    for (const t of sanitized.tasks) {
      const allowedAssignees = new Set([...validTeamIds, userId]);
      const finalAssignees = t.assigneeIds.filter((id) => allowedAssignees.has(id));
      const status = finalAssignees.length > 0 ? 'ready_for_completion' : 'pending';
      const dueDate = addDays(now, t.dueDateOffsetDays);

      const subtasks = (t.subtasks || []).map((s, idx) => ({
        title: s.title,
        description: s.description || '',
        startDate: now,
        dueDate: addDays(now, s.dueDateOffsetDays),
        status: 'pending',
        order: idx,
        links: [],
        attachments: [],
        recurrenceType: 'none',
        recurrenceDays: [],
        recurrenceEndDate: null,
      }));

      const task = await Task.create({
        project: project._id,
        workspace: workspaceId,
        folder: null,
        title: t.title,
        description: t.description,
        detailedDescription: '',
        taskType: 'general',
        assignees: finalAssignees,
        createdBy: userId,
        status,
        priority: t.priority,
        startDate: now,
        dueDate,
        bufferTime: 0,
        estimatedHours: null,
        progress: 0,
        subTasks: subtasks,
        allowAssigneeEditSubtasks: false,
        dependencies: [],
        links: [],
        attachments: [],
        reminderSent: false,
        recurrenceType: 'none',
        recurrenceDays: [],
        recurrenceEndDate: null,
        order: taskOrder++,
        isArchived: false,
        isTrash: false,
        isDeleted: false,
      });

      createdTasks.push(task);
    }

    const notifySet = new Set([...validTeamIds]);
    createdTasks.forEach((t) =>
      (t.assignees || []).forEach((a) => {
        const id = a.toString();
        if (id !== userId) notifySet.add(id);
      })
    );

    for (const recipient of notifySet) {
      createAndSendNotification({
        recipient,
        title: `You've been added to "${project.name}"`,
        body: `A new project was created by AI with ${createdTasks.length} task(s).`,
        data: {
          notificationType: 'project',
          projectId: project._id.toString(),
          workspaceId: workspaceId.toString(),
        },
        sendPush: true,
        emailEventType: 'teamInvite',
      }).catch((e) => console.error('AI notify failed:', e.message));
    }

    const populatedProject = await Project.findById(project._id)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('createdBy', 'name email profile');

    res.status(201).json({
      success: true,
      message: 'AI plan executed successfully.',
      project: populatedProject,
      taskCount: createdTasks.length,
      subtaskCount: createdTasks.reduce((sum, t) => sum + t.subTasks.length, 0),
      memberCount: teamMembers.length,
      warnings: sanitized.warnings,
    });
  } catch (error) {
    console.error('❌ AI execute error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute AI plan.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/review  { projectId, focus? }
// ─────────────────────────────────────────────────────────────────────
export const reviewExistingProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, focus } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'projectId is required.' });
    }

    const ctx = await loadProjectContext(projectId, userId);
    if (!ctx.canManage) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners, admins, or project managers can request reviews.',
      });
    }

    const review = await reviewProject({
      project: ctx.project,
      tasks: ctx.tasks,
      members: ctx.members,
      focus: focus?.trim() || null,
    });

    res.status(200).json({ success: true, review });
  } catch (err) {
    console.error('❌ AI review error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/summarize  { projectId }
// ─────────────────────────────────────────────────────────────────────
export const summarizeProjectAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'projectId is required.' });
    }

    const ctx = await loadProjectContext(projectId, userId);
    const summary = await summarizeProject({
      project: ctx.project,
      tasks: ctx.tasks,
      members: ctx.members,
    });

    res.status(200).json({ success: true, summary });
  } catch (err) {
    console.error('❌ AI summarize error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/explain  { projectId, taskId?, question?, audience? }
// ─────────────────────────────────────────────────────────────────────
export const explainProjectAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, taskId, question, audience } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'projectId is required.' });
    }

    const ctx = await loadProjectContext(projectId, userId);

    let task = null;
    if (taskId) {
      if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return res.status(400).json({ success: false, message: 'Invalid taskId.' });
      }
      task = ctx.tasks.find((t) => t._id.toString() === taskId);
      if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found in this project.' });
      }
    }

    const explanation = await explainContext({
      project: ctx.project,
      task,
      question: question?.trim() || null,
      audience: audience?.trim() || null,
    });

    res.status(200).json({ success: true, explanation });
  } catch (err) {
    console.error('❌ AI explain error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/document  { projectId }
// Returns structured doc; frontend renders to PDF.
// ─────────────────────────────────────────────────────────────────────
export const generateProjectDocsAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'projectId is required.' });
    }

    const ctx = await loadProjectContext(projectId, userId);

    const doc = await generateProjectDocs({
      project: ctx.project,
      tasks: ctx.tasks,
      members: ctx.members,
    });

    doc.meta = {
      ...doc.meta,
      projectName: ctx.project.name,
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.name || null,
    };

    res.status(200).json({ success: true, doc });
  } catch (err) {
    console.error('❌ AI docs error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};