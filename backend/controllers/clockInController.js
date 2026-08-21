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

// ─── Set Clock‑In Settings (start, end, closingTime, enabled) ──────
// NOTE: previous version destructured only { clockInStart, clockInEnd,
// clockInEnabled } from req.body — closingTime was silently dropped
// and never saved. That's fixed below.

export const setClockInSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;
  const { clockInStart, clockInEnd, closingTime, clockInEnabled } = req.body;

  console.log("🔥 [clockin-settings] incoming body:", {
    clockInStart,
    clockInEnd,
    closingTime,
    clockInEnabled,
  });

  if (clockInStart && !TIME_REGEX.test(clockInStart)) {
    return res.status(400).json({ success: false, message: "Invalid start time format. Use HH:MM." });
  }
  if (clockInEnd && !TIME_REGEX.test(clockInEnd)) {
    return res.status(400).json({ success: false, message: "Invalid end time format. Use HH:MM." });
  }
  if (closingTime && !TIME_REGEX.test(closingTime)) {
    return res.status(400).json({ success: false, message: "Invalid closing time format. Use HH:MM." });
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  if (!isManager(workspace, userId)) {
    return res.status(403).json({ success: false, message: "Only the workspace owner or admin can set clock-in settings." });
  }

  // Allow explicit null (to clear a field) as well as a real value.
  // Only skip when the key wasn't sent at all (undefined).
  if (clockInStart !== undefined) workspace.clockInStart = clockInStart;
  if (clockInEnd !== undefined) workspace.clockInEnd = clockInEnd;
  if (closingTime !== undefined) workspace.closingTime = closingTime;
  if (clockInEnabled !== undefined) workspace.clockInEnabled = clockInEnabled;

  await workspace.save();

  console.log("✅ [clockin-settings] saved:", {
    clockInStart: workspace.clockInStart,
    clockInEnd: workspace.clockInEnd,
    closingTime: workspace.closingTime,
    clockInEnabled: workspace.clockInEnabled,
  });

  res.status(200).json({
    success: true,
    message: "Clock-in settings updated.",
    settings: {
      clockInStart: workspace.clockInStart,
      clockInEnd: workspace.clockInEnd,
      closingTime: workspace.closingTime,
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
      clockInEnabled: workspace.clockInEnabled,
    },
  });
});

// ─── Clock‑In (start/end window → early / on-time / late) ─────────

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

  // Check if already clocked in today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existing = await ClockIn.findOne({
    user: userId,
    workspace: workspaceId,
    date: { $gte: today },
    clockOutTime: null,
  });
  if (existing) {
    return res.status(400).json({ success: false, message: "You have already clocked in today and haven't clocked out yet." });
  }

  const now = new Date();

  // Parse start and end times (if set)
  let startDate = null, endDate = null;
  if (workspace.clockInStart) {
    const [hours, minutes] = workspace.clockInStart.split(":").map(Number);
    startDate = new Date(now);
    startDate.setHours(hours, minutes, 0, 0);
  }
  if (workspace.clockInEnd) {
    const [hours, minutes] = workspace.clockInEnd.split(":").map(Number);
    endDate = new Date(now);
    endDate.setHours(hours, minutes, 0, 0);
  }

  let status = "on-time";
  let isLate = false;
  let lateMinutes = 0;
  let isEarly = false;
  let earlyMinutes = 0;

  if (startDate && endDate) {
    const nowMs = now.getTime();
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    if (nowMs < startMs) {
      isEarly = true;
      earlyMinutes = Math.floor((startMs - nowMs) / 60000);
      status = "early";
    } else if (nowMs > endMs) {
      isLate = true;
      lateMinutes = Math.floor((nowMs - endMs) / 60000);
      status = "late";
    } else {
      status = "on-time";
    }
  } else {
    // No range defined — treat as on-time
    status = "on-time";
  }

  const clockInDoc = await ClockIn.create({
    user: userId,
    workspace: workspaceId,
    clockInTime: now,
    date: now,
    status,
    isLate,
    lateMinutes,
    isEarly,
    earlyMinutes,
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
      body: `${userName} clocked in at ${now.toLocaleTimeString()} ${isLate ? `(late by ${lateMinutes} min)` : isEarly ? `(early by ${earlyMinutes} min)` : ""}`,
      data: {
        type: "clockin",
        workspaceId: workspaceId,
        userId: userId,
        clockInId: clockInDoc._id.toString(),
      },
      emailEventType: "newMessage",
      emailHtml: `<p><strong>${userName}</strong> clocked in at ${now.toLocaleTimeString()} ${isLate ? `(late by ${lateMinutes} min)` : isEarly ? `(early by ${earlyMinutes} min)` : ""}</p>`,
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
      earlyMinutes,
    },
  });
});

// ─── Clock‑Out (closingTime → clockOutLate penalty) ────────────────

export const clockOut = asyncHandler(async (req, res) => {
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const clockInDoc = await ClockIn.findOne({
    user: userId,
    workspace: workspaceId,
    date: { $gte: today },
    clockOutTime: null,
  });
  if (!clockInDoc) {
    return res.status(400).json({ success: false, message: "You haven't clocked in today or already clocked out." });
  }

  const now = new Date();
  let clockOutLate = false;
  let clockOutLateMinutes = 0;

  if (workspace.closingTime) {
    const [hours, minutes] = workspace.closingTime.split(":").map(Number);
    const closingDate = new Date(now);
    closingDate.setHours(hours, minutes, 0, 0);
    if (now > closingDate) {
      const diffMs = now - closingDate;
      clockOutLate = true;
      clockOutLateMinutes = Math.floor(diffMs / 60000);
    }
  }

  clockInDoc.clockOutTime = now;
  clockInDoc.clockOutLate = clockOutLate;
  clockInDoc.clockOutLateMinutes = clockOutLateMinutes;
  await clockInDoc.save();

  notifyUsers([userId], {
    title: "✅ Clocked out successfully",
    body: `You clocked out at ${now.toLocaleTimeString()} ${clockOutLate ? `(clocked out ${clockOutLateMinutes} min after closing)` : ""}`,
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

// ─── Leaderboard ──────────────────────────────────────────────────

export const getClockInLeaderboard = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { period = "month" } = req.query; // "week", "month", "all"

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

  const leaderboard = await ClockIn.aggregate([
    {
      $match: {
        workspace: workspace._id,
        clockInTime: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: "$user",
        totalClockIns: { $sum: 1 },
        earlyCount: { $sum: { $cond: ["$isEarly", 1, 0] } },
        onTimeCount: { $sum: { $cond: [{ $eq: ["$status", "on-time"] }, 1, 0] } },
        lateCount: { $sum: { $cond: ["$isLate", 1, 0] } },
        avgEarlyMinutes: { $avg: "$earlyMinutes" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        user: {
          _id: "$user._id",
          name: "$user.name",
          email: "$user.email",
          profile: "$user.profile",
        },
        totalClockIns: 1,
        // Early count = early * 1 + on-time * 0.5 (late adds 0)
        earlyCount: {
          $add: [
            "$earlyCount",
            { $multiply: ["$onTimeCount", 0.5] },
          ],
        },
        onTimeCount: 1,
        lateCount: 1,
        avgEarlyMinutes: { $round: ["$avgEarlyMinutes", 1] },
        // Score: early = 10, on-time = 5, late = 0
        score: {
          $add: [
            { $multiply: ["$earlyCount", 10] },
            { $multiply: ["$onTimeCount", 5] },
          ],
        },
      },
    },
    { $sort: { score: -1 } },
    { $limit: 10 },
  ]);

  res.status(200).json({
    success: true,
    leaderboard,
    period,
  });
});

// ─── Scheduler for reminders (based on start time) ──────────────

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
      console.error("Clock-in scheduler error:", error);
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

    const leaderboardData = await ClockIn.aggregate([
      {
        $match: {
          workspace: workspace._id,
          clockInTime: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$user",
          totalClockIns: { $sum: 1 },
          earlyCount: { $sum: { $cond: ["$isEarly", 1, 0] } },
          onTimeCount: { $sum: { $cond: [{ $eq: ["$status", "on-time"] }, 1, 0] } },
          lateCount: { $sum: { $cond: ["$isLate", 1, 0] } },
          avgEarlyMinutes: { $avg: "$earlyMinutes" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          user: { name: "$user.name", email: "$user.email" },
          earlyCount: 1,
          onTimeCount: 1,
          avgEarlyMinutes: { $round: ["$avgEarlyMinutes", 1] },
          score: {
            $add: [
              "$earlyCount",
              { $multiply: ["$onTimeCount", 0.5] },
            ],
          },
        },
      },
      { $sort: { score: -1 } },
      { $limit: 5 },
    ]);

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