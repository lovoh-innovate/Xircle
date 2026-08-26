// socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Message, Chat } from '../models/messagingModel.js';
import Call from '../models/call.js';
import User from '../models/userModel.js';
import Workspace from '../models/workspaceModel.js';
import { createAndSendNotification } from './notificationController.js';

let io;

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

    // ── SEND MESSAGE ─────────────────────────────────────────────────
    // Critical path: create → emit. Notifications and chat-list fan-out
    // happen AFTER the emit and are never awaited on the response path.
    socket.on('send-message', async (data, callback) => {
      try {
        const {
          chatId, content, messageType, mentions, replyToId,
          mediaUrl, mediaName, mediaSize, mediaDuration,
        } = data;

        const chat = await Chat.findById(chatId);
        if (!chat) return callback({ error: 'Chat not found' });

        const isParticipant = chat.participants.some(
          (p) => p.user.toString() === socket.userId
        );
        if (!isParticipant) return callback({ error: 'You are not a participant in this chat' });

        const message = await Message.create({
          workspace: chat.workspace,
          chat: chatId,
          sender: socket.userId,
          content: content?.trim() || '',
          messageType: messageType || 'text',
          mediaUrl: mediaUrl || null,
          mediaName: mediaName || null,
          mediaSize: mediaSize || null,
          mediaDuration: mediaDuration || null,
          mentions: mentions || [],
          replyTo: replyToId || null,
          readBy: [{ user: socket.userId, readAt: new Date() }],
        });

        chat.lastMessage = message._id;
        chat.lastMessageAt = new Date();
        await chat.save();

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name email profile')
          .populate('mentions', 'name email profile')
          .populate('replyTo');

        // 🔴 Emit FIRST — everything below is background work.
        io.to(`chat:${chatId}`).emit('new-message', populatedMessage);
        callback({ success: true, message: populatedMessage });

        // Typing is socket-only now, nothing to clear in the DB.
        io.to(`chat:${chatId}`).emit('user-stopped-typing', {
          chatId,
          userId: socket.userId,
        });

        // Fan out a lightweight chat-list patch to every participant so
        // GeneralChats can update lastMessage/unread without a refetch.
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

        // ─── Notifications (fire-and-forget, never blocks the socket ack) ──
        const senderName = socket.user.name || 'Someone';
        const chatType = chat.type;
        const chatName = chat.type === 'group' ? chat.name : senderName;

        let preview = content?.substring(0, 100) || '';
        if (messageType === 'image') preview = '📷 Image';
        else if (messageType === 'video') preview = '🎬 Video';
        else if (messageType === 'audio') preview = '🎵 Audio';
        else if (messageType === 'file') preview = `📎 ${mediaName || 'File'}`;
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
      } catch (error) {
        console.error('Error sending message:', error);
        callback({ error: error.message });
      }
    });

    // ── Typing indicators — pure socket, zero DB, zero REST ─────────
    socket.on('typing:start', (data) => {
      const { chatId } = data || {};
      if (!chatId) return;
      socket.to(`chat:${chatId}`).emit('typing:start', {
        chatId,
        user: {
          _id: socket.userId,
          name: socket.user.name,
          profile: socket.user.profile,
        },
      });
    });

    socket.on('typing:stop', (data) => {
      const { chatId } = data || {};
      if (!chatId) return;
      socket.to(`chat:${chatId}`).emit('typing:stop', {
        chatId,
        userId: socket.userId,
      });
    });

    // Back-compat aliases — remove once the frontend fully migrates to typing:start/stop
    socket.on('start-typing', (data) => socket.emit('typing:start', data));
    socket.on('stop-typing', (data) => socket.emit('typing:stop', data));

    // ── Mark as read ──────────────────────────────────────────────
    socket.on('mark-read', async (data) => {
      try {
        const { chatId, messageIds } = data;
        const chat = await Chat.findById(chatId);
        if (!chat) return;

        const isParticipant = chat.participants.some(
          (p) => p.user.toString() === socket.userId
        );
        if (!isParticipant) return;

        await Message.updateMany(
          { _id: { $in: messageIds }, 'readBy.user': { $ne: socket.userId } },
          { $push: { readBy: { user: socket.userId, readAt: new Date() } } }
        );

        await Chat.updateOne(
          { _id: chatId, 'participants.user': socket.userId },
          { $set: { 'participants.$.lastReadAt': new Date() } }
        );

        const messages = await Message.find({ _id: { $in: messageIds } }).select('sender');
        for (const message of messages) {
          if (message.sender.toString() !== socket.userId) {
            io.to(`user:${message.sender}`).emit('message-read', {
              chatId,
              messageId: message._id,
              readBy: socket.userId,
            });
          }
        }

        // Let the reader's own chat-list badge clear immediately.
        io.to(`user:${socket.userId}`).emit('chat-list-update', {
          chatId,
          unreadCount: 0,
        });
      } catch (error) {
        console.error('Error marking read:', error);
      }
    });

    // ── Delete message ─────────────────────────────────────────────
    socket.on('delete-message', async (data, callback) => {
      try {
        const { messageId } = data;
        const message = await Message.findById(messageId);
        if (!message) return callback({ error: 'Message not found' });

        const chat = await Chat.findById(message.chat);
        if (!chat) return callback({ error: 'Chat not found' });

        const participant = chat.participants.find((p) => p.user.toString() === socket.userId);
        const isAdmin = participant?.role === 'admin';
        const isSender = message.sender.toString() === socket.userId;
        if (!isAdmin && !isSender) return callback({ error: 'Not authorized to delete this message' });

        message.isDeleted = true;
        message.deletedBy = socket.userId;
        message.deletedAt = new Date();
        await message.save();

        io.to(`chat:${message.chat}`).emit('message-deleted', {
          messageId,
          deletedBy: socket.userId,
          deletedAt: message.deletedAt,
        });

        callback({ success: true });
      } catch (error) {
        console.error('Error deleting message:', error);
        callback({ error: error.message });
      }
    });

    // ── Call signaling (unchanged) ──────────────────────────────────
    socket.on('join-call-room', async (roomId) => {
      const call = await Call.findOne({ roomId, status: { $in: ['ringing', 'ongoing'] } });
      if (!call) console.warn(`⚠️ User ${socket.user.name} tried to join unknown call room: ${roomId}`);
      socket.join(`room:${roomId}`);
    });

    socket.on('leave-call-room', (roomId) => socket.leave(`room:${roomId}`));

    socket.on('call-offer', (data) => {
      if (!data.toUserId || !data.roomId) return;
      io.to(`user:${data.toUserId}`).emit('call-offer', { from: socket.userId, roomId: data.roomId, sdp: data.sdp });
    });

    socket.on('call-answer', (data) => {
      if (!data.toUserId || !data.roomId) return;
      io.to(`user:${data.toUserId}`).emit('call-answer', { from: socket.userId, roomId: data.roomId, sdp: data.sdp });
    });

    socket.on('ice-candidate', (data) => {
      if (!data.toUserId || !data.roomId) return;
      io.to(`user:${data.toUserId}`).emit('ice-candidate', { from: socket.userId, roomId: data.roomId, candidate: data.candidate });
    });

    socket.on('leave-call', (roomId) => {
      if (!roomId) return;
      socket.to(`room:${roomId}`).emit('participant-left', socket.userId);
      socket.leave(`room:${roomId}`);
    });

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