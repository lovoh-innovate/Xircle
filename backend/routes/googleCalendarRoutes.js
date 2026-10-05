// routes/googleCalendarRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  connectGoogleCalendar,
  googleCalendarCallback,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
} from '../controllers/googleCalendarController.js';

const router = express.Router();

// ─── /connect ─────────────────────────────────────────────────────────
// NO `protect` middleware here. This route is hit via a plain browser
// navigation (`window.location.href = ...`) which does NOT carry the
// Authorization header. The controller verifies the JWT from the query
// string instead. See connectGoogleCalendar in the controller.
router.get('/connect', connectGoogleCalendar);

// ─── /callback ────────────────────────────────────────────────────────
// Google redirects here after the user consents. No auth header either;
// the `state` param (which we set to the user id) identifies the user.
router.get('/callback', googleCalendarCallback);

// ─── Authenticated endpoints ──────────────────────────────────────────
// These are called via RTK Query, so they DO carry the Authorization
// header and can use the normal protect middleware.
router.post('/disconnect', protect, disconnectGoogleCalendar);
router.get('/status', protect, getGoogleCalendarStatus);

export default router;