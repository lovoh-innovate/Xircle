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

const isChatAdmin = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  const participant = chat?.participants.find(
    (p) => p.user.toString() === userId,
  );
  return participant?.role === "admin";
};

/**
 * Send push + in‑app notification to multiple users (same as call controller).
 * Includes full error logging.
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
// CREATE GROUP CHAT (Owner only)
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
      name: name.trim(),
      avatar: avatar || null,
      participants: activeMembers,
      createdBy: userId,
      lastMessageAt: new Date(),
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
    } else {
      console.log(`⚠️ No other members to notify`);
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
// CREATE DIRECT CHAT
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
// GET USER CHATS
// GET /api/messages/chats
// ─────────────────────────────────────────────────────────────────────────────

export const getUserChats = async (req, res) => {
  console.log(`🔵 getUserChats called for user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required." });
    }

    const chats = await Chat.find({
      workspace: workspaceId,
      participants: { $elemMatch: { user: userId } },
      isArchived: false,
    })
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

    const messages = await Message.find({ chat: chatId, isDeleted: false })
      .populate("sender", "name email profile")
      .populate("mentions", "name email profile")
      .populate("replyTo")
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
// SEND MESSAGE (with full logging)
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
      .populate("replyTo");
    console.log(`✅ Message populated`);

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

    if (allParticipantIds.length > 0) {
      console.log(`📤 Notifying ${allParticipantIds.length} participants for message ${message._id}`);
      notifyUsers(allParticipantIds, {
        title: `${senderName} sent a message`,
        body: preview,
        data: {
          chatId: chat._id.toString(),
          workspaceId: chat.workspace.toString(),
          messageId: message._id.toString(),
        },
      });
    } else {
      console.log(`⚠️ No participants to notify (message from ${userId})`);
    }

    // ─── 10. NOTIFY MENTIONED USERS (if any) ─────────────────────────────
    if (filteredMentions.length > 0) {
      console.log(`📤 Notifying ${filteredMentions.length} mentioned users`);
      notifyUsers(filteredMentions, {
        title: `${senderName} mentioned you in chat`,
        body: `${senderName}: ${content?.substring(0, 100) || 'sent a message'}`,
        data: {
          chatId: chat._id.toString(),
          messageId: message._id.toString(),
        },
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

// ─────────────────────────────────────────────────────────────────────────────
// GET TYPING USERS
// GET /api/messages/:chatId/typing
// ─────────────────────────────────────────────────────────────────────────────

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
// SEARCH USERS IN WORKSPACE
// GET /api/messages/search/users
// ─────────────────────────────────────────────────────────────────────────────

export const searchUsers = async (req, res) => {
  console.log(`🔵 searchUsers called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { workspaceId, query } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required." });
    }

    const workspace = await Workspace.findById(workspaceId).populate(
      "members.user",
      "name email profile",
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
          m.email.toLowerCase().includes(query.toLowerCase()),
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
// ADD PARTICIPANT TO GROUP
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

    const workspace = await Workspace.findById(chat.workspace);
    const existingUserIds = chat.participants.map((p) => p.user.toString());
    const addedUsers = [];

    for (const newUserId of userIds) {
      if (!existingUserIds.includes(newUserId)) {
        const isActiveMember = workspace.members.some(
          (m) => m.user.toString() === newUserId && m.status === "active",
        );
        if (isActiveMember) {
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
    }

    await chat.save();

    if (addedUsers.length > 0) {
      console.log(`📢 Notifying ${addedUsers.length} added participants`);
      notifyUsers(addedUsers, {
        title: `Added to group "${chat.name}"`,
        body: `You have been added to the group chat "${chat.name}".`,
        data: { chatId: chat._id.toString(), workspaceId: chat.workspace.toString() },
      });
    }

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

    chat.participants = chat.participants.filter(
      (p) => p.user.toString() !== targetUserId,
    );
    await chat.save();

    console.log(`📢 Notifying removed participant ${targetUserId}`);
    notifyUsers([targetUserId], {
      title: `Removed from group "${chat.name}"`,
      body: `You have been removed from the group chat "${chat.name}".`,
      data: { workspaceId: chat.workspace.toString() },
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