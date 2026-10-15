// controllers/teamController.js
import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import Project from '../models/projectModel.js';
import Task from '../models/taskModel.js';
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Works whether m.user is a raw ObjectId OR a populated user document
const getUserId = (u) => (u?._id ? u._id.toString() : u?.toString());

const isOwner = (workspace, userId) =>
  workspace.owner.toString() === userId.toString();

/**
 * Admin check — ONLY permanent members with role 'Admin'.
 * Associates can NEVER be admins/managers, even if their role string
 * somehow says otherwise.
 */
const isAdmin = (workspace, userId) => {
  return workspace.members.some(
    (m) =>
      getUserId(m.user) === userId.toString() &&
      m.role?.toLowerCase() === 'admin' &&
      m.status === 'active' &&
      m.memberType !== 'associate'
  );
};

const isManager = (workspace, userId) =>
  isOwner(workspace, userId) || isAdmin(workspace, userId);

const isAssociate = (workspace, userId) => {
  const m = workspace.members.find(
    (m) => getUserId(m.user) === userId.toString() && m.status === 'active'
  );
  return m?.memberType === 'associate';
};

const findActiveMember = (workspace, userId) =>
  workspace.members.find(
    (m) => getUserId(m.user) === userId.toString() && m.status === 'active'
  );

const findPendingMember = (workspace, userId) =>
  workspace.members.find(
    (m) => getUserId(m.user) === userId.toString() && m.status === 'pending'
  );

/**
 * Active admins + the owner (deduped). Associates never appear here.
 */
const getAdminUserIds = (workspace) => {
  const adminIds = workspace.members
    .filter(
      (m) =>
        m.status === 'active' &&
        m.memberType !== 'associate' &&
        m.role?.toLowerCase() === 'admin'
    )
    .map((m) => getUserId(m.user));

  const ownerId = workspace.owner.toString();
  if (!adminIds.includes(ownerId)) adminIds.push(ownerId);
  return adminIds;
};

const isExpired = (member) => {
  if (!member?.accessExpiresAt) return false;
  return new Date(member.accessExpiresAt) < new Date();
};

// ─── Notification helper ──────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST TO JOIN WORKSPACE VIA INVITE CODE (permanent members only)
// POST /api/team/join
// ─────────────────────────────────────────────────────────────────────────────

const requestToJoin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { inviteCode } = req.body;

    if (!inviteCode)
      return res.status(400).json({ message: 'Invite code is required.' });

    const workspace = await Workspace.findOne({
      inviteCode: inviteCode.toUpperCase(),
    });

    if (!workspace)
      return res
        .status(404)
        .json({ message: 'Invalid invite code. Workspace not found.' });

    if (isOwner(workspace, userId))
      return res
        .status(400)
        .json({ message: 'You are the owner of this workspace.' });

    const alreadyActive = findActiveMember(workspace, userId);
    if (alreadyActive) {
      return res
        .status(400)
        .json({ message: 'You are already an active member of this workspace.' });
    }

    const alreadyPending = findPendingMember(workspace, userId);
    if (alreadyPending)
      return res
        .status(400)
        .json({ message: 'You already have a pending join request for this workspace.' });

    workspace.members.push({
      user: userId,
      role: 'Staff',
      memberType: 'permanent',   // invite code = permanent track
      department: null,
      status: 'pending',
      joinedAt: null,
    });

    await workspace.save();

    const requestingUser = await User.findById(userId).select('name email');

    const adminIds = getAdminUserIds(workspace);
    const recipientIds = adminIds.filter((id) => id !== userId);

    if (recipientIds.length > 0) {
      notifyUsers(recipientIds, {
        title: `New join request for "${workspace.name}"`,
        body: `${requestingUser?.name || 'A user'} wants to join your workspace.`,
        data: { workspaceId: workspace._id.toString(), userId },
        emailEventType: 'teamInvite',
        emailHtml: `
          <h3>New Join Request</h3>
          <p>${requestingUser?.name || 'A user'} (${requestingUser?.email || ''}) has requested to join <strong>${workspace.name}</strong>.</p>
          <p><a href="${process.env.CLIENT_URL}/workspace/${workspace._id}/members">Manage Members</a></p>
        `,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Join request sent. Waiting for owner approval.',
      workspaceId: workspace._id,
      workspaceName: workspace.name,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL PENDING JOIN REQUESTS  (owner or admin)
// GET /api/team/:workspaceId/requests
// ─────────────────────────────────────────────────────────────────────────────

const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const workspace = await Workspace.findById(req.params.workspaceId).populate(
      'members.user',
      'name email profile phone authMethod'
    );

    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    if (!isManager(workspace, userId))
      return res
        .status(403)
        .json({ message: 'Only the workspace owner or admin can view pending requests.' });

    const pending = workspace.members.filter(
      (m) => m.status === 'pending' && m.memberType !== 'associate'
    );
    res.status(200).json({ success: true, pending });
  } catch (error) {
    console.error('❌ Error in getPendingRequests:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE MEMBER + ASSIGN DEPARTMENT & ROLE  (owner or admin)
// PUT /api/team/:workspaceId/approve/:memberId
// ─────────────────────────────────────────────────────────────────────────────

const approveMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, memberId } = req.params;
    const { department, role } = req.body;

    if (!department)
      return res
        .status(400)
        .json({ message: 'Department is required when approving a member.' });

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    if (!isManager(workspace, userId))
      return res
        .status(403)
        .json({ message: 'Only the workspace owner or admin can approve members.' });

    const memberIndex = workspace.members.findIndex(
      (m) => getUserId(m.user) === memberId && m.status === 'pending'
    );

    if (memberIndex === -1)
      return res
        .status(404)
        .json({ message: 'No pending request found for this user.' });

    workspace.members[memberIndex].status = 'active';
    workspace.members[memberIndex].memberType = 'permanent';
    workspace.members[memberIndex].department = department.trim();
    workspace.members[memberIndex].role = role?.trim() || 'Staff';
    workspace.members[memberIndex].joinedAt = new Date();

    await workspace.save();

    await User.findByIdAndUpdate(memberId, {
      $addToSet: { joinedWorkspaces: workspaceId },
    });

    await workspace.populate('members.user', 'name email profile');

    notifyUsers(memberId, {
      title: `Welcome to "${workspace.name}"`,
      body: `Your join request has been approved. You are now a member (${role || 'Staff'}) in the ${department} department.`,
      data: { workspaceId: workspace._id.toString() },
      emailEventType: 'teamInvite',
      emailHtml: `
        <h3>Welcome to ${workspace.name}!</h3>
        <p>Your request to join has been approved.</p>
        <p>Role: ${role || 'Staff'}<br/>Department: ${department}</p>
        <p><a href="${process.env.CLIENT_URL}/workspace/${workspace._id}">Go to Workspace</a></p>
      `,
    });

    res.status(200).json({
      success: true,
      message: 'Member approved and assigned successfully.',
      member: workspace.members[memberIndex],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REJECT JOIN REQUEST  (owner or admin)
// DELETE /api/team/:workspaceId/reject/:memberId
// ─────────────────────────────────────────────────────────────────────────────

const rejectMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, memberId } = req.params;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    if (!isManager(workspace, userId))
      return res
        .status(403)
        .json({ message: 'Only the workspace owner or admin can reject requests.' });

    const memberIndex = workspace.members.findIndex(
      (m) => getUserId(m.user) === memberId && m.status === 'pending'
    );

    if (memberIndex === -1)
      return res
        .status(404)
        .json({ message: 'No pending request found for this user.' });

    workspace.members.splice(memberIndex, 1);
    await workspace.save();

    notifyUsers(memberId, {
      title: `Request to join "${workspace.name}" declined`,
      body: 'Your request to join the workspace has been declined by the owner or admin.',
      data: { workspaceId: workspace._id.toString() },
      emailEventType: 'teamInvite',
    });

    res.status(200).json({ success: true, message: 'Join request rejected.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL ACTIVE MEMBERS  (owner + active members)
// GET /api/team/:workspaceId/members
//
// Returns permanent members AND associates, each tagged with memberType,
// so the frontend can render them differently (associates = limited).
// ─────────────────────────────────────────────────────────────────────────────

const getMembers = async (req, res) => {
  try {
    const userId = req.user.id;
    const workspace = await Workspace.findById(req.params.workspaceId).populate(
      'members.user',
      'name email profile phone authMethod'
    );

    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    const ownerAccess = isOwner(workspace, userId);
    const memberAccess = findActiveMember(workspace, userId);

    if (!ownerAccess && !memberAccess)
      return res
        .status(403)
        .json({ message: 'Access denied. You are not part of this workspace.' });

    const activeMembers = workspace.members.filter((m) => {
      if (m.status !== 'active') return false;
      // Filter out expired associates on the fly
      if (m.memberType === 'associate' && isExpired(m)) return false;
      return true;
    });

    // Shape so the frontend can distinguish
    const shaped = activeMembers.map((m) => ({
      ...m.toObject(),
      memberType: m.memberType || 'permanent',
      isAssociate: m.memberType === 'associate',
    }));

    res.status(200).json({ success: true, members: shaped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET MEMBERS BY DEPARTMENT  (owner + active members)
// GET /api/team/:workspaceId/department/:department
// ─────────────────────────────────────────────────────────────────────────────

const getMembersByDepartment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { department } = req.params;

    const workspace = await Workspace.findById(req.params.workspaceId).populate(
      'members.user',
      'name email profile phone'
    );

    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    const ownerAccess = isOwner(workspace, userId);
    const memberAccess = findActiveMember(workspace, userId);

    if (!ownerAccess && !memberAccess)
      return res.status(403).json({ message: 'Access denied.' });

    // Associates aren't tied to departments — only permanent members are
    const departmentMembers = workspace.members.filter(
      (m) =>
        m.status === 'active' &&
        m.memberType !== 'associate' &&
        m.department?.toLowerCase() === department.toLowerCase()
    );

    res.status(200).json({
      success: true,
      department,
      members: departmentMembers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE MEMBER ROLE OR DEPARTMENT  (owner or admin)
// PUT /api/team/:workspaceId/member/:memberId
// ─────────────────────────────────────────────────────────────────────────────

const updateMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, memberId } = req.params;
    const { role, department } = req.body;

    if (!role && !department)
      return res
        .status(400)
        .json({ message: 'Provide at least a role or department to update.' });

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    if (!isManager(workspace, userId))
      return res
        .status(403)
        .json({ message: 'Only the workspace owner or admin can update members.' });

    if (memberId === userId)
      return res
        .status(400)
        .json({ message: 'You cannot update your own membership.' });
    if (isOwner(workspace, memberId))
      return res
        .status(400)
        .json({ message: 'Cannot update the workspace owner.' });

    if (isAdmin(workspace, userId) && isAdmin(workspace, memberId)) {
      return res
        .status(403)
        .json({ message: 'Admins cannot update other admins.' });
    }

    const memberIndex = workspace.members.findIndex(
      (m) => getUserId(m.user) === memberId && m.status === 'active'
    );

    if (memberIndex === -1)
      return res.status(404).json({ message: 'Active member not found.' });

    // Associates cannot be given workspace admin/manager roles
    if (
      workspace.members[memberIndex].memberType === 'associate' &&
      role &&
      ['Admin', 'Owner'].includes(role)
    ) {
      return res.status(400).json({
        message:
          'Associates cannot be promoted to workspace Admin. Promote them to permanent member first.',
      });
    }

    if (role) workspace.members[memberIndex].role = role.trim();
    if (department) workspace.members[memberIndex].department = department.trim();

    await workspace.save();
    await workspace.populate('members.user', 'name email profile');

    notifyUsers(memberId, {
      title: `Your role in "${workspace.name}" has been updated`,
      body: `Your role is now ${workspace.members[memberIndex].role}${
        workspace.members[memberIndex].department
          ? ` in the ${workspace.members[memberIndex].department} department`
          : ''
      }.`,
      data: { workspaceId: workspace._id.toString() },
      emailEventType: 'teamInvite',
    });

    res.status(200).json({
      success: true,
      message: 'Member updated successfully.',
      member: workspace.members[memberIndex],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE ACTIVE MEMBER  (owner or admin)
// DELETE /api/team/:workspaceId/member/:memberId
//
// Works for permanent members AND associates. When removing an associate,
// also drops all their project ties and revokes project.associates records.
// ─────────────────────────────────────────────────────────────────────────────

const removeMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, memberId } = req.params;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    if (!isManager(workspace, userId))
      return res
        .status(403)
        .json({ message: 'Only the workspace owner or admin can remove members.' });

    if (memberId === userId)
      return res.status(400).json({ message: 'You cannot remove yourself.' });
    if (isOwner(workspace, memberId))
      return res
        .status(400)
        .json({ message: 'Cannot remove the workspace owner.' });

    if (isAdmin(workspace, userId) && isAdmin(workspace, memberId)) {
      return res
        .status(403)
        .json({ message: 'Admins cannot remove other admins.' });
    }

    const memberIndex = workspace.members.findIndex(
      (m) => getUserId(m.user) === memberId && m.status === 'active'
    );

    if (memberIndex === -1)
      return res.status(404).json({ message: 'Active member not found.' });

    const target = workspace.members[memberIndex];
    const wasAssociate = target.memberType === 'associate';

    workspace.members.splice(memberIndex, 1);
    await workspace.save();

    await User.findByIdAndUpdate(memberId, {
      $pull: { joinedWorkspaces: workspaceId },
    });

    // If it was an associate, revoke all project.associates records for them
    // in this workspace and strip them from projectManagers/teamMembers.
    if (wasAssociate) {
      const projects = await Project.find({
        workspace: workspaceId,
        $or: [
          { 'associates.userId': memberId },
          { projectManagers: memberId },
          { 'teamMembers.user': memberId },
        ],
      }).select('_id projectManagers teamMembers associates');

      for (const p of projects) {
        p.associates.forEach((a) => {
          if (a.userId && a.userId.toString() === memberId && a.status !== 'revoked') {
            a.status = 'revoked';
            a.revokedAt = new Date();
            a.revokedBy = userId;
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
    }

    notifyUsers(memberId, {
      title: `Removed from "${workspace.name}"`,
      body: `You have been removed from the workspace "${workspace.name}" by an owner or admin.`,
      data: { workspaceId: workspace._id.toString() },
      emailEventType: 'teamInvite',
    });

    res
      .status(200)
      .json({ success: true, message: 'Member removed from workspace.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET MY MEMBERSHIP DETAILS
// GET /api/team/:workspaceId/me
// ─────────────────────────────────────────────────────────────────────────────

const getMyMembership = async (req, res) => {
  try {
    const userId = req.user.id;
    const workspace = await Workspace.findById(req.params.workspaceId)
      .populate('owner', 'name email profile')
      .populate('members.user', 'name email profile');

    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    const membership = workspace.members.find(
      (m) => getUserId(m.user) === userId
    );

    if (!membership)
      return res
        .status(404)
        .json({ message: 'You are not a member of this workspace.' });

    res.status(200).json({
      success: true,
      workspace: {
        _id: workspace._id,
        name: workspace.name,
        industry: workspace.industry,
        color: workspace.color,
        initials: workspace.initials,
        owner: workspace.owner,
      },
      membership: {
        ...membership.toObject(),
        isAssociate: membership.memberType === 'associate',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// ASSOCIATE-SPECIFIC ENDPOINTS
//
// Associates are workspace members with memberType 'associate'.
// They are normally added from within a project (projectController.addAssociate)
// which also handles adding the workspace member record. These endpoints
// manage the workspace-level side.
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// LIST WORKSPACE ASSOCIATES  (owner or admin)
// GET /api/team/:workspaceId/associates
// ─────────────────────────────────────────────────────────────────────────────

const getAssociates = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(workspaceId).populate(
      'members.user',
      'name email profile phone'
    );

    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    if (!isManager(workspace, userId))
      return res
        .status(403)
        .json({ message: 'Only the workspace owner or admin can view associates.' });

    const associates = workspace.members.filter(
      (m) => m.memberType === 'associate' && m.status === 'active'
    );

    // Attach the projects each associate is on in this workspace
    const associateIds = associates.map((m) => getUserId(m.user));
    const projects = await Project.find({
      workspace: workspaceId,
      'associates.userId': { $in: associateIds },
    }).select('name associates');

    const associateWithProjects = associates.map((m) => {
      const uid = getUserId(m.user);
      const assignedProjects = projects
        .filter((p) =>
          (p.associates || []).some(
            (a) => a.userId && a.userId.toString() === uid && a.status === 'active'
          )
        )
        .map((p) => ({ _id: p._id, name: p.name }));

      return {
        ...m.toObject(),
        isExpired: isExpired(m),
        projects: assignedProjects,
      };
    });

    res.status(200).json({ success: true, associates: associateWithProjects });
  } catch (error) {
    console.error('❌ getAssociates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE WORKSPACE ASSOCIATE  (owner or admin)
// PATCH /api/team/:workspaceId/associate/:memberId
// Body: { accessExpiresAt? }
//
// Role changes are handled per-project. This only lets the workspace owner
// extend/remove the access window on the workspace-level associate record.
// ─────────────────────────────────────────────────────────────────────────────

const updateAssociate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, memberId } = req.params;
    const { accessExpiresAt } = req.body;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    if (!isManager(workspace, userId))
      return res
        .status(403)
        .json({ message: 'Only the workspace owner or admin can update associates.' });

    const member = workspace.members.find(
      (m) => getUserId(m.user) === memberId && m.memberType === 'associate'
    );

    if (!member)
      return res.status(404).json({ message: 'Associate not found in this workspace.' });

    if (accessExpiresAt !== undefined) {
      member.accessExpiresAt = accessExpiresAt ? new Date(accessExpiresAt) : null;
    }

    await workspace.save();

    // Mirror the expiry onto project.associates records for consistency
    if (accessExpiresAt !== undefined) {
      await Project.updateMany(
        {
          workspace: workspaceId,
          'associates.userId': memberId,
        },
        {
          $set: {
            'associates.$[elem].accessExpiresAt': accessExpiresAt
              ? new Date(accessExpiresAt)
              : null,
          },
        },
        {
          arrayFilters: [{ 'elem.userId': memberId }],
        }
      );
    }

    notifyUsers(memberId, {
      title: `Your access to "${workspace.name}" was updated`,
      body: accessExpiresAt
        ? `Your associate access now expires on ${new Date(accessExpiresAt).toDateString()}.`
        : 'Your associate access no longer has an expiration date.',
      data: { workspaceId: workspace._id.toString() },
      emailEventType: 'teamInvite',
    });

    res.status(200).json({
      success: true,
      message: 'Associate updated.',
      member,
    });
  } catch (error) {
    console.error('❌ updateAssociate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE WORKSPACE ASSOCIATE  (owner or admin)
// DELETE /api/team/:workspaceId/associate/:memberId
//
// Same effect as removeMember but scoped to associates. Also revokes
// every project.associates record for this user in the workspace.
// ─────────────────────────────────────────────────────────────────────────────

const removeAssociate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, memberId } = req.params;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    if (!isManager(workspace, userId))
      return res
        .status(403)
        .json({ message: 'Only the workspace owner or admin can remove associates.' });

    if (isOwner(workspace, memberId))
      return res.status(400).json({ message: 'Cannot remove the workspace owner.' });

    const memberIndex = workspace.members.findIndex(
      (m) => getUserId(m.user) === memberId && m.memberType === 'associate'
    );

    if (memberIndex === -1)
      return res.status(404).json({ message: 'Associate not found in this workspace.' });

    // Block if they still have open tasks anywhere in the workspace
    const openTasks = await Task.countDocuments({
      workspace: workspaceId,
      assignees: memberId,
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

    workspace.members.splice(memberIndex, 1);
    await workspace.save();

    await User.findByIdAndUpdate(memberId, {
      $pull: { joinedWorkspaces: workspaceId },
    });

    // Revoke project-level associate records + drop from teams/PMs
    const projects = await Project.find({
      workspace: workspaceId,
      $or: [
        { 'associates.userId': memberId },
        { projectManagers: memberId },
        { 'teamMembers.user': memberId },
      ],
    }).select('_id projectManagers teamMembers associates');

    for (const p of projects) {
      p.associates.forEach((a) => {
        if (a.userId && a.userId.toString() === memberId && a.status !== 'revoked') {
          a.status = 'revoked';
          a.revokedAt = new Date();
          a.revokedBy = userId;
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

    notifyUsers(memberId, {
      title: `Removed from "${workspace.name}"`,
      body: 'Your associate access to this workspace has been revoked.',
      data: { workspaceId: workspace._id.toString() },
      emailEventType: 'teamInvite',
    });

    res.status(200).json({
      success: true,
      message: 'Associate removed from workspace.',
      revokedProjects: projects.length,
    });
  } catch (error) {
    console.error('❌ removeAssociate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERT ASSOCIATE → PERMANENT MEMBER  (owner or admin)
// PATCH /api/team/:workspaceId/associate/:memberId/promote
// Body: { role?, department? }
//
// After this they become a normal permanent member and can be given
// workspace Admin rights, appear in department lists, request clock-in, etc.
// ─────────────────────────────────────────────────────────────────────────────

const convertAssociateToMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, memberId } = req.params;
    const { role = 'Staff', department = 'General' } = req.body;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace)
      return res.status(404).json({ message: 'Workspace not found.' });

    if (!isManager(workspace, userId))
      return res
        .status(403)
        .json({ message: 'Only the workspace owner or admin can promote associates.' });

    const member = workspace.members.find(
      (m) => getUserId(m.user) === memberId && m.memberType === 'associate'
    );

    if (!member)
      return res.status(404).json({ message: 'Associate not found in this workspace.' });

    member.memberType = 'permanent';
    member.role = role;
    member.department = department;
    member.accessExpiresAt = null;

    await workspace.save();

    notifyUsers(memberId, {
      title: `You are now a permanent member of "${workspace.name}"`,
      body: `You have been promoted to ${role} in the ${department} department.`,
      data: { workspaceId: workspace._id.toString() },
      emailEventType: 'teamInvite',
      emailHtml: `
        <h3>Welcome aboard!</h3>
        <p>You are now a permanent member of <strong>${workspace.name}</strong>.</p>
        <p>Role: ${role}<br/>Department: ${department}</p>
      `,
    });

    res.status(200).json({
      success: true,
      message: 'Associate promoted to permanent member.',
      member,
    });
  } catch (error) {
    console.error('❌ convertAssociateToMember error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Permanent member flow
  requestToJoin,
  getPendingRequests,
  approveMember,
  rejectMember,
  getMembers,
  getMembersByDepartment,
  updateMember,
  removeMember,
  getMyMembership,
  // Associate flow
  getAssociates,
  updateAssociate,
  removeAssociate,
  convertAssociateToMember,
};