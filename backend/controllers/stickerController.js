// controllers/stickerController.js
import Sticker from '../models/stickerModel.js';
import { Message, Chat } from '../models/messagingModel.js';
import { getIO } from './socket.js';
import { createAndSendNotification } from './notificationController.js';

// ─── Helper: validate sticker duration (max 6 seconds) ──────────────
const validateStickerDuration = (duration) => {
  const d = parseFloat(duration) || 0;
  if (d > 6) {
    throw new Error('Sticker duration cannot exceed 6 seconds.');
  }
  return d;
};

// ─── CREATE STICKER ──────────────────────────────────────────────────
// POST /api/stickers
// body: { type, duration?, tags? } + file (multipart)
export const createSticker = async (req, res) => {
  console.log(`🔵 createSticker called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { type, duration, tags } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Sticker file is required.' });
    }

    if (!type || !['image', 'animated'].includes(type)) {
      return res.status(400).json({ message: 'Valid type (image or animated) is required.' });
    }

    let validatedDuration = 0;
    if (type === 'animated') {
      try {
        validatedDuration = validateStickerDuration(duration);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    // file.path is from multer (local or Cloudinary URL)
    const fileUrl = file.path;
    const thumbnailUrl = type === 'image' ? fileUrl : null; // could generate thumbnail later

    const sticker = await Sticker.create({
      createdBy: userId,
      fileUrl,
      thumbnailUrl,
      type,
      duration: validatedDuration,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      savedBy: [userId], // creator automatically saves it
    });

    res.status(201).json({
      success: true,
      message: 'Sticker created successfully.',
      sticker,
    });
  } catch (error) {
    console.error('❌ createSticker error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── SEND STICKER AS MESSAGE ────────────────────────────────────────
// POST /api/stickers/send
// body: { chatId, stickerId, replyToId? }
export const sendSticker = async (req, res) => {
  console.log(`🔵 sendSticker called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { chatId, stickerId, replyToId } = req.body;

    if (!chatId || !stickerId) {
      return res.status(400).json({ message: 'chatId and stickerId are required.' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found.' });
    }
    const isParticipant = chat.participants.some(p => p.user.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({ message: 'You are not in this chat.' });
    }

    const sticker = await Sticker.findOne({ _id: stickerId, isDeleted: false });
    if (!sticker) {
      return res.status(404).json({ message: 'Sticker not found or deleted.' });
    }

    const message = await Message.create({
      workspace: chat.workspace,
      chat: chatId,
      sender: userId,
      content: '',
      messageType: 'sticker',
      sticker: stickerId,
      replyTo: replyToId || null,
      readBy: [{ user: userId, readAt: new Date() }],
    });

    chat.lastMessage = message._id;
    chat.lastMessageAt = new Date();
    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email profile username')
      .populate('sticker', 'fileUrl thumbnailUrl type')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'name email profile username' },
      });

    const io = getIO();
    if (io) {
      io.to(`chat:${chatId}`).emit('new-message', populatedMessage);
    }

    // Notifications
    const participantIds = chat.participants
      .map(p => p.user.toString())
      .filter(id => id !== userId);

    if (participantIds.length > 0) {
      const senderName = req.user.name || 'Someone';
      const chatName = chat.type === 'group' ? chat.name : senderName;
      const preview = '📌 Sticker';
      const notificationData = {
        chatId: chat._id.toString(),
        chatType: chat.type,
        chatName,
        senderName,
        messageId: message._id.toString(),
        stickerId: sticker._id.toString(),
      };
      if (chat.workspace) notificationData.workspaceId = chat.workspace.toString();

      setTimeout(() => {
        for (const uid of participantIds) {
          createAndSendNotification({
            recipient: uid,
            title: chat.type === 'group' ? `📢 ${chatName}` : `💬 ${senderName}`,
            body: preview,
            data: notificationData,
            sendPush: true,
            emailEventType: 'newMessage',
            emailSubject: `Sticker from ${senderName}`,
            emailHtml: `<p>${senderName} sent a sticker.</p>`,
          }).catch(err => console.error(`Notify ${uid} failed:`, err.message));
        }
      }, 2500);
    }

    res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error('❌ sendSticker error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── SAVE STICKER TO COLLECTION ─────────────────────────────────────
// POST /api/stickers/:stickerId/save
export const saveSticker = async (req, res) => {
  console.log(`🔵 saveSticker called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { stickerId } = req.params;

    const sticker = await Sticker.findOne({ _id: stickerId, isDeleted: false });
    if (!sticker) {
      return res.status(404).json({ message: 'Sticker not found.' });
    }

    if (sticker.savedBy.includes(userId)) {
      return res.status(400).json({ message: 'Sticker already saved.' });
    }

    sticker.savedBy.push(userId);
    await sticker.save();

    res.status(200).json({
      success: true,
      message: 'Sticker saved to collection.',
    });
  } catch (error) {
    console.error('❌ saveSticker error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── UNSAVE STICKER FROM COLLECTION ────────────────────────────────
// POST /api/stickers/:stickerId/unsave
export const unsaveSticker = async (req, res) => {
  console.log(`🔵 unsaveSticker called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { stickerId } = req.params;

    const sticker = await Sticker.findOne({ _id: stickerId, isDeleted: false });
    if (!sticker) {
      return res.status(404).json({ message: 'Sticker not found.' });
    }

    const index = sticker.savedBy.indexOf(userId);
    if (index === -1) {
      return res.status(400).json({ message: 'Sticker not saved.' });
    }

    sticker.savedBy.splice(index, 1);
    await sticker.save();

    res.status(200).json({
      success: true,
      message: 'Sticker removed from collection.',
    });
  } catch (error) {
    console.error('❌ unsaveSticker error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET SAVED STICKERS FOR CURRENT USER ───────────────────────────
// GET /api/stickers/saved
export const getSavedStickers = async (req, res) => {
  console.log(`🔵 getSavedStickers called by user ${req.user.id}`);
  try {
    const userId = req.user.id;

    const stickers = await Sticker.find({
      savedBy: userId,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      stickers,
    });
  } catch (error) {
    console.error('❌ getSavedStickers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ALL STICKERS (with optional tag filter) ───────────────────
// GET /api/stickers?tag=happy&limit=20&page=1
export const getStickers = async (req, res) => {
  console.log(`🔵 getStickers called by user ${req.user.id}`);
  try {
    const { tag, limit = 50, page = 1 } = req.query;
    const filter = { isDeleted: false };

    if (tag) {
      filter.tags = { $in: [tag] };
    }

    const stickers = await Sticker.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Sticker.countDocuments(filter);

    res.status(200).json({
      success: true,
      stickers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('❌ getStickers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE STICKER (creator only) ──────────────────────────────────
// DELETE /api/stickers/:stickerId
export const deleteSticker = async (req, res) => {
  console.log(`🔵 deleteSticker called by user ${req.user.id}`);
  try {
    const userId = req.user.id;
    const { stickerId } = req.params;

    const sticker = await Sticker.findById(stickerId);
    if (!sticker) {
      return res.status(404).json({ message: 'Sticker not found.' });
    }

    if (sticker.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'Only the creator can delete this sticker.' });
    }

    sticker.isDeleted = true;
    await sticker.save();

    res.status(200).json({
      success: true,
      message: 'Sticker deleted successfully.',
    });
  } catch (error) {
    console.error('❌ deleteSticker error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};