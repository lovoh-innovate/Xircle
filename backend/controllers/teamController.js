// controllers/teamController.js
import Workspace from "../models/workspaceModel.js";
import User from "../models/userModel.js";

// ── Notification service ──────────────────────────────────────────
import { createAndSendNotification } from "./notificationController.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const isOwner = (workspace, userId) =>
  workspace.owner.toString() === userId;

const findActiveMember = (workspace, userId) =>
  workspace.members.find(
    (m) => m.user.toString() === userId && m.status === "active"
  );

const findPendingMember = (workspace, userId) =>
  workspace.members.find(
    (m) => m.user.toString() === userId && m.status === "pending"
  );

/**
 * Fire-and-forget notification to one or many users.
 * @param {string|string[]} userIds - Single user ID or array
 * @param {Object} options
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

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST TO JOIN WORKSPACE VIA INVITE CODE
// POST /api/team/join
// Staff uses invite code → goes into pending, waits for owner approval
// ─────────────────────────────────────────────────────────────────────────────

const requestToJoin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { inviteCode } = req.body;

    if (!inviteCode)
      return res.status(400).json({ message: "Invite code is required." });

    const workspace = await Workspace.findOne({
      inviteCode: inviteCode.toUpperCase(),
    });

    if (!workspace)
      return res
        .status(404)
        .json({ message: "Invalid invite code. Workspace not found." });

    if (isOwner(workspace, userId))
      return res
        .status(400)
        .json({ message: "You are the owner of this workspace." });

    const alreadyActive = findActiveMember(workspace, userId);
    if (alreadyActive)
      return res
        .status(400)
        .json({ message: "You are already an active member of this workspace." });

    const alreadyPending = findPendingMember(workspace, userId);
    if (alreadyPending)
      return res
        .status(400)
        .json({ message: "You already have a pending join request for this workspace." });

    workspace.members.push({
      user: userId,
      role: "Staff",
      department: null,
      status: "pending",
      joinedAt: null,
    });

    await workspace.save();

    // Notify owner
    const requestingUser = await User.findById(userId).select("name email");
    notifyUsers(workspace.owner.toString(), {
      title: `New join request for "${workspace.name}"`,
      body: `${requestingUser?.name || "A user"} wants to join your workspace.`,
      data: { workspaceId: workspace._id.toString(), userId },
      emailEventType: "teamInvite",
      emailHtml: `
        <h3>New Join Request</h3>
        <p>${requestingUser?.name || "A user"} (${
        requestingUser?.email || ""
      }) has requested to join <strong>${workspace.name}</strong>.</p>
        <p><a href="${process.env.CLIENT_URL}/workspace/${
        workspace._id
      }/members">Manage Members</a></p>
      `,
    });

    res.status(200).json({
      success: true,
      message: "Join request sent. Waiting for owner approval.",
      workspaceId: workspace._id,
      workspaceName: workspace.name,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL PENDING JOIN REQUESTS  (owner only)
// GET /api/team/:workspaceId/requests
// ─────────────────────────────────────────────────────────────────────────────

const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const workspace = await Workspace.findById(req.params.workspaceId).populate(
      "members.user",
      "name email profile phone authMethod"
    );

    if (!workspace)
      return res.status(404).json({ message: "Workspace not found." });

    if (!isOwner(workspace, userId))
      return res
        .status(403)
        .json({ message: "Only the workspace owner can view pending requests." });

    const pending = workspace.members.filter((m) => m.status === "pending");

    res.status(200).json({ success: true, pending });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE MEMBER + ASSIGN DEPARTMENT & ROLE  (owner only)
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
        .json({ message: "Department is required when approving a member." });

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace)
      return res.status(404).json({ message: "Workspace not found." });

    if (!isOwner(workspace, userId))
      return res
        .status(403)
        .json({ message: "Only the workspace owner can approve members." });

    const memberIndex = workspace.members.findIndex(
      (m) => m.user.toString() === memberId && m.status === "pending"
    );

    if (memberIndex === -1)
      return res
        .status(404)
        .json({ message: "No pending request found for this user." });

    // Approve and assign
    workspace.members[memberIndex].status = "active";
    workspace.members[memberIndex].department = department.trim();
    workspace.members[memberIndex].role = role?.trim() || "Staff";
    workspace.members[memberIndex].joinedAt = new Date();

    await workspace.save();

    // Add to user's joinedWorkspaces
    await User.findByIdAndUpdate(memberId, {
      $addToSet: { joinedWorkspaces: workspaceId },
    });

    await workspace.populate("members.user", "name email profile");

    // Notify the approved member
    notifyUsers(memberId, {
      title: `Welcome to "${workspace.name}"`,
      body: `Your join request has been approved. You are now a member (${
        role || "Staff"
      }) in the ${department} department.`,
      data: { workspaceId: workspace._id.toString() },
      emailEventType: "teamInvite",
      emailHtml: `
        <h3>Welcome to ${workspace.name}!</h3>
        <p>Your request to join has been approved.</p>
        <p>Role: ${role || "Staff"}<br/>Department: ${department}</p>
        <p><a href="${process.env.CLIENT_URL}/workspace/${
        workspace._id
      }">Go to Workspace</a></p>
      `,
    });

    res.status(200).json({
      success: true,
      message: "Member approved and assigned successfully.",
      member: workspace.members[memberIndex],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REJECT JOIN REQUEST  (owner only)
// DELETE /api/team/:workspaceId/reject/:memberId
// ─────────────────────────────────────────────────────────────────────────────

const rejectMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, memberId } = req.params;

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace)
      return res.status(404).json({ message: "Workspace not found." });

    if (!isOwner(workspace, userId))
      return res
        .status(403)
        .json({ message: "Only the workspace owner can reject requests." });

    const memberIndex = workspace.members.findIndex(
      (m) => m.user.toString() === memberId && m.status === "pending"
    );

    if (memberIndex === -1)
      return res
        .status(404)
        .json({ message: "No pending request found for this user." });

    workspace.members.splice(memberIndex, 1);
    await workspace.save();

    // Notify rejected user
    notifyUsers(memberId, {
      title: `Request to join "${workspace.name}" declined`,
      body: "Your request to join the workspace has been declined by the owner.",
      data: { workspaceId: workspace._id.toString() },
      emailEventType: "teamInvite",
    });

    res.status(200).json({ success: true, message: "Join request rejected." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL ACTIVE MEMBERS  (owner + active members)
// GET /api/team/:workspaceId/members
// ─────────────────────────────────────────────────────────────────────────────

const getMembers = async (req, res) => {
  try {
    const userId = req.user.id;

    const workspace = await Workspace.findById(req.params.workspaceId).populate(
      "members.user",
      "name email profile phone authMethod"
    );

    if (!workspace)
      return res.status(404).json({ message: "Workspace not found." });

    const ownerAccess = isOwner(workspace, userId);
    const memberAccess = findActiveMember(workspace, userId);

    if (!ownerAccess && !memberAccess)
      return res
        .status(403)
        .json({ message: "Access denied. You are not part of this workspace." });

    const activeMembers = workspace.members.filter((m) => m.status === "active");

    res.status(200).json({ success: true, members: activeMembers });
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
      "members.user",
      "name email profile phone"
    );

    if (!workspace)
      return res.status(404).json({ message: "Workspace not found." });

    const ownerAccess = isOwner(workspace, userId);
    const memberAccess = findActiveMember(workspace, userId);

    if (!ownerAccess && !memberAccess)
      return res.status(403).json({ message: "Access denied." });

    const departmentMembers = workspace.members.filter(
      (m) =>
        m.status === "active" &&
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
// UPDATE MEMBER ROLE OR DEPARTMENT  (owner only)
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
        .json({ message: "Provide at least a role or department to update." });

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace)
      return res.status(404).json({ message: "Workspace not found." });

    if (!isOwner(workspace, userId))
      return res
        .status(403)
        .json({ message: "Only the workspace owner can update members." });

    const memberIndex = workspace.members.findIndex(
      (m) => m.user.toString() === memberId && m.status === "active"
    );

    if (memberIndex === -1)
      return res.status(404).json({ message: "Active member not found." });

    if (role) workspace.members[memberIndex].role = role.trim();
    if (department) workspace.members[memberIndex].department = department.trim();

    await workspace.save();
    await workspace.populate("members.user", "name email profile");

    // Optional: notify the member about their updated role/department
    notifyUsers(memberId, {
      title: `Your role in "${workspace.name}" has been updated`,
      body: `Your role is now ${workspace.members[memberIndex].role} in the ${workspace.members[memberIndex].department} department.`,
      data: { workspaceId: workspace._id.toString() },
      emailEventType: "teamInvite",
    });

    res.status(200).json({
      success: true,
      message: "Member updated successfully.",
      member: workspace.members[memberIndex],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE ACTIVE MEMBER  (owner only)
// DELETE /api/team/:workspaceId/member/:memberId
// ─────────────────────────────────────────────────────────────────────────────

const removeMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, memberId } = req.params;

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace)
      return res.status(404).json({ message: "Workspace not found." });

    if (!isOwner(workspace, userId))
      return res
        .status(403)
        .json({ message: "Only the workspace owner can remove members." });

    if (memberId === userId)
      return res
        .status(400)
        .json({ message: "Owner cannot remove themselves." });

    const memberIndex = workspace.members.findIndex(
      (m) => m.user.toString() === memberId && m.status === "active"
    );

    if (memberIndex === -1)
      return res.status(404).json({ message: "Active member not found." });

    workspace.members.splice(memberIndex, 1);
    await workspace.save();

    // Remove from user's joinedWorkspaces
    await User.findByIdAndUpdate(memberId, {
      $pull: { joinedWorkspaces: workspaceId },
    });

    // Notify removed member
    notifyUsers(memberId, {
      title: `Removed from "${workspace.name}"`,
      body: `You have been removed from the workspace "${workspace.name}" by the owner.`,
      data: { workspaceId: workspace._id.toString() },
      emailEventType: "teamInvite",
    });

    res
      .status(200)
      .json({ success: true, message: "Member removed from workspace." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET MY MEMBERSHIP DETAILS  (staff)
// GET /api/team/:workspaceId/me
// ─────────────────────────────────────────────────────────────────────────────

const getMyMembership = async (req, res) => {
  try {
    const userId = req.user.id;

    const workspace = await Workspace.findById(req.params.workspaceId)
      .populate("owner", "name email profile")
      .populate("members.user", "name email profile");

    if (!workspace)
      return res.status(404).json({ message: "Workspace not found." });

    const membership = workspace.members.find(
      (m) => m.user._id.toString() === userId
    );

    if (!membership)
      return res
        .status(404)
        .json({ message: "You are not a member of this workspace." });

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
      membership,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

export {
  requestToJoin,
  getPendingRequests,
  approveMember,
  rejectMember,
  getMembers,
  getMembersByDepartment,
  updateMember,
  removeMember,
  getMyMembership,
};