// routes/appRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

// ─── Ensure upload directory exists ──────────────────────────────────
const uploadDir = 'uploads/app-versions';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ─── Multer disk storage ──────────────────────────────────────────────
const appStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const version = req.body.version || Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `xircle-v${version}-${Date.now()}${ext}`);
  },
});

const uploadAppFile = multer({
  storage: appStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.apk' || ext === '.aab') {
      cb(null, true);
    } else {
      cb(new Error('Only APK and AAB files are allowed'), false);
    }
  },
});

// ─── Wrapper to catch multer errors ──────────────────────────────────
const handleAppUpload = (req, res, next) => {
  uploadAppFile.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ Multer upload error:', err);
      return res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: err.message,
      });
    }
    next();
  });
};

// ─── Public routes (no authentication required) ─────────────────────
router.get('/version', getAppVersion);
router.get('/version/:versionId', getAppVersionById);
router.get('/download/:versionId', downloadApp);
router.post('/update-version', updateUserAppVersion);

// ─── Admin routes (authentication required) ─────────────────────────
router.use(protect);

router.post('/admin/upload', handleAppUpload, uploadApp);
router.put('/admin/update/:versionId', updateApp);
router.delete('/admin/delete/:versionId', deleteApp);
router.get('/admin/versions', getAppVersions);

export default router;