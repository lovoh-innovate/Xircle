import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  setClockInSettings,
  getClockInSettings,
  clockIn,
  clockOut,
  getUserClockInHistory,
  getWorkspaceClockIns,
  getClockInLeaderboard,
  triggerMonthlyLeaderboard,
  getAttendanceSummary,
} from '../controllers/clockInController.js';

const router = express.Router();

// ─── Settings ──────────────────────────────────────────────────────────
router.put('/:workspaceId/clockin-settings', protect, setClockInSettings);
router.get('/:workspaceId/clockin-settings', protect, getClockInSettings);

// ─── Clock‑in/out actions ────────────────────────────────────────────
router.post('/:workspaceId/clockin', protect, clockIn);
router.post('/:workspaceId/clockout', protect, clockOut);

// ─── History (user's own) ────────────────────────────────────────────
router.get('/:workspaceId/clockin/history', protect, getUserClockInHistory);

// ─── Admin/owner views ───────────────────────────────────────────────
router.get('/:workspaceId/clockins', protect, getWorkspaceClockIns);

// ─── Attendance Summary (for a specific date) ──────────────────────
router.get('/:workspaceId/attendance-summary', protect, getAttendanceSummary);

// ─── Leaderboard ──────────────────────────────────────────────────────
router.get('/:workspaceId/leaderboard', protect, getClockInLeaderboard);

// ─── Monthly report (trigger manually) ──────────────────────────────
router.post('/:workspaceId/leaderboard/monthly', protect, triggerMonthlyLeaderboard);

export default router;