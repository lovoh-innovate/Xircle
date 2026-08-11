// routes/appRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import { r2Client, R2_BUCKET_NAME } from '../config/r2.js';
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

// ─── Multer S3 (R2) storage ──────────────────────────────────────────
const appStorage = multerS3({
  s3: r2Client,
  bucket: R2_BUCKET_NAME,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const version = req.body.version || Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `app-versions/xircle-v${version}-${Date.now()}${ext}`);
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
      console.error('❌ Multer/R2 upload error:', err);
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