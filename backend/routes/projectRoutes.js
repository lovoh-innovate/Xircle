// routes/projectRoutes.js
import express from 'express';
import jwt from 'jsonwebtoken';
import {
  // CRUD
  createProject,
  getWorkspaceProjects,
  getMyAssociateProjects,     // renamed from getMyCollaboratedProjects
  getProject,                 // unified (project ID | public share token)
  getProjectTasks,
  getTask,
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
  // Public share link (token-based, read-only)
  enableProjectShareLink,
  disableProjectShareLink,
  // Associates (workspace-level limited collaborators)
  addAssociate,
  getAssociates,
  updateAssociate,
  removeAssociate,
} from '../controllers/projectController.js';
import User from '../models/userModel.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// ═════════════════════════════════════════════════════════════════════
// optionalAuth — inline middleware
//
// Populates req.user when a valid JWT is present, but NEVER blocks.
// Lets a single endpoint serve:
//   - workspace members / associates (via project ID, with JWT)
//   - anonymous visitors (via public share token, no JWT)
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
// STATIC ROUTES — must be declared BEFORE '/:identifier' so they aren't
// shadowed by the generic matcher.
// ═════════════════════════════════════════════════════════════════════

// ── My associate projects (limited-access projects I'm on) ──
router.get('/associating', protect, getMyAssociateProjects);

// ── Workspace-scoped project list ──
router.get('/workspace/:workspaceId', protect, getWorkspaceProjects);

// ═════════════════════════════════════════════════════════════════════
// CREATE PROJECT
// ═════════════════════════════════════════════════════════════════════
router.post(
  '/',
  protect,
  upload.fields([
    { name: 'documents', maxCount: 10 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  createProject
);

// ═════════════════════════════════════════════════════════════════════
// UNIFIED READ ROUTES
//
// `:identifier` accepts any of:
//   • Mongo ObjectId     → workspace mode (auth respected; associates
//                          and members see what they're allowed to see)
//   • public share token → public read-only mode (from /p/:token)
//
// Associates DO NOT use a token — they use the project ObjectId like
// any other workspace member. Their access is scoped by their
// workspace membership (memberType: 'associate') + project.associates.
//
// Response shape is unchanged:
//   { project, viewer, permissions, associate, isFullMember }
// ═════════════════════════════════════════════════════════════════════

router.get('/:identifier', optionalAuth, getProject);
router.get('/:identifier/tasks', optionalAuth, getProjectTasks);
router.get('/:identifier/tasks/:taskId', optionalAuth, getTask);

// ═════════════════════════════════════════════════════════════════════
// UPDATE PROJECT (owner / admin / PM only — enforced in controller)
// ═════════════════════════════════════════════════════════════════════
router.put(
  '/:projectId',
  protect,
  upload.fields([
    { name: 'documents', maxCount: 10 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  updateProject
);

// ═════════════════════════════════════════════════════════════════════
// LIFECYCLE: trash / restore / permanent delete / archive
// ═════════════════════════════════════════════════════════════════════
router.delete('/:projectId', protect, deleteProject);
router.patch('/:projectId/restore', protect, restoreProject);
router.delete('/:projectId/permanent', protect, permanentlyDeleteProject);

router.patch('/:projectId/archive', protect, archiveProject);
router.patch('/:projectId/unarchive', protect, unarchiveProject);

// ═════════════════════════════════════════════════════════════════════
// COMPLETION & MANAGEMENT
// ═════════════════════════════════════════════════════════════════════
router.patch('/:projectId/confirm-completion', protect, confirmProjectCompletion);
router.patch('/:projectId/managers', protect, manageProjectManagers);

// ── Team management ──
router.post('/:projectId/team', protect, addTeamMember);
router.delete('/:projectId/team/:memberId', protect, removeTeamMember);
router.get('/:projectId/team', protect, getProjectTeamWithTasks);

// ── DM & stats ──
router.get('/:projectId/dm/:userId', protect, getTeamMemberDM);
router.get('/:projectId/stats', protect, getProjectStats);

// ═════════════════════════════════════════════════════════════════════
// PUBLIC SHARE LINK  (token-based, read-only)
//
// The ONLY token-based project access path. Associates don't use this.
// ═════════════════════════════════════════════════════════════════════
router.post('/:projectId/share-link', protect, enableProjectShareLink);
router.delete('/:projectId/share-link', protect, disableProjectShareLink);

// ═════════════════════════════════════════════════════════════════════
// ASSOCIATE MANAGEMENT  (owner / admin / PM only — enforced in controller)
//
// Associates are workspace-level limited collaborators added directly
// from a project. They don't use invite tokens. When they accept, they
// become workspace members with memberType: 'associate' and gain scoped
// access to this project.
//
// Role can be: 'viewer' | 'editor' | 'projectManager'
//   - 'projectManager' also adds them to the projectManagers array and
//     gives them full PM powers on this project.
//
// `accessExpiresAt` is optional — omit to grant indefinite access.
// ═════════════════════════════════════════════════════════════════════
router.get('/:projectId/associates', protect, getAssociates);
router.post('/:projectId/associates', protect, addAssociate);
router.patch('/:projectId/associates/:associateId', protect, updateAssociate);
router.delete('/:projectId/associates/:associateId', protect, removeAssociate);

export default router;