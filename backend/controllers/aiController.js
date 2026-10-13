// controllers/aiController.js
import mongoose from 'mongoose';
import Project from '../models/projectModel.js';
import Task from '../models/taskModel.js';
import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import { Message, Chat } from '../models/messagingModel.js';
import WorkspaceNote from '../models/workspaceNoteModel.js';
import ClockIn from '../models/clockInModel.js';
import Call from '../models/call.js';
import { v4 as uuidv4 } from 'uuid';

import {
  planProject,
  reviewProject,
  summarizeProject,
  explainContext,
  generateProjectDocs,
  askXircle,
  runAgent,
} from '../services/geminiService.js';
import { buildUserContext } from '../services/xircleContextService.js';
import { createAndSendNotification } from './notificationController.js';
import { getIO } from './socket.js';

// ═════════════════════════════════════════════════════════════════════
// INLINE MODEL — AI chat conversations
// ═════════════════════════════════════════════════════════════════════
const aiConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    title: { type: String, default: 'New conversation' },
    messages: [
      {
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, default: '' },
        toolCalls: { type: mongoose.Schema.Types.Mixed, default: [] },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    lastMessageAt: { type: Date, default: Date.now },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

aiConversationSchema.index({ user: 1, lastMessageAt: -1 });

const AIConversation =
  mongoose.models.AIConversation ||
  mongoose.model('AIConversation', aiConversationSchema);

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

const TASK_STATUS_ENUM = [
  'pending',
  'in-progress',
  'ready_for_completion',
  'completed',
  'confirmed_completed',
  'cancelled',
];
const SUBTASK_STATUS_ENUM = ['pending', 'done', 'confirmed'];

// ─────────────────────────────────────────────────────────────────────
// INLINE GROQ CLIENT (for edit endpoints)
// ─────────────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const stripCodeFences = (t) =>
  t.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGroqForEdit({ system, user, temperature = 0.3, maxTokens = 8192 }) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');

  const body = {
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature,
    max_tokens: maxTokens,
  };

  let response;
  let attempt = 0;
  while (attempt < 3) {
    attempt++;
    try {
      response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(`Groq request failed: ${err.message}`);
    }

    if (response.ok) break;

    if (response.status === 429) {
      const errBody = await response.text().catch(() => '');
      const match = errBody.match(/in\s+([\d.]+)s/);
      const waitSec = match ? Math.ceil(parseFloat(match[1])) + 1 : 18;
      if (attempt < 3) {
        console.warn(`⏳ Groq 429 — retrying in ${waitSec}s (attempt ${attempt}/3)`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw new Error('Groq rate limit reached. Try again in a moment.');
    }

    const errBody = await response.text().catch(() => '');
    throw new Error(`Groq API error (${response.status}): ${errBody.slice(0, 300)}`);
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

// ═════════════════════════════════════════════════════════════════════
// WEB SEARCH
// ═════════════════════════════════════════════════════════════════════
async function performWebSearch(query, maxResults = 5) {
  const q = String(query || '').trim().slice(0, 400);
  if (!q) return { error: 'Empty query.' };

  const limit = Math.min(Math.max(Number(maxResults) || 5, 1), 10);
  const TAVILY = process.env.TAVILY_API_KEY;
  const BRAVE = process.env.BRAVE_SEARCH_API_KEY;
  const SERPER = process.env.SERPER_API_KEY;

  try {
    if (TAVILY) {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY,
          query: q,
          search_depth: 'basic',
          max_results: limit,
          include_answer: true,
          include_raw_content: false,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        return { error: `Tavily error (${res.status}): ${t.slice(0, 200)}` };
      }
      const data = await res.json();
      return {
        provider: 'tavily',
        query: q,
        answer: data.answer || null,
        results: (data.results || []).map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
        })),
      };
    }

    if (BRAVE) {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${limit}`;
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': BRAVE,
        },
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        return { error: `Brave error (${res.status}): ${t.slice(0, 200)}` };
      }
      const data = await res.json();
      const items = data?.web?.results || [];
      return {
        provider: 'brave',
        query: q,
        answer: data?.infobox?.description || null,
        results: items.slice(0, limit).map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.description,
        })),
      };
    }

    if (SERPER) {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': SERPER,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q, num: limit }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        return { error: `Serper error (${res.status}): ${t.slice(0, 200)}` };
      }
      const data = await res.json();
      const items = data?.organic || [];
      return {
        provider: 'serper',
        query: q,
        answer: data?.answerBox?.answer || data?.answerBox?.snippet || null,
        results: items.slice(0, limit).map((r) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
        })),
      };
    }

    return {
      error:
        'No web-search provider configured. Set TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, or SERPER_API_KEY.',
    };
  } catch (err) {
    return { error: `Web search failed: ${err.message}` };
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
// TASK-LEVEL SANITIZER
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
// PLAN SANITIZER
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

// ─────────────────────────────────────────────────────────────────────
// loadProjectContext
// ─────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────
// digestTaskForEdit
// ─────────────────────────────────────────────────────────────────────
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
// EXISTING ENDPOINTS
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
// TASK-LEVEL AI EDITING
// ═════════════════════════════════════════════════════════════════════

const TASK_EDIT_SYSTEM = `
You edit an existing task inside a team delivery app. The user gives a
short natural-language request. You return the ENTIRE new state of the
task, with the change applied.

STRICT RULES:
1. Only use member IDs from the provided member list.
2. Preserve everything the user did NOT ask to change.
3. Return the full new task state. Do not return a diff.
4. Do NOT invent facts.

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
  "summary": "string",
  "changes": [{ "field": "string", "from": "string", "to": "string" }]
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
        message: err.message || 'The AI could not process that edit right now. Please try again.',
      });
    }

    const validMemberIds = ctx.members.map((m) => String(m._id));
    const sanitized = sanitizeProposedTask(result?.proposed || {}, validMemberIds, currentTask);

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
// PROJECT-LEVEL AI EDITING
// ═════════════════════════════════════════════════════════════════════

const PROJECT_EDIT_SYSTEM = `
You edit an existing project in a team delivery app. Return the ENTIRE
new state — project fields AND the full task list.

STRICT RULES:
1. Only use member IDs from the provided member list.
2. Preserve everything the user did NOT ask to change.
3. Return the full new project state.

Return STRICT JSON only:
{
  "proposed": {
    "project": {
      "name": "string", "description": "string", "detailedDescription": "string",
      "priority": "low"|"medium"|"high"|"urgent",
      "projectType": "general"|"client"|"internal"|"marketing"|"product",
      "tags": ["string"], "teamMemberIds": ["string"]
    },
    "tasks": [
      {
        "_id": "string (existing task) — OMIT for new tasks",
        "_deleted": true (only if removing),
        "title": "string", "description": "string",
        "priority": "low"|"medium"|"high"|"urgent",
        "status": "pending"|"in-progress"|"ready_for_completion"|"completed"|"confirmed_completed"|"cancelled",
        "startDate": "ISO date" | null, "dueDate": "ISO date" | null,
        "estimatedHours": number | null, "bufferTime": number,
        "assigneeIds": ["string"],
        "subTasks": [{ "title": "string", "description": "string", "dueDate": "ISO"|null, "status": "pending"|"done"|"confirmed" }]
      }
    ]
  },
  "summary": "string",
  "changes": [{ "field": "string", "from": "string", "to": "string" }]
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
        message: err.message || 'The AI could not process that edit right now. Please try again.',
      });
    }

    const validMemberIds = ctx.members.map((m) => String(m._id));
    const warnings = [];

    const sanitizedProject = sanitizeProposedProject(
      result?.proposed?.project || {},
      validMemberIds,
      currentProject
    );
    warnings.push(...sanitizedProject.warnings);

    const currentTaskById = new Map(currentTasks.map((t) => [t._id, t]));
    const proposedTasksRaw = Array.isArray(result?.proposed?.tasks) ? result.proposed.tasks : [];
    const sanitizedTasks = [];

    for (const raw of proposedTasksRaw) {
      if (!raw || typeof raw !== 'object') continue;

      if (raw._deleted === true) {
        const id = String(raw._id || '');
        if (currentTaskById.has(id)) sanitizedTasks.push({ _id: id, _deleted: true });
        continue;
      }

      if (raw._id && currentTaskById.has(String(raw._id))) {
        const fallback = currentTaskById.get(String(raw._id));
        const clean = sanitizeProposedTask(raw, validMemberIds, fallback);
        sanitizedTasks.push({ _id: String(raw._id), ...clean });
        warnings.push(...clean.warnings);
        continue;
      }

      if (!raw._id) {
        const clean = sanitizeProposedTask(raw, validMemberIds, {});
        sanitizedTasks.push({ _tempId: `new-${sanitizedTasks.length}`, ...clean });
        warnings.push(...clean.warnings);
        continue;
      }

      warnings.push(`Dropped unknown task "${raw.title || raw._id}".`);
    }

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

    const sanitizedProject = sanitizeProposedProject(proposed.project || {}, validMemberIds, ctx.project);
    warnings.push(...sanitizedProject.warnings);

    ctx.project.name = sanitizedProject.name;
    ctx.project.description = sanitizedProject.description;
    ctx.project.detailedDescription = sanitizedProject.detailedDescription;
    ctx.project.priority = sanitizedProject.priority;
    ctx.project.projectType = sanitizedProject.projectType;
    ctx.project.tags = sanitizedProject.tags;

    const pmId = userId;
    const otherTeamIds = sanitizedProject.teamMemberIds.filter((id) => id !== pmId);
    const existingTeamById = new Map(
      (ctx.project.teamMembers || []).map((tm) => [String(tm.user?._id || tm.user), tm])
    );
    ctx.project.teamMembers = otherTeamIds.map((id) => {
      const existing = existingTeamById.get(id);
      if (existing) return existing;
      return { user: id, role: 'member', status: 'active', joinedAt: new Date() };
    });

    await ctx.project.save();

    const currentTaskById = new Map(ctx.tasks.map((t) => [t._id.toString(), t]));
    const allowedIds = new Set([...validMemberIds, pmId]);
    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    const proposedTasks = Array.isArray(proposed.tasks) ? proposed.tasks : [];
    let orderCursor = ctx.tasks.length;

    for (const t of proposedTasks) {
      if (!t || typeof t !== 'object') continue;

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
// PLAN-PREVIEW AI EDITING
// ═════════════════════════════════════════════════════════════════════

const PLAN_EDIT_SYSTEM = `
You edit a DRAFT project plan that has NOT been committed yet. Return
the ENTIRE new plan with the change applied.

STRICT RULES:
1. Only use member IDs from the provided member list.
2. Preserve everything the user did NOT ask to change.
3. Return the full plan.

Return STRICT JSON only:
{
  "plan": {
    "project": { "name": "string", "description": "string", "detailedDescription": "string",
      "priority": "low"|"medium"|"high"|"urgent",
      "projectType": "general"|"client"|"internal"|"marketing"|"product",
      "tags": ["string"], "teamMemberIds": ["string"] },
    "tasks": [ { "title": "string", "description": "string",
      "priority": "low"|"medium"|"high"|"urgent",
      "assigneeIds": ["string"], "dueDateOffsetDays": number,
      "subtasks": [{ "title": "string", "description": "string", "dueDateOffsetDays": number }] } ]
  },
  "summary": "string",
  "changes": [{ "field": "string", "from": "string", "to": "string" }]
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
        message: err.message || 'The AI could not process that edit right now. Please try again.',
      });
    }

    const validIds = memberContext.map((m) => m.id);
    const sanitized = sanitizePlan(result?.plan || cleanPlan, validIds);

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

// ═════════════════════════════════════════════════════════════════════
// ── FLEXIBLE CHAT WITH TOOLS + WEB SEARCH ────────────────────────────
// ═════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────
// Tool schemas
// ─────────────────────────────────────────────────────────────────────
const AI_TOOLS = [
  // ── WEB ──────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the internet. Use for current events, news, recent facts, or when unsure. Returns titles, snippets, URLs — synthesize an answer and cite sources.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query.' },
          maxResults: { type: 'number', description: '1-10, default 5.' },
        },
        required: ['query'],
      },
    },
  },

  // ── WORKSPACE READ ──────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_workspace_summary',
      description: 'Overview of a workspace: members, projects, open tasks, today\'s clock-ins.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' } },
        required: ['workspaceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_workspace_members',
      description: 'Active members with name, role, department.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' } },
        required: ['workspaceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_member_profile',
      description: 'Profile of a member: role, department, tasks assigned/completed, clock-ins.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          userId: { type: 'string' },
          nameQuery: { type: 'string' },
        },
        required: ['workspaceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_projects',
      description: 'List projects in a workspace with status, progress, team size.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          status: { type: 'string', enum: ['planning', 'in-progress', 'completed', 'on-hold', 'cancelled', 'all'] },
        },
        required: ['workspaceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_details',
      description: 'Full project: description, status, team, all tasks.',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_tasks',
      description: 'Tasks assigned to the caller.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'in-progress', 'ready_for_completion', 'completed', 'confirmed_completed', 'cancelled', 'all'] },
          overdue: { type: 'boolean' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_task_details',
      description: 'Full details of one task: subtasks, assignees, comments.',
      parameters: {
        type: 'object',
        properties: { taskId: { type: 'string' } },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_clock_in_status',
      description: 'Caller\'s clock-in status today + workspace schedule.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' } },
        required: ['workspaceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_clock_in_history',
      description: 'Caller\'s clock-in history.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['workspaceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_attendance_summary',
      description: 'Attendance summary (admin/owner only).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['workspaceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_scheduled_calls',
      description: 'Caller\'s upcoming scheduled calls.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_unread_chats',
      description: 'Caller\'s unread chats and counts.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_workspace',
      description: 'Search tasks, projects, notes by keyword.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          query: { type: 'string' },
        },
        required: ['workspaceId', 'query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_recent_activity',
      description: 'Caller\'s activity over last N days.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          days: { type: 'number' },
        },
        required: ['workspaceId'],
      },
    },
  },

  // ── WORKSPACE WRITE ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'clock_in',
      description: 'Clock caller in NOW.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' } },
        required: ['workspaceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clock_out',
      description: 'Clock caller out NOW. Reason required if before closing time.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['workspaceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_call',
      description: 'Schedule a future call (ISO timestamp).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          type: { type: 'string', enum: ['audio', 'video'] },
          participantIds: { type: 'array', items: { type: 'string' } },
          scheduledAt: { type: 'string' },
        },
        required: ['workspaceId', 'type', 'participantIds', 'scheduledAt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_call_now',
      description: 'Start a call immediately and ring everyone.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          type: { type: 'string', enum: ['audio', 'video'] },
          participantIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['workspaceId', 'type', 'participantIds'],
      },
    },
  },

  // ── MESSAGING ───────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'send_chat_message',
      description:
        'Send a message into a chat you already have the chatId for. Use only when you already have a chatId from a previous tool result — otherwise use send_message_to_user.',
      parameters: {
        type: 'object',
        properties: {
          chatId: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['chatId', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_or_create_direct_chat',
      description:
        'Find the direct chat between the caller and a workspace member by NAME or userId. Creates the chat if it doesn\'t exist. Returns the chatId.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          userId: { type: 'string', description: 'Target user ID (optional if nameQuery is given).' },
          nameQuery: { type: 'string', description: 'Person\'s name to search for (optional if userId is given).' },
        },
        required: ['workspaceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_message_to_user',
      description:
        'Send a direct message to ONE workspace member by NAME or userId. Automatically finds or creates the direct chat and sends the message. For 2+ recipients, use send_message_to_many instead.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          userId: { type: 'string', description: 'Target user ID (optional if nameQuery is given).' },
          nameQuery: { type: 'string', description: 'Person\'s name to search for (optional if userId is given).' },
          content: { type: 'string', description: 'The message text to send.' },
        },
        required: ['workspaceId', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_message_to_many',
      description:
        'Send the same direct message to MULTIPLE workspace members in one call. Use this for "message everyone", "tell all members", "remind the whole team", or "message X, Y, and Z". Set allMembers:true to target every active member. NEVER loop send_message_to_user for broadcasts — use this instead.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          content: { type: 'string', description: 'The message text to send to each person.' },
          allMembers: {
            type: 'boolean',
            description: 'Set true to send to every active member of the workspace (except the caller).',
          },
          recipients: {
            type: 'array',
            description: 'Explicit list when not using allMembers. Each item: { userId } or { nameQuery }.',
            items: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                nameQuery: { type: 'string' },
              },
            },
          },
        },
        required: ['workspaceId', 'content'],
      },
    },
  },

  // ── TASK WRITE ──────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a task in a project.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          assigneeIds: { type: 'array', items: { type: 'string' } },
          dueDate: { type: 'string' },
        },
        required: ['projectId', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task_status',
      description: 'Update a task\'s status.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'in-progress', 'ready_for_completion', 'completed', 'confirmed_completed', 'cancelled'] },
        },
        required: ['taskId', 'status'],
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────
// Workspace access helper
// ─────────────────────────────────────────────────────────────────────
async function canAccessWorkspace(workspace, userId) {
  if (!workspace) return false;
  const ownerId = (workspace.owner?._id || workspace.owner)?.toString();
  if (ownerId === userId) return true;
  return (workspace.members || []).some(
    (m) => (m.user?._id || m.user)?.toString() === userId && m.status === 'active'
  );
}

// ─────────────────────────────────────────────────────────────────────
// Fuzzy member lookup by name inside a workspace
// ─────────────────────────────────────────────────────────────────────
async function resolveWorkspaceMemberByName(workspace, query, excludeUserId) {
  const allUserIds = [
    workspace.owner?.toString(),
    ...(workspace.members || []).map((m) => (m.user?._id || m.user)?.toString()),
  ]
    .filter(Boolean)
    .filter((id) => id !== excludeUserId);

  if (allUserIds.length === 0) return null;

  const users = await User.find({ _id: { $in: allUserIds } }).select('name email');
  const q = String(query || '').toLowerCase().trim();
  if (!q) return null;

  // 1. Exact name match
  let hit = users.find((u) => u.name?.toLowerCase() === q);
  if (hit) return hit;

  // 2. Full substring match
  hit = users.find((u) => u.name?.toLowerCase().includes(q));
  if (hit) return hit;

  // 3. All query words present in the name
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (words.length > 0) {
    hit = users.find((u) => words.every((w) => u.name?.toLowerCase().includes(w)));
    if (hit) return hit;
  }

  // 4. Any word matches (loose fallback)
  if (words.length > 1) {
    hit = users.find((u) => words.some((w) => u.name?.toLowerCase().includes(w)));
    if (hit) return hit;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Find or create a direct chat between two users in a workspace
// ─────────────────────────────────────────────────────────────────────
async function findOrCreateDirectChat(workspace, userId, targetId) {
  let chat = await Chat.findOne({
    workspace: workspace._id,
    type: 'direct',
    participants: {
      $all: [
        { $elemMatch: { user: userId } },
        { $elemMatch: { user: targetId } },
      ],
    },
    $expr: { $eq: [{ $size: '$participants' }, 2] },
  });

  let isNew = false;
  if (!chat) {
    chat = await Chat.create({
      workspace: workspace._id,
      type: 'direct',
      scope: 'workspace',
      participants: [
        { user: userId, role: 'member', joinedAt: new Date(), online: false, lastSeen: new Date() },
        { user: targetId, role: 'member', joinedAt: new Date(), online: false, lastSeen: new Date() },
      ],
      createdBy: userId,
      lastMessageAt: new Date(),
      isPublic: false,
      joinRequests: [],
    });
    isNew = true;
  }

  return { chat, isNew };
}

// ─────────────────────────────────────────────────────────────────────
// Tool executor
// ─────────────────────────────────────────────────────────────────────
function buildToolExecutor(userId) {
  return async function executeTool(name, args = {}) {
    try {
      switch (name) {
        // ─── WEB SEARCH ─────────────────────────────────────────
        case 'web_search': {
          return await performWebSearch(args.query, args.maxResults || 5);
        }

        // ─── WORKSPACE READ ─────────────────────────────────────
        case 'get_workspace_summary': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const [projectCount, openTaskCount] = await Promise.all([
            Project.countDocuments({ workspace: ws._id, isTrash: { $ne: true } }),
            Task.countDocuments({
              workspace: ws._id,
              isDeleted: false,
              isTrash: { $ne: true },
              status: { $nin: ['confirmed_completed', 'cancelled'] },
            }),
          ]);

          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const clockedInToday = await ClockIn.countDocuments({
            workspace: ws._id,
            clockInTime: { $gte: todayStart },
          });

          return {
            id: ws._id.toString(),
            name: ws.name,
            industry: ws.industry,
            memberCount: (ws.members || []).filter((m) => m.status === 'active').length,
            projectCount,
            openTaskCount,
            clockedInToday,
            clockInEnabled: !!ws.clockInEnabled,
            clockInStart: ws.clockInStart || null,
            clockInEnd: ws.clockInEnd || null,
            closingTime: ws.closingTime || null,
          };
        }

        case 'list_workspace_members': {
          const ws = await Workspace.findById(args.workspaceId)
            .populate('owner', 'name email profile')
            .populate('members.user', 'name email profile')
            .lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const ownerIdStr = (ws.owner?._id || ws.owner)?.toString();
          const list = [];
          if (ws.owner) {
            list.push({
              userId: ownerIdStr,
              name: ws.owner.name,
              email: ws.owner.email,
              role: 'Owner',
              department: 'Management',
              status: 'active',
            });
          }
          for (const m of ws.members || []) {
            const u = m.user;
            if (!u?._id || u._id.toString() === ownerIdStr) continue;
            list.push({
              userId: u._id.toString(),
              name: u.name,
              email: u.email,
              role: m.role,
              department: m.department || null,
              status: m.status,
              joinedAt: m.joinedAt || null,
            });
          }
          return { workspaceName: ws.name, members: list };
        }

        case 'get_member_profile': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          let targetId = args.userId || userId;

          if (!args.userId && args.nameQuery) {
            const hit = await resolveWorkspaceMemberByName(ws, args.nameQuery, null);
            if (!hit) return { error: `No member matching "${args.nameQuery}".` };
            targetId = hit._id.toString();
          }

          const user = await User.findById(targetId).select('name email profile title skills createdAt').lean();
          if (!user) return { error: 'User not found.' };

          const membership = (ws.members || []).find(
            (m) => (m.user?._id || m.user)?.toString() === targetId
          );
          const isOwner = ws.owner?.toString() === targetId;

          const [assigned, completed, recentClockIns] = await Promise.all([
            Task.countDocuments({ workspace: ws._id, assignees: targetId, isDeleted: false, isTrash: { $ne: true } }),
            Task.countDocuments({ workspace: ws._id, assignees: targetId, status: 'confirmed_completed' }),
            ClockIn.find({ workspace: ws._id, user: targetId }).sort({ clockInTime: -1 }).limit(10).lean(),
          ]);

          return {
            userId: targetId,
            name: user.name,
            email: user.email,
            title: user.title || null,
            skills: user.skills || [],
            role: isOwner ? 'Owner' : membership?.role || 'Member',
            department: membership?.department || null,
            joinedWorkspaceAt: membership?.joinedAt || null,
            accountCreatedAt: user.createdAt,
            tasksAssigned: assigned,
            tasksCompleted: completed,
            recentClockIns: recentClockIns.map((c) => ({
              clockInTime: c.clockInTime,
              clockOutTime: c.clockOutTime,
              status: c.status,
            })),
          };
        }

        case 'list_projects': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const query = { workspace: ws._id, isTrash: { $ne: true } };
          if (args.status && args.status !== 'all') query.status = args.status;

          const projects = await Project.find(query)
            .select('name status priority progress teamMembers startDate endDate')
            .sort({ createdAt: -1 })
            .limit(30)
            .lean();

          return {
            count: projects.length,
            projects: projects.map((p) => ({
              id: p._id.toString(),
              name: p.name,
              status: p.status,
              priority: p.priority,
              progress: p.progress,
              teamSize: (p.teamMembers || []).length,
              startDate: p.startDate,
              endDate: p.endDate,
            })),
          };
        }

        case 'get_project_details': {
          const project = await Project.findById(args.projectId)
            .populate('projectManagers', 'name email')
            .populate('teamMembers.user', 'name email')
            .lean();
          if (!project) return { error: 'Project not found.' };
          const ws = await Workspace.findById(project.workspace).lean();
          if (!ws || !(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const tasks = await Task.find({
            project: project._id,
            isDeleted: false,
            isTrash: { $ne: true },
          })
            .populate('assignees', 'name')
            .select('title status priority dueDate progress assignees subTasks')
            .sort({ order: 1 })
            .lean();

          return {
            id: project._id.toString(),
            name: project.name,
            description: project.description,
            detailedDescription: project.detailedDescription,
            status: project.status,
            priority: project.priority,
            progress: project.progress,
            startDate: project.startDate,
            endDate: project.endDate,
            team: (project.teamMembers || [])
              .filter((tm) => tm.status === 'active')
              .map((tm) => ({
                userId: (tm.user?._id || tm.user)?.toString(),
                name: tm.user?.name,
                role: tm.role,
              })),
            projectManagers: (project.projectManagers || []).map((pm) => ({
              userId: (pm._id || pm).toString(),
              name: pm.name,
            })),
            tasks: tasks.map((t) => ({
              id: t._id.toString(),
              title: t.title,
              status: t.status,
              priority: t.priority,
              dueDate: t.dueDate,
              progress: t.progress,
              assignees: (t.assignees || []).map((a) => ({ userId: a._id.toString(), name: a.name })),
              subtaskCount: (t.subTasks || []).length,
              confirmedSubtasks: (t.subTasks || []).filter((s) => s.status === 'confirmed').length,
            })),
          };
        }

        case 'list_my_tasks': {
          const query = {
            assignees: userId,
            isDeleted: false,
            isTrash: { $ne: true },
            isArchived: { $ne: true },
          };
          if (args.workspaceId) query.workspace = args.workspaceId;
          if (args.status && args.status !== 'all') query.status = args.status;
          if (args.overdue) {
            query.dueDate = { $lt: new Date() };
            if (!query.status) query.status = { $nin: ['confirmed_completed', 'completed', 'cancelled'] };
          }

          const tasks = await Task.find(query)
            .populate('project', 'name')
            .select('title status priority dueDate progress project')
            .sort({ dueDate: 1 })
            .limit(Math.min(args.limit || 30, 60))
            .lean();

          return {
            count: tasks.length,
            tasks: tasks.map((t) => ({
              id: t._id.toString(),
              title: t.title,
              status: t.status,
              priority: t.priority,
              dueDate: t.dueDate,
              progress: t.progress,
              projectName: t.project?.name || null,
              projectId: t.project?._id?.toString() || null,
              overdue: !!(t.dueDate && new Date(t.dueDate) < new Date() && !['completed', 'confirmed_completed', 'cancelled'].includes(t.status)),
            })),
          };
        }

        case 'get_task_details': {
          const task = await Task.findById(args.taskId)
            .populate('assignees', 'name email')
            .populate('createdBy', 'name')
            .lean();
          if (!task) return { error: 'Task not found.' };
          const ws = await Workspace.findById(task.workspace).lean();
          if (!ws || !(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          return {
            id: task._id.toString(),
            title: task.title,
            description: task.description,
            detailedDescription: task.detailedDescription,
            status: task.status,
            priority: task.priority,
            startDate: task.startDate,
            dueDate: task.dueDate,
            progress: task.progress,
            assignees: (task.assignees || []).map((a) => ({ userId: a._id.toString(), name: a.name, email: a.email })),
            createdBy: task.createdBy ? { userId: task.createdBy._id.toString(), name: task.createdBy.name } : null,
            subtasks: (task.subTasks || []).map((s) => ({
              title: s.title,
              status: s.status,
              dueDate: s.dueDate,
            })),
          };
        }

        case 'get_clock_in_status': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

          const record = await ClockIn.findOne({
            user: userId,
            workspace: ws._id,
            clockInTime: { $gte: todayStart, $lt: tomorrowStart },
          }).sort({ clockInTime: -1 }).lean();

          return {
            clockInEnabled: !!ws.clockInEnabled,
            window: { start: ws.clockInStart, end: ws.clockInEnd },
            closingTime: ws.closingTime,
            todayRecord: record
              ? {
                  clockInTime: record.clockInTime,
                  clockOutTime: record.clockOutTime,
                  status: record.status,
                  isLate: record.isLate,
                  lateMinutes: record.lateMinutes,
                }
              : null,
          };
        }

        case 'get_clock_in_history': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const records = await ClockIn.find({ workspace: ws._id, user: userId })
            .sort({ clockInTime: -1 })
            .limit(Math.min(args.limit || 15, 60))
            .lean();

          return {
            count: records.length,
            records: records.map((r) => ({
              clockInTime: r.clockInTime,
              clockOutTime: r.clockOutTime,
              status: r.status,
              isLate: r.isLate,
              lateMinutes: r.lateMinutes,
              autoClockedOut: r.autoClockedOut,
            })),
          };
        }

        case 'get_attendance_summary': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          const isOwner = ws.owner?.toString() === userId;
          const isAdmin = (ws.members || []).some(
            (m) => (m.user?._id || m.user)?.toString() === userId && m.role === 'Admin' && m.status === 'active'
          );
          if (!isOwner && !isAdmin) return { error: 'Only owner or admin can view attendance.' };

          const dateKey = args.date || new Date().toISOString().slice(0, 10);
          const start = new Date(`${dateKey}T00:00:00.000Z`);
          const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

          const records = await ClockIn.find({
            workspace: ws._id,
            clockInTime: { $gte: start, $lt: end },
          }).populate('user', 'name email').lean();

          const activeMembers = (ws.members || []).filter((m) => m.status === 'active');
          const clockedInIds = new Set(records.map((r) => r.user?._id?.toString()).filter(Boolean));
          const notClockedIn = activeMembers
            .filter((m) => !clockedInIds.has((m.user?._id || m.user)?.toString()))
            .map((m) => m.user?.name || 'Unknown');

          return {
            date: dateKey,
            clockedIn: records.map((r) => ({
              name: r.user?.name || 'Unknown',
              clockInTime: r.clockInTime,
              clockOutTime: r.clockOutTime,
              status: r.status,
              isLate: r.isLate,
            })),
            notClockedIn,
            totals: { clockedIn: records.length, notClockedIn: notClockedIn.length },
          };
        }

        case 'list_scheduled_calls': {
          const query = { 'participants.user': userId, status: 'scheduled' };
          if (args.workspaceId) query.workspace = args.workspaceId;
          const calls = await Call.find(query)
            .populate('creator', 'name')
            .populate('participants.user', 'name')
            .sort({ scheduledAt: 1 })
            .limit(20)
            .lean();
          return {
            count: calls.length,
            calls: calls.map((c) => ({
              id: c._id.toString(),
              type: c.type,
              scheduledAt: c.scheduledAt,
              creator: c.creator?.name,
              participantCount: (c.participants || []).length,
            })),
          };
        }

        case 'get_my_unread_chats': {
          const chats = await Chat.find({ 'participants.user': userId }).select('_id type name participants workspace').lean();
          const chatIds = chats.map((c) => c._id);
          if (chatIds.length === 0) return { count: 0, chats: [] };

          const unreadAgg = await Message.aggregate([
            {
              $match: {
                chat: { $in: chatIds },
                sender: { $ne: new mongoose.Types.ObjectId(userId) },
                isDeleted: false,
                'readBy.user': { $ne: new mongoose.Types.ObjectId(userId) },
              },
            },
            { $group: { _id: '$chat', count: { $sum: 1 } } },
          ]);

          const counts = Object.fromEntries(unreadAgg.map((u) => [u._id.toString(), u.count]));
          const unread = chats
            .filter((c) => counts[c._id.toString()] > 0)
            .map((c) => {
              const other = c.participants?.find((p) => p.user?.toString() !== userId);
              return {
                chatId: c._id.toString(),
                type: c.type,
                name: c.name || other?.user?.toString() || 'Direct chat',
                unreadCount: counts[c._id.toString()],
              };
            });

          return { count: unread.length, chats: unread };
        }

        case 'search_workspace': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const re = new RegExp(String(args.query || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

          const [tasks, projects, notes] = await Promise.all([
            Task.find({ workspace: ws._id, isDeleted: false, isTrash: { $ne: true }, title: re })
              .select('title status priority').limit(10).lean(),
            Project.find({ workspace: ws._id, isTrash: { $ne: true }, name: re })
              .select('name status progress').limit(10).lean(),
            WorkspaceNote.find({ workspace: ws._id, title: re })
              .select('title updatedAt').limit(10).lean(),
          ]);

          return {
            query: args.query,
            tasks: tasks.map((t) => ({ id: t._id.toString(), title: t.title, status: t.status })),
            projects: projects.map((p) => ({ id: p._id.toString(), name: p.name, status: p.status })),
            notes: notes.map((n) => ({ id: n._id.toString(), title: n.title })),
          };
        }

        case 'get_my_recent_activity': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const days = Math.min(args.days || 7, 30);
          const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

          const [createdTasks, completedTasks, sentMessages, clockIns] = await Promise.all([
            Task.countDocuments({ workspace: ws._id, createdBy: userId, createdAt: { $gte: since } }),
            Task.countDocuments({ workspace: ws._id, assignees: userId, status: 'confirmed_completed', updatedAt: { $gte: since } }),
            Message.countDocuments({ workspace: ws._id, sender: userId, createdAt: { $gte: since }, isDeleted: false }),
            ClockIn.countDocuments({ workspace: ws._id, user: userId, clockInTime: { $gte: since } }),
          ]);

          return {
            window: `${days} days`,
            tasksCreated: createdTasks,
            tasksCompleted: completedTasks,
            messagesSent: sentMessages,
            clockIns,
          };
        }

        // ─── WORKSPACE WRITE ────────────────────────────────────
        case 'clock_in': {
          const ws = await Workspace.findById(args.workspaceId);
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };
          if (!ws.clockInEnabled) return { error: 'Clock-in is disabled for this workspace.' };

          const now = new Date();
          const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

          const open = await ClockIn.findOne({
            user: userId, workspace: ws._id,
            date: { $gte: dayStart, $lt: dayEnd },
            clockOutTime: null,
          });
          if (open) return { error: 'You already clocked in today and haven\'t clocked out yet.' };

          const closed = await ClockIn.findOne({
            user: userId, workspace: ws._id,
            date: { $gte: dayStart, $lt: dayEnd },
            clockOutTime: { $ne: null },
          });
          if (closed) return { error: 'You already completed today\'s clock-in cycle.' };

          const minutes = now.getHours() * 60 + now.getMinutes();
          const toMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
          const startM = toMin(ws.clockInStart);
          const endM = toMin(ws.clockInEnd);
          const closingM = toMin(ws.closingTime);

          if (closingM !== null && minutes > closingM) {
            return { error: `Clock-in is closed (after ${ws.closingTime}).` };
          }
          if (startM !== null && minutes < startM) {
            return { error: `Clock-in doesn't open until ${ws.clockInStart}.` };
          }

          const isLate = endM !== null && minutes > endM;
          const lateMinutes = isLate ? minutes - endM : 0;
          const status = isLate ? 'late' : 'on-time';

          const doc = await ClockIn.create({
            user: userId, workspace: ws._id,
            clockInTime: now, date: now,
            status, isLate, lateMinutes, isEarly: !isLate,
          });

          return {
            success: true,
            message: `Clocked in at ${now.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos' })}${isLate ? ` (late by ${lateMinutes} min)` : ' (on time)'}.`,
            clockInId: doc._id.toString(),
            status, isLate, lateMinutes,
          };
        }

        case 'clock_out': {
          const ws = await Workspace.findById(args.workspaceId);
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const now = new Date();
          const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

          const open = await ClockIn.findOne({
            user: userId, workspace: ws._id,
            date: { $gte: dayStart, $lt: dayEnd },
            clockOutTime: null,
          });
          if (!open) return { error: 'You haven\'t clocked in today or already clocked out.' };

          const minutes = now.getHours() * 60 + now.getMinutes();
          const toMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
          const closingM = toMin(ws.closingTime);

          if (closingM !== null && minutes < closingM && !args.reason) {
            return { error: `You're clocking out before ${ws.closingTime}. Please provide a reason.` };
          }

          const clockOutLate = closingM !== null && minutes > closingM;
          const lateMinutes = clockOutLate ? minutes - closingM : 0;

          open.clockOutTime = now;
          open.clockOutLate = clockOutLate;
          open.clockOutLateMinutes = lateMinutes;
          if (args.reason) open.clockOutReason = String(args.reason).slice(0, 500);
          await open.save();

          return {
            success: true,
            message: `Clocked out at ${now.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos' })}.`,
            clockOutId: open._id.toString(),
            clockOutLate, lateMinutes,
          };
        }

        case 'schedule_call': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const when = new Date(args.scheduledAt);
          if (Number.isNaN(when.getTime())) return { error: 'Invalid scheduledAt.' };
          if (when <= new Date()) return { error: 'Scheduled time must be in the future.' };

          const activeIds = new Set([
            ws.owner?.toString(),
            ...(ws.members || []).filter((m) => m.status === 'active').map((m) => (m.user?._id || m.user)?.toString()),
          ]);
          const valid = [...new Set([...(args.participantIds || []), userId])].filter((id) => activeIds.has(id));
          if (valid.length < 2) return { error: 'Not enough valid participants.' };

          const call = await Call.create({
            workspace: ws._id,
            creator: userId,
            type: args.type === 'video' ? 'video' : 'audio',
            roomId: uuidv4(),
            scheduledAt: when,
            status: 'scheduled',
            participants: valid.map((uid) => ({ user: uid, status: 'pending' })),
          });

          for (const uid of valid.filter((id) => id !== userId)) {
            createAndSendNotification({
              recipient: uid,
              title: '📅 Call scheduled',
              body: `A ${call.type} call is scheduled for ${when.toLocaleString()}.`,
              data: { callId: call._id.toString(), roomId: call.roomId, notificationType: 'scheduled_call' },
              sendPush: true,
            }).catch(() => {});
          }

          return {
            success: true,
            message: `Scheduled a ${call.type} call for ${when.toLocaleString()}. ${valid.length} participants will be rung.`,
            callId: call._id.toString(),
            participantCount: valid.length,
          };
        }

        case 'start_call_now': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const activeIds = new Set([
            ws.owner?.toString(),
            ...(ws.members || []).filter((m) => m.status === 'active').map((m) => (m.user?._id || m.user)?.toString()),
          ]);
          const valid = [...new Set([...(args.participantIds || []), userId])].filter((id) => activeIds.has(id));
          if (valid.length < 2) return { error: 'Not enough valid participants.' };

          const call = await Call.create({
            workspace: ws._id,
            creator: userId,
            type: args.type === 'video' ? 'video' : 'audio',
            roomId: uuidv4(),
            status: 'ringing',
            participants: valid.map((uid) => ({
              user: uid,
              status: uid === userId ? 'accepted' : 'ringing',
              joinedAt: uid === userId ? new Date() : null,
            })),
          });

          try {
            const io = getIO();
            for (const uid of valid) {
              io.to(`user:${uid}`).emit('incoming-call', {
                callId: call._id,
                roomId: call.roomId,
                type: call.type,
                workspaceId: ws._id.toString(),
                caller: { _id: userId },
                participants: valid.map((id) => ({ _id: id })),
              });
            }
          } catch (e) { /* io may not be initialized */ }

          for (const uid of valid.filter((id) => id !== userId)) {
            createAndSendNotification({
              recipient: uid,
              title: '📞 Incoming call',
              body: `You have an incoming ${call.type} call.`,
              data: {
                callId: call._id.toString(),
                roomId: call.roomId,
                notificationType: 'call',
                actions: [
                  { action: 'answer', title: 'Answer' },
                  { action: 'decline', title: 'Decline' },
                ],
              },
              sendPush: true,
            }).catch(() => {});
          }

          return {
            success: true,
            message: `Started a ${call.type} call and rang ${valid.length - 1} participant(s).`,
            callId: call._id.toString(),
            roomId: call.roomId,
          };
        }

        // ─── MESSAGING ──────────────────────────────────────────
        case 'send_chat_message': {
          const chat = await Chat.findById(args.chatId);
          if (!chat) return { error: 'Chat not found.' };
          const isPart = (chat.participants || []).some((p) => p.user?.toString() === userId);
          if (!isPart) return { error: 'You are not a participant of this chat.' };

          const content = String(args.content || '').trim().slice(0, 4000);
          if (!content) return { error: 'Message content is empty.' };

          const msg = await Message.create({
            workspace: chat.workspace || null,
            chat: chat._id,
            sender: userId,
            content,
            messageType: 'text',
            readBy: [{ user: userId, readAt: new Date() }],
          });

          chat.lastMessage = msg._id;
          chat.lastMessageAt = new Date();
          await chat.save();

          try {
            const io = getIO();
            io.to(`chat:${chat._id}`).emit('new-message', {
              _id: msg._id, chat: chat._id, sender: userId,
              content, messageType: 'text', createdAt: msg.createdAt,
            });
          } catch (e) { /* ignore */ }

          return { success: true, messageId: msg._id.toString(), message: 'Message sent.' };
        }

        case 'find_or_create_direct_chat': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          let targetId = args.userId || null;

          if (!targetId && args.nameQuery) {
            const hit = await resolveWorkspaceMemberByName(ws, args.nameQuery, userId);
            if (!hit) return { error: `No workspace member matching "${args.nameQuery}".` };
            targetId = hit._id.toString();
          }

          if (!targetId) return { error: 'Provide a userId or nameQuery.' };
          if (targetId === userId) return { error: 'You cannot message yourself.' };

          const isTargetMember =
            targetId === ws.owner?.toString() ||
            (ws.members || []).some(
              (m) => (m.user?._id || m.user)?.toString() === targetId && m.status === 'active'
            );
          if (!isTargetMember) {
            return { error: 'That user is not an active member of this workspace.' };
          }

          const { chat, isNew } = await findOrCreateDirectChat(ws, userId, targetId);
          const target = await User.findById(targetId).select('name email').lean();

          return {
            success: true,
            chatId: chat._id.toString(),
            isNew,
            recipient: { userId: targetId, name: target?.name || 'Unknown' },
            message: isNew
              ? `Created a new direct chat with ${target?.name}.`
              : `Found existing direct chat with ${target?.name}.`,
          };
        }

        case 'send_message_to_user': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          let targetId = args.userId || null;

          if (!targetId && args.nameQuery) {
            const hit = await resolveWorkspaceMemberByName(ws, args.nameQuery, userId);
            if (!hit) return { error: `No workspace member matching "${args.nameQuery}".` };
            targetId = hit._id.toString();
          }

          if (!targetId) return { error: 'Provide a userId or nameQuery.' };
          if (targetId === userId) return { error: 'You cannot message yourself.' };

          const isTargetMember =
            targetId === ws.owner?.toString() ||
            (ws.members || []).some(
              (m) => (m.user?._id || m.user)?.toString() === targetId && m.status === 'active'
            );
          if (!isTargetMember) {
            return { error: 'That user is not an active member of this workspace.' };
          }

          const content = String(args.content || '').trim().slice(0, 4000);
          if (!content) return { error: 'Message content is empty.' };

          const { chat, isNew } = await findOrCreateDirectChat(ws, userId, targetId);

          const msg = await Message.create({
            workspace: chat.workspace || null,
            chat: chat._id,
            sender: userId,
            content,
            messageType: 'text',
            readBy: [{ user: userId, readAt: new Date() }],
          });

          chat.lastMessage = msg._id;
          chat.lastMessageAt = new Date();
          await chat.save();

          try {
            const io = getIO();
            io.to(`chat:${chat._id}`).emit('new-message', {
              _id: msg._id, chat: chat._id, sender: userId,
              content, messageType: 'text', createdAt: msg.createdAt,
            });
          } catch (e) { /* ignore */ }

          const sender = await User.findById(userId).select('name').lean();
          const target = await User.findById(targetId).select('name').lean();

          createAndSendNotification({
            recipient: targetId,
            title: `💬 ${sender?.name || 'Someone'}`,
            body: content.slice(0, 120),
            data: {
              notificationType: 'chat',
              chatId: chat._id.toString(),
              workspaceId: ws._id.toString(),
            },
            sendPush: true,
          }).catch(() => {});

          return {
            success: true,
            chatId: chat._id.toString(),
            messageId: msg._id.toString(),
            recipient: target?.name || 'Unknown',
            isNewChat: isNew,
            message: `${isNew ? 'Started a new chat with' : 'Sent to'} ${target?.name}: "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}"`,
          };
        }

        case 'send_message_to_many': {
          const ws = await Workspace.findById(args.workspaceId).lean();
          if (!ws) return { error: 'Workspace not found.' };
          if (!(await canAccessWorkspace(ws, userId))) return { error: 'Access denied.' };

          const content = String(args.content || '').trim().slice(0, 4000);
          if (!content) return { error: 'Message content is empty.' };

          let targetIds = [];

          if (args.allMembers) {
            targetIds = [
              ws.owner?.toString(),
              ...(ws.members || [])
                .filter((m) => m.status === 'active')
                .map((m) => (m.user?._id || m.user)?.toString()),
            ]
              .filter(Boolean)
              .filter((id) => id !== userId);
          } else if (Array.isArray(args.recipients)) {
            for (const r of args.recipients) {
              let tid = r?.userId || null;
              if (!tid && r?.nameQuery) {
                const hit = await resolveWorkspaceMemberByName(ws, r.nameQuery, userId);
                if (hit) tid = hit._id.toString();
              }
              if (tid && tid !== userId) targetIds.push(tid);
            }
          }

          targetIds = [...new Set(targetIds)];
          if (targetIds.length === 0) return { error: 'No valid recipients found.' };

          const sender = await User.findById(userId).select('name').lean();
          const results = [];

          for (const targetId of targetIds) {
            try {
              const { chat } = await findOrCreateDirectChat(ws, userId, targetId);

              const msg = await Message.create({
                workspace: chat.workspace || null,
                chat: chat._id,
                sender: userId,
                content,
                messageType: 'text',
                readBy: [{ user: userId, readAt: new Date() }],
              });

              chat.lastMessage = msg._id;
              chat.lastMessageAt = new Date();
              await chat.save();

              try {
                const io = getIO();
                io.to(`chat:${chat._id}`).emit('new-message', {
                  _id: msg._id,
                  chat: chat._id,
                  sender: userId,
                  content,
                  messageType: 'text',
                  createdAt: msg.createdAt,
                });
              } catch (e) { /* ignore */ }

              createAndSendNotification({
                recipient: targetId,
                title: `💬 ${sender?.name || 'Someone'}`,
                body: content.slice(0, 120),
                data: {
                  notificationType: 'chat',
                  chatId: chat._id.toString(),
                  workspaceId: ws._id.toString(),
                },
                sendPush: true,
              }).catch(() => {});

              const target = await User.findById(targetId).select('name').lean();
              results.push({ name: target?.name || 'Unknown', ok: true });
            } catch (err) {
              results.push({ name: `User ${targetId}`, ok: false, error: err.message });
            }
          }

          const sent = results.filter((r) => r.ok);
          const failed = results.filter((r) => !r.ok);
          const names = sent.map((r) => r.name).join(', ') || 'nobody';

          return {
            success: true,
            sentCount: sent.length,
            failedCount: failed.length,
            recipients: results,
            message: `Sent to ${sent.length} ${sent.length === 1 ? 'person' : 'people'}: ${names}${failed.length ? ` — ${failed.length} failed` : ''}`,
          };
        }

        // ─── TASK WRITE ─────────────────────────────────────────
        case 'create_task': {
          const project = await Project.findById(args.projectId);
          if (!project) return { error: 'Project not found.' };
          const ws = await Workspace.findById(project.workspace);
          if (!ws) return { error: 'Workspace not found.' };

          const isOwner = ws.owner?.toString() === userId;
          const isAdmin = (ws.members || []).some(
            (m) => (m.user?._id || m.user)?.toString() === userId && m.role === 'Admin' && m.status === 'active'
          );
          const isPM = (project.projectManagers || []).some((pm) => (pm._id || pm)?.toString() === userId);
          if (!isOwner && !isAdmin && !isPM) return { error: 'You can\'t create tasks in this project.' };

          const valid = (args.assigneeIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));

          const task = await Task.create({
            project: project._id,
            workspace: project.workspace,
            title: String(args.title || 'Untitled task').slice(0, 200),
            description: String(args.description || '').slice(0, 5000),
            priority: ['low', 'medium', 'high', 'urgent'].includes(args.priority) ? args.priority : 'medium',
            assignees: valid,
            createdBy: userId,
            status: valid.length > 0 ? 'ready_for_completion' : 'pending',
            startDate: new Date(),
            dueDate: args.dueDate ? new Date(args.dueDate) : null,
            subTasks: [],
            isDeleted: false,
            isTrash: false,
          });

          return { success: true, taskId: task._id.toString(), message: `Task "${task.title}" created.` };
        }

        case 'update_task_status': {
          const task = await Task.findById(args.taskId);
          if (!task) return { error: 'Task not found.' };
          const project = await Project.findById(task.project);
          const ws = await Workspace.findById(task.workspace);
          if (!ws) return { error: 'Workspace not found.' };

          const isOwner = ws.owner?.toString() === userId;
          const isAdmin = (ws.members || []).some(
            (m) => (m.user?._id || m.user)?.toString() === userId && m.role === 'Admin' && m.status === 'active'
          );
          const isPM = (project.projectManagers || []).some((pm) => (pm._id || pm)?.toString() === userId);
          const isAssignee = (task.assignees || []).some((a) => a.toString() === userId);
          if (!isOwner && !isAdmin && !isPM && !isAssignee) return { error: 'Not allowed.' };

          if (!TASK_STATUS_ENUM.includes(args.status)) return { error: 'Invalid status.' };
          task.status = args.status;
          await task.save();
          return { success: true, message: `Task status set to "${args.status}".` };
        }

        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      console.error(`Tool "${name}" failed:`, err);
      return { error: err.message || 'Tool execution failed.' };
    }
  };
}

// ─────────────────────────────────────────────────────────────────────
// System prompt for the agent
// ─────────────────────────────────────────────────────────────────────
const AGENT_SYSTEM = `
You are Xircle AI — the assistant inside the Xircle team app.
You're as capable as ChatGPT: answer any question, help with anything,
AND take real actions inside the user's workspace via tools.

TOOLS — USE THEM:
- Any question about the user's workspace (people, tasks, projects,
  chats, clock-ins, notes, activity) → call a READ tool FIRST. Never guess.
- Any "do X for me" request → call a WRITE tool.
- Naming a person + "message/tell/send X to" → use send_message_to_user.
- "Everyone", "all members", "the whole team", "broadcast", or naming 2+ people
  at once → use send_message_to_many with allMembers:true (or an explicit
  recipients array). NEVER loop send_message_to_user for multiple people.
- Only use send_chat_message when you already have a chatId from a
  previous tool result.
- Need current info, news, or you're unsure about a fact → call web_search.
- Chain tools in one turn (e.g. "clock me in and message Sarah").

BEHAVIOR:
- Warm, direct, no filler. No "Certainly!". Match the user's energy.
- Use REAL names from tool results. Never invent data.
- Never show raw Mongo IDs — use names.
- If a tool errors, tell the user what blocked you.
- Ambiguous request → ask ONE short clarifying question.
- Destructive actions (delete/cancel) → confirm first.

FORMATTING (markdown in a chat bubble — works on mobile):
- **bold** for names, labels, key numbers
- bullets (- item) for parallel things, numbered (1.) for steps
- TABLES only for genuine side-by-side comparisons (3-4 cols max)
- Short paragraphs, blank lines between blocks
- No ASCII art, no decorative separators, no nested bullets past 2 levels

Prefer this style for lists:
  • **Project Name** — Status · 36% · 3 tasks

The runtime context (current time, user's workspaces, active workspace)
is at the top of every turn. Default to the active workspace unless
the user names another; if they have multiple and don't specify, ask.
`.trim();

// ─────────────────────────────────────────────────────────────────────
// Runtime context builder
// ─────────────────────────────────────────────────────────────────────
async function buildRuntimeContext(userId) {
  const user = await User.findById(userId).select('name email username').lean();

  const ownedWs = await Workspace.find({ owner: userId }).select('_id name industry').lean();
  const memberWs = await Workspace.find({
    'members.user': userId,
    'members.status': 'active',
  })
    .select('_id name industry owner')
    .lean();

  const seen = new Set();
  const workspaces = [...ownedWs, ...memberWs].filter((w) => {
    const id = w._id.toString();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return {
    nowISO: new Date().toISOString(),
    timezone: 'Africa/Lagos',
    user: user
      ? { id: userId, name: user.name, email: user.email, username: user.username }
      : { id: userId },
    workspaces: workspaces.map((w) => ({
      id: w._id.toString(),
      name: w.name,
      industry: w.industry || null,
      isOwner: w.owner?.toString() === userId,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/chat
// ─────────────────────────────────────────────────────────────────────
export const chatWithAI = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      message,
      conversationId = null,
      workspaceId = null,
    } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'message is required.' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ success: false, message: 'Message too long (max 4000 chars).' });
    }

    let conversation = null;
    if (conversationId) {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ success: false, message: 'Invalid conversationId.' });
      }
      conversation = await AIConversation.findOne({ _id: conversationId, user: userId });
      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found.' });
      }
    } else {
      conversation = await AIConversation.create({
        user: userId,
        workspace: workspaceId || null,
        title: message.trim().slice(0, 60),
        messages: [],
      });
    }

    const history = conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const runtime = await buildRuntimeContext(userId);
    if (workspaceId) runtime.activeWorkspaceId = workspaceId;

    const systemPrompt = `${AGENT_SYSTEM}\n\nRuntime context (JSON):\n${JSON.stringify(runtime)}`;

    const executor = buildToolExecutor(userId);
    const result = await runAgent({
      system: systemPrompt,
      history,
      userMessage: message.trim(),
      tools: AI_TOOLS,
      toolExecutor: executor,
      temperature: 0.4,
      maxIterations: 5,
    });

    conversation.messages.push({
      role: 'user',
      content: message.trim(),
      toolCalls: [],
    });
    conversation.messages.push({
      role: 'assistant',
      content: result.content || '',
      toolCalls: result.toolCalls.map((tc) => ({
        name: tc.name,
        args: tc.args,
      })),
    });
    conversation.lastMessageAt = new Date();
    if (conversation.title === 'New conversation' || !conversation.title) {
      conversation.title = message.trim().slice(0, 60);
    }
    if (!conversation.workspace && workspaceId) conversation.workspace = workspaceId;
    await conversation.save();

    return res.status(200).json({
      success: true,
      conversationId: conversation._id.toString(),
      answer: result.content,
      actions: result.toolCalls.map((tc) => ({
        tool: tc.name,
        args: tc.args,
        ok: !(tc.result && tc.result.error),
        summary:
          tc.result && tc.result.message
            ? tc.result.message
            : tc.result && tc.result.error
              ? tc.result.error
              : null,
      })),
      generatedAt: new Date(),
    });
  } catch (err) {
    console.error('❌ AI chat error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'AI chat failed.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────
// Conversation CRUD
// ─────────────────────────────────────────────────────────────────────
export const listAIConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, archived } = req.query;

    const query = { user: userId };
    if (workspaceId) query.workspace = workspaceId;
    if (archived === 'true') query.archived = true;
    else if (archived === 'false') query.archived = { $ne: true };

    const conversations = await AIConversation.find(query)
      .select('title workspace lastMessageAt archived createdAt messages')
      .sort({ lastMessageAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({
      success: true,
      conversations: conversations.map((c) => ({
        _id: c._id,
        title: c.title,
        workspaceId: c.workspace,
        lastMessageAt: c.lastMessageAt,
        archived: c.archived,
        createdAt: c.createdAt,
        messageCount: (c.messages || []).length,
        preview: (() => {
          const last = (c.messages || []).slice(-1)[0];
          return last ? String(last.content || '').slice(0, 120) : '';
        })(),
      })),
    });
  } catch (err) {
    console.error('❌ listAIConversations error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAIConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversationId.' });
    }
    const conv = await AIConversation.findOne({ _id: conversationId, user: userId });
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    res.status(200).json({ success: true, conversation: conv });
  } catch (err) {
    console.error('❌ getAIConversation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createAIConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title = 'New conversation', workspaceId = null } = req.body;

    const conv = await AIConversation.create({
      user: userId,
      workspace: workspaceId,
      title: String(title).slice(0, 120),
      messages: [],
    });

    res.status(201).json({ success: true, conversation: conv });
  } catch (err) {
    console.error('❌ createAIConversation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateAIConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { title, archived } = req.body;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversationId.' });
    }

    const updates = {};
    if (typeof title === 'string' && title.trim()) updates.title = title.trim().slice(0, 120);
    if (typeof archived === 'boolean') updates.archived = archived;

    const conv = await AIConversation.findOneAndUpdate(
      { _id: conversationId, user: userId },
      { $set: updates },
      { new: true }
    );
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    res.status(200).json({ success: true, conversation: conv });
  } catch (err) {
    console.error('❌ updateAIConversation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteAIConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversationId.' });
    }
    const result = await AIConversation.deleteOne({ _id: conversationId, user: userId });
    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }
    res.status(200).json({ success: true, message: 'Conversation deleted.' });
  } catch (err) {
    console.error('❌ deleteAIConversation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};