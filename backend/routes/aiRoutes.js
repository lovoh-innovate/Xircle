// routes/aiRoutes.js
import express from 'express';
import {
  // ── Planning ─────────────────────────────────────────────────────
  planWithAI,
  executeAIPlan,
  editPlanPreview,

  // ── Project intelligence ─────────────────────────────────────────
  reviewExistingProject,
  summarizeProjectAI,
  explainProjectAI,
  generateProjectDocsAI,

  // ── Task-level editing ───────────────────────────────────────────
  editTaskWithAI,
  applyTaskEdits,

  // ── Project-level editing ────────────────────────────────────────
  editProjectWithAI,
  applyProjectEdits,

  // ── Ask Xircle (legacy single-shot Q&A) ──────────────────────────
  askXircleAI,

  // ── NEW: Flexible chat with tool use ─────────────────────────────
  chatWithAI,
  listAIConversations,
  createAIConversation,
  getAIConversation,
  updateAIConversation,
  deleteAIConversation,
} from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ═════════════════════════════════════════════════════════════════════
// ── CHAT (the flexible one) ─────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════
//
// One endpoint, one conversation, infinite reach.
//
// The agent has READ tools (look things up) and WRITE tools (do things)
// and decides which to call based on what the user asks. It can chain
// multiple tool calls in a single turn:
//
//   "clock me in and tell Sarah I'll be 10 min late"
//     → clock_in + send_chat_message
//
//   "schedule a standup call at 3PM with the dev team"
//     → schedule_call (with computed ISO timestamp)
//
//   "what's Mercy been up to this week?"
//     → get_member_profile + get_my_recent_activity
//
//   "what project are we on?"
//     → list_projects (uses activeWorkspaceId from context)
//
// Body:
//   {
//     message:         string   (required)
//     conversationId?: string   (continue an existing chat)
//     workspaceId?:    string   (scope + active workspace hint)
//   }
//
// Response:
//   {
//     success: true,
//     conversationId: string,
//     answer: string,
//     actions: [{ tool, args, ok, summary }],   // what the AI did
//     generatedAt: Date
//   }
//
router.post('/chat', protect, chatWithAI);

// ── Conversation management ─────────────────────────────────────────
// List the caller's AI chats. Newest first.
// Query: ?workspaceId=...&archived=true|false
router.get('/conversations', protect, listAIConversations);

// Create an empty conversation up front (rarely needed —
// /chat creates one automatically when conversationId is omitted).
// Body: { title?, workspaceId? }
router.post('/conversations', protect, createAIConversation);

// Fetch one full conversation with all messages.
router.get('/conversations/:conversationId', protect, getAIConversation);

// Rename or archive.
// Body: { title?, archived? }
router.patch('/conversations/:conversationId', protect, updateAIConversation);

// Delete the conversation (and its history).
router.delete('/conversations/:conversationId', protect, deleteAIConversation);

// ═════════════════════════════════════════════════════════════════════
// ── PLANNING ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════

// Preview: nothing hits the DB.
router.post('/plan', protect, planWithAI);

// Iterate on the preview before committing it.
// Body: { workspaceId, plan, prompt }
router.post('/plan/edit', protect, editPlanPreview);

// Commit: creates project + members + tasks.
router.post('/execute', protect, executeAIPlan);

// ═════════════════════════════════════════════════════════════════════
// ── PROJECT INTELLIGENCE ────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════

// Audit an existing project. Managers only.
router.post('/review', protect, reviewExistingProject);

// Human-friendly snapshot. Any project member.
router.post('/summarize', protect, summarizeProjectAI);

// Explain a task or the project. Optional taskId / question / audience.
router.post('/explain', protect, explainProjectAI);

// Structured project documentation for PDF export.
router.post('/document', protect, generateProjectDocsAI);

// ═════════════════════════════════════════════════════════════════════
// ── TASK-LEVEL EDITING ──────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════

// Preview an AI-driven edit to one task. No writes.
// Body: { taskId, prompt }
router.post('/task/edit', protect, editTaskWithAI);

// Commit the (possibly user-modified) proposed state.
// Body: { taskId, proposed }
router.post('/task/apply', protect, applyTaskEdits);

// ═════════════════════════════════════════════════════════════════════
// ── PROJECT-LEVEL EDITING ───────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════

// Preview an AI-driven edit to a project AND its tasks at once.
// Body: { projectId, prompt }
router.post('/project/edit', protect, editProjectWithAI);

// Commit the (possibly user-modified) proposed state.
// Body: { projectId, proposed }
router.post('/project/apply', protect, applyProjectEdits);

// ═════════════════════════════════════════════════════════════════════
// ── ASK XIRCLE (legacy single-shot Q&A) ─────────────────────────────
// ═════════════════════════════════════════════════════════════════════
//
// Kept for backwards compatibility. New code should prefer /chat —
// it's strictly more capable (same context + tool use + persistence).
//
// Body: { question, history? }
router.post('/ask', protect, askXircleAI);

export default router;