// routes/projectRoutes.js
import express from 'express';
import {
  createProject,
  getWorkspaceProjects,
  getProjectById,
  updateProject,
  confirmProjectCompletion,
  manageProjectManagers,
  addTeamMember,
  removeTeamMember,
  getProjectTeamWithTasks,
  getTeamMemberDM,
  getProjectStats,
  deleteProject,
} from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// ── Project CRUD ──
router.post(
  '/',
  protect,
  upload.fields([
    { name: 'documents', maxCount: 10 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  createProject
);
router.get('/workspace/:workspaceId', protect, getWorkspaceProjects);
router.get('/:projectId', protect, getProjectById);
router.put(
  '/:projectId',
  protect,
  upload.fields([
    { name: 'documents', maxCount: 10 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  updateProject
);
router.delete('/:projectId', protect, deleteProject);

// ── Final step: owner confirms project completion ──
router.patch('/:projectId/confirm-completion', protect, confirmProjectCompletion);

// ── Managers (owner only) ──
router.patch('/:projectId/managers', protect, manageProjectManagers);

// ── Team management ──
router.post('/:projectId/team', protect, addTeamMember);
router.delete('/:projectId/team/:memberId', protect, removeTeamMember);
router.get('/:projectId/team', protect, getProjectTeamWithTasks);

// ── DM & stats ──
router.get('/:projectId/dm/:userId', protect, getTeamMemberDM);
router.get('/:projectId/stats', protect, getProjectStats);

export default router;