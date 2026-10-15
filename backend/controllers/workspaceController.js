// controllers/workspaceController.js
import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import Project from '../models/projectModel.js';
import asyncHandler from 'express-async-handler';
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const generateInviteCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

/**
 * Fire-and-forget notification to one or many users.
 */
async function notifyUsers(
  userIds,
  { title, body, data = {}, emailEventType = null, emailHtml = null }
) {
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
    }).catch((err) =>
      console.error(`Notification to ${recipient} failed:`, err.message)
    );
  }
}

const getUserId = (u) => (u?._id ? u._id.toString() : u?.toString());

const isOwner = (workspace, userId) =>
  workspace.owner.toString() === userId.toString();

/**
 * Admin = permanent member with role 'Admin'.
 * Associates are NEVER admins.
 */
const isAdmin = (workspace, userId) =>
  workspace.members.some(
    (m) =>
      getUserId(m.user) === userId.toString() &&
      m.role === 'Admin' &&
      m.status === 'active' &&
      m.memberType !== 'associate'
  );

/**
 * Manager = owner or admin. Associates are excluded even if they
 * somehow have an Admin-looking role string.
 */
const isManager = (workspace, userId) =>
  isOwner(workspace, userId) || isAdmin(workspace, userId);

const isAssociate = (workspace, userId) => {
  const m = workspace.members.find(
    (m) => getUserId(m.user) === userId.toString() && m.status === 'active'
  );
  return m?.memberType === 'associate';
};

const isExpired = (member) => {
  if (!member?.accessExpiresAt) return false;
  return new Date(member.accessExpiresAt) < new Date();
};

/**
 * Revoke all project ties for an associate inside a given workspace.
 * Used on removal / leave / expiry.
 */
const revokeAssociateProjects = async (workspaceId, memberId, revokedBy = null) => {
  const projects = await Project.find({
    workspace: workspaceId,
    $or: [
      { 'associates.userId': memberId },
      { projectManagers: memberId },
      { 'teamMembers.user': memberId },
    ],
  }).select('_id projectManagers teamMembers associates');

  const now = new Date();
  for (const p of projects) {
    (p.associates || []).forEach((a) => {
      if (a.userId && a.userId.toString() === memberId && a.status !== 'revoked') {
        a.status = 'revoked';
        a.revokedAt = now;
        a.revokedBy = revokedBy;
      }
    });
    p.projectManagers = p.projectManagers.filter(
      (pm) => pm.toString() !== memberId
    );
    p.teamMembers = p.teamMembers.filter(
      (tm) => tm.user.toString() !== memberId
    );
    await p.save();
  }

  return projects.length;
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE WORKSPACE
// POST /api/workspaces
// ─────────────────────────────────────────────────────────────────────────────

const createWorkspace = asyncHandler(async (req, res) => {
  console.log('📝 Create workspace request:', req.body);
  console.log('📎 File:', req.file);

  const {
    name,
    industry,
    description,
    color,
    size,
    website,
    location,
    phone,
  } = req.body;

  const userId = req.user.id;

  if (!name?.trim()) {
    res.status(400);
    throw new Error('Business name is required.');
  }
  if (!industry?.trim()) {
    res.status(400);
    throw new Error('Industry is required.');
  }

  const logoUrl = req.file?.path || '';

  const workspace = await Workspace.create({
    name: name.trim(),
    industry: industry.trim(),
    description: description?.trim() || '',
    color: color || '#1a3a6b',
    logo: logoUrl,
    size: size || '',
    website: website?.trim() || '',
    location: location?.trim() || '',
    phone: phone?.trim() || '',
    owner: userId,
    inviteCode: generateInviteCode(),
    verified: false,
    members: [
      {
        user: userId,
        role: 'Owner',
        memberType: 'permanent',
        status: 'active',
        department: 'Management',
        joinedAt: new Date(),
      },
    ],
    activeTasks: 0,
  });

  await User.findByIdAndUpdate(userId, {
    $push: { ownedWorkspaces: workspace._id },
    $addToSet: { joinedWorkspaces: workspace._id },
  });

  await workspace.populate('owner', 'name email profile');

  res.status(201).json({
    success: true,
    workspace,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET MY WORKSPACES  (owned + permanent + associate)
// GET /api/workspaces/my
// ─────────────────────────────────────────────────────────────────────────────

const getMyWorkspaces = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const myBusinesses = await Workspace.find({ owner: userId })
    .populate('owner', 'name email profile')
    .lean();

  // Permanent memberships (memberType != 'associate', or undefined for old data)
  const joinedBusinesses = await Workspace.find({
    owner: { $ne: userId },
    members: {
      $elemMatch: {
        user: userId,
        status: 'active',
        $or: [
          { memberType: 'permanent' },
          { memberType: { $exists: false } },
        ],
      },
    },
  })
    .populate('owner', 'name email profile')
    .lean();

  // Associate memberships — filter out expired
  const allAssociateWorkspaces = await Workspace.find({
    owner: { $ne: userId },
    members: {
      $elemMatch: {
        user: userId,
        status: 'active',
        memberType: 'associate',
      },
    },
  })
    .populate('owner', 'name email profile')
    .lean();

  const now = new Date();
  const associateBusinesses = allAssociateWorkspaces.filter((ws) => {
    const m = ws.members.find((m) => getUserId(m.user) === userId);
    if (!m) return false;
    if (m.accessExpiresAt && new Date(m.accessExpiresAt) < now) return false;
    return true;
  });

  res.status(200).json({
    success: true,
    myBusinesses,
    joinedBusinesses,
    associateBusinesses,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE WORKSPACE
// GET /api/workspaces/:id
// ─────────────────────────────────────────────────────────────────────────────

const getWorkspace = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const workspace = await Workspace.findById(req.params.id)
    .populate('owner', 'name email profile')
    .populate('members.user', 'name email profile');

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  // Must be at least a member (permanent or active associate)
  const myMembership = workspace.members.find(
    (m) => getUserId(m.user) === userId && m.status === 'active'
  );

  if (!myMembership) {
    res.status(403);
    throw new Error('Access denied. You are not part of this workspace.');
  }

  // Expired associate? Lock them out
  if (myMembership.memberType === 'associate' && isExpired(myMembership)) {
    res.status(403);
    throw new Error('Your associate access to this workspace has expired.');
  }

  res.status(200).json({
    success: true,
    workspace,
    myMembership: {
      ...myMembership.toObject(),
      isAssociate: myMembership.memberType === 'associate',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE WORKSPACE (supports logo upload)
// PUT /api/workspaces/:id
// ─────────────────────────────────────────────────────────────────────────────
// Allowed: Owner or Admin (permanent managers only)
// ─────────────────────────────────────────────────────────────────────────────

const updateWorkspace = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (!isManager(workspace, userId)) {
    res.status(403);
    throw new Error('Only the owner or an admin can edit this workspace.');
  }

  const {
    name,
    industry,
    description,
    color,
    size,
    website,
    location,
    phone,
  } = req.body;

  const logoUrl = req.file?.path;

  if (name) workspace.name = name.trim();
  if (industry) workspace.industry = industry.trim();
  if (description !== undefined) workspace.description = description.trim();
  if (color) workspace.color = color;
  if (logoUrl) workspace.logo = logoUrl;
  if (size) workspace.size = size;
  if (website !== undefined) workspace.website = website.trim();
  if (location !== undefined) workspace.location = location.trim();
  if (phone !== undefined) workspace.phone = phone.trim();

  await workspace.save();
  await workspace.populate('owner', 'name email profile');

  res.status(200).json({
    success: true,
    workspace,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE WORKSPACE (Owner only)
// DELETE /api/workspaces/:id
// ─────────────────────────────────────────────────────────────────────────────

const deleteWorkspace = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (!isOwner(workspace, userId)) {
    res.status(403);
    throw new Error('Only the owner can delete this workspace.');
  }

  // Gather active member IDs (excluding owner) — permanent AND associate
  const activeMemberIds = workspace.members
    .filter(
      (m) => m.status === 'active' && getUserId(m.user) !== userId
    )
    .map((m) => getUserId(m.user));

  const workspaceName = workspace.name;
  const workspaceId = workspace._id.toString();

  await workspace.deleteOne();

  await User.updateMany(
    { _id: { $in: activeMemberIds } },
    { $pull: { joinedWorkspaces: workspace._id } }
  );

  await User.findByIdAndUpdate(userId, {
    $pull: {
      ownedWorkspaces: workspace._id,
      joinedWorkspaces: workspace._id,
    },
  });

  if (activeMemberIds.length > 0) {
    notifyUsers(activeMemberIds, {
      title: `Workspace "${workspaceName}" deleted`,
      body: `The workspace "${workspaceName}" has been permanently removed by the owner.`,
      data: {},
      emailEventType: 'projectUpdate',
      emailHtml: `<p>The workspace <strong>${workspaceName}</strong> has been deleted by its owner.</p>`,
    });
  }

  res.status(200).json({
    success: true,
    message: 'Workspace deleted.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE WORKSPACE (self-leave for permanent members AND associates)
// POST /api/workspaces/:id/leave
// ─────────────────────────────────────────────────────────────────────────────

const leaveWorkspace = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (isOwner(workspace, userId)) {
    res.status(400);
    throw new Error('Owner cannot leave. Transfer ownership or delete the workspace.');
  }

  const myMembership = workspace.members.find(
    (m) => getUserId(m.user) === userId && m.status === 'active'
  );

  if (!myMembership) {
    res.status(400);
    throw new Error('You are not an active member of this workspace.');
  }

  const wasAssociate = myMembership.memberType === 'associate';

  workspace.members = workspace.members.filter(
    (m) => getUserId(m.user) !== userId
  );
  await workspace.save();

  await User.findByIdAndUpdate(userId, {
    $pull: { joinedWorkspaces: workspace._id },
  });

  // If they were an associate, revoke their project ties
  if (wasAssociate) {
    await revokeAssociateProjects(workspace._id, userId, userId);
  }

  const leavingUser = await User.findById(userId).select('name');

  notifyUsers(workspace.owner.toString(), {
    title: `${leavingUser?.name || 'A member'} left "${workspace.name}"`,
    body: `${leavingUser?.name || 'Someone'} has left your workspace.`,
    data: { workspaceId: workspace._id.toString(), leftUserId: userId },
    emailEventType: 'teamInvite',
  });

  res.status(200).json({
    success: true,
    message: 'Left workspace successfully.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE MEMBER (Owner or Admin)
// DELETE /api/workspaces/:id/members/:memberId
//
// Works for permanent members AND associates.
// When removing an associate, also revokes every project.associates record
// they had in this workspace and strips them from projectManagers/teamMembers.
// ─────────────────────────────────────────────────────────────────────────────

const removeMember = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { memberId } = req.params;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (!isManager(workspace, userId)) {
    res.status(403);
    throw new Error('Only the owner or an admin can remove members.');
  }

  if (memberId === userId) {
    res.status(400);
    throw new Error('You cannot remove yourself. Use the leave endpoint instead.');
  }
  if (isOwner(workspace, memberId)) {
    res.status(400);
    throw new Error('Cannot remove the workspace owner.');
  }

  // Admin can't remove another admin
  if (isAdmin(workspace, userId) && isAdmin(workspace, memberId)) {
    res.status(403);
    throw new Error('Admins cannot remove other admins.');
  }

  const target = workspace.members.find(
    (m) => getUserId(m.user) === memberId
  );

  if (!target) {
    res.status(404);
    throw new Error('Member not found in this workspace.');
  }

  const wasAssociate = target.memberType === 'associate';

  workspace.members = workspace.members.filter(
    (m) => getUserId(m.user) !== memberId
  );
  await workspace.save();

  await User.findByIdAndUpdate(memberId, {
    $pull: { joinedWorkspaces: workspace._id },
  });

  if (wasAssociate) {
    await revokeAssociateProjects(workspace._id, memberId, userId);
  }

  notifyUsers(memberId, {
    title: `Removed from "${workspace.name}"`,
    body: wasAssociate
      ? 'Your associate access to this workspace has been revoked.'
      : `You have been removed from the workspace "${workspace.name}".`,
    data: { workspaceId: workspace._id.toString() },
    emailEventType: 'teamInvite',
  });

  res.status(200).json({
    success: true,
    message: 'Member removed.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE MEMBER ROLE (Owner only)
// PATCH /api/workspaces/:id/members/:memberId/role
// Body: { role: 'Admin' | 'Member' | 'Staff' }
//
// Associates cannot be promoted to Admin — promote them to permanent first.
// ─────────────────────────────────────────────────────────────────────────────

const updateMemberRole = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { memberId } = req.params;
  const { role } = req.body;

  if (!role || !['Admin', 'Member', 'Staff'].includes(role)) {
    res.status(400);
    throw new Error('Invalid role. Allowed: Admin, Member, Staff');
  }

  const workspace = await Workspace.findById(req.params.id);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (!isOwner(workspace, userId)) {
    res.status(403);
    throw new Error('Only the owner can change member roles.');
  }

  const member = workspace.members.find(
    (m) => getUserId(m.user) === memberId && m.status === 'active'
  );
  if (!member) {
    res.status(404);
    throw new Error('Active member not found.');
  }

  if (isOwner(workspace, memberId)) {
    res.status(400);
    throw new Error('Cannot change the role of the owner.');
  }

  if (member.memberType === 'associate' && role === 'Admin') {
    res.status(400);
    throw new Error(
      'Associates cannot be promoted to Admin. Convert them to a permanent member first.'
    );
  }

  member.role = role;
  await workspace.save();

  const updatedMember = workspace.members.find(
    (m) => getUserId(m.user) === memberId
  );
  await workspace.populate('members.user', 'name email profile');

  notifyUsers(memberId, {
    title: `Role updated in "${workspace.name}"`,
    body: `You have been ${role === 'Admin' ? 'promoted to Admin' : `set to ${role}`} in the workspace.`,
    data: { workspaceId: workspace._id.toString(), newRole: role },
    emailEventType: 'teamInvite',
  });

  res.status(200).json({
    success: true,
    message: `Member role updated to ${role}`,
    member: updatedMember,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGENERATE INVITE CODE (Owner only)
// PATCH /api/workspaces/:id/invite-code
// ─────────────────────────────────────────────────────────────────────────────

const regenerateInviteCode = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (!isOwner(workspace, userId)) {
    res.status(403);
    throw new Error('Only the owner can regenerate the invite code.');
  }

  workspace.inviteCode = generateInviteCode();
  await workspace.save();

  res.status(200).json({
    success: true,
    inviteCode: workspace.inviteCode,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET WORKSPACE BY INVITE CODE (preview before joining)
// GET /api/workspaces/by-code/:inviteCode
//
// Invite codes are for permanent members only. Associates are added
// directly from the project level — they never use codes.
// ─────────────────────────────────────────────────────────────────────────────

const getWorkspaceByInviteCode = asyncHandler(async (req, res) => {
  const { inviteCode } = req.params;

  const workspace = await Workspace.findOne({
    inviteCode: inviteCode.toUpperCase(),
  });

  if (!workspace) {
    res.status(404);
    throw new Error('Invalid invite code. Workspace not found.');
  }

  res.status(200).json({
    success: true,
    workspace: {
      _id: workspace._id,
      name: workspace.name,
      industry: workspace.industry,
      color: workspace.color,
      logo: workspace.logo,
      memberCount: (workspace.members || []).filter(
        (m) => m.status === 'active'
      ).length,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LIST WORKSPACE ASSOCIATES  (owner or admin)
// GET /api/workspaces/:id/associates
//
// Read-only role listing. The full associate management surface lives in
// teamController (add/update/remove/promote).
// ─────────────────────────────────────────────────────────────────────────────

const getWorkspaceAssociates = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const workspace = await Workspace.findById(req.params.id).populate(
    'members.user',
    'name email profile phone'
  );

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (!isManager(workspace, userId)) {
    res.status(403);
    throw new Error('Only the owner or an admin can view associates.');
  }

  const associates = workspace.members
    .filter((m) => m.memberType === 'associate' && m.status === 'active')
    .map((m) => ({
      ...m.toObject(),
      isExpired: isExpired(m),
    }));

  res.status(200).json({
    success: true,
    associates,
    count: associates.length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION HELPER (optional – can be removed after use)
// POST /api/workspaces/migrate
// ─────────────────────────────────────────────────────────────────────────────

const migrateWorkspaces = asyncHandler(async (req, res) => {
  const result = await Workspace.updateMany(
    { 'members.status': { $exists: false } },
    {
      $set: {
        'members.$[elem].status': 'active',
        'members.$[elem].department': 'General',
        'members.$[elem].memberType': 'permanent',
      },
    },
    {
      arrayFilters: [{ 'elem.status': { $exists: false } }],
    }
  );

  // Also tag any existing members that don't have memberType yet
  const typeResult = await Workspace.updateMany(
    { 'members.memberType': { $exists: false } },
    {
      $set: {
        'members.$[elem].memberType': 'permanent',
      },
    },
    {
      arrayFilters: [{ 'elem.memberType': { $exists: false } }],
    }
  );

  res.status(200).json({
    success: true,
    message: 'Migration completed',
    modifiedCount: result.modifiedCount + typeResult.modifiedCount,
    matchedCount: result.matchedCount + typeResult.matchedCount,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CRON HELPER — EXPIRE ASSOCIATES
//
// Sweeps every workspace for associates whose accessExpiresAt has passed,
// revokes their workspace membership and every project.associates record.
// Call this from your cron runner.
// ─────────────────────────────────────────────────────────────────────────────

const expireAssociates = async () => {
  const now = new Date();

  const workspaces = await Workspace.find({
    members: {
      $elemMatch: {
        memberType: 'associate',
        status: 'active',
        accessExpiresAt: { $lt: now, $ne: null },
      },
    },
  }).select('_id name members');

  let expiredCount = 0;

  for (const workspace of workspaces) {
    const expiredMembers = workspace.members.filter(
      (m) =>
        m.memberType === 'associate' &&
        m.status === 'active' &&
        m.accessExpiresAt &&
        new Date(m.accessExpiresAt) < now
    );

    for (const member of expiredMembers) {
      const memberId = getUserId(member.user);

      workspace.members = workspace.members.filter(
        (m) => getUserId(m.user) !== memberId
      );

      await User.findByIdAndUpdate(memberId, {
        $pull: { joinedWorkspaces: workspace._id },
      });

      await revokeAssociateProjects(workspace._id, memberId, null);

      notifyUsers(memberId, {
        title: `Access to "${workspace.name}" expired`,
        body: 'Your associate access to this workspace has expired.',
        data: { workspaceId: workspace._id.toString() },
        emailEventType: 'teamInvite',
      });

      expiredCount++;
    }

    await workspace.save();
  }

  console.log(`🧹 Expired ${expiredCount} associate membership(s).`);
  return expiredCount;
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export {
  createWorkspace,
  getMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  leaveWorkspace,
  removeMember,
  updateMemberRole,
  regenerateInviteCode,
  migrateWorkspaces,
  getWorkspaceByInviteCode,
  // Associate-scoped
  getWorkspaceAssociates,
  // Cron
  expireAssociates,
};