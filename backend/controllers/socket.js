// socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Message, Chat } from '../models/messagingModel.js';
import Sticker from '../models/stickerModel.js';
import Task from '../models/taskModel.js';
import Project from '../models/projectModel.js';
import WorkspaceNote from '../models/workspaceNoteModel.js';
import ClockIn from '../models/clockInModel.js';
import Call from '../models/call.js';
import User from '../models/userModel.js';
import Workspace from '../models/workspaceModel.js';
import { createAndSendNotification } from './notificationController.js';

let io;

const NOTIFICATION_DELAY_MS = 2500;

const isSocketUserOnline = (userId) => {
  const room = io.sockets.adapter.rooms.get(`user:${userId}`);
  return !!room && room.size > 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// REFERENCE SANITIZER
// ─────────────────────────────────────────────────────────────────────────────

const REFERENCE_TYPES = ['task', 'project', 'note', 'clockin'];

const sanitizeReferences = async (rawRefs, workspaceId, userId) => {
  if (!Array.isArray(rawRefs) || rawRefs.length === 0) return [];
  if (!workspaceId) return [];

  const cleaned = [];

  for (const raw of rawRefs.slice(0, 10)) {
    const { type, refId } = raw || {};
    if (!REFERENCE_TYPES.includes(type)) continue;
    if (!mongoose.Types.ObjectId.isValid(refId)) continue;

    if (
      cleaned.some(
        (r) => r.type === type && r.refId.toString() === refId.toString()
      )
    ) {
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
          user: userId,
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

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error: No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId || decoded.id || decoded.sub;
      if (!userId) return next(new Error('No user ID in token'));

      const user = await User.findById(userId).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      socket.userId = user._id.toString();
      next();
    } catch (err) {
      console.error('Socket auth error:', err.message);
      next(new Error('Authentication error: ' + err.message));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`✅ User connected: ${socket.userId} - ${socket.user.name}`);
    socket.join(`user:${socket.userId}`);

    const updateUserOnlineStatus = async (isOnline) => {
      try {
        await Chat.updateMany(
          { 'participants.user': socket.userId },
          {
            $set: {
              'participants.$.online': isOnline,
              'participants.$.lastSeen': isOnline ? null : new Date(),
            },
          }
        );

        const chats = await Chat.find({ 'participants.user': socket.userId }).select('_id');
        for (const chat of chats) {
          io.to(`chat:${chat._id}`).emit('user-status-changed', {
            userId: socket.userId,
            online: isOnline,
            lastSeen: isOnline ? null : new Date(),
            chatId: chat._id,
          });
        }

        try {
          const workspaces = await Workspace.find({
            'members.user': socket.userId,
            'members.status': 'active',
          }).select('_id');

          for (const ws of workspaces) {
            io.to(`workspace:${ws._id}`).emit('member-status-changed', {
              userId: socket.userId,
              online: isOnline,
              lastSeen: isOnline ? null : new Date(),
            });
          }
        } catch (wsErr) {
          console.error('Error broadcasting workspace presence:', wsErr.message);
        }
      } catch (error) {
        console.error('Error updating online status:', error);
      }
    };

    await updateUserOnlineStatus(true);

    socket.on('presence', async (data) => {
      const isOnline = data.status === 'online';
      await updateUserOnlineStatus(isOnline);
    });

    socket.on('request-presence', async (data, callback) => {
      const { userId } = data;
      if (!userId) return callback && callback({ online: false });
      callback && callback({ online: isSocketUserOnline(userId) });
    });

    socket.on('join-workspace', async (workspaceId, callback) => {
      socket.join(`workspace:${workspaceId}`);
      try {
        const workspace = await Workspace.findById(workspaceId).select('members');
        const online = (workspace?.members || [])
          .map((m) => m.user.toString())
          .filter((uid) => isSocketUserOnline(uid));
        if (typeof callback === 'function') callback({ online });
      } catch (err) {
        console.error('Error building workspace presence snapshot:', err.message);
        if (typeof callback === 'function') callback({ online: [] });
      }
    });

    socket.on('join-chat', (chatId) => {
      socket.join(`chat:${chatId}`);
    });

    socket.on('leave-chat', (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    // ── SEND MESSAGE ──────────────────────────────────────────────
    socket.on('send-message', async (data, callback) => {
      try {
        const {
          chatId, content, messageType, mentions, replyToId,
          mediaUrl, mediaName, mediaSize, mediaDuration, stickerId,
          clientMsgId, references: rawReferences,
        } = data;

        const chat = await Chat.findById(chatId);
        if (!chat) return callback({ error: 'Chat not found' });

        const isParticipant = chat.participants.some(
          (p) => p.user.toString() === socket.userId
        );
        if (!isParticipant) return callback({ error: 'You are not a participant in this chat' });

        let stickerRef = null;
        if (messageType === 'sticker') {
          if (!stickerId) {
            return callback({ error: 'stickerId is required for sticker messages' });
          }
          const sticker = await Sticker.findOne({ _id: stickerId, isDeleted: false });
          if (!sticker) {
            return callback({ error: 'Sticker not found or deleted' });
          }
          stickerRef = stickerId;
        }

        const finalMessageType = messageType || 'text';
        const sanitizedReferences = await sanitizeReferences(
          rawReferences, chat.workspace, socket.userId
        );

        const message = await Message.create({
          workspace: chat.workspace,
          chat: chatId,
          sender: socket.userId,
          content: content?.trim() || '',
          messageType: finalMessageType,
          mediaUrl: mediaUrl || null,
          mediaName: mediaName || null,
          mediaSize: mediaSize || null,
          mediaDuration: mediaDuration || null,
          mentions: mentions || [],
          references: sanitizedReferences,
          replyTo: replyToId || null,
          sticker: stickerRef,
          readBy: [{ user: socket.userId, readAt: new Date() }],
        });

        chat.lastMessage = message._id;
        chat.lastMessageAt = new Date();
        await chat.save();

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name email profile')
          .populate('mentions', 'name email profile')
          .populate('replyTo')
          .populate('sticker', 'fileUrl thumbnailUrl type');

        const responseMessage = populatedMessage.toObject
          ? populatedMessage.toObject()
          : populatedMessage;
        responseMessage.clientMsgId = clientMsgId || null;

        io.to(`chat:${chatId}`).emit('new-message', responseMessage);
        callback({ success: true, message: responseMessage });

        io.to(`chat:${chatId}`).emit('user-stopped-typing', {
          chatId, userId: socket.userId,
        });

        const lastMessagePreview = {
          _id: message._id,
          content: message.content,
          messageType: message.messageType,
          createdAt: message.createdAt,
        };
        chat.participants.forEach((p) => {
          io.to(`user:${p.user.toString()}`).emit('chat-list-update', {
            chatId: chat._id.toString(),
            lastMessage: lastMessagePreview,
            lastMessageAt: chat.lastMessageAt,
            senderId: socket.userId,
          });
        });

        const senderName = socket.user.name || 'Someone';
        const chatType = chat.type;
        const chatName = chat.type === 'group' ? chat.name : senderName;

        let preview = content?.substring(0, 100) || '';
        if (messageType === 'image') preview = '📷 Image';
        else if (messageType === 'video') preview = '🎬 Video';
        else if (messageType === 'audio') preview = '🎵 Audio';
        else if (messageType === 'file') preview = `📎 ${mediaName || 'File'}`;
        else if (messageType === 'sticker') preview = '📌 Sticker';
        if (!preview) preview = 'Sent a message';

        let notifTitle, notifBody;
        if (chatType === 'group') {
          notifTitle = `📢 ${chatName}`;
          notifBody = `${senderName}: ${preview}`;
        } else {
          notifTitle = `💬 ${senderName}`;
          notifBody = preview;
        }

        let chatLink;
        if (chat.workspace) {
          chatLink = `${process.env.CLIENT_URL}/workspace/${chat.workspace}/chat/${chat._id}`;
        } else {
          chatLink = `${process.env.CLIENT_URL}/channels/${chat._id}`;
        }

        const notificationData = {
          chatId: chat._id.toString(),
          chatType, chatName, senderName,
          url: chatLink,
          messageId: message._id.toString(),
        };
        if (chat.workspace) notificationData.workspaceId = chat.workspace.toString();

        const allParticipantIds = chat.participants
          .map((p) => p.user.toString())
          .filter((id) => id !== socket.userId);

        setTimeout(() => {
          for (const uid of allParticipantIds) {
            createAndSendNotification({
              recipient: uid,
              title: notifTitle,
              body: notifBody,
              data: notificationData,
              sendPush: true,
              emailEventType: 'newMessage',
              emailSubject: notifTitle,
              emailHtml: `<p>${notifBody}</p><p><a href="${chatLink}">View in app</a></p>`,
            }).catch((err) => console.error(`Notify ${uid} failed:`, err.message));
          }

          if (mentions && mentions.length > 0) {
            for (const uid of mentions) {
              if (allParticipantIds.includes(uid)) {
                createAndSendNotification({
                  recipient: uid,
                  title: `${senderName} mentioned you in chat`,
                  body: `${senderName}: ${content?.substring(0, 100) || 'sent a message'}`,
                  data: { ...notificationData, url: chatLink },
                  sendPush: true,
                  emailEventType: 'newMessage',
                  emailSubject: `${senderName} mentioned you`,
                  emailHtml: `<p>${senderName} mentioned you: ${content || ''}</p><p><a href="${chatLink}">View message</a></p>`,
                }).catch((err) => console.error(`Mention notify ${uid} failed:`, err.message));
              }
            }
          }
        }, NOTIFICATION_DELAY_MS);
      } catch (error) {
        console.error('Error sending message:', error);
        callback({ error: error.message });
      }
    });

    // ── Typing / read / edit / delete / reactions ────────────────
    socket.on('typing:start', (data) => {
      const { chatId } = data || {};
      if (!chatId) return;
      socket.to(`chat:${chatId}`).emit('user-typing', {
        chatId, userId: socket.userId, name: socket.user.name,
      });
    });

    socket.on('typing:stop', (data) => {
      const { chatId } = data || {};
      if (!chatId) return;
      socket.to(`chat:${chatId}`).emit('user-stopped-typing', {
        chatId, userId: socket.userId,
      });
    });

    socket.on('mark-read', async (data) => {
      try {
        const { chatId, messageIds } = data || {};
        if (!chatId || !Array.isArray(messageIds) || !messageIds.length) return;
        const now = new Date();
        await Message.updateMany(
          { _id: { $in: messageIds }, chat: chatId, 'readBy.user': { $ne: socket.userId } },
          { $push: { readBy: { user: socket.userId, readAt: now } } }
        );
        io.to(`chat:${chatId}`).emit('messages-read', {
          chatId, userId: socket.userId, messageIds, readAt: now,
        });
      } catch (err) {
        console.error('mark-read error:', err.message);
      }
    });

    socket.on('delete-message', async (data, callback) => {
      try {
        const { messageId } = data || {};
        if (!messageId) return callback && callback({ error: 'messageId required' });
        const msg = await Message.findById(messageId);
        if (!msg) return callback && callback({ error: 'Message not found' });
        if (msg.sender.toString() !== socket.userId) {
          return callback && callback({ error: 'Not authorized' });
        }
        msg.isDeleted = true;
        msg.content = '';
        await msg.save();
        io.to(`chat:${msg.chat}`).emit('message-deleted', {
          messageId: msg._id, chatId: msg.chat,
        });
        callback && callback({ success: true });
      } catch (err) {
        callback && callback({ error: err.message });
      }
    });

    socket.on('edit-message', async (data, callback) => {
      try {
        const { messageId, content } = data || {};
        if (!messageId || !content?.trim()) {
          return callback && callback({ error: 'messageId and content required' });
        }
        const msg = await Message.findById(messageId);
        if (!msg) return callback && callback({ error: 'Message not found' });
        if (msg.sender.toString() !== socket.userId) {
          return callback && callback({ error: 'Not authorized' });
        }
        msg.content = content.trim();
        msg.edited = true;
        msg.editedAt = new Date();
        await msg.save();
        io.to(`chat:${msg.chat}`).emit('message-edited', {
          messageId: msg._id, chatId: msg.chat, content: msg.content, editedAt: msg.editedAt,
        });
        callback && callback({ success: true });
      } catch (err) {
        callback && callback({ error: err.message });
      }
    });

    socket.on('toggle-reaction', async (data, callback) => {
      try {
        const { messageId, emoji } = data || {};
        if (!messageId || !emoji) return callback && callback({ error: 'messageId and emoji required' });
        const msg = await Message.findById(messageId);
        if (!msg) return callback && callback({ error: 'Message not found' });
        if (!msg.reactions) msg.reactions = [];
        const existing = msg.reactions.find(
          (r) => r.emoji === emoji && r.user.toString() === socket.userId
        );
        if (existing) {
          msg.reactions = msg.reactions.filter(
            (r) => !(r.emoji === emoji && r.user.toString() === socket.userId)
          );
        } else {
          msg.reactions.push({ emoji, user: socket.userId });
        }
        await msg.save();
        io.to(`chat:${msg.chat}`).emit('message-reaction', {
          messageId: msg._id, chatId: msg.chat, reactions: msg.reactions,
        });
        callback && callback({ success: true });
      } catch (err) {
        callback && callback({ error: err.message });
      }
    });

    // ─────────────────────────────────────────────────────────────
    // ── Call events ─────────────────────────────────────────────
    //
    // LiveKit handles all media + in-call presence. The socket room
    // `room:${roomId}` is only used so clients receive:
    //   • call-ended
    //   • call-participant-update
    //   • call-guest-joined
    //
    // Guests (no account) join via LiveKit only and learn about
    // call-end via LiveKit's RoomDisconnected event. They do NOT
    // need to connect to socket.io.
    // ─────────────────────────────────────────────────────────────

    socket.on('join-call-room', async (roomId, callback) => {
      try {
        if (!roomId) {
          return typeof callback === 'function' && callback({ error: 'roomId required' });
        }

        const call = await Call.findOne({
          roomId,
          status: { $in: ['ringing', 'ongoing'] },
          'participants.user': socket.userId,
        }).select('_id');

        if (!call) {
          return typeof callback === 'function' &&
            callback({ error: 'Not allowed to join this call' });
        }

        socket.join(`room:${roomId}`);
        typeof callback === 'function' && callback({ success: true });
      } catch (err) {
        console.error('join-call-room error:', err.message);
        typeof callback === 'function' && callback({ error: 'Failed to join call room' });
      }
    });

    socket.on('leave-call-room', (roomId) => {
      if (!roomId) return;
      socket.leave(`room:${roomId}`);
    });

    socket.on('leave-call', (roomId) => {
      if (!roomId) return;
      socket.leave(`room:${roomId}`);
    });

    // Ask the workspace/room for the current ongoing-call snapshot
    // (useful when a client reconnects or changes workspace)
    socket.on('get-ongoing-calls', async (data, callback) => {
      try {
        const { workspaceId } = data || {};
        let query;
        if (workspaceId) {
          query = { workspace: workspaceId, status: { $in: ['ringing', 'ongoing'] } };
        } else {
          query = {
            status: { $in: ['ringing', 'ongoing'] },
            $or: [
              { 'participants.user': socket.userId },
              { creator: socket.userId },
            ],
          };
        }
        const calls = await Call.find(query)
          .populate('participants.user', 'name email username profile')
          .populate('creator', 'name email username profile')
          .sort({ updatedAt: -1 })
          .limit(50);

        typeof callback === 'function' && callback({ success: true, calls });
      } catch (err) {
        console.error('get-ongoing-calls error:', err.message);
        typeof callback === 'function' && callback({ error: 'Failed to fetch' });
      }
    });

    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.userId} - ${socket.user.name}`);
      // Socket.io removes the socket from all rooms automatically.
      // LiveKit detects the dropped media connection on its own.
      // If a user was the sole remaining participant in a group call,
      // consider adding a LiveKit webhook to auto-end that call.
      await updateUserOnlineStatus(false);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};