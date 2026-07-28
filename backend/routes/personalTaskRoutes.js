// routes/personalTaskRoutes.js
import express from 'express';
import {
  createPersonalFolder,
  getPersonalFolders,
  updatePersonalFolder,
  deletePersonalFolder,
  createPersonalTask,
  getPersonalTasks,
  updatePersonalTask,
  archivePersonalTask,
  restorePersonalTask,
  deletePersonalTask,
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

export default router;