// controllers/messagingController.js
import mongoose from "mongoose";
import { Message, Chat, TypingIndicator } from "../models/messagingModel.js";
import Workspace from "../models/workspaceModel.js";
import User from "../models/userModel.js";
import Sticker from "../models/stickerModel.js";
import Task from "../models/taskModel.js";                          // 👈 NEW
import Project from "../models/projectModel.js";                    // 👈 NEW
import WorkspaceNote from "../models/workspaceNoteModel.js";        // 👈 NEW
import ClockIn from "../models/clockInModel.js";                    // 👈 NEW
import { createAndSendNotification } from './notificationController.js';
import { getIO } from './socket.js';

// ──────────────────────────────────────────────────
// Helpers (unchanged)
// ──────────────────────────────────────────────────

const isWorkspaceMember = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);
  return workspace?.members.some(
    (m) => m.user.toString() === userId && m.status === "active",
  );
};

const isWorkspaceAdmin = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);
  return workspace?.members.some(
    (m) => m.user.toString() === userId && m.role === 'Admin' && m.status === 'active'
  );
};

const isChatParticipant = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  return chat?.participants.some((p) => p.user.toString() === userId);
};

const isChatAdmin = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  if (!chat) return false;
  if (chat.scope === 'workspace' && chat.workspace) {
    const workspace = await Workspace.findById(chat.workspace);
    if (workspace && (workspace.owner.toString() === userId || await isWorkspaceAdmin(chat.workspace.toString(), userId))) {
      return true;
    }
  }
  const participant = chat.participants.find(
    (p) => p.user.toString() === userId,
  );
  return participant?.role === "admin";
};

const getChatCreator = async (chatId) => {
  const chat = await Chat.findById(chatId);
  return chat?.createdBy?.toString();
};

const isChatCreator = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  return chat?.createdBy?.toString() === userId;
};

const buildChatNotificationData = (chat, extra = {}) => ({
  notificationType: chat.type === 'group' ? 'channel' : 'chat',
  scope: chat.scope,
  chatId: chat._id.toString(),
  workspaceId: chat.workspace ? chat.workspace.toString() : null,
  ...extra,
});

const notifyUsers = async (userIds, { title, body, data = {} } = {}) => {
  console.log(`🔔 notifyUsers called with ${userIds?.length || 0} recipients`);
  if (!userIds || userIds.length === 0) {
    console.log(`⚠️ notifyUsers: no recipients, skipping`);
    return;
  }
  const recipients = Array.isArray(userIds) ? userIds : [userIds];
  for (const uid of recipients) {
    console.log(`  ▶️ Sending notification to user ${uid}`);
    try {
      await createAndSendNotification({
        recipient: uid,
        title,
        body,
        data,
        sendPush: true,
        emailEventType: 'newMessage',
        emailSubject: title,
        emailHtml: `<p>${body}</p>`,
      });
      console.log(`  ✅ Notification sent to ${uid}`);
    } catch (err) {
      console.error(`  ❌ Notify ${uid} failed:`, err);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REFERENCE SANITIZER — validates tagged tasks/projects/notes/clock-ins
// Never trust the client. Every ref is re-checked against the workspace.
// ─────────────────────────────────────────────────────────────────────────────

const REFERENCE_TYPES = ['task', 'project', 'note', 'clockin'];

const sanitizeReferences = async (rawRefs, workspaceId, userId) => {
  if (!Array.isArray(rawRefs) || rawRefs.length === 0) return [];
  if (!workspaceId) return []; // refs only make sense inside a workspace chat

  const cleaned = [];

  for (const raw of rawRefs.slice(0, 10)) {
    const { type, refId } = raw || {};
    if (!REFERENCE_TYPES.includes(type)) continue;
    if (!mongoose.Types.ObjectId.isValid(refId)) continue;

    // Dedupe by (type, refId)
    if (cleaned.some((r) => r.type === type && r.refId.toString() === refId.toString())) {
      continue;
    }

    let doc = null;
    let label = '';
    let sublabel = '';
    let url = '';

    try {
      if (type === 'task') {
        doc = await Task.findOne({
          _id: refId,
          workspace: workspaceId,
          isDeleted: false,
          isTrash: { $ne: true },
        })
          .populate({ path: 'project', select: 'name' })
          .lean();
        if (doc) {
          label = doc.title;
          sublabel = doc.project?.name || '';
          url = doc.project?._id
            ? `/workspace/${workspaceId}/project/${doc.project._id}/task/${doc._id}`
            : null;
        }
      } else if (type === 'project') {
        doc = await Project.findOne({
          _id: refId,
          workspace: workspaceId,
          isTrash: { $ne: true },
        }).lean();
        if (doc) {
          label = doc.name;
          sublabel = doc.status || '';
          url = `/workspace/${workspaceId}/project/${doc._id}`;
        }
      } else if (type === 'note') {
        doc = await WorkspaceNote.findOne({
          _id: refId,
          workspace: workspaceId,
        }).lean();
        if (doc) {
          label = doc.title;
          sublabel = 'Note';
          url = `/workspace/${workspaceId}/notes/${doc._id}`;
        }
      } else if (type === 'clockin') {
        doc = await ClockIn.findOne({
          _id: refId,
          workspace: workspaceId,
          user: userId, // you can only reference your own clock-in
        }).lean();
        if (doc) {
          const t = new Date(doc.clockInTime);
          label = `Clocked in at ${t.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}`;
          sublabel = t.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          url = `/workspace/${workspaceId}/clockin`;
        }
      }
    } catch (err) {
      console.error('sanitizeReferences lookup failed:', err.message);
      continue;
    }

    if (!doc || !url) continue;

    cleaned.push({
      type,
      refId: doc._id,
      label: String(label).slice(0, 200),
      sublabel: String(sublabel || '').slice(0, 120),
      url,
      workspaceId,
    });
  }

  return cleaned;
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE ONLINE STATUS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const updateOnlineStatus = async (req, res) => {
  console.log(`🔵 updateOnlineStatus called for user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { workspaceId, isOnline } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required." });
    }
    await Chat.updateMany(
      {
        workspace: workspaceId,
        "participants.user": userId,
      },
      {
        $set: {
          "participants.$.online": isOnline,
          "participants.$.lastSeen": isOnline ? null : new Date(),
        },
      },
    );
    console.log(`✅ Online status updated for user ${userId}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`❌ updateOnlineStatus error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH CHAT ENTITIES — powers the "/" picker in the chat input
// GET /api/messages/chat/:chatId/entities?q=...&limit=8
// ─────────────────────────────────────────────────────────────────────────────

export const searchChatEntities = async (req, res) => {
  console.log(`🔵 searchChatEntities called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { q = '', limit = 8 } = req.query;

    const chat = await Chat.findById(chatId).select('participants workspace');
    if (!chat) return res.status(404).json({ message: 'Chat not found.' });

    const isParticipant = chat.participants.some(
      (p) => p.user.toString() === userId
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Non-workspace (public) chats have nothing to tag
    if (!chat.workspace) {
      return res.status(200).json({
        success: true,
        results: { tasks: [], projects: [], notes: [], clockins: [] },
      });
    }

    const workspaceId = chat.workspace;
    const workspace = await Workspace.findById(workspaceId).select('owner members');
    if (!workspace) return res.status(404).json({ message: 'Workspace not found.' });

    const isOwner = workspace.owner.toString() === userId;
    const activeMember = workspace.members.find(
      (m) => m.user.toString() === userId && m.status === 'active'
    );
    if (!isOwner && !activeMember) {
      return res.status(403).json({ message: 'Not a workspace member.' });
    }

    const isAdmin =
      isOwner || activeMember?.role?.toLowerCase() === 'admin';

    const search = String(q).trim();
    const regex = search
      ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : null;
    const cap = Math.min(parseInt(limit, 10) || 8, 15);

    // ── Tasks ──────────────────────────────────────────────────
    const taskQuery = {
      workspace: workspaceId,
      isDeleted: false,
      isTrash: { $ne: true },
    };
    if (regex) taskQuery.title = regex;
    const tasks = await Task.find(taskQuery)
      .populate({ path: 'project', select: 'name' })
      .select('title status priority project')
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean();

    // ── Projects ───────────────────────────────────────────────
    const projectQuery = {
      workspace: workspaceId,
      isTrash: { $ne: true },
    };
    if (regex) projectQuery.name = regex;
    const projects = await Project.find(projectQuery)
      .select('name status progress')
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean();

    // ── Notes ──────────────────────────────────────────────────
    const noteQuery = { workspace: workspaceId };
    if (regex) noteQuery.title = regex;
    const notes = await WorkspaceNote.find(noteQuery)
      .select('title updatedAt')
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean();

    // ── Clock-ins ──────────────────────────────────────────────
    // Staff sees their own. Admins/owner see everyone's.
    const clockinQuery = {
      workspace: workspaceId,
      ...(isAdmin ? {} : { user: userId }),
    };
    const clockins = await ClockIn.find(clockinQuery)
      .select('user clockInTime status')
      .populate('user', 'name profile')
      .sort({ clockInTime: -1 })
      .limit(cap)
      .lean();

    res.status(200).json({
      success: true,
      workspaceId: workspaceId.toString(),
      results: {
        tasks: tasks.map((t) => ({
          _id: t._id,
          type: 'task',
          label: t.title,
          sublabel: t.project?.name || '',
          projectId: t.project?._id || null,
          status: t.status,
          priority: t.priority,
          url: t.project?._id
            ? `/workspace/${workspaceId}/project/${t.project._id}/task/${t._id}`
            : null,
        })),
        projects: projects.map((p) => ({
          _id: p._id,
          type: 'project',
          label: p.name,
          sublabel: p.status || '',
          status: p.status,
          progress: p.progress,
          url: `/workspace/${workspaceId}/project/${p._id}`,
        })),
        notes: notes.map((n) => ({
          _id: n._id,
          type: 'note',
          label: n.title,
          sublabel: 'Note',
          updatedAt: n.updatedAt,
          url: `/workspace/${workspaceId}/notes/${n._id}`,
        })),
        clockins: clockins.map((c) => {
          const t = new Date(c.clockInTime);
          const isOther = c.user?._id?.toString() !== userId;
          return {
            _id: c._id,
            type: 'clockin',
            label: `Clocked in ${t.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}`,
            sublabel: isOther
              ? `${c.user?.name || 'User'} · ${t.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}`
              : t.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }),
            url: `/workspace/${workspaceId}/clockin`,
          };
        }),
      },
    });
  } catch (error) {
    console.error('❌ searchChatEntities error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE GROUP CHAT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const createGroupChat = async (req, res) => {
  console.log(`🔵 createGroupChat called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { workspaceId, name, memberIds = [] } = req.body;
    const avatarFile = req.file;
    if (!workspaceId || !name?.trim()) {
      return res
        .status(400)
        .json({ message: "Workspace ID and group name are required." });
    }
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found." });
    }
    const isOwner = workspace.owner.toString() === userId;
    const isAdmin = workspace.members.some(
      (m) => m.user.toString() === userId && m.role === 'Admin' && m.status === 'active'
    );
    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Only the workspace owner or admins can create group chats." });
    }
    const participants = [
      {
        user: userId,
        role: 'admin',
        joinedAt: new Date(),
        online: false,
        lastSeen: new Date(),
      },
    ];
    const activeMemberIds = workspace.members
      .filter(m => m.status === 'active')
      .map(m => m.user.toString());
    const addedUsers = [];
    for (const mid of memberIds) {
      if (activeMemberIds.includes(mid) && mid !== userId) {
        if (!participants.some(p => p.user.toString() === mid)) {
          participants.push({
            user: mid,
            role: 'member',
            joinedAt: new Date(),
            online: false,
            lastSeen: new Date(),
          });
          addedUsers.push(mid);
        }
      }
    }
    let avatarUrl = avatarFile ? avatarFile.path : null;
    const chat = await Chat.create({
      workspace: workspaceId,
      type: "group",
      scope: "workspace",
      name: name.trim(),
      avatar: avatarUrl,
      participants,
      createdBy: userId,
      lastMessageAt: new Date(),
      isPublic: false,
      joinRequests: [],
    });
    const populatedChat = await Chat.findById(chat._id)
      .populate("participants.user", "name email profile username")
      .populate("createdBy", "name email profile username");
    if (addedUsers.length > 0) {
      console.log(`📢 Notifying ${addedUsers.length} members about new group chat`);
      notifyUsers(addedUsers, {
        title: `New group chat "${chat.name}"`,
        body: `You were added to the group "${chat.name}" by ${req.user.name || 'the workspace admin'}.`,
        data: buildChatNotificationData(chat),
      });
    }
    res.status(201).json({
      success: true,
      message: "Group chat created successfully",
      chat: populatedChat,
    });
  } catch (error) {
    console.error(`❌ createGroupChat error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE GROUP CHAT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const updateGroupChat = async (req, res) => {
  console.log(`🔵 updateGroupChat called by user ${req.user.id} for chat ${req.params.chatId}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { name, description, isPublic } = req.body;
    const avatarFile = req.file;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    if (chat.type !== "group") {
      return res.status(400).json({ message: "Only group chats can be updated." });
    }
    let canUpdate = false;
    let isWorkspaceChat = chat.scope === 'workspace' && chat.workspace;
    if (chat.scope === 'public') {
      if (chat.createdBy.toString() === userId) canUpdate = true;
    } else if (isWorkspaceChat) {
      const workspace = await Workspace.findById(chat.workspace);
      if (workspace) {
        const isOwner = workspace.owner.toString() === userId;
        const isAdmin = workspace.members.some(
          (m) => m.user.toString() === userId && m.role === 'Admin' && m.status === 'active'
        );
        if (isOwner || isAdmin || chat.createdBy.toString() === userId) canUpdate = true;
      }
    }
    if (!canUpdate) {
      return res.status(403).json({
        message: "You do not have permission to update this group."
      });
    }
    if (name) chat.name = name.trim();
    if (description !== undefined) chat.description = description.trim();
    if (chat.scope === 'public' && isPublic !== undefined) {
      chat.isPublic = isPublic === 'true' || isPublic === true;
    }
    if (avatarFile) {
      chat.avatar = avatarFile.path;
    }
    await chat.save();
    const updatedChat = await Chat.findById(chatId)
      .populate("participants.user", "name email profile username")
      .populate("createdBy", "name email profile username");
    const participantIds = chat.participants.map(p => p.user.toString());
    if (participantIds.length > 0 && name) {
      notifyUsers(participantIds, {
        title: `Group "${chat.name}" updated`,
        body: `The group chat "${chat.name}" has been updated.`,
        data: buildChatNotificationData(chat),
      });
    }
    res.status(200).json({
      success: true,
      message: "Group updated successfully",
      chat: updatedChat,
    });
  } catch (error) {
    console.error(`❌ updateGroupChat error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE DIRECT CHAT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const createDirectChat = async (req, res) => {
  console.log(`🔵 createDirectChat called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { workspaceId, targetUserId } = req.body;
    if (!workspaceId || !targetUserId) {
      return res
        .status(400)
        .json({ message: "Workspace ID and target user are required." });
    }
    if (targetUserId === userId) {
      return res
        .status(400)
        .json({ message: "Cannot create a chat with yourself." });
    }
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found." });
    }
    const isUserActive = workspace.members.some(
      (m) => m.user.toString() === userId && m.status === "active",
    );
    const isTargetActive = workspace.members.some(
      (m) => m.user.toString() === targetUserId && m.status === "active",
    );
    if (!isUserActive || !isTargetActive) {
      return res
        .status(403)
        .json({
          message: "Both users must be active members of the workspace.",
        });
    }
    const existingChat = await Chat.findOne({
      workspace: workspaceId,
      type: "direct",
      scope: "workspace",
      participants: {
        $all: [{ user: userId }, { user: targetUserId }],
        $size: 2,
      },
    });
    if (existingChat) {
      const populatedChat = await Chat.findById(existingChat._id).populate(
        "participants.user",
        "name email profile username",
      );
      return res.status(200).json({
        success: true,
        message: "Chat already exists",
        chat: populatedChat,
      });
    }
    const chat = await Chat.create({
      workspace: workspaceId,
      type: "direct",
      scope: "workspace",
      participants: [
        { user: userId, role: "member", online: false, lastSeen: new Date() },
        {
          user: targetUserId,
          role: "member",
          online: false,
          lastSeen: new Date(),
        },
      ],
      createdBy: userId,
      lastMessageAt: new Date(),
      isPublic: false,
      joinRequests: [],
    });
    const populatedChat = await Chat.findById(chat._id).populate(
      "participants.user",
      "name email profile username",
    );
    console.log(`📢 Notifying target user ${targetUserId} about new direct chat`);
    notifyUsers([targetUserId], {
      title: `New message from ${req.user.name || 'a colleague'}`,
      body: `${req.user.name || 'Someone'} started a direct chat with you.`,
      data: buildChatNotificationData(chat),
    });
    res.status(201).json({
      success: true,
      message: "Direct chat created successfully",
      chat: populatedChat,
    });
  } catch (error) {
    console.error(`❌ createDirectChat error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PUBLIC DIRECT CHAT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const createPublicDirectChat = async (req, res) => {
  console.log(`🔵 createPublicDirectChat called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { userId: targetUserId, username } = req.body;
    let targetUser;
    if (targetUserId) {
      targetUser = await User.findById(targetUserId);
    } else if (username?.trim()) {
      targetUser = await User.findOne({ username: username.trim() });
    } else {
      return res.status(400).json({ message: "Provide either userId or username." });
    }
    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }
    if (targetUser._id.toString() === userId) {
      return res.status(400).json({ message: "Cannot chat with yourself." });
    }
    const existingChat = await Chat.findOne({
      type: "direct",
      scope: "public",
      participants: {
        $all: [{ user: userId }, { user: targetUser._id }],
        $size: 2,
      },
    });
    if (existingChat) {
      const populatedChat = await Chat.findById(existingChat._id).populate(
        "participants.user",
        "name email profile username",
      );
      return res.status(200).json({
        success: true,
        message: "Chat already exists",
        chat: populatedChat,
      });
    }
    const chat = await Chat.create({
      workspace: null,
      type: "direct",
      scope: "public",
      participants: [
        { user: userId, role: "member", online: false, lastSeen: new Date() },
        {
          user: targetUser._id,
          role: "member",
          online: false,
          lastSeen: new Date(),
        },
      ],
      createdBy: userId,
      lastMessageAt: new Date(),
      isPublic: true,
      joinRequests: [],
    });
    const populatedChat = await Chat.findById(chat._id).populate(
      "participants.user",
      "name email profile username",
    );
    notifyUsers([targetUser._id.toString()], {
      title: `${req.user.name || 'Someone'} started a chat with you`,
      body: `You have a new direct message from ${req.user.name || 'someone'}.`,
      data: buildChatNotificationData(chat),
    });
    res.status(201).json({
      success: true,
      message: "Public direct chat created successfully",
      chat: populatedChat,
    });
  } catch (error) {
    console.error(`❌ createPublicDirectChat error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PUBLIC GROUP CHAT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const createPublicGroupChat = async (req, res) => {
  console.log(`🔵 createPublicGroupChat called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { name, description, isPublic = 'true' } = req.body;
    const avatarFile = req.file;
    if (!name?.trim()) {
      return res.status(400).json({ message: "Group name is required." });
    }
    const existing = await Chat.findOne({
      scope: "public",
      type: "group",
      name: name.trim(),
    });
    if (existing) {
      return res.status(400).json({ message: "Group name already taken." });
    }
    let avatarUrl = avatarFile ? avatarFile.path : null;
    const chat = await Chat.create({
      workspace: null,
      type: "group",
      scope: "public",
      name: name.trim(),
      description: description?.trim() || "",
      avatar: avatarUrl,
      participants: [
        {
          user: userId,
          role: "admin",
          joinedAt: new Date(),
          online: false,
          lastSeen: new Date(),
        },
      ],
      createdBy: userId,
      lastMessageAt: new Date(),
      isPublic: isPublic === 'true' || isPublic === true,
      joinRequests: [],
    });
    const populatedChat = await Chat.findById(chat._id)
      .populate("participants.user", "name email profile username")
      .populate("createdBy", "name email profile username");
    res.status(201).json({
      success: true,
      message: "Public group chat created successfully",
      chat: populatedChat,
    });
  } catch (error) {
    console.error(`❌ createPublicGroupChat error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PUBLIC GROUP (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const updatePublicGroup = async (req, res) => {
  console.log(`🔵 updatePublicGroup called by user ${req.user.id} for chat ${req.params.chatId}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { name, description, isPublic } = req.body;
    const avatarFile = req.file;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (chat.scope !== 'public' || chat.type !== 'group') {
      return res.status(400).json({ message: "Not a public group." });
    }
    if (chat.createdBy.toString() !== userId) {
      return res.status(403).json({ message: "Only the creator can update this group." });
    }
    if (name) chat.name = name.trim();
    if (description !== undefined) chat.description = description.trim();
    if (isPublic !== undefined) chat.isPublic = isPublic === 'true' || isPublic === true;
    if (avatarFile) {
      chat.avatar = avatarFile.path;
    }
    await chat.save();
    const updatedChat = await Chat.findById(chatId)
      .populate("participants.user", "name email profile username")
      .populate("createdBy", "name email profile username");
    res.status(200).json({
      success: true,
      message: "Group updated successfully",
      chat: updatedChat,
    });
  } catch (error) {
    console.error(`❌ updatePublicGroup error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE PUBLIC GROUP (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const deletePublicGroup = async (req, res) => {
  console.log(`🔵 deletePublicGroup called by user ${req.user.id} for chat ${req.params.chatId}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (chat.scope !== 'public' || chat.type !== 'group') {
      return res.status(400).json({ message: "Not a public group." });
    }
    if (chat.createdBy.toString() !== userId) {
      return res.status(403).json({ message: "Only the creator can delete this group." });
    }
    await Message.deleteMany({ chat: chatId });
    await Chat.findByIdAndDelete(chatId);
    const participantIds = chat.participants.map(p => p.user.toString());
    notifyUsers(participantIds, {
      title: `Group "${chat.name}" has been deleted`,
      body: `The public group "${chat.name}" has been permanently deleted by its creator.`,
      data: { notificationType: 'system' },
    });
    res.status(200).json({
      success: true,
      message: "Group deleted successfully.",
    });
  } catch (error) {
    console.error(`❌ deletePublicGroup error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH PUBLIC GROUPS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const searchPublicGroups = async (req, res) => {
  console.log(`🔵 searchPublicGroups called by user ${req.user.id}`);
  try {
    const { query } = req.query;
    const filter = {
      scope: "public",
      type: "group",
      isPublic: true,
    };
    if (query) {
      filter.name = { $regex: query, $options: "i" };
    }
    const groups = await Chat.find(filter)
      .populate("participants.user", "name email profile username")
      .populate("createdBy", "name email profile username")
      .select("-joinRequests")
      .limit(20);
    const userId = req.user.id;
    const availableGroups = groups.filter(
      (g) => !g.participants.some((p) => p.user._id.toString() === userId)
    );
    res.status(200).json({
      success: true,
      groups: availableGroups,
    });
  } catch (error) {
    console.error(`❌ searchPublicGroups error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST TO JOIN PUBLIC GROUP (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const requestJoinGroup = async (req, res) => {
  console.log(`🔵 requestJoinGroup called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (chat.scope !== "public" || chat.type !== "group" || !chat.isPublic) {
      return res.status(400).json({ message: "Not a public group." });
    }
    if (chat.participants.some((p) => p.user.toString() === userId)) {
      return res.status(400).json({ message: "You are already a member." });
    }
    const existingRequest = chat.joinRequests.find(
      (r) => r.user.toString() === userId && r.status === "pending",
    );
    if (existingRequest) {
      return res.status(400).json({ message: "Join request already sent." });
    }
    chat.joinRequests.push({
      user: userId,
      status: "pending",
      requestedAt: new Date(),
    });
    await chat.save();
    const adminIds = chat.participants
      .filter((p) => p.role === "admin")
      .map((p) => p.user.toString());
    if (adminIds.length > 0) {
      notifyUsers(adminIds, {
        title: `New join request for "${chat.name}"`,
        body: `${req.user.name} requested to join your group.`,
        data: buildChatNotificationData(chat),
      });
    }
    res.status(200).json({
      success: true,
      message: "Join request sent.",
    });
  } catch (error) {
    console.error(`❌ requestJoinGroup error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HANDLE JOIN REQUEST (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const handleJoinRequest = async (req, res) => {
  console.log(`🔵 handleJoinRequest called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId, requestId } = req.params;
    const { action } = req.body;
    if (!action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: "Invalid action." });
    }
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found." });
    }
    const isAdmin = await isChatAdmin(chatId, userId);
    if (!isAdmin) {
      return res.status(403).json({ message: "Only admins can handle join requests." });
    }
    const requestIndex = chat.joinRequests.findIndex(
      (r) => r._id.toString() === requestId && r.status === "pending",
    );
    if (requestIndex === -1) {
      return res.status(404).json({ message: "Join request not found or already handled." });
    }
    const request = chat.joinRequests[requestIndex];
    if (action === 'accept') {
      chat.participants.push({
        user: request.user,
        role: "member",
        joinedAt: new Date(),
        online: false,
        lastSeen: new Date(),
      });
      request.status = "accepted";
      await chat.save();
      const systemMessage = await Message.create({
        workspace: chat.workspace,
        chat: chat._id,
        sender: null,
        content: `${req.user.name || 'Someone'} joined the channel`,
        messageType: 'system',
        readBy: [],
        archivedBy: [],
        starredBy: [],
      });
      chat.lastMessage = systemMessage._id;
      chat.lastMessageAt = new Date();
      await chat.save();
      const populatedSystem = await Message.findById(systemMessage._id)
        .populate('sender', 'name email profile username')
        .populate('mentions', 'name email profile username')
        .populate('replyTo');
      const io = getIO();
      if (io) {
        io.to(`chat:${chat._id}`).emit('new-message', populatedSystem);
      }
      notifyUsers([request.user.toString()], {
        title: `Accepted into "${chat.name}"`,
        body: `Your request to join "${chat.name}" has been accepted.`,
        data: buildChatNotificationData(chat),
      });
    } else {
      request.status = "rejected";
      await chat.save();
      notifyUsers([request.user.toString()], {
        title: `Join request rejected for "${chat.name}"`,
        body: `Your request to join "${chat.name}" was rejected.`,
        data: { notificationType: 'system' },
      });
    }
    res.status(200).json({
      success: true,
      message: `Join request ${action}ed.`,
    });
  } catch (error) {
    console.error(`❌ handleJoinRequest error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET JOIN REQUESTS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const getJoinRequests = async (req, res) => {
  console.log(`🔵 getJoinRequests called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId)
      .populate("joinRequests.user", "name email profile username");
    if (!chat) {
      return res.status(404).json({ message: "Group not found." });
    }
    const isAdmin = await isChatAdmin(chatId, userId);
    if (!isAdmin) {
      return res.status(403).json({ message: "Only admins can view join requests." });
    }
    const pendingRequests = chat.joinRequests.filter((r) => r.status === "pending");
    res.status(200).json({
      success: true,
      requests: pendingRequests,
    });
  } catch (error) {
    console.error(`❌ getJoinRequests error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET USER CHATS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const getUserChats = async (req, res) => {
  console.log(`🔵 getUserChats called for user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { workspaceId, archived } = req.query;
    const query = {
      participants: { $elemMatch: { user: userId } },
    };
    if (workspaceId) {
      query.workspace = workspaceId;
    } else {
      query.$or = [{ workspace: { $ne: null } }, { scope: "public" }];
    }
    if (archived === 'true') {
      query['archivedBy'] = { $in: [userId] };
    } else {
      query['archivedBy'] = { $not: { $in: [userId] } };
    }
    const chats = await Chat.find(query)
      .populate("participants.user", "name email profile username")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name email profile username" }
      })
      .populate("createdBy", "name email profile username")
      .sort({ lastMessageAt: -1 });
    if (chats.length === 0) {
      return res.status(200).json({ success: true, chats: [] });
    }
    const chatIds = chats.map((c) => c._id);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const unreadAgg = await Message.aggregate([
      {
        $match: {
          chat: { $in: chatIds },
          sender: { $ne: userObjectId },
          isDeleted: false,
          "readBy.user": { $ne: userObjectId },
        },
      },
      { $group: { _id: "$chat", count: { $sum: 1 } } },
    ]);
    const unreadMap = {};
    unreadAgg.forEach((u) => {
      unreadMap[u._id.toString()] = u.count;
    });
    const chatsWithUnread = chats.map((chat) => {
      const chatObj = chat.toObject();
      chatObj.participants = chatObj.participants.map((p) => ({
        ...p,
        online: p.online || false,
        lastSeen: p.lastSeen || null,
      }));
      return {
        ...chatObj,
        unreadCount: unreadMap[chat._id.toString()] || 0,
      };
    });
    res.status(200).json({
      success: true,
      chats: chatsWithUnread,
    });
  } catch (error) {
    console.error(`❌ getUserChats error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET CHAT MESSAGES (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const getChatMessages = async (req, res) => {
  console.log(`🔵 getChatMessages called for user ${req.user.id}, chat ${req.params.chatId}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const isParticipant = await isChatParticipant(chatId, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "Access denied." });
    }
    const messages = await Message.find({
      chat: chatId,
      isDeleted: false,
      archivedBy: { $ne: userId }
    })
      .populate("sender", "name email profile username")
      .populate("mentions", "name email profile username")
      .populate({
        path: "replyTo",
        populate: { path: "sender", select: "name email profile username" },
      })
      .populate("sticker", "fileUrl thumbnailUrl type")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
      },
      {
        $push: {
          readBy: {
            user: userId,
            readAt: new Date(),
          },
        },
      },
    );
    await Chat.updateOne(
      { _id: chatId, "participants.user": userId },
      { $set: { "participants.$.lastReadAt": new Date() } },
    );
    res.status(200).json({
      success: true,
      messages: messages.reverse(),
      count: messages.length,
    });
  } catch (error) {
    console.error(`❌ getChatMessages error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND MESSAGE (archive-aware notifications + reference tags)
// ─────────────────────────────────────────────────────────────────────────────

export const sendMessage = async (req, res) => {
  console.log("🔥🔥🔥 sendMessage called! 🔥🔥🔥");
  console.log(`👤 User ID: ${req.user.id}`);
  console.log(`📨 Chat ID: ${req.params.chatId}`);
  console.log(`📦 Body:`, req.body);
  console.log(`📎 File:`, req.file ? req.file.originalname : 'none');

  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const {
      content,
      messageType = "text",
      mentions = [],
      replyToId,
      clientMsgId,
      stickerId,
      references: rawReferences = [],   // 👈 NEW
    } = req.body;

    const isParticipant = await isChatParticipant(chatId, userId);
    if (!isParticipant) {
      console.log(`❌ User ${userId} is not a participant`);
      return res.status(403).json({ message: "You are not a participant in this chat." });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      console.log(`❌ Chat ${chatId} not found`);
      return res.status(404).json({ message: "Chat not found." });
    }

    // ─── Sticker handling ──────────────────────────────────────────────
    let stickerRef = null;
    if (messageType === 'sticker') {
      if (!stickerId) {
        return res.status(400).json({ message: "stickerId is required for sticker messages." });
      }
      const sticker = await Sticker.findOne({ _id: stickerId, isDeleted: false });
      if (!sticker) {
        return res.status(404).json({ message: "Sticker not found or deleted." });
      }
      stickerRef = sticker._id;
      if (req.file) {
        console.warn("⚠️ File upload ignored because messageType is 'sticker'.");
      }
    }

    // ─── Media handling (only if not sticker) ─────────────────────────
    let mediaUrl = null;
    let mediaName = null;
    let mediaSize = null;
    let mediaDuration = null;
    let finalMessageType = messageType;

    if (req.file && messageType !== 'sticker') {
      console.log(`📎 File uploaded: ${req.file.originalname}, type: ${req.file.mimetype}`);
      mediaUrl = req.file.path;
      mediaName = req.file.originalname;
      mediaSize = req.file.size;
      mediaDuration = req.body.mediaDuration ? parseInt(req.body.mediaDuration) : null;

      if (req.file.mimetype.startsWith("audio/")) finalMessageType = "audio";
      else if (req.file.mimetype.startsWith("image/")) finalMessageType = "image";
      else if (req.file.mimetype.startsWith("video/")) finalMessageType = "video";
      else finalMessageType = "file";
    } else if (messageType !== 'sticker') {
      console.log(`📝 No file, using messageType: ${messageType}`);
    }

    // ─── Mentions validation ──────────────────────────────────────────
    console.log(`🔍 Validating mentions: ${mentions}`);
    const validMentions = await Promise.all(
      mentions.map(async (mentionId) => {
        const isValid = chat.participants.some((p) => p.user.toString() === mentionId);
        return isValid ? mentionId : null;
      })
    );
    const filteredMentions = validMentions.filter((m) => m !== null);
    console.log(`✅ Valid mentions: ${filteredMentions}`);

    // ─── References validation (task / project / note / clockin) ─────
    const sanitizedReferences = await sanitizeReferences(
      rawReferences,
      chat.workspace,
      userId
    );
    console.log(`🔗 Valid references: ${sanitizedReferences.length}`);

    console.log(`📝 Creating message...`);
    const message = await Message.create({
      workspace: chat.workspace,
      chat: chatId,
      sender: userId,
      content: content?.trim() || "",
      messageType: finalMessageType,
      mediaUrl,
      mediaName,
      mediaSize,
      mediaDuration,
      mentions: filteredMentions,
      references: sanitizedReferences,   // 👈 NEW
      replyTo: replyToId || null,
      sticker: stickerRef,
      readBy: [{ user: userId, readAt: new Date() }],
      archivedBy: [],
      starredBy: [],
    });
    console.log(`✅ Message created with ID: ${message._id}`);

    chat.lastMessage = message._id;
    chat.lastMessageAt = new Date();
    await chat.save();
    console.log(`✅ Chat updated with last message`);

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name email profile username")
      .populate("mentions", "name email profile username")
      .populate({
        path: "replyTo",
        populate: { path: "sender", select: "name email profile username" },
      })
      .populate("sticker", "fileUrl thumbnailUrl type");

    const responseMessage = populatedMessage.toObject
      ? populatedMessage.toObject()
      : populatedMessage;
    responseMessage.clientMsgId = clientMsgId || null;

    await TypingIndicator.deleteOne({ chat: chatId, user: userId });
    console.log(`✅ Typing indicator cleared`);

    const io = getIO();
    if (io) {
      io.to(`chat:${chatId}`).emit("new-message", responseMessage);
      console.log(`📡 Socket event emitted to chat:${chatId}`);
    } else {
      console.log(`⚠️ Socket.io not available`);
    }

    // ─────────────────────────────────────────────────────────────────
    // NOTIFICATION LOGIC (archive-aware)
    // ─────────────────────────────────────────────────────────────────
    const senderName = req.user.name || 'Someone';
    const isGroup = chat.type === 'group';

    // Users who archived this chat — they should NOT get the generic "new message" push
    const archivedUserIds = (chat.archivedBy || []).map(id => id.toString());

    // All participants except the sender
    const allParticipantIds = chat.participants
      .map(p => p.user.toString())
      .filter(id => id !== userId);

    // Resolve reply target (if any)
    let repliedToUserId = null;
    if (replyToId) {
      const replyToMessage = await Message.findById(replyToId);
      if (replyToMessage && replyToMessage.sender && replyToMessage.sender.toString() !== userId) {
        repliedToUserId = replyToMessage.sender.toString();
      }
    }

    // ─── Build message preview ────────────────────────────────────────
    let preview = content?.substring(0, 100) || '';
    if (finalMessageType === 'image') preview = '📷 Image';
    else if (finalMessageType === 'video') preview = '🎬 Video';
    else if (finalMessageType === 'audio') preview = '🎵 Audio';
    else if (finalMessageType === 'file') preview = `📎 ${mediaName || 'File'}`;
    else if (finalMessageType === 'sticker') preview = '📌 Sticker';
    if (!preview) preview = 'Sent a message';
    console.log(`📄 Preview: "${preview}"`);

    let chatName = chat.name || 'Chat';
    if (chat.type === 'direct') {
      const otherUser = chat.participants.find(p => p.user.toString() !== userId);
      chatName = otherUser && otherUser.user ? otherUser.user.name : 'Direct Chat';
    }

    // ─── 1) GENERIC "NEW MESSAGE" NOTIFICATION ────────────────────────
    const mentionRecipients = filteredMentions.filter((id) => {
      if (isGroup) return true;
      return !archivedUserIds.includes(id);
    });

    const replyRecipients = [];
    if (repliedToUserId) {
      const replyArchived = archivedUserIds.includes(repliedToUserId);
      const canNotifyReply = isGroup || !replyArchived;
      const alreadyCovered =
        mentionRecipients.includes(repliedToUserId) ||
        (!replyArchived);
      if (canNotifyReply && !alreadyCovered) {
        replyRecipients.push(repliedToUserId);
      }
    }

    const generalRecipients = allParticipantIds.filter((id) => {
      if (archivedUserIds.includes(id)) return false;
      if (mentionRecipients.includes(id)) return false;
      if (replyRecipients.includes(id)) return false;
      return true;
    });

    if (generalRecipients.length > 0) {
      console.log(`📤 Sending NEW MESSAGE notifications to ${generalRecipients.length} participants`);
      notifyUsers(generalRecipients, {
        title: `${isGroup ? `📢 ${chatName}` : `💬 ${senderName}`}`,
        body: preview,
        data: buildChatNotificationData(chat, { messageId: message._id.toString() }),
      });
    } else {
      console.log(`🔇 No generic recipients (all archived / mentioned / replied)`);
    }

    // ─── 2) MENTION NOTIFICATIONS ─────────────────────────────────────
    if (mentionRecipients.length > 0) {
      console.log(`📤 Sending MENTION notifications to ${mentionRecipients.length} users`);
      notifyUsers(mentionRecipients, {
        title: `${senderName} mentioned you in ${isGroup ? chatName : 'a chat'}`,
        body: `${senderName}: ${content?.substring(0, 100) || 'sent a message'}`,
        data: buildChatNotificationData(chat, { messageId: message._id.toString() }),
      });
    }

    // ─── 3) REPLY NOTIFICATIONS ───────────────────────────────────────
    if (replyRecipients.length > 0) {
      console.log(`📤 Sending REPLY notifications to ${replyRecipients.length} users`);
      notifyUsers(replyRecipients, {
        title: `${senderName} replied to your message`,
        body: `${senderName}: ${content?.substring(0, 100) || 'sent a reply'}`,
        data: buildChatNotificationData(chat, { messageId: message._id.toString() }),
      });
    }

    console.log(`✅ sendMessage completed successfully`);
    res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error("❌ Send message error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE MESSAGE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const deleteMessage = async (req, res) => {
  console.log(`🔵 deleteMessage called for message ${req.params.messageId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }
    const chat = await Chat.findById(message.chat);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    const isAdmin = await isChatAdmin(message.chat, userId);
    const isSender = message.sender.toString() === userId;
    if (!isAdmin && !isSender) {
      return res
        .status(403)
        .json({
          message: "Only admins or the message sender can delete messages.",
        });
    }
    message.isDeleted = true;
    message.deletedBy = userId;
    message.deletedAt = new Date();
    await message.save();
    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error(`❌ deleteMessage error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPING INDICATORS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const startTyping = async (req, res) => {
  console.log(`🔵 startTyping called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const isParticipant = await isChatParticipant(chatId, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "Access denied." });
    }
    await TypingIndicator.findOneAndUpdate(
      { chat: chatId, user: userId },
      { startedAt: new Date() },
      { upsert: true },
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`❌ startTyping error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const stopTyping = async (req, res) => {
  console.log(`🔵 stopTyping called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    await TypingIndicator.deleteOne({ chat: chatId, user: userId });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`❌ stopTyping error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTypingUsers = async (req, res) => {
  console.log(`🔵 getTypingUsers called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const isParticipant = await isChatParticipant(chatId, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "Access denied." });
    }
    const typing = await TypingIndicator.find({ chat: chatId })
      .populate("user", "name email profile username")
      .where("user")
      .ne(userId);
    res.status(200).json({
      success: true,
      typing: typing.map((t) => t.user),
    });
  } catch (error) {
    console.error(`❌ getTypingUsers error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH USERS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const searchUsers = async (req, res) => {
  console.log(`🔵 searchUsers called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { workspaceId, query, scope } = req.query;
    if (scope === 'public') {
      if (!query || query.trim().length < 2) {
        return res.status(200).json({ success: true, users: [] });
      }
      const trimmedQuery = query.trim();
      const users = await User.find({
        $or: [
          { username: trimmedQuery },
          { username: { $regex: trimmedQuery, $options: 'i' } },
          { name: { $regex: trimmedQuery, $options: 'i' } },
        ],
        _id: { $ne: userId },
      })
        .select('name email profile username')
        .limit(20);
      return res.status(200).json({ success: true, users });
    }
    if (!workspaceId) {
      return res.status(400).json({ message: 'Workspace ID is required for workspace search.' });
    }
    const workspace = await Workspace.findById(workspaceId).populate(
      'members.user',
      'name email profile username',
    );
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found.' });
    }
    let members = workspace.members
      .filter((m) => m.status === 'active' && m.user._id.toString() !== userId)
      .map((m) => m.user);
    if (query) {
      const q = query.toLowerCase().trim();
      members = members.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.username && m.username.toLowerCase().includes(q)),
      );
    }
    res.status(200).json({
      success: true,
      users: members,
    });
  } catch (error) {
    console.error('❌ searchUsers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD PARTICIPANT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const addParticipant = async (req, res) => {
  console.log(`🔵 addParticipant called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { userIds } = req.body;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    if (chat.type !== "group") {
      return res
        .status(400)
        .json({ message: "Only group chats can have participants added." });
    }
    const isAdmin = await isChatAdmin(chatId, userId);
    if (!isAdmin) {
      return res
        .status(403)
        .json({ message: "Only admins can add participants." });
    }
    let workspace = null;
    if (chat.scope === 'workspace' && chat.workspace) {
      workspace = await Workspace.findById(chat.workspace);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found." });
      }
    }
    const existingUserIds = chat.participants.map((p) => p.user.toString());
    const addedUsers = [];
    for (const newUserId of userIds) {
      if (!existingUserIds.includes(newUserId)) {
        if (workspace) {
          const isActiveMember = workspace.members.some(
            (m) => m.user.toString() === newUserId && m.status === "active",
          );
          if (!isActiveMember) continue;
        }
        chat.participants.push({
          user: newUserId,
          role: "member",
          joinedAt: new Date(),
          online: false,
          lastSeen: new Date(),
        });
        addedUsers.push(newUserId);
      }
    }
    if (addedUsers.length === 0) {
      return res.status(400).json({ message: "No valid users to add." });
    }
    await chat.save();
    notifyUsers(addedUsers, {
      title: `Added to group "${chat.name}"`,
      body: `You have been added to the group chat "${chat.name}".`,
      data: buildChatNotificationData(chat),
    });
    const populatedChat = await Chat.findById(chatId).populate(
      "participants.user",
      "name email profile username",
    );
    res.status(200).json({
      success: true,
      message: "Participants added successfully",
      chat: populatedChat,
    });
  } catch (error) {
    console.error(`❌ addParticipant error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE PARTICIPANT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const removeParticipant = async (req, res) => {
  console.log(`🔵 removeParticipant called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId, userId: targetUserId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    if (chat.type !== "group") {
      return res
        .status(400)
        .json({ message: "Only group chats can have participants removed." });
    }
    const isAdmin = await isChatAdmin(chatId, userId);
    if (!isAdmin) {
      return res
        .status(403)
        .json({ message: "Only admins can remove participants." });
    }
    const creatorId = chat.createdBy?.toString();
    if (creatorId === targetUserId) {
      return res
        .status(403)
        .json({ message: "Cannot remove the group creator." });
    }
    if (chat.scope === 'workspace' && chat.workspace) {
      const workspace = await Workspace.findById(chat.workspace);
      if (workspace && workspace.owner.toString() === targetUserId) {
        return res
          .status(403)
          .json({ message: "Cannot remove the workspace owner." });
      }
    }
    chat.participants = chat.participants.filter(
      (p) => p.user.toString() !== targetUserId,
    );
    await chat.save();
    notifyUsers([targetUserId], {
      title: `Removed from group "${chat.name}"`,
      body: `You have been removed from the group chat "${chat.name}".`,
      data: { notificationType: 'system' },
    });
    res.status(200).json({
      success: true,
      message: "Participant removed successfully",
    });
  } catch (error) {
    console.error(`❌ removeParticipant error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MAKE GROUP ADMIN (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const makeGroupAdmin = async (req, res) => {
  console.log(`🔵 makeGroupAdmin called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { userId: targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ message: "Target user ID is required." });
    }
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    if (chat.type !== "group") {
      return res.status(400).json({ message: "Only group chats support admins." });
    }
    const isAdmin = await isChatAdmin(chatId, userId);
    if (!isAdmin) {
      return res.status(403).json({ message: "Only admins can promote users." });
    }
    const participant = chat.participants.find(
      (p) => p.user.toString() === targetUserId,
    );
    if (!participant) {
      return res.status(404).json({ message: "User is not a participant." });
    }
    if (participant.role === "admin") {
      return res.status(400).json({ message: "User is already an admin." });
    }
    participant.role = "admin";
    await chat.save();
    notifyUsers([targetUserId], {
      title: `You are now an admin of "${chat.name}"`,
      body: `You have been promoted to admin in the group chat "${chat.name}".`,
      data: buildChatNotificationData(chat),
    });
    res.status(200).json({
      success: true,
      message: "User promoted to admin.",
      chat: await Chat.findById(chatId).populate("participants.user", "name email profile username"),
    });
  } catch (error) {
    console.error(`❌ makeGroupAdmin error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE GROUP ADMIN (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const removeGroupAdmin = async (req, res) => {
  console.log(`🔵 removeGroupAdmin called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { userId: targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ message: "Target user ID is required." });
    }
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    if (chat.type !== "group") {
      return res.status(400).json({ message: "Only group chats support admin roles." });
    }
    const isAdmin = await isChatAdmin(chatId, userId);
    if (!isAdmin) {
      return res.status(403).json({ message: "Only admins can demote users." });
    }
    const creatorId = chat.createdBy?.toString();
    if (creatorId === targetUserId) {
      return res.status(403).json({ message: "Cannot demote the group creator." });
    }
    if (chat.scope === 'workspace' && chat.workspace) {
      const workspace = await Workspace.findById(chat.workspace);
      if (workspace && workspace.owner.toString() === targetUserId) {
        return res.status(403).json({ message: "Cannot demote the workspace owner." });
      }
    }
    const participant = chat.participants.find(
      (p) => p.user.toString() === targetUserId,
    );
    if (!participant) {
      return res.status(404).json({ message: "User is not a participant." });
    }
    if (participant.role !== "admin") {
      return res.status(400).json({ message: "User is not an admin." });
    }
    participant.role = "member";
    await chat.save();
    notifyUsers([targetUserId], {
      title: `Admin rights removed for "${chat.name}"`,
      body: `You are no longer an admin of the group chat "${chat.name}".`,
      data: buildChatNotificationData(chat),
    });
    res.status(200).json({
      success: true,
      message: "Admin rights removed.",
      chat: await Chat.findById(chatId).populate("participants.user", "name email profile username"),
    });
  } catch (error) {
    console.error(`❌ removeGroupAdmin error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE GROUP CHAT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const deleteGroupChat = async (req, res) => {
  console.log(`🔵 deleteGroupChat called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    if (chat.type !== "group") {
      return res.status(400).json({ message: "Only group chats can be deleted." });
    }
    const isCreator = chat.createdBy?.toString() === userId;
    let canDelete = false;
    if (chat.scope === 'workspace' && chat.workspace) {
      const workspace = await Workspace.findById(chat.workspace);
      if (workspace) {
        const isOwner = workspace.owner.toString() === userId;
        const isAdmin = workspace.members.some(
          (m) => m.user.toString() === userId && m.role === 'Admin' && m.status === 'active'
        );
        if (isOwner || isAdmin) canDelete = true;
      }
    }
    if (!isCreator && !canDelete) {
      return res.status(403).json({
        message: "Only the creator, workspace owner, or workspace admin can delete the group chat."
      });
    }
    await Message.deleteMany({ chat: chatId });
    await Chat.findByIdAndDelete(chatId);
    const participantIds = chat.participants.map(p => p.user.toString());
    notifyUsers(participantIds, {
      title: `Group "${chat.name}" has been deleted`,
      body: `The group chat "${chat.name}" has been permanently deleted.`,
      data: { notificationType: 'system' },
    });
    res.status(200).json({
      success: true,
      message: "Group chat and all messages deleted successfully.",
    });
  } catch (error) {
    console.error(`❌ deleteGroupChat error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET GROUP MEMBERS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const getGroupMembers = async (req, res) => {
  console.log(`🔵 getGroupMembers called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId)
      .populate("participants.user", "name email profile username");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    const isParticipant = await isChatParticipant(chatId, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a member of this chat." });
    }
    const members = chat.participants.map(p => ({
      user: p.user,
      role: p.role,
      joinedAt: p.joinedAt,
      online: p.online,
      lastSeen: p.lastSeen,
    }));
    res.status(200).json({
      success: true,
      members,
    });
  } catch (error) {
    console.error(`❌ getGroupMembers error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE CHAT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const archiveChat = async (req, res) => {
  console.log(`🔵 archiveChat called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    const isParticipant = await isChatParticipant(chatId, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a participant." });
    }
    if (!(chat.archivedBy || []).some(id => id.toString() === userId)) {
      chat.archivedBy = chat.archivedBy || [];
      chat.archivedBy.push(userId);
      await chat.save();
    }
    res.status(200).json({
      success: true,
      message: "Chat archived.",
    });
  } catch (error) {
    console.error(`❌ archiveChat error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UNARCHIVE CHAT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const unarchiveChat = async (req, res) => {
  console.log(`🔵 unarchiveChat called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    const isParticipant = await isChatParticipant(chatId, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a participant." });
    }
    chat.archivedBy = (chat.archivedBy || []).filter(id => id.toString() !== userId);
    await chat.save();
    res.status(200).json({
      success: true,
      message: "Chat unarchived.",
    });
  } catch (error) {
    console.error(`❌ unarchiveChat error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXIT GROUP CHAT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const exitGroupChat = async (req, res) => {
  console.log(`🔵 exitGroupChat called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    if (chat.type !== "group") {
      return res.status(400).json({ message: "Only group chats can be exited." });
    }
    const participantIndex = chat.participants.findIndex(
      (p) => p.user.toString() === userId,
    );
    if (participantIndex === -1) {
      return res.status(400).json({ message: "You are not a member of this group." });
    }
    chat.participants.splice(participantIndex, 1);
    await chat.save();
    chat.archivedBy = (chat.archivedBy || []).filter(id => id.toString() !== userId);
    await chat.save();
    const otherParticipantIds = chat.participants.map(p => p.user.toString());
    notifyUsers(otherParticipantIds, {
      title: `${req.user.name} left the group`,
      body: `${req.user.name} has left the group chat "${chat.name}".`,
      data: buildChatNotificationData(chat),
    });
    res.status(200).json({
      success: true,
      message: "You have left the group.",
    });
  } catch (error) {
    console.error(`❌ exitGroupChat error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK CHAT AS READ (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const markChatAsRead = async (req, res) => {
  console.log(`🔵 markChatAsRead called for chat ${req.params.chatId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const isParticipant = await isChatParticipant(chatId, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "Access denied." });
    }
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
      },
      {
        $push: {
          readBy: {
            user: userId,
            readAt: new Date(),
          },
        },
      },
    );
    await Chat.updateOne(
      { _id: chatId, "participants.user": userId },
      { $set: { "participants.$.lastReadAt": new Date() } },
    );
    res.status(200).json({
      success: true,
      message: "Chat marked as read",
    });
  } catch (error) {
    console.error(`❌ markChatAsRead error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE MESSAGE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const archiveMessage = async (req, res) => {
  console.log(`🔵 archiveMessage called for message ${req.params.messageId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }
    const isParticipant = await isChatParticipant(message.chat, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a participant in this chat." });
    }
    if (!(message.archivedBy || []).some(id => id.toString() === userId)) {
      message.archivedBy = message.archivedBy || [];
      message.archivedBy.push(userId);
      await message.save();
    }
    res.status(200).json({
      success: true,
      message: "Message archived.",
    });
  } catch (error) {
    console.error(`❌ archiveMessage error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UNARCHIVE MESSAGE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const unarchiveMessage = async (req, res) => {
  console.log(`🔵 unarchiveMessage called for message ${req.params.messageId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }
    const isParticipant = await isChatParticipant(message.chat, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a participant in this chat." });
    }
    message.archivedBy = (message.archivedBy || []).filter(id => id.toString() !== userId);
    await message.save();
    res.status(200).json({
      success: true,
      message: "Message unarchived.",
    });
  } catch (error) {
    console.error(`❌ unarchiveMessage error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STAR MESSAGE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const starMessage = async (req, res) => {
  console.log(`🔵 starMessage called for message ${req.params.messageId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }
    const isParticipant = await isChatParticipant(message.chat, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a participant in this chat." });
    }
    if (!(message.starredBy || []).some(id => id.toString() === userId)) {
      message.starredBy = message.starredBy || [];
      message.starredBy.push(userId);
      await message.save();
    }
    res.status(200).json({
      success: true,
      message: "Message starred.",
    });
  } catch (error) {
    console.error(`❌ starMessage error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UNSTAR MESSAGE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const unstarMessage = async (req, res) => {
  console.log(`🔵 unstarMessage called for message ${req.params.messageId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }
    const isParticipant = await isChatParticipant(message.chat, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a participant in this chat." });
    }
    message.starredBy = (message.starredBy || []).filter(id => id.toString() !== userId);
    await message.save();
    res.status(200).json({
      success: true,
      message: "Message unstarred.",
    });
  } catch (error) {
    console.error(`❌ unstarMessage error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET PENDING JOIN REQUESTS (unchanged) ──────────────────────────────────

export const getPendingJoinRequests = async (req, res) => {
  console.log(`🔵 getPendingJoinRequests called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const groups = await Chat.find({
      scope: 'public',
      type: 'group',
      isPublic: true,
      'joinRequests.user': userId,
      'joinRequests.status': 'pending',
    })
      .populate('participants.user', 'name email profile username')
      .populate('createdBy', 'name email profile username')
      .select('-joinRequests');
    res.status(200).json({ success: true, groups });
  } catch (error) {
    console.error('❌ getPendingJoinRequests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EDIT MESSAGE (unchanged)
// PUT /api/messages/:messageId
// ─────────────────────────────────────────────────────────────────────────────

export const updateMessage = async (req, res) => {
  console.log(`🔵 updateMessage called for message ${req.params.messageId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content cannot be empty." });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: "You can only edit your own messages." });
    }

    message.content = content.trim();
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    const updatedMessage = await Message.findById(messageId)
      .populate("sender", "name email profile username")
      .populate("mentions", "name email profile username")
      .populate({
        path: "replyTo",
        populate: { path: "sender", select: "name email profile username" },
      })
      .populate("sticker", "fileUrl thumbnailUrl type");

    const io = getIO();
    if (io) {
      io.to(`chat:${message.chat}`).emit("message-edited", updatedMessage);
    }

    res.status(200).json({
      success: true,
      message: updatedMessage,
    });
  } catch (error) {
    console.error(`❌ updateMessage error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE REACTION (unchanged)
// POST /api/messages/:messageId/reactions
// ─────────────────────────────────────────────────────────────────────────────

export const toggleReaction = async (req, res) => {
  console.log(`🔵 toggleReaction called for message ${req.params.messageId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string' || emoji.length === 0) {
      return res.status(400).json({ message: "Valid emoji is required." });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    const isParticipant = await isChatParticipant(message.chat, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not in this chat." });
    }

    if (!message.reactions) message.reactions = [];

    const existingIndex = message.reactions.findIndex(
      (r) => r.user.toString() === userId && r.emoji === emoji
    );

    const io = getIO();
    if (existingIndex !== -1) {
      message.reactions.splice(existingIndex, 1);
      await message.save();
      if (io) {
        io.to(`chat:${message.chat}`).emit("reaction-removed", {
          messageId: message._id,
          emoji,
          userId,
        });
      }
      return res.status(200).json({
        success: true,
        action: 'removed',
        message: "Reaction removed.",
      });
    } else {
      message.reactions.push({ user: userId, emoji });
      await message.save();
      if (io) {
        io.to(`chat:${message.chat}`).emit("reaction-added", {
          messageId: message._id,
          emoji,
          user: userId,
        });
      }
      return res.status(200).json({
        success: true,
        action: 'added',
        message: "Reaction added.",
      });
    }
  } catch (error) {
    console.error(`❌ toggleReaction error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET REACTIONS FOR A MESSAGE (unchanged)
// GET /api/messages/:messageId/reactions
// ─────────────────────────────────────────────────────────────────────────────

export const getMessageReactions = async (req, res) => {
  console.log(`🔵 getMessageReactions called for message ${req.params.messageId} by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId)
      .populate('reactions.user', 'name email profile username');
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    const isParticipant = await isChatParticipant(message.chat, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not in this chat." });
    }

    res.status(200).json({
      success: true,
      reactions: message.reactions || [],
    });
  } catch (error) {
    console.error(`❌ getMessageReactions error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};