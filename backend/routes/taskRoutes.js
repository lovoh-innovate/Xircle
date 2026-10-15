// routes/taskRoutes.js
import express from 'express';
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

const router = express.Router();

// ── All urgent tasks (must be above /:taskId) ──
router.get('/all-urgent', protect, getAllUrgentTasks);

// ── My tasks (assigned to the user) ──
router.get('/my-tasks', protect, getMyTasks);

// ── Folder management (project‑scoped) ──
router.get('/project/:projectId/folders', protect, getProjectFolders);
router.post('/folders', protect, createFolder);
router.put('/folders/:folderId', protect, updateFolder);
router.delete('/folders/:folderId', protect, deleteFolder);

// ── Folder read‑only access management ──
router.post('/folders/:folderId/read-only', protect, addFolderReadOnly);
router.delete('/folders/:folderId/read-only', protect, removeFolderReadOnly);

// ── Task reordering (project‑scoped, must be above /:taskId) ──
router.patch('/project/:projectId/reorder', protect, reorderTasks);

// ── Task CRUD ──
router.post(
  '/',
  protect,
  upload.fields([{ name: 'attachments', maxCount: 10 }]),
  createTask
);
router.get('/project/:projectId', protect, getProjectTasks);
router.get('/:taskId', protect, getTaskById);
router.put(
  '/:taskId',
  protect,
  upload.fields([{ name: 'attachments', maxCount: 10 }]),
  updateTask
);

// ── Copy / Move tasks ──
router.post('/:taskId/copy', protect, copyTask);
router.patch('/:taskId/move', protect, moveTask);

// ── Archive / Trash / Permanent delete ──
router.patch('/:taskId/archive', protect, archiveTask);
router.patch('/:taskId/restore', protect, restoreTask);
router.delete('/:taskId', protect, deleteTask);
router.delete('/:taskId/permanent', protect, permanentlyDeleteTask);

// ── Assign / Unassign task (PM/Owner only — enforced in controller) ──
router.patch('/:taskId/assign', protect, assignTask);

// ── Sub‑task endpoints ──
router.post(
  '/:taskId/subtasks',
  protect,
  upload.fields([{ name: 'attachments', maxCount: 10 }]),
  addSubTask
);
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

// ── Sub‑task reordering ──
router.patch('/:taskId/subtasks/reorder', protect, reorderSubTasks);

// ── Main task completion flow ──
// markTaskCompleted is the endpoint collaborators use when they're the
// task's assignee — the controller allows it via resolveTaskAccess.
router.patch(
  '/:taskId/complete',
  protect,
  upload.fields([{ name: 'completionAttachments', maxCount: 10 }]),
  markTaskCompleted
);

// Confirm completion (approve)
router.patch(
  '/:taskId/confirm-completion',
  protect,
  upload.none(),
  confirmTaskCompletion
);

// ── Reject task completion ──
router.post('/:taskId/reject', protect, rejectTask);

// ── Reminder endpoints ──
router.post('/reminders', protect, sendTaskReminders);
router.post('/:taskId/remind', protect, sendManualReminder);

// ── Comments & feedback history ──
// Collaborators (editors) can comment ONLY on tasks they're assigned to —
// enforced inside addComment via resolveTaskAccess.canComment.
router.post('/:taskId/comments', protect, addComment);
router.get('/:taskId/feedback', protect, getTaskFeedback);

export default router;