// routes/taskRoutes.js
import express from 'express';
import {
  createTask,
  getProjectTasks,
  getMyTasks,
  getTaskById,
  updateTask,
  deleteTask,
  updateTaskProgress,
  reviewTaskProgress,
  submitDailyReport,
  reassignTask,
  updateTaskStage,
  approveTaskCompletion,
  addComment,
  getTaskFeedback,
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

// ── Assignee: submit progress (with optional attachments) ──
router.patch(
  '/:taskId/progress',
  protect,
  upload.fields([{ name: 'attachments', maxCount: 10 }]), // <-- ADDED
  updateTaskProgress
);

// ── Owner/PM: approve or reject submitted progress ──
router.patch('/:taskId/review', protect, reviewTaskProgress);

// ── Assignee: daily check-in (one per day, upserts) ──
router.post(
  '/:taskId/daily-report',
  protect,
  upload.fields([{ name: 'attachments', maxCount: 10 }]), // optional, for consistency
  submitDailyReport
);

// ── Management actions ──
router.patch('/:taskId/reassign', protect, reassignTask);
router.patch('/:taskId/stage', protect, updateTaskStage);
router.patch('/:taskId/approve', protect, approveTaskCompletion);

// ── Comments & feedback history ──
router.post('/:taskId/comments', protect, addComment);
router.get('/:taskId/feedback', protect, getTaskFeedback);

export default router;