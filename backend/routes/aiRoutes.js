// routes/aiRoutes.js
import express from 'express';
import {
  planWithAI,
  executeAIPlan,
  editPlanPreview,                        // 👈 NEW
  reviewExistingProject,
  summarizeProjectAI,
  explainProjectAI,
  generateProjectDocsAI,
  askXircleAI,
  editTaskWithAI,                         // 👈 NEW
  applyTaskEdits,                         // 👈 NEW
  editProjectWithAI,                      // 👈 NEW
  applyProjectEdits,                      // 👈 NEW
} from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js'; // ← adjust to your actual auth middleware

const router = express.Router();

// ── Planning ─────────────────────────────────────────────────────────
// Preview: nothing hits the DB.
router.post('/plan', protect, planWithAI);

// Iterate on the preview before committing it.
// Same shape as the plan from /plan, returns the full updated plan.
// Body: { workspaceId, plan, prompt }
router.post('/plan/edit', protect, editPlanPreview);

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

// ── Task-level editing ───────────────────────────────────────────────
// Preview an AI-driven edit to one task. No writes.
// Body: { taskId, prompt }
// Returns: { current, proposed, summary, changes, warnings }
router.post('/task/edit', protect, editTaskWithAI);

// Commit the (possibly user-modified) proposed state.
// Body: { taskId, proposed }
router.post('/task/apply', protect, applyTaskEdits);

// ── Project-level editing ────────────────────────────────────────────
// Preview an AI-driven edit to a project AND its tasks at once.
// Handles "add James, give him 2 tasks, reduce Mercy's load" style
// requests — including creating new tasks and soft-deleting existing ones.
// Body: { projectId, prompt }
// Returns: { current: { project, tasks }, proposed: { project, tasks }, summary, changes, warnings }
router.post('/project/edit', protect, editProjectWithAI);

// Commit the (possibly user-modified) proposed state.
// Creates new tasks, updates existing ones, soft-deletes removed ones,
// and rewrites the project's team.
// Body: { projectId, proposed }
router.post('/project/apply', protect, applyProjectEdits);

// ── Ask Xircle ───────────────────────────────────────────────────────
// The conversational lens. Reads the user's whole Xircle context
// (Today + Projects + Chat + Workspace + Notes + Stats) and answers
// natural-language questions about their own work.
//
// READ-ONLY. Does not create, update, or delete anything.
// Body: { question: string, history?: [{ role: 'user'|'assistant', content: string }] }
router.post('/ask', protect, askXircleAI);

export default router;