import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import asyncHandler from 'express-async-handler';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const generateInviteCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

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

  // 👇 Get logo URL from uploaded file (if any)
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
// UPDATE WORKSPACE (supports logo upload via Cloudinary)
// PUT /api/workspaces/:id
// ─────────────────────────────────────────────────────────────────────────────

const updateWorkspace = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }
  if (workspace.owner.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can edit this workspace.');
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

  // 👇 If a file was uploaded via multer, Cloudinary returns the URL in req.file.path
  const logoUrl = req.file?.path;

  if (name) workspace.name = name.trim();
  if (industry) workspace.industry = industry.trim();
  if (description !== undefined) workspace.description = description.trim();
  if (color) workspace.color = color;
  if (logoUrl) workspace.logo = logoUrl;   // 👈 update logo from uploaded file
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
// DELETE WORKSPACE
// DELETE /api/workspaces/:id
// ─────────────────────────────────────────────────────────────────────────────

const deleteWorkspace = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }
  if (workspace.owner.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can delete this workspace.');
  }

  await workspace.deleteOne();

  await User.findByIdAndUpdate(userId, {
    $pull: { ownedWorkspaces: workspace._id },
  });

  res.status(200).json({
    success: true,
    message: 'Workspace deleted.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE WORKSPACE
// POST /api/workspaces/:id/leave
// ─────────────────────────────────────────────────────────────────────────────

const leaveWorkspace = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (workspace.owner.toString() === userId) {
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

  res.status(200).json({
    success: true,
    message: 'Left workspace successfully.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE MEMBER (owner only)
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
  if (workspace.owner.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can remove members.');
  }
  if (memberId === userId) {
    res.status(400);
    throw new Error('Owner cannot remove themselves.');
  }

  workspace.members = workspace.members.filter(
    (m) => m.user.toString() !== memberId
  );
  await workspace.save();

  await User.findByIdAndUpdate(memberId, {
    $pull: { joinedWorkspaces: workspace._id },
  });

  res.status(200).json({
    success: true,
    message: 'Member removed.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGENERATE INVITE CODE (owner only)
// PATCH /api/workspaces/:id/invite-code
// ─────────────────────────────────────────────────────────────────────────────

const regenerateInviteCode = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }
  if (workspace.owner.toString() !== userId) {
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
  regenerateInviteCode,
  migrateWorkspaces,
};