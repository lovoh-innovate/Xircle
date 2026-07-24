// routes/notificationRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  // Preferences
  getNotificationPreferences,
  updateEmailNotifications,
  updatePushNotifications,

  // Device registration
  registerPushSubscription,
  registerMobileToken,
  deleteDeviceToken,

  // Test endpoints
  sendTestPush,
  sendTestEmail,

  // VAPID public key
  getVapidPublicKey,

  // In-app notifications
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
} from '../controllers/notificationController.js';

const router = express.Router();

// ─── All routes require authentication ────────────────────────────────────
router.use(protect);

// ─── Preferences ──────────────────────────────────────────────────────────
router.get('/preferences', getNotificationPreferences);
router.put('/preferences/email', updateEmailNotifications);
router.put('/preferences/push', updatePushNotifications);

// ─── Device token registration ───────────────────────────────────────────
router.post('/register/web', registerPushSubscription);
router.post('/register/mobile', registerMobileToken);

// ─── Device token management ─────────────────────────────────────────────
router.delete('/device/:token', deleteDeviceToken);

// ─── Test endpoints ──────────────────────────────────────────────────────
router.post('/test/push', sendTestPush);
router.post('/test/email', sendTestEmail);

// ─── VAPID public key ────────────────────────────────────────────────────
router.get('/vapid-public-key', getVapidPublicKey);

// ─── In‑app notifications ───────────────────────────────────────────────
// Note: "read-all" must come before "/:id/read" to avoid conflict
router.get('/', getUserNotifications);
router.put('/read-all', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);
router.delete('/:id', deleteNotification);
router.delete('/clear-all', clearAllNotifications);

export default router;