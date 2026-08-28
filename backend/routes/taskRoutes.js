import express from 'express';
import {
  // Existing
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
  // Copy / Move / Archive / Restore / Permanent delete
  copyTask,
  moveTask,
  archiveTask,
  restoreTask,
  permanentlyDeleteTask,
  // Folder management
  createFolder,
  updateFolder,
  deleteFolder,
  getProjectFolders,
  // Folder read‑only access
  addFolderReadOnly,
  removeFolderReadOnly,
  // Reorder endpoints
  reorderTasks,
  reorderSubTasks,
  // Urgent tasks
  getAllUrgentTasks,
  // Personal sub‑tasks
  addPersonalSubTask,
  updatePersonalSubTask,
  togglePersonalSubTask,
  deletePersonalSubTask,
  reorderPersonalSubTasks,
} from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// ── All urgent tasks (must be above /:taskId) ──
router.get('/all-urgent', protect, getAllUrgentTasks);

// ── Personal tasks (already above /:taskId) ──
router.get('/my-tasks', protect, getMyTasks);

// ── Personal sub‑task endpoints (NEW — must be above /:taskId) ──
router.post('/personal/:taskId/subtasks', protect, addPersonalSubTask);
router.put('/personal/:taskId/subtasks/:subTaskIndex', protect, updatePersonalSubTask);
router.patch('/personal/:taskId/subtasks/:subTaskIndex/toggle', protect, togglePersonalSubTask);
router.delete('/personal/:taskId/subtasks/:subTaskIndex', protect, deletePersonalSubTask);
router.patch('/personal/:taskId/subtasks/reorder', protect, reorderPersonalSubTasks);

// ── Folder management (project‑scoped) ──
router.get('/project/:projectId/folders', protect, getProjectFolders);
router.post('/folders', protect, createFolder);               // expects { projectId, name }
router.put('/folders/:folderId', protect, updateFolder);
router.delete('/folders/:folderId', protect, deleteFolder);

// ── Folder read‑only access management ──
router.post('/folders/:folderId/read-only', protect, addFolderReadOnly);   // body: { users: [userId] }
router.delete('/folders/:folderId/read-only', protect, removeFolderReadOnly); // body: { users: [userId] }

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
router.post('/:taskId/copy', protect, copyTask);          // body: { targetFolderId }
router.patch('/:taskId/move', protect, moveTask);         // body: { targetFolderId }

// ── Archive / Trash / Permanent delete ──
router.patch('/:taskId/archive', protect, archiveTask);    // personal archive
router.patch('/:taskId/restore', protect, restoreTask);    // restore from trash/archive
router.delete('/:taskId', protect, deleteTask);             // soft‑delete (trash)
router.delete('/:taskId/permanent', protect, permanentlyDeleteTask); // hard delete

// ── Assign / Unassign task (PM/Owner only) ──
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

// ── Sub‑task reordering (specific to a task) ──
router.patch('/:taskId/subtasks/reorder', protect, reorderSubTasks);

// ── Main task completion flow ──
// ✅ FIX: added upload middleware to parse multipart form data with completion attachments
router.patch(
  '/:taskId/complete',
  protect,
  upload.fields([{ name: 'completionAttachments', maxCount: 10 }]),
  markTaskCompleted
);
router.patch('/:taskId/confirm-completion', protect, confirmTaskCompletion);

// ── NEW: Reject task completion (manager/owner) ──
router.post('/:taskId/reject', protect, rejectTask);  // body: { reason }

// ── Reminder endpoints ──
router.post('/reminders', protect, sendTaskReminders);
router.post('/:taskId/remind', protect, sendManualReminder);

// ── Comments & feedback history ──
router.post('/:taskId/comments', protect, addComment);
router.get('/:taskId/feedback', protect, getTaskFeedback);

export default router;