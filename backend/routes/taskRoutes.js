// routes/taskRoutes.js
import express from 'express';
import jwt from 'jsonwebtoken';
import {
  createTask,
  getProjectTasks,
  getMyTasks,
  getTaskById,
  updateTask,
  assignTask,
  deleteTask,
  addSubTask,
  updateSubTask,
  markSubTaskDone,
  confirmSubTask,
  rejectSubTask,
  deleteSubTask,
  assignSubTask,
  bulkAssignSubTasks,
  markTaskCompleted,
  confirmTaskCompletion,
  rejectTask,
  addComment,
  getTaskFeedback,
  sendTaskReminders,
  sendManualReminder,
  copyTask,
  moveTask,
  archiveTask,
  restoreTask,
  permanentlyDeleteTask,
  createFolder,
  updateFolder,
  deleteFolder,
  getProjectFolders,
  addFolderReadOnly,
  removeFolderReadOnly,
  reorderTasks,
  reorderSubTasks,
  getAllUrgentTasks,
} from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import User from '../models/userModel.js';

const router = express.Router();

// ═════════════════════════════════════════════════════════════════════
// optionalAuth — mirrors projectRoutes.js
// Populates req.user when a valid JWT is present, never blocks.
// Needed so public viewers can hit read endpoints when the project is
// public-shared.
// ═════════════════════════════════════════════════════════════════════
const optionalAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies?.jwt || req.headers.authorization?.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    if (!userId) return next();

    const user = await User.findById(userId).select('-password');
    if (user) req.user = user;
  } catch {
    // Anonymous — silently continue
  }
  next();
};

// ═════════════════════════════════════════════════════════════════════
// STATIC ROUTES  (must be above any '/:taskId' patterns)
// ═════════════════════════════════════════════════════════════════════

// ── All urgent tasks (across all projects the user has access to) ──
router.get('/all-urgent', protect, getAllUrgentTasks);

// ── Tasks assigned to me ──
router.get('/my-tasks', protect, getMyTasks);

// ── Folder management (project-scoped) ──
// Reads: public-friendly. Writes: strict auth.
router.get('/project/:projectId/folders', optionalAuth, getProjectFolders);
router.post('/folders', protect, createFolder);
router.put('/folders/:folderId', protect, updateFolder);
router.delete('/folders/:folderId', protect, deleteFolder);

// ── Folder read-only access management ──
router.post('/folders/:folderId/read-only', protect, addFolderReadOnly);
router.delete('/folders/:folderId/read-only', protect, removeFolderReadOnly);

// ── Task reordering (project-scoped, managers only) ──
router.patch('/project/:projectId/reorder', protect, reorderTasks);

// ── Task list per project ──
// Public viewers see everything (read-only);
// associates (non-PM) see only tasks assigned to them;
// members/managers see everything.
// Filtering + access checks live inside getProjectTasks.
router.get('/project/:projectId', optionalAuth, getProjectTasks);

// ═════════════════════════════════════════════════════════════════════
// TASK CRUD
// ═════════════════════════════════════════════════════════════════════
router.post(
  '/',
  protect,
  upload.fields([{ name: 'attachments', maxCount: 10 }]),
  createTask
);

// Read: public-friendly for public-shared projects.
router.get('/:taskId', optionalAuth, getTaskById);

router.put(
  '/:taskId',
  protect,
  upload.fields([{ name: 'attachments', maxCount: 10 }]),
  updateTask
);

// ── Copy / Move ──
router.post('/:taskId/copy', protect, copyTask);
router.patch('/:taskId/move', protect, moveTask);

// ── Archive / Trash / Permanent delete ──
router.patch('/:taskId/archive', protect, archiveTask);
router.patch('/:taskId/restore', protect, restoreTask);
router.delete('/:taskId', protect, deleteTask);
router.delete('/:taskId/permanent', protect, permanentlyDeleteTask);

// ── Assign / Reassign whole task ──
router.patch('/:taskId/assign', protect, assignTask);

// ═════════════════════════════════════════════════════════════════════
// SUB-TASK ROUTES
// ═════════════════════════════════════════════════════════════════════
router.patch('/:taskId/subtasks/reorder', protect, reorderSubTasks);
router.post('/:taskId/subtasks/bulk-assign', protect, bulkAssignSubTasks);

router.post(
  '/:taskId/subtasks',
  protect,
  upload.fields([{ name: 'attachments', maxCount: 10 }]),
  addSubTask
);

router.patch('/:taskId/subtasks/:subTaskIndex/assign', protect, assignSubTask);

router.put(
  '/:taskId/subtasks/:subTaskIndex',
  protect,
  upload.fields([{ name: 'attachments', maxCount: 10 }]),
  updateSubTask
);

router.patch(
  '/:taskId/subtasks/:subTaskIndex/done',
  protect,
  upload.fields([{ name: 'attachments', maxCount: 10 }]),
  markSubTaskDone
);

router.patch('/:taskId/subtasks/:subTaskIndex/confirm', protect, confirmSubTask);
router.patch('/:taskId/subtasks/:subTaskIndex/reject', protect, rejectSubTask);
router.delete('/:taskId/subtasks/:subTaskIndex', protect, deleteSubTask);

// ═════════════════════════════════════════════════════════════════════
// MAIN TASK COMPLETION FLOW
// ═════════════════════════════════════════════════════════════════════
router.patch(
  '/:taskId/complete',
  protect,
  upload.fields([{ name: 'completionAttachments', maxCount: 10 }]),
  markTaskCompleted
);

router.patch('/:taskId/confirm-completion', protect, upload.none(), confirmTaskCompletion);
router.post('/:taskId/reject', protect, rejectTask);

// ═════════════════════════════════════════════════════════════════════
// REMINDERS
// ═════════════════════════════════════════════════════════════════════
router.post('/reminders', protect, sendTaskReminders);
router.post('/:taskId/remind', protect, sendManualReminder);

// ═════════════════════════════════════════════════════════════════════
// COMMENTS & FEEDBACK
// ═════════════════════════════════════════════════════════════════════
router.post('/:taskId/comments', protect, addComment);
router.get('/:taskId/feedback', protect, getTaskFeedback);

export default router;