// routes/appRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { appUpload } from '../middleware/uploadMiddleware.js';
import {
  getAppVersion,
  getAppVersionById,
  downloadApp,
  updateUserAppVersion,
  uploadApp,
  updateApp,
  deleteApp,
  getAppVersions,
} from '../controllers/appController.js';

const router = express.Router();

// ─── Public Routes ────────────────────────────────────────────────────
// GET /api/app/version?platform=android&currentVersion=1.0.0&token=...
router.get('/version', getAppVersion);

// GET /api/app/version/:versionId
router.get('/version/:versionId', getAppVersionById);

// GET /api/app/download/:versionId?token=...
router.get('/download/:versionId', downloadApp);

// POST /api/app/update-version  (body: { token, version })
router.post('/update-version', updateUserAppVersion);

// ─── Admin Routes (require authentication) ──────────────────────────
// POST /api/app/admin/upload  (multipart form-data with field "file")
router.post('/admin/upload', protect, appUpload.single('file'), uploadApp);

// PUT /api/app/admin/update/:versionId  (body: { version, releaseNotes, isRequired, isActive })
router.put('/admin/update/:versionId', protect, updateApp);

// DELETE /api/app/admin/delete/:versionId
router.delete('/admin/delete/:versionId', protect, deleteApp);

// GET /api/app/admin/versions?platform=android
router.get('/admin/versions', protect, getAppVersions);

export default router;