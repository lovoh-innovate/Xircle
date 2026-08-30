import express from 'express';
import {
  // Folder management
  createPersonalFolder,
  getPersonalFolders,
  updatePersonalFolder,
  deletePersonalFolder,
  // Personal task CRUD
  createPersonalTask,
  getPersonalTasks,
  updatePersonalTask,
  archivePersonalTask,
  restorePersonalTask,
  deletePersonalTask,
  // Personal sub‑task endpoints
  addPersonalSubTask,
  updatePersonalSubTask,
  togglePersonalSubTask,
  deletePersonalSubTask,
  reorderPersonalSubTasks,
} from '../controllers/personalTaskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ── Personal Folders ──────────────────────────────────────────────
router.get('/folders', getPersonalFolders);
router.post('/folders', createPersonalFolder);
router.put('/folders/:folderId', updatePersonalFolder);
router.delete('/folders/:folderId', deletePersonalFolder);

// ── Personal Tasks ────────────────────────────────────────────────
router.get('/', getPersonalTasks);                       // supports ?folderId, ?status, ?priority, ?archived
router.post('/', createPersonalTask);
router.put('/:taskId', updatePersonalTask);

// ── Archive / Restore / Trash ────────────────────────────────────
router.patch('/:taskId/archive', archivePersonalTask);
router.patch('/:taskId/restore', restorePersonalTask);
router.delete('/:taskId', deletePersonalTask);            // soft‑delete → trash

// ── Personal Sub‑tasks ────────────────────────────────────────────
router.post('/:taskId/subtasks', protect, addPersonalSubTask);
router.put('/:taskId/subtasks/:subTaskIndex', protect, updatePersonalSubTask);
router.patch('/:taskId/subtasks/:subTaskIndex/toggle', protect, togglePersonalSubTask);
router.delete('/:taskId/subtasks/:subTaskIndex', protect, deletePersonalSubTask);
router.patch('/:taskId/subtasks/reorder', protect, reorderPersonalSubTasks);

export default router;