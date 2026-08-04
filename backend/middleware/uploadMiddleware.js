// middleware/uploadMiddleware.js
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../utils/cloudinary.js';
import path from 'path';

// ─── Storage for chat/media files (Cloudinary) ──────────────────────
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isAudio = file.mimetype.startsWith('audio/');
    const isVideo = file.mimetype.startsWith('video/');

    let resource_type = 'auto';
    if (isAudio || isVideo) {
      resource_type = 'video';
    } else if (file.mimetype.startsWith('image/')) {
      resource_type = 'image';
    } else {
      resource_type = 'raw';
    }

    return {
      folder: 'chat-media',
      resource_type: resource_type,
    };
  }
});

// ─── Storage for app version files (Cloudinary) ─────────────────────
// NOTE: using resource_type 'video' instead of 'raw' — Cloudinary's free/basic
// plan caps 'raw' uploads at 10MB, but 'video' allows much larger binaries
// (100MB+ on free plan). Cloudinary doesn't actually validate the bytes are
// real video for this resource_type, so APK/AAB files upload fine.
const appStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const version = req.body.version || Date.now();
    const ext = path.extname(file.originalname).toLowerCase(); // .apk or .aab

    return {
      folder: 'app-versions',
      resource_type: 'video',
      public_id: `app-${version}-${Date.now()}${ext}`,
    };
  }
});

// ─── Multer instances ──────────────────────────────────────────────────
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm',
      'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/amr',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log('❌ Rejected file type:', file.mimetype);
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

const appUpload = multer({
  storage: appStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB – adjust as needed
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.apk' || ext === '.aab') {
      cb(null, true);
    } else {
      cb(new Error('Only APK and AAB files are allowed'), false);
    }
  }
});

// ─── Exports ──────────────────────────────────────────────────────────
export default upload;
export { appUpload };