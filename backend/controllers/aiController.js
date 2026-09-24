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
  askXircle,
} from '../services/geminiService.js';
import { buildUserContext } from '../services/xircleContextService.js';
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────
// ENUMS
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

// Valid task statuses (mirrors the schema — kept here so sanitization
// can run without pulling enumValues from the model every time).
const TASK_STATUS_ENUM = ['pending', 'in-progress', 'ready_for_completion', 'completed', 'confirmed_completed', 'cancelled'];
const SUBTASK_STATUS_ENUM = ['pending', 'done', 'confirmed'];

// ─────────────────────────────────────────────────────────────────────
// INLINE GROQ CLIENT (for the edit endpoints)
// ─────────────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const stripCodeFences = (t) =>
  t.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

async function callGroqForEdit({ system, user, temperature = 0.3, maxTokens = 8192 }) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');

  let response;
  try {
    response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature,
        max_tokens: maxTokens,
      }),
    });
  } catch (err) {
    throw new Error(`Groq request failed: ${err.message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groq API error (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Groq returned an empty response.');

  try {
    return JSON.parse(stripCodeFences(raw));
  } catch {
    throw new Error('Groq returned invalid JSON.');
  }
}

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

const safeDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const clampStr = (v, max) => String(v ?? '').slice(0, max);

// ─────────────────────────────────────────────────────────────────────
// TASK-LEVEL SANITIZER  (used by both task-edit and project-edit apply)
// ─────────────────────────────────────────────────────────────────────
const sanitizeProposedTask = (proposed, validMemberIds, fallback = {}) => {
  const valid = new Set(validMemberIds.map(String));
  const warnings = [];

  const rawAssigneeIds = Array.isArray(proposed?.assigneeIds)
    ? proposed.assigneeIds
    : Array.isArray(proposed?.assignees)
      ? proposed.assignees.map((a) => a?._id || a)
      : [];

  const assigneeIds = rawAssigneeIds
    .filter(Boolean)
    .filter((id) => {
      if (valid.has(String(id))) return true;
      warnings.push(`Dropped unknown assignee ${id}.`);
      return false;
    })
    .map(String);

  const rawSubtasks = Array.isArray(proposed?.subTasks)
    ? proposed.subTasks
    : Array.isArray(proposed?.subtasks)
      ? proposed.subtasks
      : [];

  const subTasks = rawSubtasks
    .filter((s) => s && typeof s === 'object')
    .map((s, idx) => ({
      title: clampStr(s.title || `Subtask ${idx + 1}`, 200).trim() || `Subtask ${idx + 1}`,
      description: clampStr(s.description || '', 2000),
      startDate: safeDate(s.startDate) || new Date(),
      dueDate: safeDate(s.dueDate),
      status: SUBTASK_STATUS_ENUM.includes(s.status) ? s.status : 'pending',
      order: idx,
      links: Array.isArray(s.links) ? s.links.map(String).slice(0, 20) : [],
      attachments: [],
      recurrenceType: 'none',
      recurrenceDays: [],
      recurrenceEndDate: null,
    }))
    .slice(0, 100);

  return {
    title: clampStr(proposed?.title ?? fallback.title ?? 'Untitled task', 200).trim() || 'Untitled task',
    description: clampStr(proposed?.description ?? fallback.description ?? '', 5000),
    priority: TASK_PRIORITY_ENUM.includes(proposed?.priority)
      ? proposed.priority
      : fallback.priority || DEFAULT_TASK_PRIORITY,
    status: TASK_STATUS_ENUM.includes(proposed?.status)
      ? proposed.status
      : fallback.status || 'pending',
    startDate: safeDate(proposed?.startDate) ?? fallback.startDate ?? null,
    dueDate: safeDate(proposed?.dueDate) ?? fallback.dueDate ?? null,
    estimatedHours:
      typeof proposed?.estimatedHours === 'number' && proposed.estimatedHours >= 0
        ? proposed.estimatedHours
        : fallback.estimatedHours ?? null,
    bufferTime:
      typeof proposed?.bufferTime === 'number' && proposed.bufferTime >= 0
        ? proposed.bufferTime
        : fallback.bufferTime ?? 0,
    assigneeIds,
    allowAssigneeEditSubtasks:
      typeof proposed?.allowAssigneeEditSubtasks === 'boolean'
        ? proposed.allowAssigneeEditSubtasks
        : !!fallback.allowAssigneeEditSubtasks,
    subTasks,
    warnings,
  };
};

// ─────────────────────────────────────────────────────────────────────
// PROJECT-LEVEL SANITIZER
// ─────────────────────────────────────────────────────────────────────
const sanitizeProposedProject = (proposed, validMemberIds, fallbackProject = {}) => {
  const valid = new Set(validMemberIds.map(String));
  const warnings = [];

  const rawTeam = Array.isArray(proposed?.teamMemberIds)
    ? proposed.teamMemberIds
    : Array.isArray(proposed?.teamMembers)
      ? proposed.teamMembers.map((t) => t?.user?._id || t?.user || t?._id || t)
      : [];

  const teamMemberIds = rawTeam
    .filter(Boolean)
    .filter((id) => {
      if (valid.has(String(id))) return true;
      warnings.push(`Dropped unknown team member ${id}.`);
      return false;
    })
    .map(String);

  return {
    name: clampStr(proposed?.name ?? fallbackProject.name ?? 'Untitled Project', 120).trim() || 'Untitled Project',
    description: clampStr(proposed?.description ?? fallbackProject.description ?? '', 500),
    detailedDescription: clampStr(proposed?.detailedDescription ?? fallbackProject.detailedDescription ?? '', 5000),
    priority: PROJECT_PRIORITY_ENUM.includes(proposed?.priority)
      ? proposed.priority
      : fallbackProject.priority || DEFAULT_PROJECT_PRIORITY,
    projectType: PROJECT_TYPE_ENUM.includes(proposed?.projectType)
      ? proposed.projectType
      : fallbackProject.projectType || DEFAULT_PROJECT_TYPE,
    tags: Array.isArray(proposed?.tags) ? proposed.tags.map(String).slice(0, 20) : [],
    teamMemberIds,
    warnings,
  };
};

// ─────────────────────────────────────────────────────────────────────
// Original plan sanitizer (unchanged)
// ─────────────────────────────────────────────────────────────────────
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
    priority: PROJECT_PRIORITY_ENUM.includes(proj.priority) ? proj.priority : DEFAULT_PROJECT_PRIORITY,
    projectType: PROJECT_TYPE_ENUM.includes(proj.projectType) ? proj.projectType : DEFAULT_PROJECT_TYPE,
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
      priority: TASK_PRIORITY_ENUM.includes(t.priority) ? t.priority : DEFAULT_TASK_PRIORITY,
      assigneeIds: assignees,
      dueDateOffsetDays: typeof t.dueDateOffsetDays === 'number' ? t.dueDateOffsetDays : null,
      subtasks: (t.subtasks || []).map((s) => ({
        title: String(s.title || 'Subtask').slice(0, 200),
        description: String(s.description || '').slice(0, 1000),
        dueDateOffsetDays: typeof s.dueDateOffsetDays === 'number' ? s.dueDateOffsetDays : null,
      })),
    };
  });

  return { project: cleanedProject, tasks: cleanedTasks, warnings };
};

// Fetch project + tasks + unique members, with full access check.
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
  const isPM = (project.projectManagers || []).some((pm) => (pm._id || pm).toString() === userId);
  const isMember = (project.teamMembers || []).some(
    (tm) => (tm.user?._id || tm.user)?.toString() === userId && tm.status === 'active'
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

// Convert a task document (populated or not) into the shape the AI sees.
const digestTaskForEdit = (t) => ({
  _id: t._id.toString(),
  title: t.title,
  description: t.description || '',
  priority: t.priority,
  status: t.status,
  startDate: t.startDate || null,
  dueDate: t.dueDate || null,
  estimatedHours: t.estimatedHours ?? null,
  bufferTime: t.bufferTime ?? 0,
  assigneeIds: (t.assignees || []).map((a) => String(a._id || a)),
  assigneeNames: (t.assignees || []).map((a) => a.name).filter(Boolean),
  allowAssigneeEditSubtasks: !!t.allowAssigneeEditSubtasks,
  subTasks: (t.subTasks || []).map((s, idx) => ({
    _index: idx,
    title: s.title,
    description: s.description || '',
    dueDate: s.dueDate || null,
    status: s.status,
  })),
});

// ═════════════════════════════════════════════════════════════════════
// EXISTING ENDPOINTS (unchanged)
// ═════════════════════════════════════════════════════════════════════

export const planWithAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, prompt } = req.body;

    if (!workspaceId) return res.status(400).json({ success: false, message: 'workspaceId is required.' });
    if (!prompt || !prompt.trim()) return res.status(400).json({ success: false, message: 'prompt is required.' });
    if (prompt.length > 4000) return res.status(400).json({ success: false, message: 'Prompt is too long (max 4000 chars).' });

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found.' });
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner or admins can use AI planning.' });
    }

    const activeMemberships = workspace.members.filter((m) => m.status === 'active');
    const userIds = activeMemberships.map((m) => m.user?._id || m.user).filter(Boolean);
    const ownerId = workspace.owner?._id || workspace.owner;
    if (ownerId && !userIds.some((id) => id.toString() === ownerId.toString())) userIds.push(ownerId);

    const users = await User.find({ _id: { $in: userIds } }).select('name email profile title skills');
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
        teamMembers: plan.project.teamMemberIds.map((id) => idToUser.get(String(id))).filter(Boolean),
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
    res.status(500).json({ success: false, message: error.message || 'AI planning failed.' });
  }
};

export const executeAIPlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, plan } = req.body;

    if (!workspaceId) return res.status(400).json({ success: false, message: 'workspaceId is required.' });
    if (!plan || !plan.project || !Array.isArray(plan.tasks)) {
      return res.status(400).json({ success: false, message: 'A valid plan is required.' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found.' });
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner or admins can execute AI plans.' });
    }

    const activeMemberIds = workspace.members
      .filter((m) => m.status === 'active')
      .map((m) => (m.user?._id || m.user)?.toString())
      .filter(Boolean);
    const ownerId = (workspace.owner?._id || workspace.owner)?.toString();
    if (ownerId) activeMemberIds.push(ownerId);

    const sanitized = sanitizePlan(plan, activeMemberIds);

    const validTeamIds = sanitized.project.teamMemberIds.filter((id) => id !== userId);
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
    res.status(500).json({ success: false, message: error.message || 'Failed to execute AI plan.' });
  }
};

export const reviewExistingProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, focus } = req.body;
    if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required.' });

    const ctx = await loadProjectContext(projectId, userId);
    if (!ctx.canManage) {
      return res.status(403).json({ success: false, message: 'Only workspace owners, admins, or project managers can request reviews.' });
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

export const summarizeProjectAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required.' });

    const ctx = await loadProjectContext(projectId, userId);
    const summary = await summarizeProject({ project: ctx.project, tasks: ctx.tasks, members: ctx.members });

    res.status(200).json({ success: true, summary });
  } catch (err) {
    console.error('❌ AI summarize error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

export const explainProjectAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, taskId, question, audience } = req.body;
    if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required.' });

    const ctx = await loadProjectContext(projectId, userId);

    let task = null;
    if (taskId) {
      if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return res.status(400).json({ success: false, message: 'Invalid taskId.' });
      }
      task = ctx.tasks.find((t) => t._id.toString() === taskId);
      if (!task) return res.status(404).json({ success: false, message: 'Task not found in this project.' });
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

export const generateProjectDocsAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required.' });

    const ctx = await loadProjectContext(projectId, userId);
    const doc = await generateProjectDocs({ project: ctx.project, tasks: ctx.tasks, members: ctx.members });

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

export const askXircleAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { question, history = [] } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ success: false, message: 'question is required.' });
    }
    if (question.length > 2000) {
      return res.status(400).json({ success: false, message: 'Question is too long (max 2000 chars).' });
    }
    if (!Array.isArray(history)) {
      return res.status(400).json({ success: false, message: 'history must be an array.' });
    }
    if (history.length > 20) {
      return res.status(400).json({ success: false, message: 'history is too long (max 20 turns).' });
    }

    const cleanHistory = history
      .filter(
        (m) =>
          m &&
          typeof m === 'object' &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.trim()
      )
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    let context;
    try {
      context = await buildUserContext(userId);
    } catch (err) {
      console.error('❌ buildUserContext failed:', err);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Failed to load your Xircle data.',
      });
    }

    let result;
    try {
      result = await askXircle({ context, question: question.trim(), history: cleanHistory });
    } catch (err) {
      console.error('❌ askXircle failed:', err);
      return res.status(502).json({
        success: false,
        message: 'The AI could not answer that right now. Please try again.',
      });
    }

    res.status(200).json({
      success: true,
      answer: result.answer,
      followUps: result.followUps,
      generatedAt: new Date(),
      timezone: context.timezone,
      contextCounts: context.counts,
    });
  } catch (err) {
    console.error('❌ AI ask error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'AI query failed.' });
  }
};

// ═════════════════════════════════════════════════════════════════════
// NEW: TASK-LEVEL AI EDITING
// ═════════════════════════════════════════════════════════════════════
//
// Flow:
//   1. POST /api/ai/task/edit   → preview (no writes)
//   2. POST /api/ai/task/apply  → commit the (possibly user-edited) preview
//
// The AI returns the FULL new task state, not a diff. Frontend shows the
// diff visually by comparing `current` and `proposed`. This keeps the UI
// simple and the apply step stateless.
// ═════════════════════════════════════════════════════════════════════

const TASK_EDIT_SYSTEM = `
You edit an existing task inside a team delivery app. The user gives a
short natural-language request. You return the ENTIRE new state of the
task, with the change applied.

You can change ANY of:
  • title            (string, max 200 chars)
  • description      (string, max 5000 chars)
  • priority         ("low" | "medium" | "high" | "urgent")
  • status           ("pending" | "in-progress" | "ready_for_completion" | "completed" | "confirmed_completed" | "cancelled")
  • startDate        (ISO date string or null)
  • dueDate          (ISO date string or null)
  • estimatedHours   (number or null)
  • bufferTime       (number, minutes)
  • assigneeIds      (array of member IDs from the provided member list)
  • allowAssigneeEditSubtasks (boolean)
  • subTasks         (full array — you may add, remove, rename, reorder, re-date them)

STRICT RULES:
1. Only use member IDs from the provided member list. Never invent IDs.
2. Preserve everything the user did NOT ask to change. Only touch what
   the request implies.
3. If the user says "reduce checklist to 2", keep the 2 most important
   items and drop the rest — don't invent new ones.
4. If the user says "extend the date by 2 months", move BOTH startDate
   and dueDate by the same amount, preserving the duration.
5. If the user says "change the 3rd checklist", modify subTasks[2] only.
6. If the user says "assign this to X", add X to assigneeIds (don't
   remove existing assignees unless asked).
7. Return the full new task state. Do not return a diff. Do not omit
   fields — include every field above.
8. Do NOT invent facts. Do NOT change the title unless asked.

Return STRICT JSON only:
{
  "proposed": {
    "title": "string",
    "description": "string",
    "priority": "low"|"medium"|"high"|"urgent",
    "status": "pending"|"in-progress"|"ready_for_completion"|"completed"|"confirmed_completed"|"cancelled",
    "startDate": "ISO date" | null,
    "dueDate": "ISO date" | null,
    "estimatedHours": number | null,
    "bufferTime": number,
    "assigneeIds": ["string"],
    "allowAssigneeEditSubtasks": boolean,
    "subTasks": [
      { "title": "string", "description": "string", "dueDate": "ISO date"|null, "status": "pending"|"done"|"confirmed" }
    ]
  },
  "summary": "string (1-2 sentences describing what you changed and why)",
  "changes": [
    { "field": "string", "from": "string", "to": "string" }
  ]
}
`.trim();

export const editTaskWithAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, prompt } = req.body;

    if (!taskId) return res.status(400).json({ success: false, message: 'taskId is required.' });
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'prompt is required.' });
    }
    if (prompt.length > 3000) {
      return res.status(400).json({ success: false, message: 'Prompt is too long (max 3000 chars).' });
    }
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ success: false, message: 'Invalid taskId.' });
    }

    const task = await Task.findById(taskId).populate('assignees', 'name email profile');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    if (task.isDeleted || task.isTrash) {
      return res.status(400).json({ success: false, message: 'Cannot edit a deleted task.' });
    }

    const ctx = await loadProjectContext(task.project.toString(), userId);
    const canEdit = ctx.canManage ||
      ((task.assignees || []).some((a) => (a._id || a).toString() === userId) && task.allowAssigneeEditSubtasks);

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Only project managers (or assignees with edit rights) can AI-edit tasks.',
      });
    }

    const currentTask = digestTaskForEdit(task);

    // Member context (with roles) so the AI can pick sensible assignees.
    const memberContext = ctx.members.map((m) => ({
      id: String(m._id),
      name: m.name,
      role: m.workspaceRole || 'Member',
      title: m.title || null,
      skills: m.skills || [],
    }));

    const user = `
PROJECT: ${ctx.project.name}
TODAY (ISO): ${new Date().toISOString()}

AVAILABLE MEMBERS (ONLY use these IDs):
${JSON.stringify(memberContext, null, 2)}

CURRENT TASK STATE:
${JSON.stringify(currentTask, null, 2)}

USER REQUEST:
${prompt.trim()}
`.trim();

    let result;
    try {
      result = await callGroqForEdit({ system: TASK_EDIT_SYSTEM, user, temperature: 0.25 });
    } catch (err) {
      console.error('❌ editTaskWithAI Groq failed:', err);
      return res.status(502).json({
        success: false,
        message: 'The AI could not process that edit right now. Please try again.',
      });
    }

    // Sanitize against the real member list and enum values.
    const validMemberIds = ctx.members.map((m) => String(m._id));
    const sanitized = sanitizeProposedTask(result?.proposed || {}, validMemberIds, currentTask);

    // Re-hydrate assignee objects for the frontend preview.
    const idToUser = new Map(ctx.members.map((m) => [String(m._id), {
      _id: m._id, name: m.name, email: m.email, profile: m.profile,
    }]));
    const proposedHydrated = {
      ...sanitized,
      assignees: sanitized.assigneeIds.map((id) => idToUser.get(id)).filter(Boolean),
    };

    return res.status(200).json({
      success: true,
      current: currentTask,
      proposed: proposedHydrated,
      summary: String(result?.summary || '').slice(0, 800),
      changes: Array.isArray(result?.changes)
        ? result.changes.slice(0, 40).map((c) => ({
            field: String(c?.field || '').slice(0, 80),
            from: String(c?.from ?? '').slice(0, 300),
            to: String(c?.to ?? '').slice(0, 300),
          }))
        : [],
      warnings: sanitized.warnings,
    });
  } catch (err) {
    console.error('❌ AI task edit error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Task edit failed.' });
  }
};

export const applyTaskEdits = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, proposed } = req.body;

    if (!taskId) return res.status(400).json({ success: false, message: 'taskId is required.' });
    if (!proposed || typeof proposed !== 'object') {
      return res.status(400).json({ success: false, message: 'proposed is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ success: false, message: 'Invalid taskId.' });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    if (task.isDeleted || task.isTrash) {
      return res.status(400).json({ success: false, message: 'Cannot edit a deleted task.' });
    }

    const ctx = await loadProjectContext(task.project.toString(), userId);
    const canEdit = ctx.canManage ||
      ((task.assignees || []).some((a) => (a._id || a).toString() === userId) && task.allowAssigneeEditSubtasks);

    if (!canEdit) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const validMemberIds = ctx.members.map((m) => String(m._id));
    const sanitized = sanitizeProposedTask(proposed, validMemberIds, digestTaskForEdit(task));

    // Only allow assignees who are actually on this project's team.
    const teamIds = new Set(ctx.members.map((m) => String(m._id)));
    const finalAssignees = sanitized.assigneeIds.filter((id) => teamIds.has(id));

    task.title = sanitized.title;
    task.description = sanitized.description;
    task.priority = sanitized.priority;
    task.status = sanitized.status;
    task.startDate = sanitized.startDate;
    task.dueDate = sanitized.dueDate;
    task.estimatedHours = sanitized.estimatedHours;
    task.bufferTime = sanitized.bufferTime;
    task.allowAssigneeEditSubtasks = sanitized.allowAssigneeEditSubtasks;
    task.assignees = finalAssignees;
    task.subTasks = sanitized.subTasks;

    await task.save();

    const populated = await Task.findById(task._id).populate('assignees', 'name email profile');

    return res.status(200).json({
      success: true,
      task: populated,
      warnings: sanitized.warnings,
    });
  } catch (err) {
    console.error('❌ AI task apply error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to apply task edits.' });
  }
};

// ═════════════════════════════════════════════════════════════════════
// NEW: PROJECT-LEVEL AI EDITING
// ═════════════════════════════════════════════════════════════════════
//
// Flow:
//   1. POST /api/ai/project/edit   → preview (no writes)
//   2. POST /api/ai/project/apply  → commit
//
// Same "full proposed state" model as tasks, but covers the project AND
// its tasks at once so the AI can move work around ("add James, give him
// 2 tasks, reduce Mercy's load").
// ═════════════════════════════════════════════════════════════════════

const PROJECT_EDIT_SYSTEM = `
You edit an existing project in a team delivery app. The user gives a
short natural-language request. You return the ENTIRE new state of the
project — project fields AND the full task list.

You can change ANY of:
  PROJECT FIELDS
    • name                     (string, max 120 chars)
    • description              (string, max 500 chars)
    • detailedDescription      (string, max 5000 chars)
    • priority                 ("low" | "medium" | "high" | "urgent")
    • projectType              ("general" | "client" | "internal" | "marketing" | "product")
    • tags                     (array of strings)
    • teamMemberIds            (array of member IDs)

  TASKS (per existing task, keyed by "_id")
    • title, description, priority, status
    • startDate, dueDate (ISO strings or null)
    • estimatedHours, bufferTime
    • assigneeIds (array of member IDs)
    • subTasks (full array — add, remove, rename, reorder, re-date)

  TASKS (new tasks the user asked for)
    • include a task WITHOUT an "_id" — the backend will create it

  TASKS (deletions)
    • include an existing task WITH "_deleted": true — the backend will remove it

STRICT RULES:
1. Only use member IDs from the provided member list. Never invent IDs.
2. When the user says "add James and Peter", first find their IDs by name
   in the member list, then add them to teamMemberIds AND to any tasks
   that should now include them.
3. When the user says "reduce Mercy's load", move some of Mercy's tasks
   to other members. Do NOT delete the tasks — reassign them.
4. When the user says "make that 2nd task more bulky", expand its
   description and add subtasks. When they say "reduce its checklist",
   trim subTasks but keep the strongest items.
5. Preserve everything the user did NOT ask to change. Never delete a
   task unless the user clearly asked.
6. Return the full new project state — do not omit fields, do not return
   a diff. Include EVERY existing task in the tasks array (with its _id).

Return STRICT JSON only:
{
  "proposed": {
    "project": {
      "name": "string",
      "description": "string",
      "detailedDescription": "string",
      "priority": "low"|"medium"|"high"|"urgent",
      "projectType": "general"|"client"|"internal"|"marketing"|"product",
      "tags": ["string"],
      "teamMemberIds": ["string"]
    },
    "tasks": [
      {
        "_id": "string (existing task) — OMIT for new tasks",
        "_deleted": true (only if removing an existing task),
        "title": "string",
        "description": "string",
        "priority": "low"|"medium"|"high"|"urgent",
        "status": "pending"|"in-progress"|"ready_for_completion"|"completed"|"confirmed_completed"|"cancelled",
        "startDate": "ISO date" | null,
        "dueDate": "ISO date" | null,
        "estimatedHours": number | null,
        "bufferTime": number,
        "assigneeIds": ["string"],
        "subTasks": [
          { "title": "string", "description": "string", "dueDate": "ISO"|null, "status": "pending"|"done"|"confirmed" }
        ]
      }
    ]
  },
  "summary": "string (1-3 sentences — what changed overall)",
  "changes": [
    { "field": "string", "from": "string", "to": "string" }
  ]
}
`.trim();

export const editProjectWithAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, prompt } = req.body;

    if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required.' });
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'prompt is required.' });
    }
    if (prompt.length > 3000) {
      return res.status(400).json({ success: false, message: 'Prompt is too long (max 3000 chars).' });
    }

    const ctx = await loadProjectContext(projectId, userId);
    if (!ctx.canManage) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners, admins, or project managers can AI-edit a project.',
      });
    }

    // Current project state + all tasks.
    const currentProject = {
      _id: ctx.project._id.toString(),
      name: ctx.project.name,
      description: ctx.project.description || '',
      detailedDescription: ctx.project.detailedDescription || '',
      priority: ctx.project.priority,
      projectType: ctx.project.projectType,
      tags: ctx.project.tags || [],
      teamMemberIds: (ctx.project.teamMembers || [])
        .filter((tm) => tm.status === 'active')
        .map((tm) => String(tm.user?._id || tm.user))
        .filter(Boolean),
    };

    const currentTasks = ctx.tasks.map(digestTaskForEdit);

    const memberContext = ctx.members.map((m) => ({
      id: String(m._id),
      name: m.name,
      role: m.workspaceRole || 'Member',
      title: m.title || null,
      skills: m.skills || [],
    }));

    const user = `
TODAY (ISO): ${new Date().toISOString()}

AVAILABLE WORKSPACE MEMBERS (ONLY use these IDs):
${JSON.stringify(memberContext, null, 2)}

CURRENT PROJECT:
${JSON.stringify(currentProject, null, 2)}

CURRENT TASKS (${currentTasks.length}):
${JSON.stringify(currentTasks, null, 2)}

USER REQUEST:
${prompt.trim()}
`.trim();

    let result;
    try {
      result = await callGroqForEdit({ system: PROJECT_EDIT_SYSTEM, user, temperature: 0.25, maxTokens: 8192 });
    } catch (err) {
      console.error('❌ editProjectWithAI Groq failed:', err);
      return res.status(502).json({
        success: false,
        message: 'The AI could not process that edit right now. Please try again.',
      });
    }

    const validMemberIds = ctx.members.map((m) => String(m._id));
    const warnings = [];

    // Sanitize project
    const sanitizedProject = sanitizeProposedProject(
      result?.proposed?.project || {},
      validMemberIds,
      currentProject
    );
    warnings.push(...sanitizedProject.warnings);

    // Sanitize tasks
    const currentTaskById = new Map(currentTasks.map((t) => [t._id, t]));
    const proposedTasksRaw = Array.isArray(result?.proposed?.tasks) ? result.proposed.tasks : [];
    const sanitizedTasks = [];

    for (const raw of proposedTasksRaw) {
      if (!raw || typeof raw !== 'object') continue;

      // Deletion
      if (raw._deleted === true) {
        const id = String(raw._id || '');
        if (currentTaskById.has(id)) {
          sanitizedTasks.push({ _id: id, _deleted: true });
        }
        continue;
      }

      // Existing task
      if (raw._id && currentTaskById.has(String(raw._id))) {
        const fallback = currentTaskById.get(String(raw._id));
        const clean = sanitizeProposedTask(raw, validMemberIds, fallback);
        sanitizedTasks.push({ _id: String(raw._id), ...clean });
        warnings.push(...clean.warnings);
        continue;
      }

      // New task — no _id
      if (!raw._id) {
        const clean = sanitizeProposedTask(raw, validMemberIds, {});
        sanitizedTasks.push({ _tempId: `new-${sanitizedTasks.length}`, ...clean });
        warnings.push(...clean.warnings);
        continue;
      }

      // Unknown _id → drop with a warning
      warnings.push(`Dropped unknown task "${raw.title || raw._id}".`);
    }

    // Re-hydrate assignee objects for preview.
    const idToUser = new Map(ctx.members.map((m) => [String(m._id), {
      _id: m._id, name: m.name, email: m.email, profile: m.profile,
    }]));

    const proposedHydrated = {
      project: {
        ...sanitizedProject,
        teamMembers: sanitizedProject.teamMemberIds.map((id) => idToUser.get(id)).filter(Boolean),
      },
      tasks: sanitizedTasks.map((t) => ({
        ...t,
        assignees: (t.assigneeIds || []).map((id) => idToUser.get(id)).filter(Boolean),
      })),
    };

    return res.status(200).json({
      success: true,
      current: { project: currentProject, tasks: currentTasks },
      proposed: proposedHydrated,
      summary: String(result?.summary || '').slice(0, 1000),
      changes: Array.isArray(result?.changes)
        ? result.changes.slice(0, 60).map((c) => ({
            field: String(c?.field || '').slice(0, 120),
            from: String(c?.from ?? '').slice(0, 400),
            to: String(c?.to ?? '').slice(0, 400),
          }))
        : [],
      warnings: Array.from(new Set(warnings)),
    });
  } catch (err) {
    console.error('❌ AI project edit error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Project edit failed.' });
  }
};

export const applyProjectEdits = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, proposed } = req.body;

    if (!projectId) return res.status(400).json({ success: false, message: 'projectId is required.' });
    if (!proposed || typeof proposed !== 'object') {
      return res.status(400).json({ success: false, message: 'proposed is required.' });
    }

    const ctx = await loadProjectContext(projectId, userId);
    if (!ctx.canManage) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const validMemberIds = ctx.members.map((m) => String(m._id));
    const warnings = [];

    // 1. Update project fields + team members
    const sanitizedProject = sanitizeProposedProject(proposed.project || {}, validMemberIds, ctx.project);
    warnings.push(...sanitizedProject.warnings);

    ctx.project.name = sanitizedProject.name;
    ctx.project.description = sanitizedProject.description;
    ctx.project.detailedDescription = sanitizedProject.detailedDescription;
    ctx.project.priority = sanitizedProject.priority;
    ctx.project.projectType = sanitizedProject.projectType;
    ctx.project.tags = sanitizedProject.tags;

    // Team members: keep existing PM (the caller) and rebuild the rest.
    const pmId = userId;
    const otherTeamIds = sanitizedProject.teamMemberIds.filter((id) => id !== pmId);
    const existingTeamById = new Map(
      (ctx.project.teamMembers || []).map((tm) => [String(tm.user?._id || tm.user), tm])
    );
    ctx.project.teamMembers = otherTeamIds.map((id) => {
      const existing = existingTeamById.get(id);
      if (existing) return existing; // preserve joinedAt, role, etc.
      return {
        user: id,
        role: 'member',
        status: 'active',
        joinedAt: new Date(),
      };
    });

    await ctx.project.save();

    // 2. Apply task changes
    const currentTaskById = new Map(ctx.tasks.map((t) => [t._id.toString(), t]));
    const allowedIds = new Set([...validMemberIds, pmId]);
    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    const proposedTasks = Array.isArray(proposed.tasks) ? proposed.tasks : [];
    let orderCursor = ctx.tasks.length;

    for (const t of proposedTasks) {
      if (!t || typeof t !== 'object') continue;

      // Deletion
      if (t._deleted === true && t._id) {
        const found = currentTaskById.get(String(t._id));
        if (found) {
          found.isDeleted = true;
          found.isTrash = true;
          await found.save();
          deletedCount++;
        }
        continue;
      }

      // Existing task — update
      if (t._id && currentTaskById.has(String(t._id))) {
        const doc = currentTaskById.get(String(t._id));
        const sanitized = sanitizeProposedTask(t, validMemberIds, digestTaskForEdit(doc));
        const finalAssignees = sanitized.assigneeIds.filter((id) => allowedIds.has(id));

        doc.title = sanitized.title;
        doc.description = sanitized.description;
        doc.priority = sanitized.priority;
        doc.status = sanitized.status;
        doc.startDate = sanitized.startDate;
        doc.dueDate = sanitized.dueDate;
        doc.estimatedHours = sanitized.estimatedHours;
        doc.bufferTime = sanitized.bufferTime;
        doc.allowAssigneeEditSubtasks = sanitized.allowAssigneeEditSubtasks;
        doc.assignees = finalAssignees;
        doc.subTasks = sanitized.subTasks;
        await doc.save();
        updatedCount++;
        warnings.push(...sanitized.warnings);
        continue;
      }

      // New task
      if (!t._id) {
        const sanitized = sanitizeProposedTask(t, validMemberIds, {});
        const finalAssignees = sanitized.assigneeIds.filter((id) => allowedIds.has(id));
        const status = finalAssignees.length > 0 ? (sanitized.status || 'ready_for_completion') : (sanitized.status || 'pending');

        await Task.create({
          project: ctx.project._id,
          workspace: ctx.project.workspace,
          folder: null,
          title: sanitized.title,
          description: sanitized.description,
          detailedDescription: '',
          taskType: 'general',
          assignees: finalAssignees,
          createdBy: userId,
          status,
          priority: sanitized.priority,
          startDate: sanitized.startDate || new Date(),
          dueDate: sanitized.dueDate,
          bufferTime: sanitized.bufferTime || 0,
          estimatedHours: sanitized.estimatedHours,
          progress: 0,
          subTasks: sanitized.subTasks,
          allowAssigneeEditSubtasks: sanitized.allowAssigneeEditSubtasks,
          dependencies: [],
          links: [],
          attachments: [],
          reminderSent: false,
          recurrenceType: 'none',
          recurrenceDays: [],
          recurrenceEndDate: null,
          order: orderCursor++,
          isArchived: false,
          isTrash: false,
          isDeleted: false,
        });
        createdCount++;
        warnings.push(...sanitized.warnings);
      }
    }

    const populatedProject = await Project.findById(ctx.project._id)
      .populate('projectManagers', 'name email profile')
      .populate('teamMembers.user', 'name email profile')
      .populate('createdBy', 'name email profile');

    const refreshedTasks = await Task.find({
      project: ctx.project._id,
      isDeleted: false,
      isTrash: { $ne: true },
    })
      .populate('assignees', 'name email profile')
      .sort({ order: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      project: populatedProject,
      tasks: refreshedTasks,
      created: createdCount,
      updated: updatedCount,
      deleted: deletedCount,
      warnings: Array.from(new Set(warnings)),
    });
  } catch (err) {
    console.error('❌ AI project apply error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Failed to apply project edits.' });
  }
};

// ═════════════════════════════════════════════════════════════════════
// NEW: PLAN-PREVIEW AI EDITING
// ═════════════════════════════════════════════════════════════════════
//
// Before a plan is committed, the user can iterate on the preview with
// natural language: "make the 2nd task more bulky", "3rd task has too
// many checklist items, reduce it", "add two more tasks". No DB writes.
// ═════════════════════════════════════════════════════════════════════

const PLAN_EDIT_SYSTEM = `
You edit a DRAFT project plan that has NOT been committed yet. The user
gives a short natural-language request. You return the ENTIRE new plan
with the change applied.

The plan has this shape:
{
  "project": {
    "name": "string",
    "description": "string",
    "detailedDescription": "string",
    "priority": "low"|"medium"|"high"|"urgent",
    "projectType": "general"|"client"|"internal"|"marketing"|"product",
    "tags": ["string"],
    "teamMemberIds": ["string"]
  },
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "priority": "low"|"medium"|"high"|"urgent",
      "assigneeIds": ["string"],
      "dueDateOffsetDays": number,
      "subtasks": [
        { "title": "string", "description": "string", "dueDateOffsetDays": number }
      ]
    }
  ]
}

You can change ANY of:
  • Any project field
  • Any task's title, description, priority, assignees, dueDateOffsetDays
  • Any task's subtasks — add, remove, rename, re-date
  • Add new tasks (append to the tasks array)
  • Remove tasks (omit them entirely from the returned array)

STRICT RULES:
1. Only use member IDs from the provided member list. Never invent IDs.
2. Preserve everything the user did NOT ask to change.
3. If the user says "reduce the 3rd task's checklist to 2", keep the
   strongest 2 subtasks of tasks[2] and drop the rest.
4. If the user says "make the 2nd task more bulky", expand its
   description and add 2-4 realistic subtasks.
5. If the user says "add James", find James in the member list, add him
   to project.teamMemberIds, and assign him to relevant tasks.
6. Return the full plan. Do not return a diff. Keep every existing
   task unless the user asked to remove it.
7. Keep dueDateOffsetDays as relative day offsets from today.

Return STRICT JSON only:
{
  "plan": {
    "project": { ...same shape... },
    "tasks": [ ...same shape... ]
  },
  "summary": "string (1-3 sentences about what changed)",
  "changes": [
    { "field": "string", "from": "string", "to": "string" }
  ]
}
`.trim();

export const editPlanPreview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, plan, prompt } = req.body;

    if (!workspaceId) return res.status(400).json({ success: false, message: 'workspaceId is required.' });
    if (!plan || typeof plan !== 'object' || !plan.project || !Array.isArray(plan.tasks)) {
      return res.status(400).json({ success: false, message: 'A valid plan is required.' });
    }
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'prompt is required.' });
    }
    if (prompt.length > 3000) {
      return res.status(400).json({ success: false, message: 'Prompt is too long (max 3000 chars).' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found.' });
    if (!canManageWorkspace(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only the workspace owner or admins can edit AI plans.',
      });
    }

    // Members of the workspace (same set as planWithAI).
    const activeMemberships = workspace.members.filter((m) => m.status === 'active');
    const userIds = activeMemberships.map((m) => m.user?._id || m.user).filter(Boolean);
    const ownerId = workspace.owner?._id || workspace.owner;
    if (ownerId && !userIds.some((id) => id.toString() === ownerId.toString())) userIds.push(ownerId);

    const users = await User.find({ _id: { $in: userIds } }).select('name email profile title skills');
    const roleMap = new Map();
    activeMemberships.forEach((m) => {
      const id = (m.user?._id || m.user)?.toString();
      if (id) roleMap.set(id, m.role);
    });
    if (ownerId) roleMap.set(ownerId.toString(), 'Owner');

    const memberContext = users.map((u) => ({
      id: String(u._id),
      name: u.name,
      role: roleMap.get(u._id.toString()) || 'Member',
      title: u.title || null,
      skills: u.skills || [],
    }));

    // Strip hydrated user objects down to IDs before sending to the AI —
    // keeps the prompt small and prevents it from inventing fields.
    const cleanPlan = {
      project: {
        name: plan.project.name,
        description: plan.project.description,
        detailedDescription: plan.project.detailedDescription,
        priority: plan.project.priority,
        projectType: plan.project.projectType,
        tags: plan.project.tags || [],
        teamMemberIds: (plan.project.teamMemberIds || plan.project.teamMembers || [])
          .map((m) => String(m?._id || m))
          .filter(Boolean),
      },
      tasks: (plan.tasks || []).map((t) => ({
        title: t.title,
        description: t.description,
        priority: t.priority,
        assigneeIds: (t.assigneeIds || t.assignees || [])
          .map((a) => String(a?._id || a))
          .filter(Boolean),
        dueDateOffsetDays: t.dueDateOffsetDays,
        subtasks: (t.subtasks || t.subTasks || []).map((s) => ({
          title: s.title,
          description: s.description || '',
          dueDateOffsetDays: s.dueDateOffsetDays,
        })),
      })),
    };

    const user = `
WORKSPACE: ${workspace.name}

AVAILABLE MEMBERS (ONLY use these IDs):
${JSON.stringify(memberContext, null, 2)}

CURRENT PLAN:
${JSON.stringify(cleanPlan, null, 2)}

USER REQUEST:
${prompt.trim()}
`.trim();

    let result;
    try {
      result = await callGroqForEdit({ system: PLAN_EDIT_SYSTEM, user, temperature: 0.3, maxTokens: 8192 });
    } catch (err) {
      console.error('❌ editPlanPreview Groq failed:', err);
      return res.status(502).json({
        success: false,
        message: 'The AI could not process that edit right now. Please try again.',
      });
    }

    const validIds = memberContext.map((m) => m.id);
    const sanitized = sanitizePlan(result?.plan || cleanPlan, validIds);

    // Re-hydrate member objects for the frontend preview.
    const idToUser = new Map(memberContext.map((m) => [m.id, { _id: m.id, name: m.name, email: m.email, profile: null, title: m.title, skills: m.skills }]));

    const hydrated = {
      project: {
        ...sanitized.project,
        teamMembers: sanitized.project.teamMemberIds.map((id) => idToUser.get(id)).filter(Boolean),
      },
      tasks: sanitized.tasks.map((t) => ({
        ...t,
        assignees: t.assigneeIds.map((id) => idToUser.get(id)).filter(Boolean),
      })),
      warnings: sanitized.warnings,
    };

    return res.status(200).json({
      success: true,
      plan: hydrated,
      summary: String(result?.summary || '').slice(0, 800),
      changes: Array.isArray(result?.changes)
        ? result.changes.slice(0, 40).map((c) => ({
            field: String(c?.field || '').slice(0, 120),
            from: String(c?.from ?? '').slice(0, 300),
            to: String(c?.to ?? '').slice(0, 300),
          }))
        : [],
      warnings: sanitized.warnings,
    });
  } catch (err) {
    console.error('❌ AI plan edit error:', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Plan edit failed.' });
  }
};