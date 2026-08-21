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

// ─── Notification helper (internal) ────────────────────────────────
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
  const { clockInTime, closingTime, clockInEnabled } = req.body;

  // Validate time format (HH:MM)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (clockInTime && !timeRegex.test(clockInTime)) {
    return res.status(400).json({ success: false, message: "Invalid clock-in time format. Use HH:MM." });
  }
  if (closingTime && !timeRegex.test(closingTime)) {
    return res.status(400).json({ success: false, message: "Invalid closing time format. Use HH:MM." });
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  // Only owner or admin can set settings
  if (!isManager(workspace, userId)) {
    return res.status(403).json({ success: false, message: "Only the workspace owner or admin can set clock-in settings." });
  }

  // Update workspace
  if (clockInTime !== undefined) workspace.clockInTime = clockInTime;
  if (closingTime !== undefined) workspace.closingTime = closingTime;
  if (clockInEnabled !== undefined) workspace.clockInEnabled = clockInEnabled;

  await workspace.save();

  res.status(200).json({
    success: true,
    message: "Clock-in settings updated.",
    settings: {
      clockInTime: workspace.clockInTime,
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

  // Only members can view
  const isMember = workspace.members.some(
    (m) => m.user.toString() === userId && m.status === "active"
  );
  if (!isMember && !isOwner(workspace, userId)) {
    return res.status(403).json({ success: false, message: "You are not a member of this workspace." });
  }

  res.status(200).json({
    success: true,
    settings: {
      clockInTime: workspace.clockInTime,
      closingTime: workspace.closingTime,
      clockInEnabled: workspace.clockInEnabled,
    },
  });
});

// ─── Clock‑In ────────────────────────────────────────────────────────

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
    clockOutTime: null, // still clocked in
  });
  if (existing) {
    return res.status(400).json({ success: false, message: "You have already clocked in today and haven't clocked out yet." });
  }

  // Determine if late or early
  const now = new Date();
  let clockInTimeDate = null;
  if (workspace.clockInTime) {
    const [hours, minutes] = workspace.clockInTime.split(":").map(Number);
    clockInTimeDate = new Date(now);
    clockInTimeDate.setHours(hours, minutes, 0, 0);
  }

  let status = "on-time";
  let isLate = false;
  let lateMinutes = 0;
  let isEarly = false;
  let earlyMinutes = 0;

  if (clockInTimeDate) {
    const diffMs = now - clockInTimeDate;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin > 0) {
      // Late
      isLate = true;
      lateMinutes = diffMin;
      status = "late";
    } else if (diffMin < -5) { // more than 5 minutes early
      isEarly = true;
      earlyMinutes = Math.abs(diffMin);
      status = "early";
    }
  }

  const clockIn = await ClockIn.create({
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

  // Notify admin/owner that someone clocked in
  const adminIds = workspace.members
    .filter((m) => m.role === "Admin" && m.status === "active")
    .map((m) => m.user.toString());
  const ownerId = workspace.owner.toString();
  const recipientIds = [...new Set([...adminIds, ownerId])].filter(id => id !== userId);

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
        clockInId: clockIn._id.toString(),
      },
      emailEventType: "newMessage",
      emailHtml: `<p><strong>${userName}</strong> clocked in at ${now.toLocaleTimeString()} ${isLate ? `(late by ${lateMinutes} min)` : isEarly ? `(early by ${earlyMinutes} min)` : ""}</p>`,
    });
  }

  // Send a confirmation to the user
  notifyUsers([userId], {
    title: "✅ Clocked in successfully",
    body: `You clocked in at ${now.toLocaleTimeString()}`,
    data: { type: "clockin-confirmation" },
  });

  res.status(200).json({
    success: true,
    message: "Clocked in successfully.",
    clockIn: {
      id: clockIn._id,
      time: clockIn.clockInTime,
      status,
      isLate,
      lateMinutes,
      isEarly,
      earlyMinutes,
    },
  });
});

// ─── Clock‑Out ───────────────────────────────────────────────────────

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

  // Find today's clock-in without clock-out
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const clockIn = await ClockIn.findOne({
    user: userId,
    workspace: workspaceId,
    date: { $gte: today },
    clockOutTime: null,
  });
  if (!clockIn) {
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

  clockIn.clockOutTime = now;
  clockIn.clockOutLate = clockOutLate;
  clockIn.clockOutLateMinutes = clockOutLateMinutes;
  await clockIn.save();

  // Send confirmation to user
  notifyUsers([userId], {
    title: "✅ Clocked out successfully",
    body: `You clocked out at ${now.toLocaleTimeString()} ${clockOutLate ? `(clocked out ${clockOutLateMinutes} min after closing)` : ""}`,
    data: { type: "clockout-confirmation" },
  });

  res.status(200).json({
    success: true,
    message: "Clocked out successfully.",
    clockOut: {
      id: clockIn._id,
      time: clockIn.clockOutTime,
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

// ─── Get All Clock‑Ins for Workspace (admin/owner) ────────────────

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

// ─── Leaderboard ────────────────────────────────────────────────────

export const getClockInLeaderboard = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { period = "month" } = req.query; // "week", "month", "all"

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  // Determine date range
  const now = new Date();
  let startDate;
  if (period === "week") {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else if (period === "month") {
    startDate = new Date(now);
    startDate.setMonth(now.getMonth() - 1);
  } else {
    startDate = new Date(0); // beginning of time
  }

  // Aggregation pipeline: group by user, count early/on-time/late, and compute score
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
        earlyCount: 1,
        onTimeCount: 1,
        lateCount: 1,
        avgEarlyMinutes: { $round: ["$avgEarlyMinutes", 1] },
        score: {
          $add: [
            { $multiply: ["$earlyCount", 10] },   // +10 per early arrival
            { $multiply: ["$onTimeCount", 2] },   // +2 per on-time arrival (reward consistency)
            { $multiply: ["$lateCount", -5] },    // -5 per late arrival
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

// ─── Scheduler for reminders ────────────────────────────────────────

export const startClockInScheduler = () => {
  // Run every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);

      // Find workspaces with clock-in enabled and clockInTime set
      const workspaces = await Workspace.find({
        clockInEnabled: true,
        clockInTime: { $ne: null },
      });

      for (const workspace of workspaces) {
        const clockInTime = workspace.clockInTime;
        const [hours, minutes] = clockInTime.split(":").map(Number);
        const target = new Date(now);
        target.setHours(hours, minutes, 0, 0);
        const diffMinutes = Math.floor((target - now) / 60000);

        // Send reminders at 30 and 10 minutes before
        if (diffMinutes === 30 || diffMinutes === 10) {
          const memberIds = workspace.members
            .filter((m) => m.status === "active")
            .map((m) => m.user.toString());
          const ownerId = workspace.owner.toString();
          const allIds = [...new Set([...memberIds, ownerId])];

          const minutesText = diffMinutes === 30 ? "30 minutes" : "10 minutes";
          notifyUsers(allIds, {
            title: `⏰ Clock-in in ${minutesText}`,
            body: `Clock-in time is at ${clockInTime}. Don't forget to clock in!`,
            data: {
              type: "clockin-reminder",
              workspaceId: workspace._id.toString(),
            },
            emailEventType: "newMessage",
            emailHtml: `<p>Reminder: Clock-in is at <strong>${clockInTime}</strong>. Please clock in on time.</p>`,
          });
        }
      }
    } catch (error) {
      console.error("Clock-in scheduler error:", error);
    }
  });
};

// ─── Monthly leaderboard email ─────────────────────────────────────

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
          avgEarlyMinutes: { $round: ["$avgEarlyMinutes", 1] },
          score: {
            $add: [
              { $multiply: ["$earlyCount", 10] },
              { $multiply: [{ $subtract: [100, "$avgEarlyMinutes"] }, 1] },
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

// ─── Send monthly leaderboard emails for all workspaces ────────────
// 👇 ADD THIS FUNCTION

export const sendMonthlyLeaderboardForAllWorkspaces = async () => {
  try {
    const workspaces = await Workspace.find({ clockInEnabled: true });
    for (const workspace of workspaces) {
      await sendMonthlyLeaderboard(workspace._id);
    }
    console.log(`✅ Monthly leaderboard emails sent for ${workspaces.length} workspaces.`);
  } catch (error) {
    console.error('❌ sendMonthlyLeaderboardForAllWorkspaces error:', error);
  }
};

// ─── Endpoint to manually trigger monthly leaderboard email ──────

export const triggerMonthlyLeaderboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return res.status(404).json({ success: false, message: "Workspace not found." });
  }

  // Only owner or admin can trigger
  if (!isManager(workspace, userId)) {
    return res.status(403).json({ success: false, message: "Only workspace owner or admin can trigger monthly report." });
  }

  await sendMonthlyLeaderboard(workspaceId);
  res.status(200).json({ success: true, message: "Monthly leaderboard email sent." });
});