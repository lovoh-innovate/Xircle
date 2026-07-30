import express from 'express';
import {
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
  // Public chat
  createPublicDirectChat,
  createPublicGroupChat,
  searchPublicGroups,
  requestJoinGroup,
  handleJoinRequest,
  getJoinRequests,
  getPendingJoinRequests,
  // Group admin
  makeGroupAdmin,
  removeGroupAdmin,
  // Group deletion & members
  deleteGroupChat,
  getGroupMembers,
  // Archiving & exiting
  archiveChat,
  unarchiveChat,
  exitGroupChat,
  // Message archive/star
  archiveMessage,
  unarchiveMessage,
  starMessage,
  unstarMessage,
  // 🆕 Public group update/delete
  updatePublicGroup,
  deletePublicGroup,
} from '../controllers/messagingController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import multer from 'multer';

const router = express.Router();

// ─── Chat management (workspace) ──────────────────────────────────────
router.post('/group', protect, createGroupChat);
router.post('/direct', protect, createDirectChat);
router.get('/chats', protect, getUserChats);
router.get('/search/users', protect, searchUsers);

// ─── Online status ────────────────────────────────────────────────────
router.post('/online-status', protect, updateOnlineStatus);

// ─── Public (outside workspace) chat endpoints ──────────────────────
router.post('/public/direct', protect, createPublicDirectChat);
router.post('/public/group', protect, upload.single('avatar'), createPublicGroupChat);
router.get('/public/groups/search', protect, searchPublicGroups);
router.post('/public/groups/:chatId/join-request', protect, requestJoinGroup);
router.post('/public/groups/:chatId/join-request/:requestId', protect, handleJoinRequest);
router.get('/public/groups/:chatId/join-requests', protect, getJoinRequests);
// ─── Pending join requests ──────────────────────────────────────────
router.get('/public/groups/pending', protect, getPendingJoinRequests);

// 🆕 Update and delete public groups (creator only)
router.put('/public/group/:chatId', protect, upload.single('avatar'), updatePublicGroup);
router.delete('/public/group/:chatId', protect, deletePublicGroup);

// ─── Group admin management ──────────────────────────────────────────
router.post('/:chatId/make-admin', protect, makeGroupAdmin);
router.post('/:chatId/remove-admin', protect, removeGroupAdmin);

// ─── Group deletion and member listing (workspace groups) ──────────
router.delete('/group/:chatId', protect, deleteGroupChat);
router.get('/group/:chatId/members', protect, getGroupMembers);

// ─── Archiving and exiting (chat level) ─────────────────────────────
router.post('/:chatId/archive', protect, archiveChat);
router.post('/:chatId/unarchive', protect, unarchiveChat);
router.post('/:chatId/exit', protect, exitGroupChat);

// ─── Chat messages ────────────────────────────────────────────────────
router.get('/:chatId', protect, getChatMessages);
router.post('/:chatId', protect, upload.single('media'), sendMessage);
router.delete('/:messageId', protect, deleteMessage);

// ─── Message archive/star ─────────────────────────────────────────────
router.post('/:messageId/archive', protect, archiveMessage);
router.post('/:messageId/unarchive', protect, unarchiveMessage);
router.post('/:messageId/star', protect, starMessage);
router.post('/:messageId/unstar', protect, unstarMessage);

// ─── Typing indicators ───────────────────────────────────────────────
router.post('/:chatId/typing', protect, startTyping);
router.delete('/:chatId/typing', protect, stopTyping);
router.get('/:chatId/typing', protect, getTypingUsers);

// ─── Read receipts ────────────────────────────────────────────────────
router.post('/:chatId/read', protect, markChatAsRead);

// ─── Participant management ──────────────────────────────────────────
router.post('/:chatId/participants', protect, addParticipant);
router.delete('/:chatId/participants/:userId', protect, removeParticipant);

// ─── Error handling for multer ──────────────────────────────────────
router.use((err, req, res, next) => {
  console.error('MIDDLEWARE ERROR:', err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }
  next(err);
});

export default router;