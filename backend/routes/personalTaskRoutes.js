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
  permanentlyDeletePersonalTask,
  reorderPersonalTasks,
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

// IMPORTANT: this must come before `/:taskId` — otherwise Express treats
// "reorder" as a :taskId value and routes it into updatePersonalTask/PUT
// instead (which doesn't exist for PATCH anyway, but the ordering still
// matters for any future PATCH added under /:taskId).
router.patch('/reorder', reorderPersonalTasks);

router.put('/:taskId', updatePersonalTask);

// ── Archive / Restore / Trash ────────────────────────────────────
router.patch('/:taskId/archive', archivePersonalTask);
router.patch('/:taskId/restore', restorePersonalTask);
router.delete('/:taskId', deletePersonalTask);            // soft‑delete → trash
router.delete('/:taskId/permanent', permanentlyDeletePersonalTask);

// ── Personal Sub‑tasks ────────────────────────────────────────────
router.post('/:taskId/subtasks', protect, addPersonalSubTask);
router.put('/:taskId/subtasks/:subTaskIndex', protect, updatePersonalSubTask);
router.patch('/:taskId/subtasks/:subTaskIndex/toggle', protect, togglePersonalSubTask);
router.delete('/:taskId/subtasks/:subTaskIndex', protect, deletePersonalSubTask);
router.patch('/:taskId/subtasks/reorder', protect, reorderPersonalSubTasks);

export default router;