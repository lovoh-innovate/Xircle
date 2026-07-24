// controllers/messagingController.js

import mongoose from "mongoose";
import { Message, Chat, TypingIndicator } from "../models/messagingModel.js";
import Workspace from "../models/workspaceModel.js";
import User from "../models/userModel.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

// ── Notification service ──────────────────────────────────────────
import { createAndSendNotification } from './notificationController.js';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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

// ── Notification helper (fire‑and‑forget) ────────────────────────
/**
 * Send a push/email notification to one or many users.
 * @param {string|string[]} userIds - Single user ID or array
 * @param {Object} options
 */
async function notifyUsers(userIds, { title, body, data = {}, emailEventType = null, emailHtml = null }) {
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
    }).catch(err => console.error(`Notification to ${recipient} failed:`, err.message));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE ONLINE STATUS
// POST /api/messages/online-status
// ─────────────────────────────────────────────────────────────────────────────

const updateOnlineStatus = async (req, res) => {
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

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE GROUP CHAT (Owner only)
// POST /api/messages/group
// ─────────────────────────────────────────────────────────────────────────────

const createGroupChat = async (req, res) => {
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
    notifyUsers(memberIds, {
      title: `New group chat "${chat.name}"`,
      body: `You were added to the group "${chat.name}" by the workspace owner.`,
      data: { chatId: chat._id.toString(), workspaceId },
      emailEventType: 'teamInvite',
      emailHtml: `
        <h3>You've been added to a group chat</h3>
        <p>Group: <strong>${chat.name}</strong></p>
        <p><a href="${process.env.CLIENT_URL}/workspace/${workspaceId}/chat/${chat._id}">Open Chat</a></p>
      `,
    });

    res.status(201).json({
      success: true,
      message: "Group chat created successfully",
      chat: populatedChat,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE DIRECT CHAT
// POST /api/messages/direct
// ─────────────────────────────────────────────────────────────────────────────

const createDirectChat = async (req, res) => {
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
    notifyUsers(targetUserId, {
      title: `New message from ${req.user.name || 'a colleague'}`,
      body: `${req.user.name || 'Someone'} started a direct chat with you.`,
      data: { chatId: chat._id.toString(), workspaceId },
      emailEventType: 'newMessage',
    });

    res.status(201).json({
      success: true,
      message: "Direct chat created successfully",
      chat: populatedChat,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET USER CHATS
// GET /api/messages/chats
// ─────────────────────────────────────────────────────────────────────────────

const getUserChats = async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET CHAT MESSAGES
// GET /api/messages/:chatId
// ─────────────────────────────────────────────────────────────────────────────

const getChatMessages = async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND MESSAGE (UPDATED: notify all participants + mentions)
// POST /api/messages/:chatId
// ─────────────────────────────────────────────────────────────────────────────

const sendMessage = async (req, res) => {
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
    const isParticipant = await isChatParticipant(chatId, userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a participant in this chat." });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }

    // 2. Handle file upload
    let mediaUrl = null;
    let mediaName = null;
    let mediaSize = null;
    let mediaDuration = null;
    let finalMessageType = messageType;

    if (req.file) {
      mediaUrl = req.file.path;
      mediaName = req.file.originalname;
      mediaSize = req.file.size;
      mediaDuration = req.body.mediaDuration ? parseInt(req.body.mediaDuration) : null;

      if (req.file.mimetype.startsWith("audio/")) finalMessageType = "audio";
      else if (req.file.mimetype.startsWith("image/")) finalMessageType = "image";
      else if (req.file.mimetype.startsWith("video/")) finalMessageType = "video";
      else finalMessageType = "file";
    }

    // 3. Filter valid mentions (participants only)
    const validMentions = await Promise.all(
      mentions.map(async (mentionId) => {
        const isValid = chat.participants.some((p) => p.user.toString() === mentionId);
        return isValid ? mentionId : null;
      })
    );
    const filteredMentions = validMentions.filter((m) => m !== null);

    // 4. Create message
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

    // 5. Update chat last message
    chat.lastMessage = message._id;
    chat.lastMessageAt = new Date();
    await chat.save();

    // 6. Populate message
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name email profile")
      .populate("mentions", "name email profile")
      .populate("replyTo");

    // 7. Clear typing indicator
    await TypingIndicator.deleteOne({ chat: chatId, user: userId });

    // 8. Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(`chat:${chatId}`).emit("new-message", populatedMessage);
    }

    // ─── 9. NOTIFY ALL PARTICIPANTS (except sender) ──────────────────────
    const senderName = req.user.name || 'Someone';
    const allParticipantIds = chat.participants
      .map(p => p.user.toString())
      .filter(id => id !== userId);

    // Build a preview of the message content
    let preview = content?.substring(0, 100) || '';
    if (finalMessageType === 'image') preview = '📷 Image';
    else if (finalMessageType === 'video') preview = '🎬 Video';
    else if (finalMessageType === 'audio') preview = '🎵 Audio';
    else if (finalMessageType === 'file') preview = `📎 ${mediaName || 'File'}`;
    if (!preview) preview = 'Sent a message';

    // Prepare email HTML (include chat link)
    const chatLink = `${process.env.CLIENT_URL}/workspace/${chat.workspace}/chat/${chatId}`;
    const emailHtml = `
      <h3>New message from ${senderName}</h3>
      <p><strong>Chat:</strong> ${chat.type === 'group' ? chat.name : 'Direct'}</p>
      <p><em>${preview}</em></p>
      <p><a href="${chatLink}">View in app</a></p>
    `;

    // Send to all participants (fire & forget)
    if (allParticipantIds.length > 0) {
      notifyUsers(allParticipantIds, {
        title: `${senderName} sent a message`,
        body: preview,
        data: {
          chatId: chat._id.toString(),
          workspaceId: chat.workspace.toString(),
          messageId: message._id.toString(),
        },
        emailEventType: 'newMessage',
        emailHtml,
      });
    }

    // ─── 10. NOTIFY MENTIONED USERS (if any, they also get a separate mention) ──
    if (filteredMentions.length > 0) {
      notifyUsers(filteredMentions, {
        title: `${senderName} mentioned you in chat`,
        body: `${senderName}: ${content?.substring(0, 100) || 'sent a message'}`,
        data: { chatId: chat._id.toString(), messageId: message._id.toString() },
        emailEventType: 'newMessage',
        emailHtml: `
          <h3>${senderName} mentioned you</h3>
          <p><strong>Chat:</strong> ${chat.type === 'group' ? chat.name : 'Direct'}</p>
          <p><em>${content || 'sent a message'}</em></p>
          <p><a href="${chatLink}">View message</a></p>
        `,
      });
    }

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

const deleteMessage = async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPING INDICATOR
// POST /api/messages/:chatId/typing
// ─────────────────────────────────────────────────────────────────────────────

const startTyping = async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
};

const stopTyping = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    await TypingIndicator.deleteOne({ chat: chatId, user: userId });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET TYPING USERS
// GET /api/messages/:chatId/typing
// ─────────────────────────────────────────────────────────────────────────────

const getTypingUsers = async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH USERS IN WORKSPACE
// GET /api/messages/search/users
// ─────────────────────────────────────────────────────────────────────────────

const searchUsers = async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD PARTICIPANT TO GROUP
// POST /api/messages/:chatId/participants
// ─────────────────────────────────────────────────────────────────────────────

const addParticipant = async (req, res) => {
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

    // Notify added participants
    if (addedUsers.length > 0) {
      notifyUsers(addedUsers, {
        title: `Added to group "${chat.name}"`,
        body: `You have been added to the group chat "${chat.name}".`,
        data: { chatId: chat._id.toString(), workspaceId: chat.workspace.toString() },
        emailEventType: 'teamInvite',
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE PARTICIPANT FROM GROUP
// DELETE /api/messages/:chatId/participants/:userId
// ─────────────────────────────────────────────────────────────────────────────

const removeParticipant = async (req, res) => {
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

    // Notify removed participant
    notifyUsers(targetUserId, {
      title: `Removed from group "${chat.name}"`,
      body: `You have been removed from the group chat "${chat.name}".`,
      data: { workspaceId: chat.workspace.toString() },
      emailEventType: 'projectUpdate',
    });

    res.status(200).json({
      success: true,
      message: "Participant removed successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK CHAT AS READ
// POST /api/messages/:chatId/read
// ─────────────────────────────────────────────────────────────────────────────

const markChatAsRead = async (req, res) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export {
  createGroupChat,
  createDirectChat,
  getUserChats,
  getChatMessages,
  sendMessage,
  deleteMessage,
  startTyping,
  stopTyping,
  getTypingUsers,
  searchUsers,
  addParticipant,
  removeParticipant,
  markChatAsRead,
  updateOnlineStatus,
};