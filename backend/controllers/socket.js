// socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Message, Chat } from '../models/messagingModel.js';
import Sticker from '../models/stickerModel.js';  // ✨ import Sticker
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

    // ── SEND MESSAGE (with sticker support) ──────────────────────────
    socket.on('send-message', async (data, callback) => {
      try {
        const {
          chatId,
          content,
          messageType,
          mentions,
          replyToId,
          mediaUrl,
          mediaName,
          mediaSize,
          mediaDuration,
          stickerId,        // ✨ new
          clientMsgId,
        } = data;

        const chat = await Chat.findById(chatId);
        if (!chat) return callback({ error: 'Chat not found' });

        const isParticipant = chat.participants.some(
          (p) => p.user.toString() === socket.userId
        );
        if (!isParticipant) return callback({ error: 'You are not a participant in this chat' });

        // ─── Sticker handling ──────────────────────────────────────────
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

        // ─── Media handling (only if not sticker) ─────────────────────
        let finalMessageType = messageType || 'text';
        if (messageType !== 'sticker') {
          // if mediaUrl is present, we treat it as media message; but if not, it's text
          // we don't have a file upload in socket, so we rely on passed mediaUrl
        }

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
          replyTo: replyToId || null,
          sticker: stickerRef,   // ✨ set sticker reference
          readBy: [{ user: socket.userId, readAt: new Date() }],
        });

        chat.lastMessage = message._id;
        chat.lastMessageAt = new Date();
        await chat.save();

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name email profile')
          .populate('mentions', 'name email profile')
          .populate('replyTo')
          .populate('sticker', 'fileUrl thumbnailUrl type');   // ✨ populate sticker

        const responseMessage = populatedMessage.toObject
          ? populatedMessage.toObject()
          : populatedMessage;
        responseMessage.clientMsgId = clientMsgId || null;

        io.to(`chat:${chatId}`).emit('new-message', responseMessage);
        callback({ success: true, message: responseMessage });

        io.to(`chat:${chatId}`).emit('user-stopped-typing', {
          chatId,
          userId: socket.userId,
        });

        // ─── Chat list update ──────────────────────────────────────────
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

        // ─── Notifications (delayed) ──────────────────────────────────
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
          chatType,
          chatName,
          senderName,
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

    // ── Typing (unchanged) ──────────────────────────────────────────
    socket.on('typing:start', (data) => { /* ... */ });
    socket.on('typing:stop', (data) => { /* ... */ });

    // ── Mark read (unchanged) ─────────────────────────────────────────
    socket.on('mark-read', async (data) => { /* ... */ });

    // ── Delete message (unchanged) ────────────────────────────────────
    socket.on('delete-message', async (data, callback) => { /* ... */ });

    // ── Edit message (unchanged) ────────────────────────────────────
    socket.on('edit-message', async (data, callback) => { /* ... */ });

    // ── Reactions (unchanged) ────────────────────────────────────────
    socket.on('toggle-reaction', async (data, callback) => { /* ... */ });

    // ── Call signaling (unchanged) ──────────────────────────────────
    socket.on('join-call-room', async (roomId) => { /* ... */ });
    socket.on('leave-call-room', (roomId) => { /* ... */ });
    socket.on('call-offer', (data) => { /* ... */ });
    socket.on('call-answer', (data) => { /* ... */ });
    socket.on('ice-candidate', (data) => { /* ... */ });
    socket.on('leave-call', (roomId) => { /* ... */ });

    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.userId} - ${socket.user.name}`);
      await updateUserOnlineStatus(false);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};