// middleware/uploadMiddleware.js
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../utils/cloudinary.js';

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isAudio = file.mimetype.startsWith('audio/');
    const isVideo = file.mimetype.startsWith('video/');
    
    let resource_type = 'auto';
    if (isAudio || isVideo) {
      resource_type = 'video'; // Cloudinary requires 'video' for audio/video
    } else if (file.mimetype.startsWith('image/')) {
      resource_type = 'image';
    } else {
      resource_type = 'raw'; // Documents, etc.
    }
    
    return {
      folder: 'chat-media',
      resource_type: resource_type,
    };
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Comprehensive allowed mime types
    const allowedMimes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
      
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'text/plain', // .txt
      'text/csv', // .csv
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      
      // Videos
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm',
      
      // Audio (for voice notes)
      'audio/mpeg',      // mp3
      'audio/mp4',       // m4a
      'audio/x-m4a',     // m4a
      'audio/wav',       // wav
      'audio/aac',       // aac
      'audio/ogg',       // ogg
      'audio/webm',      // webm audio
      'audio/amr',       // amr (common for voice notes)
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log('❌ Rejected file type:', file.mimetype);
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

export default upload;