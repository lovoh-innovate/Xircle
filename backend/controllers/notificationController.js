// controllers/notificationController.js

import User from '../models/userModel.js';
import Notification from '../models/notificationModel.js';
import webpush from 'web-push';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Resend } from 'resend';

// ─── ENVIRONMENT CHECKS & INITIALISATION ──────────────────────────────────

// 1. Web Push (VAPID)
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
  console.warn('⚠️  VAPID environment variables missing – web push will not work');
} else {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// 2. Firebase Admin SDK (for mobile push)
let firebaseInitialised = false;

if (process.env.FIREBASE_PRIVATE_KEY) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      .replace(/\\n/g, '\n')
      .replace(/^["']|["']$/g, '')
      .trim();

    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    firebaseInitialised = true;
    console.log('✅ Firebase Admin SDK initialised');
  } catch (error) {
    console.error('❌ Firebase initialisation failed:', error.message);
  }
} else {
  console.warn('⚠️  FIREBASE_PRIVATE_KEY not set – mobile push notifications disabled');
}

// 3. Resend (email)
if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  RESEND_API_KEY not set – email notifications disabled');
}
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── HELPERS ──────────────────────────────────────────────────────────────

/**
 * Send a push notification to a user across all active devices.
 * Returns the number of successful deliveries.
 */
export const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findById(userId).select('pushTokens notificationPreferences');
    if (!user) return 0;

    // Global push enabled?
    if (!user.notificationPreferences?.push?.enabled) return 0;

    const tokens = user.pushTokens?.filter(t => t.isActive) || [];
    if (tokens.length === 0) return 0;

    let sentCount = 0;

    for (const tokenRecord of tokens) {
      try {
        if (tokenRecord.deviceType === 'web' && tokenRecord.subscription) {
          await webpush.sendNotification(
            tokenRecord.subscription,
            JSON.stringify({
              title,
              body,
              icon: '/icon.png',
              badge: '/badge.png',
              data,
              vibrate: [200, 100, 200],
              requireInteraction: true,
            })
          );
          sentCount++;
        } else if (['ios', 'android'].includes(tokenRecord.deviceType) && tokenRecord.token) {
          if (firebaseInitialised) {
            const message = {
              notification: { title, body },
              data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
              token: tokenRecord.token,
            };
            await getMessaging().send(message);
            sentCount++;
          }
        }
      } catch (error) {
        console.error(`Push failed for ${tokenRecord.deviceType}:`, error.message);
        // If token is invalid, deactivate it
        if (error.statusCode === 410 || error.statusCode === 404 || error.message?.includes('expired')) {
          tokenRecord.isActive = false;
          await user.save();
        }
      }
    }

    return sentCount;
  } catch (error) {
    console.error('sendPushNotification error:', error);
    return 0;
  }
};

/**
 * Send an email via Resend.
 */
export const sendEmailNotification = async (to, subject, html) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('sendEmailNotification error:', error);
    return false;
  }
};

/**
 * Create an in‑app notification and (optionally) trigger push/email.
 * Returns the created Notification document.
 */
export const createAndSendNotification = async ({
  recipient,
  title,
  body,
  data = {},
  sendPush = true,
  emailEventType = null,
  emailSubject = null,
  emailHtml = null,
}) => {
  try {
    const notification = await Notification.create({
      recipient,
      title,
      body,
      data,
    });

    // Push (fire & forget)
    if (sendPush) {
      sendPushNotification(recipient, title, body, {
        ...data,
        notificationId: notification._id.toString(),
      }).catch(err => console.error('Push delivery failed:', err.message));
    }

    // Email (check preferences first)
    if (emailEventType && emailSubject && emailHtml) {
      const user = await User.findById(recipient).select('email notificationPreferences');
      if (user) {
        const emailPrefs = user.notificationPreferences?.email || {};
        if (emailPrefs[emailEventType] === true) {
          sendEmailNotification(user.email, emailSubject, emailHtml).catch(err =>
            console.error('Email delivery failed:', err.message)
          );
        }
      }
    }

    return notification;
  } catch (error) {
    console.error('createAndSendNotification error:', error);
    throw error;
  }
};

// ─── PREFERENCE ENDPOINTS ──────────────────────────────────────────────────

/**
 * GET /api/notifications/preferences
 * Return the user's full notification preferences.
 */
export const getNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationPreferences email');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Provide defaults if not set
    const defaults = {
      email: {
        newMessage: true,
        taskAssignment: true,
        taskUpdate: true,
        projectUpdate: true,
        teamInvite: true,
        dailyReport: false,
      },
      push: {
        enabled: false,
        newMessage: true,
        taskAssignment: true,
        taskUpdate: true,
        projectUpdate: false,
        teamInvite: true,
        dailyReport: false,
      },
    };

    const preferences = user.notificationPreferences || {};
    // Ensure both email and push exist with defaults
    preferences.email = { ...defaults.email, ...(preferences.email || {}) };
    preferences.push = { ...defaults.push, ...(preferences.push || {}) };

    res.status(200).json({ success: true, data: preferences });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching preferences',
      error: error.message,
    });
  }
};

/**
 * PUT /api/notifications/preferences/email
 * Update email notification preferences.
 */
export const updateEmailNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const allowedFields = [
      'newMessage',
      'taskAssignment',
      'taskUpdate',
      'projectUpdate',
      'teamInvite',
      'dailyReport',
    ];

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.notificationPreferences) user.notificationPreferences = {};
    if (!user.notificationPreferences.email) user.notificationPreferences.email = {};

    // Only update allowed boolean fields
    allowedFields.forEach(field => {
      if (typeof req.body[field] === 'boolean') {
        user.notificationPreferences.email[field] = req.body[field];
      }
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email preferences updated',
      data: user.notificationPreferences.email,
    });
  } catch (error) {
    console.error('Update email notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating email preferences',
      error: error.message,
    });
  }
};

/**
 * PUT /api/notifications/preferences/push
 * Update push notification preferences.
 */
export const updatePushNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const allowedFields = [
      'enabled',
      'newMessage',
      'taskAssignment',
      'taskUpdate',
      'projectUpdate',
      'teamInvite',
      'dailyReport',
    ];

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.notificationPreferences) user.notificationPreferences = {};
    if (!user.notificationPreferences.push) user.notificationPreferences.push = {};

    allowedFields.forEach(field => {
      if (typeof req.body[field] === 'boolean') {
        user.notificationPreferences.push[field] = req.body[field];
      }
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Push preferences updated',
      data: user.notificationPreferences.push,
    });
  } catch (error) {
    console.error('Update push notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating push preferences',
      error: error.message,
    });
  }
};

// ─── DEVICE TOKEN REGISTRATION ─────────────────────────────────────────────

/**
 * POST /api/notifications/register-web
 * Register or update a web push subscription.
 * Body: { subscription, deviceType (optional) }
 */
export const registerPushSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { subscription, deviceType = 'web' } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Valid push subscription with endpoint is required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.pushTokens) user.pushTokens = [];

    const tokenData = {
      token: subscription.endpoint,
      deviceType,
      subscription, // store the full subscription object
      isActive: true,
      lastUsed: new Date(),
    };

    // Upsert
    const existingIndex = user.pushTokens.findIndex(t => t.token === subscription.endpoint);
    if (existingIndex >= 0) {
      user.pushTokens[existingIndex] = { ...user.pushTokens[existingIndex], ...tokenData };
    } else {
      user.pushTokens.push({ ...tokenData, createdAt: new Date() });
    }

    // Auto-enable push if not already
    if (!user.notificationPreferences) user.notificationPreferences = {};
    if (!user.notificationPreferences.push) user.notificationPreferences.push = {};
    user.notificationPreferences.push.enabled = true;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Web push subscription registered',
    });
  } catch (error) {
    console.error('Register push subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering web push',
      error: error.message,
    });
  }
};

/**
 * POST /api/notifications/register-mobile
 * Register or unregister a mobile FCM token.
 * Body: { fcmToken, deviceType, platform, action? }
 */
export const registerMobileToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fcmToken, deviceType = 'android', platform = 'capacitor', action } = req.body;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Handle unsubscription
    if (action === 'unsubscribe') {
      const tokenIndex = user.pushTokens?.findIndex(t => t.token === fcmToken);
      if (tokenIndex !== -1 && tokenIndex >= 0) {
        user.pushTokens[tokenIndex].isActive = false;
        await user.save();
      }
      return res.status(200).json({ success: true, message: 'Mobile token unregistered' });
    }

    // Otherwise upsert
    if (!user.pushTokens) user.pushTokens = [];

    const tokenData = {
      token: fcmToken,
      deviceType,
      platform,
      isActive: true,
      lastUsed: new Date(),
    };

    const existingIndex = user.pushTokens.findIndex(t => t.token === fcmToken);
    if (existingIndex >= 0) {
      user.pushTokens[existingIndex] = { ...user.pushTokens[existingIndex], ...tokenData };
    } else {
      user.pushTokens.push({ ...tokenData, createdAt: new Date() });
    }

    // Auto-enable push
    if (!user.notificationPreferences) user.notificationPreferences = {};
    if (!user.notificationPreferences.push) user.notificationPreferences.push = {};
    user.notificationPreferences.push.enabled = true;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Mobile token registered',
      data: { deviceType, platform, isActive: true },
    });
  } catch (error) {
    console.error('Register mobile token error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering mobile token',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/notifications/device/:token
 * Remove a specific device token (web or mobile) – marks inactive.
 */
export const deleteDeviceToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const tokenIndex = user.pushTokens?.findIndex(t => t.token === token);
    if (tokenIndex === -1 || tokenIndex === undefined) {
      return res.status(404).json({ success: false, message: 'Token not found' });
    }

    user.pushTokens[tokenIndex].isActive = false;
    await user.save();

    res.status(200).json({ success: true, message: 'Device token removed' });
  } catch (error) {
    console.error('Delete device token error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting device token',
      error: error.message,
    });
  }
};

// ─── TEST ENDPOINTS ─────────────────────────────────────────────────────────

/**
 * POST /api/notifications/test-push
 * Send a test push notification to the authenticated user.
 */
export const sendTestPush = async (req, res) => {
  try {
    const count = await sendPushNotification(
      req.user._id,
      'Test Notification',
      'This is a test push notification!',
      { type: 'test', timestamp: Date.now().toString() }
    );

    if (count > 0) {
      res.status(200).json({ success: true, message: `Test push sent to ${count} device(s)` });
    } else {
      res.status(400).json({
        success: false,
        message: 'No active push subscriptions found',
      });
    }
  } catch (error) {
    console.error('Send test push error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test push',
      error: error.message,
    });
  }
};

/**
 * POST /api/notifications/test-email
 * Send a test email to the authenticated user.
 */
export const sendTestEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('email name');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const subject = 'Test Email from Your App';
    const html = `
      <h2>Test Notification</h2>
      <p>Hello ${user.name || 'there'},</p>
      <p>This is a test email to confirm your email notifications are working.</p>
      <hr />
      <p style="color:#666;">Your App Name</p>
    `;

    const sent = await sendEmailNotification(user.email, subject, html);
    if (sent) {
      res.status(200).json({ success: true, message: 'Test email sent' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send test email' });
    }
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message,
    });
  }
};

// ─── VAPID PUBLIC KEY ──────────────────────────────────────────────────────

/**
 * GET /api/notifications/vapid-public-key
 * Return the public VAPID key for web push subscription.
 */
export const getVapidPublicKey = async (req, res) => {
  try {
    if (!process.env.VAPID_PUBLIC_KEY) {
      return res.status(503).json({
        success: false,
        message: 'VAPID public key not configured',
      });
    }
    res.status(200).json({
      success: true,
      data: { publicKey: process.env.VAPID_PUBLIC_KEY },
    });
  } catch (error) {
    console.error('Get VAPID key error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting VAPID public key',
      error: error.message,
    });
  }
};

// ─── IN‑APP NOTIFICATION CRUD ──────────────────────────────────────────────

/**
 * GET /api/notifications
 * Fetch paginated in‑app notifications for the user.
 * Query: ?page=1&limit=20&unreadOnly=true
 */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, unreadOnly } = req.query;

    const query = { recipient: userId };
    if (unreadOnly === 'true') query.read = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(query);

    res.status(200).json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get user notifications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read.
 */
export const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read for the user.
 */
export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a single notification.
 */
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({ _id: id, recipient: userId });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/notifications/clear-all
 * Delete all notifications for the user.
 */
export const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.deleteMany({ recipient: userId });
    res.status(200).json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};