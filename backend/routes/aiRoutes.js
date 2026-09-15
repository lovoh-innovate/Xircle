// routes/aiRoutes.js
import express from 'express';
import {
  planWithAI,
  executeAIPlan,
  reviewExistingProject,
  summarizeProjectAI,
  explainProjectAI,
  generateProjectDocsAI,
} from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js'; // ← adjust to your actual auth middleware

const router = express.Router();

// ── Planning ─────────────────────────────────────────────────────────
// Preview: nothing hits the DB.
router.post('/plan', protect, planWithAI);

// Commit: creates project + members + tasks.
// Accepts any client-edited version of the preview plan.
router.post('/execute', protect, executeAIPlan);

// ── Project intelligence ─────────────────────────────────────────────
// Audit an existing project. Managers only.
router.post('/review', protect, reviewExistingProject);

// Human-friendly snapshot. Any project member.
router.post('/summarize', protect, summarizeProjectAI);

// Explain a task or the project to someone who doesn't get it.
// Any project member. Optional taskId / question / audience.
router.post('/explain', protect, explainProjectAI);

// Structured project documentation for PDF export.
router.post('/document', protect, generateProjectDocsAI);

export default router;