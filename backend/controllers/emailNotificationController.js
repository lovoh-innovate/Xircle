import User from '../models/userModel.js';
import { sendEmail } from '../utils/resendEmailNotification.js';

// ─────────────────────────────────────────────────────────────────
// HELPER: check if user has email enabled for a given event type
// ─────────────────────────────────────────────────────────────────

const isEmailEnabled = (user, eventType) => {
  const prefs = user.emailNotificationPreferences;
  if (!prefs) return false; // no preferences stored, assume disabled
  return prefs[eventType] === true;
};

// ─────────────────────────────────────────────────────────────────
// GET USER EMAIL PREFERENCES
// GET /api/email-notifications/preferences
// ─────────────────────────────────────────────────────────────────

export const getEmailPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('emailNotificationPreferences email');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      preferences: user.emailNotificationPreferences || {},
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// UPDATE USER EMAIL PREFERENCES
// PUT /api/email-notifications/preferences
// Body: { newMessage: true, taskAssignment: false, ... }
// ─────────────────────────────────────────────────────────────────

export const updateEmailPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const allowedFields = [
      'newMessage',
      'taskAssignment',
      'taskUpdate',
      'projectUpdate',
      'teamInvite',
      'dailyReport',
    ];

    const updates = {};
    // Only accept known boolean values
    Object.entries(req.body).forEach(([key, value]) => {
      if (allowedFields.includes(key) && typeof value === 'boolean') {
        updates[`emailNotificationPreferences.${key}`] = value;
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid preferences provided.',
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('emailNotificationPreferences email');

    res.status(200).json({
      success: true,
      preferences: user.emailNotificationPreferences,
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// CORE FUNCTION: send email only if user has enabled the event type
// (call this from anywhere – push + email together)
// ─────────────────────────────────────────────────────────────────

/**
 * Sends an email notification if the user has that event type enabled.
 * @param {string} userId - MongoDB user _id
 * @param {string} eventType - key from emailNotificationPreferences (e.g., 'taskAssignment')
 * @param {string} subject - Email subject
 * @param {string} html - HTML email content
 */
export const sendEmailIfEnabled = async (userId, eventType, subject, html) => {
  try {
    const user = await User.findById(userId).select('email emailNotificationPreferences');
    if (!user) return;

    // 1. Check global email opt‑in
    if (!isEmailEnabled(user, eventType)) {
      return; // user disabled this notification type
    }

    // 2. Send email via Resend
    await sendEmail(user.email, subject, html);
    console.log(`📧 Email (${eventType}) sent to ${user.email}`);
  } catch (error) {
    console.error(`❌ Failed to send email to user ${userId}:`, error.message);
    // Do not throw – email failures should not break the main flow
  }
};