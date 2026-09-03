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
  // Collaboration endpoints
  addCollaborator,
  getPendingInvitations,
  acceptInvitationWithToken,
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

// IMPORTANT: reorder must come before `/:taskId` to avoid being matched as a task ID
router.patch('/reorder', reorderPersonalTasks);

router.put('/:taskId', updatePersonalTask);

// ── Archive / Restore / Trash ────────────────────────────────────
router.patch('/:taskId/archive', archivePersonalTask);
router.patch('/:taskId/restore', restorePersonalTask);
router.delete('/:taskId', deletePersonalTask);            // soft‑delete → trash
router.delete('/:taskId/permanent', permanentlyDeletePersonalTask);

// ── Collaboration ──────────────────────────────────────────────────
// Add a collaborator to a specific task (owner only)
router.post('/:taskId/collaborators', addCollaborator);

// Get pending invitations for the current user
router.get('/collaborators/pending', getPendingInvitations);

// Accept an invitation using the token from email
router.post('/collaborators/accept-token', acceptInvitationWithToken);

// ── Personal Sub‑tasks ────────────────────────────────────────────
router.post('/:taskId/subtasks', addPersonalSubTask);
router.put('/:taskId/subtasks/:subTaskIndex', updatePersonalSubTask);
router.patch('/:taskId/subtasks/:subTaskIndex/toggle', togglePersonalSubTask);
router.delete('/:taskId/subtasks/:subTaskIndex', deletePersonalSubTask);
router.patch('/:taskId/subtasks/reorder', reorderPersonalSubTasks);

export default router;