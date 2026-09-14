// routes/aiRoutes.js
import express from 'express';
import { planWithAI, executeAIPlan } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js'; // ← adjust to your actual auth middleware

const router = express.Router();

// Preview: nothing hits the DB.
router.post('/plan', protect, planWithAI);

// Commit: creates project + members + tasks.
router.post('/execute', protect, executeAIPlan);

export default router;