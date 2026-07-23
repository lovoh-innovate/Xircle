// routes/callRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  initiateCall,
  scheduleCall,
  joinCall,
  rejectCall,
  endCall,
  cancelScheduledCall,
  getScheduledCalls,
  getCallHistory,
} from '../controllers/callController.js';

const router = express.Router();

// All routes are protected – only authenticated users can use calls
router.use(protect);

// Initiate an immediate call (voice / video)
router.post('/initiate', initiateCall);

// Schedule a future call
router.post('/schedule', scheduleCall);

// Join a ringing or ongoing call
router.put('/:callId/join', joinCall);

// Reject an incoming call
router.put('/:callId/reject', rejectCall);

// End an active call (any participant can end)
router.put('/:callId/end', endCall);

// Cancel a scheduled call (only the creator)
router.put('/:callId/cancel', cancelScheduledCall);

// Get upcoming (scheduled) calls for the current user
router.get('/scheduled', getScheduledCalls);

// Get call history for the current user
router.get('/history', getCallHistory);

export default router;