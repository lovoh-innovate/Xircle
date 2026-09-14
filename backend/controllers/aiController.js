// controllers/aiController.js
import mongoose from 'mongoose';
import Project from '../models/projectModel.js';
import Task from '../models/taskModel.js';
import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import { planProject } from '../services/geminiService.js';
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────
// ENUMS — pulled straight from the schemas so nothing can drift.
// If you add a value to the model, the AI picks it up automatically.
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

// ─────────────────────────────────────────────────────────────────────
// SANITIZE — never trust LLM output.
//   • drops invented member IDs
//   • clamps enums to whatever the schema actually allows
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

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/plan
// Body: { workspaceId, prompt }
// Returns a preview plan — no DB writes.
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

    // Collect active workspace members + their User docs for role hints.
    const activeMemberships = workspace.members.filter((m) => m.status === 'active');
    const userIds = activeMemberships.map((m) => m.user?._id || m.user).filter(Boolean);

    // Include the owner even if they're not in members[].
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

    // Attach display names so the UI can render the plan without another fetch.
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
// Body: { workspaceId, plan }
// Commit the plan: create project, add members, create tasks + subtasks.
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

    // Rebuild the "allowed" set from the live workspace — never trust the
    // client to send us a plan referencing IDs outside the workspace.
    const activeMemberIds = workspace.members
      .filter((m) => m.status === 'active')
      .map((m) => (m.user?._id || m.user)?.toString())
      .filter(Boolean);

    const ownerId = (workspace.owner?._id || workspace.owner)?.toString();
    if (ownerId) activeMemberIds.push(ownerId);

    const sanitized = sanitizePlan(plan, activeMemberIds);

    // ── 1. Validate team membership (active workspace members only) ──
    const validTeamIds = sanitized.project.teamMemberIds.filter(
      (id) => id !== userId // creator is PM automatically, don't double-add
    );

    // ── 2. Create the project — creator is PM (same rule as manual flow) ──
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
      projectManagers: [userId], // creator is PM — no manual add needed
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

    // ── 3. Create tasks + subtasks ────────────────────────────────
    const now = new Date();
    const createdTasks = [];
    let taskOrder = 0;

    for (const t of sanitized.tasks) {
      // Creator must be a valid assignee too (they're PM), so union with team.
      const allowedAssignees = new Set([...validTeamIds, userId]);
      const finalAssignees = t.assigneeIds.filter((id) => allowedAssignees.has(id));

      // Backend rule: assigned → ready_for_completion, else pending.
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

    // ── 4. Notify every assignee + every team member ──────────────
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