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

// ═════════════════════════════════════════════════════════════════════════
// RULE: every STATIC path must be declared BEFORE any dynamic /:id path.
// Otherwise the dynamic one captures the static literal as its id.
// ═════════════════════════════════════════════════════════════════════════

// ─── Preferences ──────────────────────────────────────────────────────────
router.get('/preferences', getNotificationPreferences);
router.put('/preferences/email', updateEmailNotifications);
router.put('/preferences/push', updatePushNotifications);

// ─── Device token registration ───────────────────────────────────────────
router.post('/register/web', registerPushSubscription);
router.post('/register/mobile', registerMobileToken);

// ─── Device token management ─────────────────────────────────────────────
// More specific segments first — /device/:token is fine on its own because
// nothing else starts with /device, but keeping the ordering habit here too.
router.delete('/device/:token', deleteDeviceToken);

// ─── Test endpoints ──────────────────────────────────────────────────────
router.post('/test/push', sendTestPush);
router.post('/test/email', sendTestEmail);

// ─── VAPID public key ────────────────────────────────────────────────────
router.get('/vapid-public-key', getVapidPublicKey);

// ─── In-app notifications ───────────────────────────────────────────────
router.get('/', getUserNotifications);

// Static actions FIRST:
router.put('/read-all', markAllNotificationsRead);   // ⬅ must be before /:id/read
router.delete('/clear-all', clearAllNotifications);  // ⬅ must be before /:id

// Dynamic parameterised routes LAST:
router.put('/:id/read', markNotificationRead);
router.delete('/:id', deleteNotification);

export default router;