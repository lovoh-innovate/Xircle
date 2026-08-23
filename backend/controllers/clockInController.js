// controllers/clockInController.js
import ClockIn from "../models/clockInModel.js";
import Workspace from "../models/workspaceModel.js";
import User from "../models/userModel.js";
import asyncHandler from "express-async-handler";
import { createAndSendNotification } from "./notificationController.js";
import { sendMonthlyLeaderboardEmail } from "../utils/sendClockinEmail.js";
import cron from "node-cron";

// ─── Helpers ──────────────────────────────────────────────────────────

const isOwner = (workspace, userId) =>
  workspace.owner.toString() === userId;

const isAdmin = (workspace, userId) =>
  workspace.members.some(
    (m) =>
      m.user.toString() === userId &&
      m.role === "Admin" &&
      m.status === "active"
  );

const isManager = (workspace, userId) =>
  isOwner(workspace, userId) || isAdmin(workspace, userId);

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

// Build a Date for a given "HH:MM" on the same calendar day as `base`
const timeOnDate = (base, hhmm) => {
  if (!hhmm) return null;
  const [hours, minutes] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

const isSameCalendarDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// ─── Notification helper ────────────────────────────────────────────
async function notifyUsers(
  userIds,
  { title, body, data = {}, emailEventType = null, emailHtml = null }
) {
  if (!userIds) return;
  const recipients = Array.isArray(userIds) ? userIds : [userIds];
  for (const recipient of recipients) {
    createAndSendNotification({
      recipient,
      title,
      body,
      data,
      sendPush: true,
      emailEventType,
      emailSubject: title,
      emailHtml: emailHtml || `<p>${body}</p>`,
    }).catch((err) =>
      console.error(`Notification to ${recipient} failed:`, err.message)
    );
  }
}

// ─── Set Clock‑In Settings ──────────────────────────────────────────
export const setClockInSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;
  const { clockInStart, clockInEnd, closingTime, clockOutEarliest, clockInEnabled } = req.body;

  if (clockInStart && !TIME_REGEX.test(clockInStart)) {
    return res.status(400).json({ success: false, message: "Invalid start time format. Use HH:MM." });
  }
  if (clockInEnd && !TIME_REGEX.test(clockInEnd)) {
    return res.status(400).json({ success: false, message: "Invalid end time format. Use HH:MM." });
  }
  if (closingTime && !TIME_REGEX.test(closingTime)) {
    return res.status(400).json({ success: false, message: "Invalid closing time format. Use HH:MM." });
  }
  if (clockOutEarliest && !TIME_REGEX.test(clockOutEarliest)) {
    return res.status(400).json({ success: false, message: "Invalid earliest clock‑out time format. Use HH:MM." });
  }
  if (clockInStart && clockInEnd && clockInStart >= clockInEnd) {
    return res.status(400).json({ success: false, message: "Clock-in start must be before clock-in end." });
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  if (!isManager(workspace, userId)) {
    return res.status(403).json({ success: false, message: "Only the workspace owner or admin can set clock-in settings." });
  }

  if (clockInStart !== undefined) workspace.clockInStart = clockInStart;
  if (clockInEnd !== undefined) workspace.clockInEnd = clockInEnd;
  if (closingTime !== undefined) workspace.closingTime = closingTime;
  if (clockOutEarliest !== undefined) workspace.clockOutEarliest = clockOutEarliest;
  if (clockInEnabled !== undefined) workspace.clockInEnabled = clockInEnabled;

  await workspace.save();

  res.status(200).json({
    success: true,
    message: "Clock-in settings updated.",
    settings: {
      clockInStart: workspace.clockInStart,
      clockInEnd: workspace.clockInEnd,
      closingTime: workspace.closingTime,
      clockOutEarliest: workspace.clockOutEarliest,
      clockInEnabled: workspace.clockInEnabled,
    },
  });
});

// ─── Get Clock‑In Settings ──────────────────────────────────────────
export const getClockInSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  const isMember = workspace.members.some(
    (m) => m.user.toString() === userId && m.status === "active"
  );
  if (!isMember && !isOwner(workspace, userId)) {
    return res.status(403).json({ success: false, message: "You are not a member of this workspace." });
  }

  res.status(200).json({
    success: true,
    settings: {
      clockInStart: workspace.clockInStart,
      clockInEnd: workspace.clockInEnd,
      closingTime: workspace.closingTime,
      clockOutEarliest: workspace.clockOutEarliest,
      clockInEnabled: workspace.clockInEnabled,
    },
  });
});

// ─── Clock‑In ──────────────────────────────────────────────────────
export const clockIn = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  const membership = workspace.members.find(
    (m) => m.user.toString() === userId && m.status === "active"
  );
  if (!membership && !isOwner(workspace, userId)) {
    return res.status(403).json({ success: false, message: "You are not an active member of this workspace." });
  }

  if (!workspace.clockInEnabled) {
    return res.status(400).json({ success: false, message: "Clock-in is currently disabled for this workspace." });
  }

  // Already clocked in today and haven't clocked out?
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existing = await ClockIn.findOne({
    user: userId,
    workspace: workspaceId,
    date: { $gte: today, $lt: tomorrow },
    clockOutTime: null,
  });
  if (existing) {
    return res.status(400).json({ success: false, message: "You have already clocked in today and haven't clocked out yet." });
  }

  const now = new Date();

  // Block if closingTime has passed for today
  const closingDate = timeOnDate(now, workspace.closingTime);
  if (closingDate && now > closingDate) {
    return res.status(400).json({
      success: false,
      message: `Clock-in is not allowed after closing time (${workspace.closingTime}).`,
    });
  }

  // Parse clock‑in window
  const startDate = timeOnDate(now, workspace.clockInStart);
  const endDate = timeOnDate(now, workspace.clockInEnd);

  // Strict: cannot clock in before startDate (window hasn't opened yet)
  if (startDate && now < startDate) {
    return res.status(400).json({
      success: false,
      message: `Clock-in not yet open. It starts at ${workspace.clockInStart}.`,
    });
  }

  // "Late" ONLY means after clockInEnd. Anything from startDate up to and
  // including endDate (the whole window) is on-time — never late.
  let isLate = false;
  let lateMinutes = 0;
  if (endDate && now > endDate) {
    isLate = true;
    lateMinutes = Math.floor((now - endDate) / 60000);
  }

  const status = isLate ? "late" : "on-time";
  const isEarly = !isLate;

  // Create record
  const clockInDoc = await ClockIn.create({
    user: userId,
    workspace: workspaceId,
    clockInTime: now,
    date: now,
    status,
    isLate,
    lateMinutes,
    isEarly,
  });

  // Notify admins/owner
  const adminIds = workspace.members
    .filter((m) => m.role === "Admin" && m.status === "active")
    .map((m) => m.user.toString());
  const ownerId = workspace.owner.toString();
  const recipientIds = [...new Set([...adminIds, ownerId])].filter((id) => id !== userId);

  const user = await User.findById(userId).select("name");
  const userName = user?.name || "A member";

  if (recipientIds.length > 0) {
    notifyUsers(recipientIds, {
      title: `⏰ ${userName} clocked in`,
      body: `${userName} clocked in at ${now.toLocaleTimeString()} (${status})`,
      data: {
        type: "clockin",
        workspaceId: workspaceId,
        userId: userId,
        clockInId: clockInDoc._id.toString(),
      },
      emailEventType: "newMessage",
      emailHtml: `<p><strong>${userName}</strong> clocked in at ${now.toLocaleTimeString()} (${status})</p>`,
    });
  }

  // Confirmation to user
  notifyUsers([userId], {
    title: "✅ Clocked in successfully",
    body: `You clocked in at ${now.toLocaleTimeString()} (${status})`,
    data: { type: "clockin-confirmation" },
  });

  res.status(200).json({
    success: true,
    message: "Clocked in successfully.",
    clockIn: {
      id: clockInDoc._id,
      time: clockInDoc.clockInTime,
      status,
      isLate,
      lateMinutes,
      isEarly,
    },
  });
});

// ─── Clock‑Out ──────────────────────────────────────────────────────
export const clockOut = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;
  const { reason } = req.body;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  const membership = workspace.members.find(
    (m) => m.user.toString() === userId && m.status === "active"
  );
  if (!membership && !isOwner(workspace, userId)) {
    return res.status(403).json({ success: false, message: "You are not an active member of this workspace." });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const clockInDoc = await ClockIn.findOne({
    user: userId,
    workspace: workspaceId,
    date: { $gte: today, $lt: tomorrow },
    clockOutTime: null,
  });
  if (!clockInDoc) {
    return res.status(400).json({ success: false, message: "You haven't clocked in today or already clocked out." });
  }

  const now = new Date();

  // Check if clock‑out is before earliest allowed time — requires a reason
  const earliestDate = timeOnDate(now, workspace.clockOutEarliest);
  if (earliestDate && now < earliestDate) {
    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: `You are clocking out before ${workspace.clockOutEarliest}. Please provide a reason.`,
      });
    }
  }

  let clockOutLate = false;
  let clockOutLateMinutes = 0;
  const closingDate = timeOnDate(now, workspace.closingTime);
  if (closingDate && now > closingDate) {
    clockOutLate = true;
    clockOutLateMinutes = Math.floor((now - closingDate) / 60000);
  }

  clockInDoc.clockOutTime = now;
  clockInDoc.clockOutLate = clockOutLate;
  clockInDoc.clockOutLateMinutes = clockOutLateMinutes;
  if (reason) clockInDoc.clockOutReason = reason.trim();
  await clockInDoc.save();

  // Let admins/owner know too, including the reason if there is one
  const adminIds = workspace.members
    .filter((m) => m.role === "Admin" && m.status === "active")
    .map((m) => m.user.toString());
  const ownerId = workspace.owner.toString();
  const recipientIds = [...new Set([...adminIds, ownerId])].filter((id) => id !== userId);

  const user = await User.findById(userId).select("name");
  const userName = user?.name || "A member";

  if (recipientIds.length > 0) {
    notifyUsers(recipientIds, {
      title: `⏰ ${userName} clocked out`,
      body: `${userName} clocked out at ${now.toLocaleTimeString()}${reason ? ` — Reason: ${reason.trim()}` : ""}`,
      data: {
        type: "clockout",
        workspaceId,
        userId,
        clockInId: clockInDoc._id.toString(),
      },
    });
  }

  notifyUsers([userId], {
    title: "✅ Clocked out successfully",
    body: `You clocked out at ${now.toLocaleTimeString()} ${clockOutLate ? `(clocked out ${clockOutLateMinutes} min after closing)` : ""}${reason ? ` (Reason: ${reason})` : ""}`,
    data: { type: "clockout-confirmation" },
  });

  res.status(200).json({
    success: true,
    message: "Clocked out successfully.",
    clockOut: {
      id: clockInDoc._id,
      time: clockInDoc.clockOutTime,
      clockOutLate,
      clockOutLateMinutes,
      reason: clockInDoc.clockOutReason || null,
    },
  });
});

// ─── Get User Clock‑In History ─────────────────────────────────────
export const getUserClockInHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  const membership = workspace.members.find(
    (m) => m.user.toString() === userId && m.status === "active"
  );
  if (!membership && !isOwner(workspace, userId)) {
    return res.status(403).json({ success: false, message: "You are not a member of this workspace." });
  }

  const skip = (page - 1) * limit;
  const query = { user: userId, workspace: workspaceId };
  const history = await ClockIn.find(query)
    .sort({ clockInTime: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await ClockIn.countDocuments(query);

  res.status(200).json({
    success: true,
    history,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// ─── Get All Clock‑Ins for Workspace (admin/owner) ─────────────────
// clockOutReason is included in the .lean() docs by default — owner/admin can see it.
export const getWorkspaceClockIns = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;
  const { date, page = 1, limit = 30 } = req.query;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  if (!isManager(workspace, userId)) {
    return res.status(403).json({ success: false, message: "Only admins or owner can view all clock-ins." });
  }

  const query = { workspace: workspaceId };
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    query.clockInTime = { $gte: start, $lte: end };
  }

  const skip = (page - 1) * limit;
  const clockIns = await ClockIn.find(query)
    .populate("user", "name email profile")
    .sort({ clockInTime: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await ClockIn.countDocuments(query);

  res.status(200).json({
    success: true,
    clockIns,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// ─── Attendance Summary ──────────────────────────────────────────
export const getAttendanceSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;
  const { date } = req.query;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  if (!isManager(workspace, userId)) {
    return res.status(403).json({ success: false, message: "Only admins or owner can view attendance summary." });
  }

  let targetDate = new Date();
  if (date) {
    targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD." });
    }
  }
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const memberIds = workspace.members
    .filter((m) => m.status === "active")
    .map((m) => m.user.toString());
  if (!memberIds.includes(workspace.owner.toString())) {
    memberIds.push(workspace.owner.toString());
  }

  const clockIns = await ClockIn.find({
    workspace: workspaceId,
    clockInTime: { $gte: startOfDay, $lte: endOfDay },
  }).populate("user", "name email profile");

  const clockedInIds = clockIns.map((c) => c.user._id.toString());
  const notClockedInIds = memberIds.filter((id) => !clockedInIds.includes(id));

  const clockedInUsers = await User.find({ _id: { $in: clockedInIds } }).select("name email profile");
  const notClockedInUsers = await User.find({ _id: { $in: notClockedInIds } }).select("name email profile");

  res.status(200).json({
    success: true,
    date: targetDate.toISOString().split("T")[0],
    totalMembers: memberIds.length,
    clockedIn: clockedInUsers.map((u) => {
      const record = clockIns.find((c) => c.user._id.toString() === u._id.toString());
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        profile: u.profile,
        clockInTime: record?.clockInTime,
        status: record?.status,
        isLate: record?.isLate,
        autoClockedOut: record?.autoClockedOut,
      };
    }),
    notClockedIn: notClockedInUsers,
  });
});

// ─── Leaderboard Helper ────────────────────────────────────────────────
// Scoring (per workspace, per calendar day):
//   - Only "on-time" clock-ins are ranked (late = 0 points, never ranked)
//   - Ranked by earliest clock-in time that day
//       1st  -> 50 pts
//       2nd  -> 40 pts
//       3rd  -> 30 pts
//       4th  -> 20 pts
//       5th  -> 10 pts
//       6th+ -> 5 pts each (still on-time, just not top 5)
//   - Points accumulate across every day in the requested period.
const getLeaderboardData = async (workspaceId, startDate, endDate = new Date(), limit = 10) => {
  const allClockIns = await ClockIn.find({
    workspace: workspaceId,
    clockInTime: { $gte: startDate, $lte: endDate },
  })
    .sort({ clockInTime: 1 })
    .populate("user", "name email profile")
    .lean();

  // Group by calendar day
  const byDay = {};
  for (const record of allClockIns) {
    if (!record.user) continue; // skip if user got deleted
    const dayKey = record.clockInTime.toISOString().split("T")[0];
    if (!byDay[dayKey]) byDay[dayKey] = [];
    byDay[dayKey].push(record);
  }

  const TOP_POINTS = [50, 40, 30, 20, 10];
  const PARTICIPATION_POINTS = 5;

  const userStats = {};
  const ensureUser = (record) => {
    const id = record.user._id.toString();
    if (!userStats[id]) {
      userStats[id] = {
        userId: id,
        name: record.user.name,
        email: record.user.email,
        profile: record.user.profile,
        totalPoints: 0,
        onTimeCount: 0,
        lateCount: 0,
        totalLateMinutes: 0,
      };
    }
    return userStats[id];
  };

  for (const dayKey of Object.keys(byDay)) {
    const dayRecords = byDay[dayKey];

    // Treat legacy "early" status the same as "on-time"
    const onTime = dayRecords
      .filter((r) => r.status === "on-time" || r.status === "early")
      .sort((a, b) => new Date(a.clockInTime) - new Date(b.clockInTime));

    const late = dayRecords.filter((r) => r.status === "late");

    onTime.forEach((record, index) => {
      const stat = ensureUser(record);
      stat.onTimeCount += 1;
      stat.totalPoints += index < TOP_POINTS.length ? TOP_POINTS[index] : PARTICIPATION_POINTS;
    });

    late.forEach((record) => {
      const stat = ensureUser(record);
      stat.lateCount += 1;
      stat.totalLateMinutes += record.lateMinutes || 0;
      // Late = 0 points, intentionally not added to totalPoints.
    });
  }

  const leaderboard = Object.values(userStats).map((u) => ({
    user: {
      _id: u.userId,
      name: u.name,
      email: u.email,
      profile: u.profile,
    },
    totalPoints: u.totalPoints,
    earlyCount: u.onTimeCount,
    lateCount: u.lateCount,
    avgLateMinutes: u.lateCount > 0 ? Math.round((u.totalLateMinutes / u.lateCount) * 10) / 10 : 0,
    score: u.totalPoints,
  }));

  leaderboard.sort((a, b) => b.score - a.score);
  return leaderboard.slice(0, limit);
};

// ─── Leaderboard Endpoint ─────────────────────────────────────────
export const getClockInLeaderboard = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { period = "month" } = req.query;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  const now = new Date();
  let startDate;
  if (period === "week") {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else if (period === "month") {
    startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 1);
  } else {
    startDate = new Date(0);
  }

  const leaderboard = await getLeaderboardData(workspaceId, startDate, now, 10);

  res.status(200).json({
    success: true,
    leaderboard,
    period,
  });
});

// ─── Schedulers ──────────────────────────────────────────────────
export const startClockInScheduler = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const workspaces = await Workspace.find({
        clockInEnabled: true,
        clockInStart: { $ne: null },
      });

      for (const workspace of workspaces) {
        const startTime = workspace.clockInStart;
        const [hours, minutes] = startTime.split(":").map(Number);
        const target = new Date(now);
        target.setHours(hours, minutes, 0, 0);
        const diffMinutes = Math.floor((target - now) / 60000);

        if (diffMinutes === 30 || diffMinutes === 10) {
          const memberIds = workspace.members
            .filter((m) => m.status === "active")
            .map((m) => m.user.toString());
          const ownerId = workspace.owner.toString();
          const allIds = [...new Set([...memberIds, ownerId])];

          const minutesText = diffMinutes === 30 ? "30 minutes" : "10 minutes";
          notifyUsers(allIds, {
            title: `⏰ Clock-in in ${minutesText}`,
            body: `Clock-in window opens at ${startTime}. Don't forget to clock in!`,
            data: {
              type: "clockin-reminder",
              workspaceId: workspace._id.toString(),
            },
            emailEventType: "newMessage",
            emailHtml: `<p>Reminder: Clock‑in starts at <strong>${startTime}</strong>. Please clock in on time.</p>`,
          });
        }
      }
    } catch (error) {
      console.error("Clock-in reminder scheduler error:", error);
    }
  });
};

export const startAutoClockOutScheduler = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const workspaces = await Workspace.find({
        clockInEnabled: true,
        closingTime: { $ne: null },
      });

      for (const workspace of workspaces) {
        const [hours, minutes] = workspace.closingTime.split(":").map(Number);
        const closingMinutes = hours * 60 + minutes;

        const diff = currentMinutes - closingMinutes;
        if (diff >= 0 && diff < 5) {
          // Only touch records that were clocked in today — never mess with
          // stale open records from a previous day here.
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);

          const openRecords = await ClockIn.find({
            workspace: workspace._id,
            clockOutTime: null,
            clockInTime: { $gte: todayStart },
          });

          if (openRecords.length === 0) continue;

          const closingDate = new Date(now);
          closingDate.setHours(hours, minutes, 0, 0);

          for (const record of openRecords) {
            record.clockOutTime = closingDate;
            record.clockOutLate = false;
            // IMPORTANT: do NOT touch `status` here — it must keep reflecting
            // whether the person's clock-in was on-time or late, so the
            // leaderboard stays correct. Auto clock-out is tracked separately.
            record.autoClockedOut = true;
            await record.save();

            notifyUsers([record.user], {
              title: "⏰ Auto clock-out",
              body: `You were automatically clocked out at closing time (${workspace.closingTime}).`,
              data: { type: "auto-clockout" },
            });
          }

          console.log(`✅ Auto clock-out completed for workspace ${workspace.name} (${openRecords.length} users).`);
        }
      }
    } catch (error) {
      console.error("Auto clock-out scheduler error:", error);
    }
  });
};

// ─── Monthly leaderboard email ──────────────────────────────────
export const sendMonthlyLeaderboard = async (workspaceId) => {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return;

    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 1);

    const leaderboardData = await getLeaderboardData(workspaceId, startDate, now, 5);

    if (leaderboardData.length === 0) return;

    const emails = leaderboardData.map((item) => item.user.email);
    const ownerEmail = (await User.findById(workspace.owner).select("email")).email;
    const recipients = [...emails, ownerEmail];

    await sendMonthlyLeaderboardEmail(recipients, workspace.name, leaderboardData, startDate);
  } catch (error) {
    console.error("Monthly leaderboard email error:", error);
  }
};

export const sendMonthlyLeaderboardForAllWorkspaces = async () => {
  try {
    const workspaces = await Workspace.find({ clockInEnabled: true });
    for (const workspace of workspaces) {
      await sendMonthlyLeaderboard(workspace._id);
    }
    console.log(`✅ Monthly leaderboard emails sent for ${workspaces.length} workspaces.`);
  } catch (error) {
    console.error("❌ sendMonthlyLeaderboardForAllWorkspaces error:", error);
  }
};

export const triggerMonthlyLeaderboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  if (!isManager(workspace, userId)) {
    return res.status(403).json({ success: false, message: "Only workspace owner or admin can trigger monthly report." });
  }

  await sendMonthlyLeaderboard(workspaceId);
  res.status(200).json({ success: true, message: "Monthly leaderboard email sent." });
});