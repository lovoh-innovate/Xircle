// routes/projectRoutes.js
import express from 'express';
import jwt from 'jsonwebtoken';
import {
  createProject,
  getWorkspaceProjects,
  getMyCollaboratedProjects,      // 👈 NEW
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
  restoreProject,
  permanentlyDeleteProject,
  archiveProject,
  unarchiveProject,
  // ── NEW: Collaborator management ──
  enableProjectShareLink,
  disableProjectShareLink,
  addCollaborator,
  getCollaborators,
  updateCollaborator,
  removeCollaborator,
  regenerateCollaboratorToken,
  // ── NEW: Public (token-scoped) reads ──
  getPublicProjectByToken,
  getPublicProjectTasks,
  getPublicTaskById,
} from '../controllers/projectController.js';
import User from '../models/userModel.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// ═════════════════════════════════════════════════════════════════════
// optionalAuth — inline middleware for public token routes
//
// Populates req.user when a valid JWT is present, but NEVER blocks the
// request. This lets a single endpoint serve both anonymous visitors
// (public read-only view) and logged-in users (linked collaborator).
// ═════════════════════════════════════════════════════════════════════
const optionalAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies?.jwt || req.headers.authorization?.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id;   // tolerate either shape
    if (!userId) return next();

    const user = await User.findById(userId).select('-password');
    if (user) req.user = user;
  } catch {
    // Silent — proceed as anonymous
  }
  next();
};

// ═════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES — must be declared BEFORE '/:projectId' so they aren't
// shadowed by the generic id matcher.
// ═════════════════════════════════════════════════════════════════════

router.get('/public/:token', optionalAuth, getPublicProjectByToken);
router.get('/public/:token/tasks', optionalAuth, getPublicProjectTasks);
router.get('/public/:token/tasks/:taskId', optionalAuth, getPublicTaskById);

// ═════════════════════════════════════════════════════════════════════
// MY COLLABORATED PROJECTS — also must be above '/:projectId'
// ═════════════════════════════════════════════════════════════════════

router.get('/collaborating', protect, getMyCollaboratedProjects);

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

// ── Soft‑delete (trash) ──
router.delete('/:projectId', protect, deleteProject);

// ── Restore from trash ──
router.patch('/:projectId/restore', protect, restoreProject);

// ── Permanent delete ──
router.delete('/:projectId/permanent', protect, permanentlyDeleteProject);

// ── Personal archive / unarchive ──
router.patch('/:projectId/archive', protect, archiveProject);
router.patch('/:projectId/unarchive', protect, unarchiveProject);

// ── Confirm project completion ──
router.patch('/:projectId/confirm-completion', protect, confirmProjectCompletion);

// ── Managers ──
router.patch('/:projectId/managers', protect, manageProjectManagers);

// ── Team management ──
router.post('/:projectId/team', protect, addTeamMember);
router.delete('/:projectId/team/:memberId', protect, removeTeamMember);
router.get('/:projectId/team', protect, getProjectTeamWithTasks);

// ── DM & stats ──
router.get('/:projectId/dm/:userId', protect, getTeamMemberDM);
router.get('/:projectId/stats', protect, getProjectStats);

// ═════════════════════════════════════════════════════════════════════
// GUEST / COLLABORATOR MANAGEMENT  (owner / admin / PM only)
// ═════════════════════════════════════════════════════════════════════

// ── Project-wide read-only share link ──
router.post('/:projectId/share-link', protect, enableProjectShareLink);
router.delete('/:projectId/share-link', protect, disableProjectShareLink);

// ── Collaborator CRUD ──
router.get('/:projectId/collaborators', protect, getCollaborators);
router.post('/:projectId/collaborators', protect, addCollaborator);
router.patch('/:projectId/collaborators/:collabId', protect, updateCollaborator);
router.delete('/:projectId/collaborators/:collabId', protect, removeCollaborator);

// ── Regenerate a collaborator's invite token (rotate the link) ──
router.post(
  '/:projectId/collaborators/:collabId/regenerate',
  protect,
  regenerateCollaboratorToken
);

export default router;