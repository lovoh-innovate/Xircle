// routes/notificationRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getNotificationPreferences,
  updateEmailNotifications,
  updatePushNotifications,
  registerPushSubscription,
  registerMobileToken,
  sendTestPush,
  sendTestEmail,
  getVapidPublicKey,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Preferences
router.get('/preferences', getNotificationPreferences);
router.put('/preferences/email', updateEmailNotifications);
router.put('/preferences/push', updatePushNotifications);

// Device token registration
router.post('/register/web', registerPushSubscription);
router.post('/register/mobile', registerMobileToken);

// Test endpoints
router.post('/test/push', sendTestPush);
router.post('/test/email', sendTestEmail);

// VAPID public key
router.get('/vapid-public-key', getVapidPublicKey);

// In-app notifications
router.get('/', getUserNotifications);
router.put('/read-all', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);

export default router;