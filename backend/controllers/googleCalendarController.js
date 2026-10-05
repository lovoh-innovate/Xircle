// controllers/googleCalendarController.js
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import {
  getAuthUrl,
  exchangeCodeForTokens,
} from '../services/googleCalendarService.js';

// ─────────────────────────────────────────────────────────────────────
// Helper: extract user id from a JWT payload, whatever field name the
// rest of the app used when it signed the token.
// ─────────────────────────────────────────────────────────────────────
const extractUserIdFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  return (
    payload.id ||
    payload.userId ||
    payload._id ||
    payload.sub ||
    null
  );
};

// ─────────────────────────────────────────────────────────────────────
// GET /api/google-calendar/connect?token=...
//
// NOTE: This route is hit by a plain browser navigation, so the JWT
// cannot arrive via the Authorization header. We read it from the
// query string instead and verify it manually.
// ─────────────────────────────────────────────────────────────────────
export const connectGoogleCalendar = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res
        .status(401)
        .send('Missing auth token. Please log in and try again.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error('connectGoogleCalendar: jwt.verify failed:', err.message);
      return res
        .status(401)
        .send('Invalid or expired auth token. Please log in and try again.');
    }

    const userId = extractUserIdFromPayload(decoded);
    if (!userId) {
      return res.status(401).send('Auth token missing user id.');
    }

    const user = await User.findById(userId).select('_id');
    if (!user) {
      return res.status(401).send('User not found.');
    }

    // `state` is echoed back to us by Google on the callback, so we use
    // it to remember which user started the flow.
    const authUrl = getAuthUrl(user._id.toString());
    return res.redirect(authUrl);
  } catch (err) {
    console.error('connectGoogleCalendar unexpected error:', err);
    return res.status(500).send('Could not start Google Calendar connection.');
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET /api/google-calendar/callback?code=...&state=<userId>
// Google redirects here after the user accepts the consent screen.
// ─────────────────────────────────────────────────────────────────────
export const googleCalendarCallback = async (req, res) => {
  const { code, state, error } = req.query;

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  if (error) {
    console.error('Google OAuth returned error:', error);
    return res.redirect(`${clientUrl}/settings?google=error`);
  }
  if (!code || !state) {
    return res.status(400).send('Missing code or state from Google.');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens?.refresh_token) {
      // Google only returns a refresh_token on the FIRST consent for a
      // given client+user. If the user revoked and re-consented without
      // prompt=consent, we'd get only an access_token. We pass
      // prompt: 'consent' in getAuthUrl() to force a refresh_token, but
      // guard here anyway.
      console.warn('No refresh_token returned by Google.');
    }

    await User.findByIdAndUpdate(state, {
      googleCalendar: {
        enabled: true,
        accessToken: tokens.access_token || null,
        refreshToken: tokens.refresh_token || null,
        expiryDate: tokens.expiry_date || null,
        calendarId: 'primary',
        connectedAt: new Date(),
      },
    });

    return res.redirect(`${clientUrl}/settings?google=connected`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return res.redirect(`${clientUrl}/settings?google=error`);
  }
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/google-calendar/disconnect
// Protected via `protect` middleware in the router.
// ─────────────────────────────────────────────────────────────────────
export const disconnectGoogleCalendar = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      googleCalendar: {
        enabled: false,
        accessToken: null,
        refreshToken: null,
        expiryDate: null,
        calendarId: 'primary',
        connectedAt: null,
      },
    });

    res.json({ success: true, message: 'Google Calendar disconnected.' });
  } catch (err) {
    console.error('disconnectGoogleCalendar error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Could not disconnect Google Calendar.' });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET /api/google-calendar/status
// Protected via `protect` middleware in the router.
// ─────────────────────────────────────────────────────────────────────
export const getGoogleCalendarStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('googleCalendar');
    res.json({
      success: true,
      enabled: !!user?.googleCalendar?.enabled,
      connectedAt: user?.googleCalendar?.connectedAt || null,
    });
  } catch (err) {
    console.error('getGoogleCalendarStatus error:', err);
    res
      .status(500)
      .json({ success: false, message: 'Could not read Google Calendar status.' });
  }
};