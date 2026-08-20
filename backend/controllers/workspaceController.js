// controllers/workspaceController.js
import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import asyncHandler from 'express-async-handler';
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const generateInviteCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

/**
 * Fire‑and‑forget notification to one or many users.
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
    }).catch(err =>
      console.error(`Notification to ${recipient} failed:`, err.message)
    );
  }
}

/**
 * Check if a user is the workspace owner.
 */
const isOwner = (workspace, userId) =>
  workspace.owner.toString() === userId.toString();

/**
 * Check if a user is an admin (role === 'Admin') in the workspace.
 */
const isAdmin = (workspace, userId) =>
  workspace.members.some(
    (m) =>
      m.user.toString() === userId.toString() &&
      m.role === 'Admin' &&
      m.status === 'active'
  );

/**
 * Check if user is owner or admin (has management permissions).
 */
const isManager = (workspace, userId) =>
  isOwner(workspace, userId) || isAdmin(workspace, userId);

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
        role: 'Owner',          // Owner role – full permissions
        status: 'active',
        department: 'Management',
        joinedAt: new Date(),
      },
    ],
    activeTasks: 0,
  });

  await User.findByIdAndUpdate(userId, {
    $push: { ownedWorkspaces: workspace._id },
  });

  await workspace.populate('owner', 'name email profile');

  res.status(201).json({
    success: true,
    workspace,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET MY WORKSPACES (owned + joined)
// GET /api/workspaces/my
// ─────────────────────────────────────────────────────────────────────────────

const getMyWorkspaces = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const myBusinesses = await Workspace.find({ owner: userId })
    .populate('owner', 'name email profile')
    .lean();

  const joinedBusinesses = await Workspace.find({
    'members.user': userId,
    owner: { $ne: userId },
  })
    .populate('owner', 'name email profile')
    .lean();

  res.status(200).json({
    success: true,
    myBusinesses,
    joinedBusinesses,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE WORKSPACE
// GET /api/workspaces/:id
// ─────────────────────────────────────────────────────────────────────────────

const getWorkspace = asyncHandler(async (req, res) => {
  const workspace = await Workspace.findById(req.params.id)
    .populate('owner', 'name email profile')
    .populate('members.user', 'name email profile');

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  res.status(200).json({
    success: true,
    workspace,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE WORKSPACE (supports logo upload)
// PUT /api/workspaces/:id
// ─────────────────────────────────────────────────────────────────────────────
// Allowed: Owner or Admin (manager)
// ─────────────────────────────────────────────────────────────────────────────

const updateWorkspace = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  // Allow Owner or Admin
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

  // Notify active members about the update? (optional)
  // For now, we skip to avoid spam.

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

  // Gather active member IDs (excluding owner)
  const activeMemberIds = workspace.members
    .filter(m => m.status === 'active' && m.user.toString() !== userId)
    .map(m => m.user.toString());

  const workspaceName = workspace.name;
  const workspaceId = workspace._id.toString();

  await workspace.deleteOne();

  await User.findByIdAndUpdate(userId, {
    $pull: { ownedWorkspaces: workspace._id },
  });

  // Notify all active members that the workspace was deleted
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
// LEAVE WORKSPACE (member self‑leave)
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

  workspace.members = workspace.members.filter(
    (m) => m.user.toString() !== userId
  );
  await workspace.save();

  await User.findByIdAndUpdate(userId, {
    $pull: { joinedWorkspaces: workspace._id },
  });

  // Notify owner that a member has left
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
// ─────────────────────────────────────────────────────────────────────────────

const removeMember = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { memberId } = req.params;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  // Allow Owner or Admin
  if (!isManager(workspace, userId)) {
    res.status(403);
    throw new Error('Only the owner or an admin can remove members.');
  }

  // Prevent removing owner or yourself
  if (memberId === userId) {
    res.status(400);
    throw new Error('You cannot remove yourself. Use the leave endpoint instead.');
  }
  if (isOwner(workspace, memberId)) {
    res.status(400);
    throw new Error('Cannot remove the workspace owner.');
  }

  // If the remover is an admin (not owner), they cannot remove another admin.
  // (Optional: only owner can remove admins)
  if (isAdmin(workspace, userId) && isAdmin(workspace, memberId)) {
    res.status(403);
    throw new Error('Admins cannot remove other admins.');
  }

  workspace.members = workspace.members.filter(
    (m) => m.user.toString() !== memberId
  );
  await workspace.save();

  await User.findByIdAndUpdate(memberId, {
    $pull: { joinedWorkspaces: workspace._id },
  });

  // Notify the removed member
  notifyUsers(memberId, {
    title: `Removed from "${workspace.name}"`,
    body: `You have been removed from the workspace "${workspace.name}".`,
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
// ─────────────────────────────────────────────────────────────────────────────
// Body: { role: 'Admin' | 'Member' }
// ─────────────────────────────────────────────────────────────────────────────

const updateMemberRole = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { memberId } = req.params;
  const { role } = req.body;

  if (!role || !['Admin', 'Member'].includes(role)) {
    res.status(400);
    throw new Error('Invalid role. Allowed: Admin, Member');
  }

  const workspace = await Workspace.findById(req.params.id);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  // Only owner can change roles
  if (!isOwner(workspace, userId)) {
    res.status(403);
    throw new Error('Only the owner can change member roles.');
  }

  const member = workspace.members.find(
    (m) => m.user.toString() === memberId && m.status === 'active'
  );
  if (!member) {
    res.status(404);
    throw new Error('Active member not found.');
  }

  // Prevent changing owner's role
  if (isOwner(workspace, memberId)) {
    res.status(400);
    throw new Error('Cannot change the role of the owner.');
  }

  member.role = role;
  await workspace.save();

  const updatedMember = workspace.members.find(
    (m) => m.user.toString() === memberId
  );
  await workspace.populate('members.user', 'name email profile');

  // Notify the member about role change
  notifyUsers(memberId, {
    title: `Role updated in "${workspace.name}"`,
    body: `You have been ${role === 'Admin' ? 'promoted to Admin' : 'demoted to Member'} in the workspace.`,
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

  // Only owner can regenerate invite code
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
      },
    },
    {
      arrayFilters: [{ 'elem.status': { $exists: false } }],
    }
  );

  res.status(200).json({
    success: true,
    message: 'Migration completed',
    modifiedCount: result.modifiedCount,
    matchedCount: result.matchedCount,
  });
});

// controllers/workspaceController.js (add this function)

// ─────────────────────────────────────────────────────────────────────────────
// GET WORKSPACE BY INVITE CODE (preview before joining)
// GET /api/workspaces/by-code/:inviteCode
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
      memberCount: workspace.members?.length || 0,
    },
  });
});

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
  updateMemberRole,           // new endpoint
  regenerateInviteCode,
  migrateWorkspaces,
  getWorkspaceByInviteCode,
};