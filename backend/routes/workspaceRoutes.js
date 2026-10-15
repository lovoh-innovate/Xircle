// routes/workspaceRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createWorkspace,
  getMyWorkspaces,
  getWorkspace,
  getWorkspaceByInviteCode,
  updateWorkspace,
  deleteWorkspace,
  leaveWorkspace,
  removeMember,
  regenerateInviteCode,
  migrateWorkspaces,
  updateMemberRole,

  // ── Associate listing (read-only) ──
  getWorkspaceAssociates,
} from '../controllers/workspaceController.js';

import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const router = express.Router();

// ── Cloudinary config ──────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// ── Multer storage for workspace logos ───────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'Xircle_WorkspaceLogos',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'avif'],
    transformation: [{ width: 300, height: 300, crop: 'limit' }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Preview workspace by invite code — no auth required.
// Invite codes are for permanent members only.
router.get('/by-code/:inviteCode', getWorkspaceByInviteCode);

// ═══════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTES
//
// Order matters — declare static paths ('/my', '/migrate') before the
// generic '/:id' matcher so they don't get shadowed.
// ═══════════════════════════════════════════════════════════════════════════

// ── Static ──
router.get('/my', protect, getMyWorkspaces);
router.post('/migrate', protect, migrateWorkspaces);

// ── Create ──
router.post('/', protect, upload.single('logo'), createWorkspace);

// ── Read ──
router.get('/:id', protect, getWorkspace);

// ── Update (logo optional) ──
router.put('/:id', protect, upload.single('logo'), updateWorkspace);

// ── Lifecycle ──
router.delete('/:id', protect, deleteWorkspace);
router.post('/:id/leave', protect, leaveWorkspace);

// ── Member management ──
router.delete('/:id/members/:memberId', protect, removeMember);
router.patch('/:id/members/:memberId/role', protect, updateMemberRole);

// ── Invite code ──
router.patch('/:id/invite-code', protect, regenerateInviteCode);

// ═══════════════════════════════════════════════════════════════════════════
// ASSOCIATES  (read-only listing)
//
// The full associate management surface lives in teamRoutes:
//   GET    /api/team/:workspaceId/associates
//   PATCH  /api/team/:workspaceId/associate/:memberId
//   DELETE /api/team/:workspaceId/associate/:memberId
//   PATCH  /api/team/:workspaceId/associate/:memberId/promote
//
// This one exists so the workspace-level UI can fetch associates without
// hitting a team-scoped route.
// ═══════════════════════════════════════════════════════════════════════════
router.get('/:id/associates', protect, getWorkspaceAssociates);

export default router;