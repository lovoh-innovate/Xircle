// routes/stickerRoutes.js
import express from 'express';
import {
  createSticker,
  sendSticker,
  saveSticker,
  unsaveSticker,
  getSavedStickers,
  getStickers,
  deleteSticker,
} from '../controllers/stickerController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import multer from 'multer';

const router = express.Router();

// ─── Sticker creation (with file upload) ────────────────────────────
router.post('/', protect, upload.single('stickerFile'), createSticker);

// ─── Send sticker as message ────────────────────────────────────────
router.post('/send', protect, sendSticker);

// ─── Save/unsave sticker to collection ─────────────────────────────
router.post('/:stickerId/save', protect, saveSticker);
router.post('/:stickerId/unsave', protect, unsaveSticker);

// ─── Get stickers ────────────────────────────────────────────────────
router.get('/saved', protect, getSavedStickers);
router.get('/', protect, getStickers); // with query ?tag=...

// ─── Delete sticker ──────────────────────────────────────────────────
router.delete('/:stickerId', protect, deleteSticker);

// ─── Multer error handling (optional, can reuse from main router) ──

export default router;