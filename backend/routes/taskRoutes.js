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
  rejectSubTask, // 👈 new import
  deleteSubTask,
  markTaskCompleted,
  confirmTaskCompletion,
  addComment,
  getTaskFeedback,
  sendTaskReminders,
  sendManualReminder,
} from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// ── Personal view (must stay above /:taskId) ──
router.get('/my-tasks', protect, getMyTasks);

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
router.delete('/:taskId', protect, deleteTask);

// ── Assign / Unassign task (PM/Owner only) ──
router.patch('/:taskId/assign', protect, assignTask);

// ─── SUB‑TASK ENDPOINTS (must come after the task CRUD above) ───
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

router.patch(
  '/:taskId/subtasks/:subTaskIndex/confirm',
  protect,
  confirmSubTask
);

// 👇 Reject sub‑task (PM/Owner only)
router.patch(
  '/:taskId/subtasks/:subTaskIndex/reject',
  protect,
  rejectSubTask
);

router.delete(
  '/:taskId/subtasks/:subTaskIndex',
  protect,
  deleteSubTask
);

// ── Main task completion flow ──
router.patch('/:taskId/complete', protect, markTaskCompleted);
router.patch('/:taskId/confirm-completion', protect, confirmTaskCompletion);

// ── Reminder endpoints ──
router.post('/reminders', protect, sendTaskReminders);
router.post('/:taskId/remind', protect, sendManualReminder);

// ── Comments & feedback history ──
router.post('/:taskId/comments', protect, addComment);
router.get('/:taskId/feedback', protect, getTaskFeedback);

export default router;