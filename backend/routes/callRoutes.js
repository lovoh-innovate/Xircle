// routes/callRoutes.js
import express from 'express';
import multer from 'multer';
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

  // AI + live notes + interactions
  startCallAI,
  stopCallAI,
  pushCallTranscript,
  pushCallAudioChunk,
  askCallAIText,
  askCallAIVoice,
  sendInCallMessage,
  setRaisedHand,
  sendCallReaction,
  updateCallDataSaver,
  finalizeCallNotesHandler,
  // in the export { ... } block, add:
getPublicMeetingState,
} from '../controllers/callController.js';

import {
  getCallToken,
  getGuestCallToken,
} from '../controllers/callTokenController.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Multer — memory storage for AI audio (STT)
// Controllers read `req.file.buffer` directly (no disk writes).
// 10 MB cap ≈ several minutes of compressed webm.
// ─────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─────────────────────────────────────────────────────────────
// PUBLIC ROUTE — guests joining a meeting by code.
// No auth middleware, must be registered BEFORE router.use(protect).
// ─────────────────────────────────────────────────────────────
router.post('/guest-token/:code', getGuestCallToken);
router.get('/public/:code/state', getPublicMeetingState);

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

// ═════════════════════════════════════════════════════════════
// ── AI + LIVE NOTES ──────────────────────────────────────────
// ═════════════════════════════════════════════════════════════
//   start    → toggle AI on  (records who started, note destination)
//   stop     → toggle AI off → auto-finalize the note
//   finalize → manually generate the note (idempotent)
//   transcript         → client-STT segments, JSON body
//   transcript/audio   → server-STT, multipart 'audio'
//   ask / ask-voice    → mid-call Q&A (text/voice) + optional TTS reply
//   messages / hand / reaction / data-saver → meeting UX
// ─────────────────────────────────────────────────────────────

router.post('/:callId/ai/start',        startCallAI);
router.post('/:callId/ai/stop',         stopCallAI);
router.post('/:callId/ai/finalize',     finalizeCallNotesHandler);

router.post('/:callId/transcript',       pushCallTranscript);
router.post(
  '/:callId/transcript/audio',
  upload.single('audio'),
  pushCallAudioChunk
);

router.post('/:callId/ai/ask',          askCallAIText);
router.post(
  '/:callId/ai/ask-voice',
  upload.single('audio'),
  askCallAIVoice
);

router.post('/:callId/messages',        sendInCallMessage);
router.post('/:callId/hand',            setRaisedHand);
router.post('/:callId/reaction',        sendCallReaction);
router.patch('/:callId/data-saver',     updateCallDataSaver);

// ── Single call by ID — MUST be the LAST GET ────────────────
router.get('/:callId', getCallById);

export default router;