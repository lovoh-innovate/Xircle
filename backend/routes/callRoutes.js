// routes/callRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  // Existing
  initiateCall,
  scheduleCall,
  joinCall,
  rejectCall,
  endCall,
  cancelScheduledCall,
  getScheduledCalls,
  inviteToCall,

  // New
  initiateDirectCall,
  createMeeting,
  joinByMeetingCode,
  leaveCall,
  getCallLogs,
  getOngoingCalls,
  getCallById,
  inviteByUsername,
} from '../controllers/callController.js';

import {
  getCallToken,
  getGuestCallToken,
} from '../controllers/callTokenController.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// PUBLIC ROUTE — guests joining a meeting by code.
// No auth middleware, must be registered BEFORE router.use(protect).
// ─────────────────────────────────────────────────────────────
router.post('/guest-token/:code', getGuestCallToken);

// ─────────────────────────────────────────────────────────────
// Everything below requires authentication
// ─────────────────────────────────────────────────────────────
router.use(protect);

// ── Static GET routes (MUST come before GET /:callId) ────────
router.get('/scheduled', getScheduledCalls);
router.get('/logs', getCallLogs);
router.get('/history', getCallLogs);       // back-compat alias for the old route
router.get('/ongoing', getOngoingCalls);

// ── Static POST routes ───────────────────────────────────────
router.post('/initiate', initiateCall);              // workspace call (existing)
router.post('/schedule', scheduleCall);              // schedule (admins/owners only)
router.post('/direct', initiateDirectCall);          // 1-on-1 call by username
router.post('/meeting', createMeeting);              // shareable meeting link

// ── Join a meeting by code (logged-in user clicking a link) ──
// 3 segments — no conflict with /:callId/join (2 segments)
router.get('/by-code/:code/join', joinByMeetingCode);

// ── Per-call actions ────────────────────────────────────────
router.put('/:callId/join', joinCall);
router.put('/:callId/reject', rejectCall);
router.put('/:callId/end', endCall);                 // force-end for everyone
router.put('/:callId/leave', leaveCall);             // leave without ending (group)
router.put('/:callId/cancel', cancelScheduledCall);

// ── Invitations ─────────────────────────────────────────────
router.post('/:callId/invite', inviteToCall);                 // by user IDs
router.post('/:callId/invite-username', inviteByUsername);    // by usernames

// ── LiveKit token for an accepted participant ───────────────
router.post('/:callId/token', getCallToken);

// ── Single call by ID — MUST be the LAST GET ────────────────
router.get('/:callId', getCallById);

export default router;