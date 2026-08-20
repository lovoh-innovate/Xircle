// routes/workspaceRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createWorkspace,
  getMyWorkspaces,
  getWorkspace,
  getWorkspaceByInviteCode,  // 👈 new import
  updateWorkspace,
  deleteWorkspace,
  leaveWorkspace,
  removeMember,
  regenerateInviteCode,
  migrateWorkspaces,
  updateMemberRole,
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

// ─── Public Routes ─────────────────────────────────────────────────────────
// Preview workspace by invite code – no authentication required
router.get('/by-code/:inviteCode', getWorkspaceByInviteCode);

// ─── Protected Routes ─────────────────────────────────────────────────────
// Create workspace with optional logo upload
router.post('/', protect, upload.single('logo'), createWorkspace);

router.get('/my', protect, getMyWorkspaces);
router.get('/:id', protect, getWorkspace);

// Update workspace with optional logo upload
router.put('/:id', protect, upload.single('logo'), updateWorkspace);

router.delete('/:id', protect, deleteWorkspace);
router.post('/:id/leave', protect, leaveWorkspace);
router.delete('/:id/members/:memberId', protect, removeMember);
router.patch('/:id/invite-code', protect, regenerateInviteCode);

// ─── NEW: Update member role (Owner only) ──────────────────────────────
router.patch('/:id/members/:memberId/role', protect, updateMemberRole);

router.post('/migrate', protect, migrateWorkspaces);

export default router;