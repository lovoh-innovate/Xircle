// routes/userRoutes.js
import express from 'express';
import {
  googleAuth,
  registerUser,
  verifyEmail,
  resendOTP,
  loginUser,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  getUsers,
  getUserById,
  logoutUser,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
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

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'Xircle_ProfilePictures',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'avif'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// ═════════════════════════════════════════════════════════════════════
// Public routes — no authentication required
//
// NOTE: registerUser / verifyEmail / loginUser / googleAuth all call
// linkPendingCollaboratorInvites() internally. This auto-links any
// pending collaborator invitations that match the user's email, so
// guests who sign up with their invited email gain access without
// any frontend cooperation.
// ═════════════════════════════════════════════════════════════════════
router.post('/google', googleAuth);
router.post('/register', registerUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOTP);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logoutUser);

// ═════════════════════════════════════════════════════════════════════
// Protected routes — authentication required
// ═════════════════════════════════════════════════════════════════════
router.put('/profile', protect, upload.single('profile'), updateProfile);
router.post('/change-password', protect, changePassword);
router.get('/:id', protect, getUserById);
router.get('/', protect, getUsers); // Frontend will check role

// ── Debug route (remove in production) ──
router.post('/test', (req, res) => {
  console.log('✅ Test route hit!');
  console.log('Body:', req.body);
  res.json({ message: 'Test route works!' });
});

export default router;