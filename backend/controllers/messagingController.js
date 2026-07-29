// controllers/messagingController.js

import mongoose from "mongoose";
import { Message, Chat, TypingIndicator } from "../models/messagingModel.js";
import Workspace from "../models/workspaceModel.js";
import User from "../models/userModel.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { createAndSendNotification } from './notificationController.js';
import { getIO } from './socket.js';

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────

const isWorkspaceMember = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);
  return workspace?.members.some(
    (m) => m.user.toString() === userId && m.status === "active",
  );
};

const isChatParticipant = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  return chat?.participants.some((p) => p.user.toString() === userId);
};

/**
 * Check if user is admin of a chat.
 * For workspace groups: workspace owner is always admin.
 * For public groups: creator is admin, and admins can be added.
 */
const isChatAdmin = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  if (!chat) return false;
  // If it's a workspace chat, workspace owner is admin
  if (chat.scope === 'workspace') {
    const workspace = await Workspace.findById(chat.workspace);
    if (workspace && workspace.owner.toString() === userId) return true;
  }
  // Check participant role
  const participant = chat.participants.find(
    (p) => p.user.toString() === userId,
  );
  return participant?.role === "admin";
};

/**
 * Get the creator/owner of a chat (user who created it).
 */
const getChatCreator = async (chatId) => {
  const chat = await Chat.findById(chatId);
  return chat?.createdBy?.toString();
};

/**
 * Check if user is the creator of the chat.
 */
const isChatCreator = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  return chat?.createdBy?.toString() === userId;
};

/**
 * Send push + in‑app notification to multiple users (with full logging).
 */
const notifyUsers = async (userIds, title, body, data = {}) => {
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
// UPDATE ONLINE STATUS
// POST /api/messages/online-status
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
// CREATE GROUP CHAT (Workspace – Owner only)
// POST /api/messages/group
// ─────────────────────────────────────────────────────────────────────────────

export const createGroupChat = async (req, res) => {
  console.log(`🔵 createGroupChat called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { workspaceId, name, avatar } = req.body;

    if (!workspaceId || !name?.trim()) {
      return res
        .status(400)
        .json({ message: "Workspace ID and group name are required." });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found." });
    }

    if (workspace.owner.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Only the workspace owner can create group chats." });
    }

    const activeMembers = workspace.members
      .filter((m) => m.status === "active")
      .map((m) => ({
        user: m.user,
        role: m.user.toString() === userId ? "admin" : "member",
        joinedAt: new Date(),
        online: false,
        lastSeen: new Date(),
      }));

    const chat = await Chat.create({
      workspace: workspaceId,
      type: "group",
      scope: "workspace",
      name: name.trim(),
      avatar: avatar || null,
      participants: activeMembers,
      createdBy: userId,
      lastMessageAt: new Date(),
      isPublic: false, // workspace groups are private by default
      joinRequests: [],
    });

    const populatedChat = await Chat.findById(chat._id)
      .populate("participants.user", "name email profile")
      .populate("createdBy", "name email profile");

    // Notify all members (except creator)
    const memberIds = activeMembers
      .filter(m => m.user.toString() !== userId)
      .map(m => m.user.toString());
    if (memberIds.length > 0) {
      console.log(`📢 Notifying ${memberIds.length} members about new group chat`);
      notifyUsers(memberIds, {
        title: `New group chat "${chat.name}"`,
        body: `You were added to the group "${chat.name}" by the workspace owner.`,
        data: { chatId: chat._id.toString(), workspaceId },
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
// CREATE DIRECT CHAT (Workspace)
// POST /api/messages/direct
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
        "name email profile",
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
      "name email profile",
    );

    // Notify target user
    console.log(`📢 Notifying target user ${targetUserId} about new direct chat`);
    notifyUsers([targetUserId], {
      title: `New message from ${req.user.name || 'a colleague'}`,
      body: `${req.user.name || 'Someone'} started a direct chat with you.`,
      data: { chatId: chat._id.toString(), workspaceId },
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
// CREATE PUBLIC DIRECT CHAT (Outside workspace, by username)
// POST /api/messages/public/direct
// ─────────────────────────────────────────────────────────────────────────────

export const createPublicDirectChat = async (req, res) => {
  console.log(`🔵 createPublicDirectChat called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { username } = req.body;

    if (!username?.trim()) {
      return res.status(400).json({ message: "Username is required." });
    }

    const targetUser = await User.findOne({ username: username.trim() });
    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }

    if (targetUser._id.toString() === userId) {
      return res.status(400).json({ message: "Cannot chat with yourself." });
    }

    // Check if direct chat already exists between these two users (public scope)
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
        "name email profile",
      );
      return res.status(200).json({
        success: true,
        message: "Chat already exists",
        chat: populatedChat,
      });
    }

    const chat = await Chat.create({
      workspace: null, // no workspace
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
      "name email profile",
    );

    // Notify target user
    notifyUsers([targetUser._id.toString()], {
      title: `${req.user.name || 'Someone'} started a chat with you`,
      body: `You have a new direct message from ${req.user.name || 'someone'}.`,
      data: { chatId: chat._id.toString() },
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
// CREATE PUBLIC GROUP CHAT (Outside workspace)
// POST /api/messages/public/group
// ─────────────────────────────────────────────────────────────────────────────

export const createPublicGroupChat = async (req, res) => {
  console.log(`🔵 createPublicGroupChat called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { name, description, avatar, isPublic = true } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Group name is required." });
    }

    // Check if group name already exists (public scope)
    const existing = await Chat.findOne({
      scope: "public",
      type: "group",
      name: name.trim(),
    });
    if (existing) {
      return res.status(400).json({ message: "Group name already taken." });
    }

    const chat = await Chat.create({
      workspace: null,
      type: "group",
      scope: "public",
      name: name.trim(),
      description: description?.trim() || "",
      avatar: avatar || null,
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
      isPublic: true,
      joinRequests: [],
    });

    const populatedChat = await Chat.findById(chat._id)
      .populate("participants.user", "name email profile")
      .populate("createdBy", "name email profile");

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
// SEARCH PUBLIC GROUPS
// GET /api/messages/public/groups/search
// ─────────────────────────────────────────────────────────────────────────────

export const searchPublicGroups = async (req, res) => {
  console.log(`🔵 searchPublicGroups called by user ${req.user.id}`);
  try {
    const { query } = req.query;
    const filter = {
      scope: "public",
      type: "group",
      isPublic: true,
      // Exclude groups where user is already a participant
    };
    if (query) {
      filter.name = { $regex: query, $options: "i" };
    }
    const groups = await Chat.find(filter)
      .populate("participants.user", "name email profile")
      .populate("createdBy", "name email profile")
      .select("-joinRequests") // exclude join requests for privacy
      .limit(20);

    // Filter groups where user is not a participant
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
// REQUEST TO JOIN PUBLIC GROUP
// POST /api/messages/public/groups/:chatId/join-request
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

    // Check if already a member
    if (chat.participants.some((p) => p.user.toString() === userId)) {
      return res.status(400).json({ message: "You are already a member." });
    }

    // Check if request already pending
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

    // Notify admins of the group
    const adminIds = chat.participants
      .filter((p) => p.role === "admin")
      .map((p) => p.user.toString());
    if (adminIds.length > 0) {
      notifyUsers(adminIds, {
        title: `New join request for "${chat.name}"`,
        body: `${req.user.name} requested to join your group.`,
        data: { chatId: chat._id.toString() },
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
// ACCEPT OR REJECT JOIN REQUEST (Admin only)
// POST /api/messages/public/groups/:chatId/join-request/:requestId
// ─────────────────────────────────────────────────────────────────────────────

export const handleJoinRequest = async (req, res) => {
  console.log(`🔵 handleJoinRequest called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId, requestId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

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

    // Find the request
    const requestIndex = chat.joinRequests.findIndex(
      (r) => r._id.toString() === requestId && r.status === "pending",
    );
    if (requestIndex === -1) {
      return res.status(404).json({ message: "Join request not found or already handled." });
    }

    const request = chat.joinRequests[requestIndex];

    if (action === 'accept') {
      // Add user as member
      chat.participants.push({
        user: request.user,
        role: "member",
        joinedAt: new Date(),
        online: false,
        lastSeen: new Date(),
      });
      request.status = "accepted";
      await chat.save();

      // Notify the user
      notifyUsers([request.user.toString()], {
        title: `Accepted into "${chat.name}"`,
        body: `Your request to join "${chat.name}" has been accepted.`,
        data: { chatId: chat._id.toString() },
      });
    } else {
      // Reject
      request.status = "rejected";
      await chat.save();

      notifyUsers([request.user.toString()], {
        title: `Join request rejected for "${chat.name}"`,
        body: `Your request to join "${chat.name}" was rejected.`,
        data: { chatId: chat._id.toString() },
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
// GET JOIN REQUESTS FOR A GROUP (Admin only)
// GET /api/messages/public/groups/:chatId/join-requests
// ─────────────────────────────────────────────────────────────────────────────

export const getJoinRequests = async (req, res) => {
  console.log(`🔵 getJoinRequests called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId)
      .populate("joinRequests.user", "name email profile");
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
// GET USER CHATS (including public chats)
// GET /api/messages/chats
// ─────────────────────────────────────────────────────────────────────────────

export const getUserChats = async (req, res) => {
  console.log(`🔵 getUserChats called for user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { workspaceId, archived } = req.query; // add archived param

    // Build query
    const query = {
      participants: { $elemMatch: { user: userId } },
    };
    if (workspaceId) {
      query.workspace = workspaceId;
    } else {
      if (workspaceId === undefined) {
        query.$or = [
          { workspace: { $ne: null } },
          { scope: "public" }
        ];
      } else {
        query.workspace = workspaceId;
      }
    }

    // Filter archived: if archived=true, only return chats where user is in archivedBy; else exclude those
    if (archived === 'true') {
      query['archivedBy'] = { $in: [userId] };
    } else {
      query['archivedBy'] = { $not: { $in: [userId] } };
    }

    const chats = await Chat.find(query)
      .populate("participants.user", "name email profile")
      .populate("lastMessage")
      .populate("createdBy", "name email profile")
      .sort({ lastMessageAt: -1 });

    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chat: chat._id,
          readBy: { $not: { $elemMatch: { user: userId } } },
          sender: { $ne: userId },
        });

        const chatObj = chat.toObject();
        chatObj.participants = chatObj.participants.map((p) => ({
          ...p,
          online: p.online || false,
          lastSeen: p.lastSeen || null,
        }));

        return {
          ...chatObj,
          unreadCount,
        };
      }),
    );

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
// GET CHAT MESSAGES
// GET /api/messages/:chatId
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

    // Exclude messages archived by this user
    const messages = await Message.find({
  chat: chatId,
  isDeleted: false,
  archivedBy: { $ne: userId } // exclude archived messages
})
  .populate("sender", "name email profile")
  .populate("mentions", "name email profile")
  .populate({
    path: "replyTo",
    populate: { path: "sender", select: "name email profile" },
  })
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
// SEND MESSAGE (with replies, mentions, and push notifications)
// POST /api/messages/:chatId
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
    } = req.body;

    // 1. Validate participant
    console.log(`🔍 Checking if user ${userId} is participant in chat ${chatId}`);
    const isParticipant = await isChatParticipant(chatId, userId);
    if (!isParticipant) {
      console.log(`❌ User ${userId} is not a participant`);
      return res.status(403).json({ message: "You are not a participant in this chat." });
    }
    console.log(`✅ User is participant`);

    const chat = await Chat.findById(chatId);
    if (!chat) {
      console.log(`❌ Chat ${chatId} not found`);
      return res.status(404).json({ message: "Chat not found." });
    }
    console.log(`✅ Chat found: ${chat._id}, type: ${chat.type}, participants: ${chat.participants.length}`);

    // 2. Handle file upload
    let mediaUrl = null;
    let mediaName = null;
    let mediaSize = null;
    let mediaDuration = null;
    let finalMessageType = messageType;

    if (req.file) {
      console.log(`📎 File uploaded: ${req.file.originalname}, type: ${req.file.mimetype}`);
      mediaUrl = req.file.path;
      mediaName = req.file.originalname;
      mediaSize = req.file.size;
      mediaDuration = req.body.mediaDuration ? parseInt(req.body.mediaDuration) : null;

      if (req.file.mimetype.startsWith("audio/")) finalMessageType = "audio";
      else if (req.file.mimetype.startsWith("image/")) finalMessageType = "image";
      else if (req.file.mimetype.startsWith("video/")) finalMessageType = "video";
      else finalMessageType = "file";
    } else {
      console.log(`📝 No file, using messageType: ${messageType}`);
    }

    // 3. Filter valid mentions (participants only)
    console.log(`🔍 Validating mentions: ${mentions}`);
    const validMentions = await Promise.all(
      mentions.map(async (mentionId) => {
        const isValid = chat.participants.some((p) => p.user.toString() === mentionId);
        return isValid ? mentionId : null;
      })
    );
    const filteredMentions = validMentions.filter((m) => m !== null);
    console.log(`✅ Valid mentions: ${filteredMentions}`);

    // 4. Create message
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
      replyTo: replyToId || null,
      readBy: [{ user: userId, readAt: new Date() }],
      archivedBy: [], // default empty
      starredBy: [],  // default empty
    });
    console.log(`✅ Message created with ID: ${message._id}`);

    // 5. Update chat last message
    chat.lastMessage = message._id;
    chat.lastMessageAt = new Date();
    await chat.save();
    console.log(`✅ Chat updated with last message`);

    // 6. Populate message
    const populatedMessage = await Message.findById(message._id)
  .populate("sender", "name email profile")
  .populate("mentions", "name email profile")
  .populate({
    path: "replyTo",
    populate: { path: "sender", select: "name email profile" },
  });

    // 7. Clear typing indicator
    await TypingIndicator.deleteOne({ chat: chatId, user: userId });
    console.log(`✅ Typing indicator cleared`);

    // 8. Emit socket event
    const io = getIO();
    if (io) {
      io.to(`chat:${chatId}`).emit("new-message", populatedMessage);
      console.log(`📡 Socket event emitted to chat:${chatId}`);
    } else {
      console.log(`⚠️ Socket.io not available`);
    }

    // ─── 9. NOTIFY ALL PARTICIPANTS (except sender) ──────────────────────
    const senderName = req.user.name || 'Someone';
    const allParticipantIds = chat.participants
      .map(p => p.user.toString())
      .filter(id => id !== userId);
    console.log(`👥 All participants (excluding sender):`, allParticipantIds);

    // Build preview
    let preview = content?.substring(0, 100) || '';
    if (finalMessageType === 'image') preview = '📷 Image';
    else if (finalMessageType === 'video') preview = '🎬 Video';
    else if (finalMessageType === 'audio') preview = '🎵 Audio';
    else if (finalMessageType === 'file') preview = `📎 ${mediaName || 'File'}`;
    if (!preview) preview = 'Sent a message';
    console.log(`📄 Preview: "${preview}"`);

    // Chat name for notification
    let chatName = chat.name || 'Chat';
    if (chat.type === 'direct') {
      const otherUser = chat.participants.find(p => p.user.toString() !== userId);
      chatName = otherUser ? otherUser.user.name : 'Direct Chat';
    }

    if (allParticipantIds.length > 0) {
      console.log(`📤 Notifying ${allParticipantIds.length} participants for message ${message._id}`);
      notifyUsers(allParticipantIds, {
        title: `${chat.type === 'group' ? `📢 ${chatName}` : `💬 ${senderName}`}`,
        body: preview,
        data: {
          chatId: chat._id.toString(),
          workspaceId: chat.workspace?.toString() || null,
          messageId: message._id.toString(),
        },
      });
    }

    // ─── 10. NOTIFY MENTIONED USERS (if any) ─────────────────────────────
    if (filteredMentions.length > 0) {
      console.log(`📤 Notifying ${filteredMentions.length} mentioned users`);
      notifyUsers(filteredMentions, {
        title: `${senderName} mentioned you in ${chat.type === 'group' ? chatName : 'a chat'}`,
        body: `${senderName}: ${content?.substring(0, 100) || 'sent a message'}`,
        data: {
          chatId: chat._id.toString(),
          messageId: message._id.toString(),
        },
      });
    }

    // ─── 11. NOTIFY REPLY-TO USER (if not already notified) ─────────────
    if (replyToId) {
      const replyToMessage = await Message.findById(replyToId);
      if (replyToMessage && replyToMessage.sender.toString() !== userId) {
        const replyToUserId = replyToMessage.sender.toString();
        if (!allParticipantIds.includes(replyToUserId) && !filteredMentions.includes(replyToUserId)) {
          notifyUsers([replyToUserId], {
            title: `${senderName} replied to your message`,
            body: `${senderName}: ${content?.substring(0, 100) || 'sent a reply'}`,
            data: {
              chatId: chat._id.toString(),
              messageId: message._id.toString(),
            },
          });
        }
      }
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
// DELETE MESSAGE
// DELETE /api/messages/:messageId
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
// TYPING INDICATOR
// POST /api/messages/:chatId/typing
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
      .populate("user", "name email profile")
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
// SEARCH USERS (Workspace or Public)
// GET /api/messages/search/users
// ─────────────────────────────────────────────────────────────────────────────

export const searchUsers = async (req, res) => {
  console.log(`🔵 searchUsers called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { workspaceId, query, scope } = req.query;

    if (scope === 'public') {
      // Search all users by username or name
      const users = await User.find({
        $or: [
          { username: { $regex: query, $options: "i" } },
          { name: { $regex: query, $options: "i" } },
        ],
        _id: { $ne: userId },
      }).select("name email profile username");
      return res.status(200).json({ success: true, users });
    }

    // Workspace scope
    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required for workspace search." });
    }

    const workspace = await Workspace.findById(workspaceId).populate(
      "members.user",
      "name email profile username",
    );
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found." });
    }

    let members = workspace.members
      .filter((m) => m.status === "active" && m.user._id.toString() !== userId)
      .map((m) => m.user);

    if (query) {
      members = members.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.email.toLowerCase().includes(query.toLowerCase()) ||
          (m.username && m.username.toLowerCase().includes(query.toLowerCase())),
      );
    }

    res.status(200).json({
      success: true,
      users: members,
    });
  } catch (error) {
    console.error(`❌ searchUsers error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD PARTICIPANT TO GROUP (Workspace or Public)
// POST /api/messages/:chatId/participants
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

    // If workspace chat, ensure users are active members
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
        // If workspace chat, check membership
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

    // Notify added users
    notifyUsers(addedUsers, {
      title: `Added to group "${chat.name}"`,
      body: `You have been added to the group chat "${chat.name}".`,
      data: { chatId: chat._id.toString(), workspaceId: chat.workspace?.toString() || null },
    });

    const populatedChat = await Chat.findById(chatId).populate(
      "participants.user",
      "name email profile",
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
// REMOVE PARTICIPANT FROM GROUP
// DELETE /api/messages/:chatId/participants/:userId
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

    // Prevent removing creator (or workspace owner)
    const creatorId = chat.createdBy?.toString();
    if (creatorId === targetUserId) {
      return res
        .status(403)
        .json({ message: "Cannot remove the group creator." });
    }

    // If workspace chat, prevent removing workspace owner
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
      data: { workspaceId: chat.workspace?.toString() || null },
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
// MAKE GROUP ADMIN
// POST /api/messages/:chatId/make-admin
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
      data: { chatId: chat._id.toString() },
    });

    res.status(200).json({
      success: true,
      message: "User promoted to admin.",
      chat: await Chat.findById(chatId).populate("participants.user", "name email profile"),
    });
  } catch (error) {
    console.error(`❌ makeGroupAdmin error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE GROUP ADMIN
// POST /api/messages/:chatId/remove-admin
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

    // Cannot demote creator
    const creatorId = chat.createdBy?.toString();
    if (creatorId === targetUserId) {
      return res.status(403).json({ message: "Cannot demote the group creator." });
    }

    // If workspace chat, cannot demote workspace owner
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
      data: { chatId: chat._id.toString() },
    });

    res.status(200).json({
      success: true,
      message: "Admin rights removed.",
      chat: await Chat.findById(chatId).populate("participants.user", "name email profile"),
    });
  } catch (error) {
    console.error(`❌ removeGroupAdmin error:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE GROUP CHAT (and all messages)
// DELETE /api/messages/group/:chatId
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

    // Only creator can delete (or workspace owner if workspace chat)
    const isCreator = chat.createdBy?.toString() === userId;
    let isWorkspaceOwner = false;
    if (chat.scope === 'workspace' && chat.workspace) {
      const workspace = await Workspace.findById(chat.workspace);
      if (workspace && workspace.owner.toString() === userId) {
        isWorkspaceOwner = true;
      }
    }

    if (!isCreator && !isWorkspaceOwner) {
      return res.status(403).json({ message: "Only the creator or workspace owner can delete the group chat." });
    }

    // Delete all messages
    await Message.deleteMany({ chat: chatId });

    // Delete the chat
    await Chat.findByIdAndDelete(chatId);

    // Notify all participants that the group was deleted
    const participantIds = chat.participants.map(p => p.user.toString());
    notifyUsers(participantIds, {
      title: `Group "${chat.name}" has been deleted`,
      body: `The group chat "${chat.name}" has been permanently deleted.`,
      data: {},
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
// GET GROUP MEMBERS (with roles)
// GET /api/messages/group/:chatId/members
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
// ARCHIVE CHAT (for a user)
// POST /api/messages/:chatId/archive
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

    // Add user to archivedBy if not already
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
// UNARCHIVE CHAT (for a user)
// POST /api/messages/:chatId/unarchive
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
// EXIT GROUP CHAT (remove self)
// POST /api/messages/:chatId/exit
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

    // Check if user is participant
    const participantIndex = chat.participants.findIndex(
      (p) => p.user.toString() === userId,
    );
    if (participantIndex === -1) {
      return res.status(400).json({ message: "You are not a member of this group." });
    }

    // Check if user is the creator or workspace owner (cannot exit? Actually they can, but then group might lose admin; we allow it but warn? We'll allow, but if creator exits, group remains with other admins)
    // But we can prevent creator from exiting if they are the only admin? Let's allow but if they are the only admin, group could become adminless. We'll let them exit and then perhaps no admin remains, but that's okay.
    chat.participants.splice(participantIndex, 1);
    await chat.save();

    // Remove from archivedBy if present
    chat.archivedBy = (chat.archivedBy || []).filter(id => id.toString() !== userId);
    await chat.save();

    // Notify other participants
    const otherParticipantIds = chat.participants.map(p => p.user.toString());
    notifyUsers(otherParticipantIds, {
      title: `${req.user.name} left the group`,
      body: `${req.user.name} has left the group chat "${chat.name}".`,
      data: { chatId: chat._id.toString() },
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
// MARK CHAT AS READ
// POST /api/messages/:chatId/read
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
// ARCHIVE MESSAGE (for a user)
// POST /api/messages/:messageId/archive
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

    // Check if user is participant in the chat
    const isParticipant = await isChatParticipant(message.chat, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a participant in this chat." });
    }

    // Add user to archivedBy if not already
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
// UNARCHIVE MESSAGE (for a user)
// POST /api/messages/:messageId/unarchive
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
// STAR MESSAGE (for a user)
// POST /api/messages/:messageId/star
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

    // Add user to starredBy if not already
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
// UNSTAR MESSAGE (for a user)
// POST /api/messages/:messageId/unstar
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