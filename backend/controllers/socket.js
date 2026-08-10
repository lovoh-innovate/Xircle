// socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Message, Chat, TypingIndicator } from '../models/messagingModel.js';
import Call from '../models/call.js';
import User from '../models/userModel.js';
import Workspace from '../models/workspaceModel.js';
import { createAndSendNotification } from './notificationController.js';

let io;

// ── Check if a user currently has ANY active socket connection ────────
// Every connected socket joins `user:${userId}` on connect, so a
// non-empty room means the user is online right now. No DB needed.
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

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      console.log('Socket auth - Token received:', token ? 'Yes' : 'No');

      if (!token) {
        console.log('No token provided');
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded:', decoded);

      const userId = decoded.userId || decoded.id || decoded.sub;
      if (!userId) {
        console.log('No user ID found in token');
        return next(new Error('No user ID in token'));
      }

      console.log('Looking for user with ID:', userId);

      const user = await User.findById(userId).select('-password');
      if (!user) {
        console.log('User not found for ID:', userId);
        return next(new Error('User not found'));
      }

      socket.user = user;
      socket.userId = user._id.toString();
      console.log('✅ Socket authenticated for user:', user.name);
      next();
    } catch (err) {
      console.error('Socket auth error:', err.message);
      next(new Error('Authentication error: ' + err.message));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`✅ User connected: ${socket.userId} - ${socket.user.name}`);

    // Join user to their personal room
    socket.join(`user:${socket.userId}`);

    // ── Online status ──────────────────────────────────────────────
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

        const chats = await Chat.find({ 'participants.user': socket.userId });
        for (const chat of chats) {
          io.to(`chat:${chat._id}`).emit('user-status-changed', {
            userId: socket.userId,
            online: isOnline,
            lastSeen: isOnline ? null : new Date(),
            chatId: chat._id,
          });
        }

        // ── NEW: broadcast to every workspace this user belongs to ──
        // This drives the "who's online" indicator on workspace pages,
        // independent of whether the user has any chat open.
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

        console.log(
          `📡 User ${socket.user.name} is now ${isOnline ? 'online' : 'offline'}`
        );
      } catch (error) {
        console.error('Error updating online status:', error);
      }
    };

    await updateUserOnlineStatus(true);

    socket.on('presence', async (data) => {
      const { status } = data;
      const isOnline = status === 'online';
      await updateUserOnlineStatus(isOnline);
    });

    // ── Workspace & chat rooms ─────────────────────────────────────
    socket.on('join-workspace', async (workspaceId, callback) => {
      socket.join(`workspace:${workspaceId}`);
      console.log(`📢 User ${socket.user.name} joined workspace: ${workspaceId}`);

      // Send back a snapshot of who's online right now, so the client
      // doesn't have to wait for the next status-change event to know.
      try {
        const workspace = await Workspace.findById(workspaceId).select('members');
        const online = (workspace?.members || [])
          .map((m) => m.user.toString())
          .filter((uid) => isSocketUserOnline(uid));

        if (typeof callback === 'function') {
          callback({ online });
        }
      } catch (err) {
        console.error('Error building workspace presence snapshot:', err.message);
        if (typeof callback === 'function') callback({ online: [] });
      }
    });

    socket.on('join-chat', (chatId) => {
      socket.join(`chat:${chatId}`);
      console.log(`💬 User ${socket.user.name} joined chat: ${chatId}`);
    });

    socket.on('leave-chat', (chatId) => {
      socket.leave(`chat:${chatId}`);
      console.log(`👋 User ${socket.user.name} left chat: ${chatId}`);
    });

    // ── SEND MESSAGE (with push notifications) ─────────────────────
    socket.on('send-message', async (data, callback) => {
      try {
        const {
          chatId, content, messageType, mentions, replyToId,
          mediaUrl, mediaName, mediaSize, mediaDuration,
        } = data;

        console.log(`📩 send-message from ${socket.user.name} in chat ${chatId}`);

        const chat = await Chat.findById(chatId);
        if (!chat) return callback({ error: 'Chat not found' });

        const isParticipant = chat.participants.some(
          (p) => p.user.toString() === socket.userId
        );
        if (!isParticipant) return callback({ error: 'You are not a participant in this chat' });

        const message = await Message.create({
          workspace: chat.workspace, // may be null for public chats
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

        // Emit to chat room (real‑time)
        io.to(`chat:${chatId}`).emit('new-message', populatedMessage);

        // ─── NOTIFICATIONS (push & in‑app) ──────────────────────────
        const senderName = socket.user.name || 'Someone';
        const chatType = chat.type;
        const chatName = chat.type === 'group' ? chat.name : senderName;

        // Build preview
        let preview = content?.substring(0, 100) || '';
        if (messageType === 'image') preview = '📷 Image';
        else if (messageType === 'video') preview = '🎬 Video';
        else if (messageType === 'audio') preview = '🎵 Audio';
        else if (messageType === 'file') preview = `📎 ${mediaName || 'File'}`;
        if (!preview) preview = 'Sent a message';

        // Notification title & body
        let notifTitle, notifBody;
        if (chatType === 'group') {
          notifTitle = `📢 ${chatName}`;
          notifBody = `${senderName}: ${preview}`;
        } else {
          notifTitle = `💬 ${senderName}`;
          notifBody = preview;
        }

        // Build the correct chat URL
        let chatLink;
        if (chat.workspace) {
          // Workspace chat
          chatLink = `${process.env.CLIENT_URL}/workspace/${chat.workspace}/chat/${chat._id}`;
        } else {
          // Public chat (outside workspace)
          chatLink = `${process.env.CLIENT_URL}/channels/${chat._id}`;
        }

        // Data to be sent with the notification (used by the service worker)
        const notificationData = {
          chatId: chat._id.toString(),
          chatType: chatType,
          chatName: chatName,
          senderName: senderName,
          url: chatLink,
          messageId: message._id.toString(),
        };
        // Only include workspaceId if it exists
        if (chat.workspace) {
          notificationData.workspaceId = chat.workspace.toString();
        }

        const allParticipantIds = chat.participants
          .map(p => p.user.toString())
          .filter(id => id !== socket.userId);

        // Send to all participants (except sender)
        if (allParticipantIds.length > 0) {
          console.log(`🔔 Notifying ${allParticipantIds.length} participants in chat ${chatId}`);
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
            }).catch(err => console.error(`Notify ${uid} failed:`, err.message));
          }
        }

        // Mentions (additional notification)
        if (mentions && mentions.length > 0) {
          console.log(`🔔 Notifying ${mentions.length} mentioned users`);
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
              }).catch(err => console.error(`Mention notify ${uid} failed:`, err.message));
            }
          }
        }

        // Clear typing
        await TypingIndicator.deleteOne({ chat: chatId, user: socket.userId });
        io.to(`chat:${chatId}`).emit('user-stopped-typing', {
          chatId,
          userId: socket.userId,
        });

        callback({ success: true, message: populatedMessage });
      } catch (error) {
        console.error('Error sending message:', error);
        callback({ error: error.message });
      }
    });

    // ── Typing indicators ──────────────────────────────────────────
    socket.on('start-typing', async (data) => {
      try {
        const { chatId } = data;
        const chat = await Chat.findById(chatId);
        if (!chat) return;
        const isParticipant = chat.participants.some(
          (p) => p.user.toString() === socket.userId
        );
        if (!isParticipant) return;

        await TypingIndicator.findOneAndUpdate(
          { chat: chatId, user: socket.userId },
          { startedAt: new Date() },
          { upsert: true }
        );

        socket.to(`chat:${chatId}`).emit('user-typing', {
          chatId,
          user: {
            _id: socket.userId,
            name: socket.user.name,
            email: socket.user.email,
            profile: socket.user.profile,
          },
        });
      } catch (error) {
        console.error('Error handling typing:', error);
      }
    });

    socket.on('stop-typing', async (data) => {
      try {
        const { chatId } = data;
        await TypingIndicator.deleteOne({ chat: chatId, user: socket.userId });
        socket.to(`chat:${chatId}`).emit('user-stopped-typing', {
          chatId,
          userId: socket.userId,
        });
      } catch (error) {
        console.error('Error stopping typing:', error);
      }
    });

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
          {
            _id: { $in: messageIds },
            'readBy.user': { $ne: socket.userId },
          },
          {
            $push: { readBy: { user: socket.userId, readAt: new Date() } },
          }
        );

        await Chat.updateOne(
          { _id: chatId, 'participants.user': socket.userId },
          { $set: { 'participants.$.lastReadAt': new Date() } }
        );

        const messages = await Message.find({ _id: { $in: messageIds } });
        for (const message of messages) {
          if (message.sender.toString() !== socket.userId) {
            io.to(`user:${message.sender}`).emit('message-read', {
              chatId,
              messageId: message._id,
              readBy: socket.userId,
            });
          }
        }
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

        const participant = chat.participants.find(
          (p) => p.user.toString() === socket.userId
        );
        const isAdmin = participant?.role === 'admin';
        const isSender = message.sender.toString() === socket.userId;

        if (!isAdmin && !isSender) {
          return callback({ error: 'Not authorized to delete this message' });
        }

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

    // ── 📞 Call signaling ───────────────────────────────────────────
    socket.on('join-call-room', async (roomId) => {
      const call = await Call.findOne({ roomId, status: { $in: ['ringing', 'ongoing'] } });
      if (!call) {
        console.warn(`⚠️ User ${socket.user.name} tried to join unknown call room: ${roomId}`);
      }
      socket.join(`room:${roomId}`);
      console.log(`📞 User ${socket.user.name} joined call room ${roomId}`);
    });

    socket.on('leave-call-room', (roomId) => {
      socket.leave(`room:${roomId}`);
      console.log(`📞 User ${socket.user.name} left call room ${roomId}`);
    });

    socket.on('call-offer', (data) => {
      if (!data.toUserId || !data.roomId) return console.warn('Invalid call-offer');
      io.to(`user:${data.toUserId}`).emit('call-offer', {
        from: socket.userId,
        roomId: data.roomId,
        sdp: data.sdp,
      });
    });

    socket.on('call-answer', (data) => {
      if (!data.toUserId || !data.roomId) return console.warn('Invalid call-answer');
      io.to(`user:${data.toUserId}`).emit('call-answer', {
        from: socket.userId,
        roomId: data.roomId,
        sdp: data.sdp,
      });
    });

    socket.on('ice-candidate', (data) => {
      if (!data.toUserId || !data.roomId) return console.warn('Invalid ice-candidate');
      io.to(`user:${data.toUserId}`).emit('ice-candidate', {
        from: socket.userId,
        roomId: data.roomId,
        candidate: data.candidate,
      });
    });

    socket.on('leave-call', (roomId) => {
      if (!roomId) return;
      socket.to(`room:${roomId}`).emit('participant-left', socket.userId);
      socket.leave(`room:${roomId}`);
    });

    // ── Disconnect ──────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.userId} - ${socket.user.name}`);
      await updateUserOnlineStatus(false);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};