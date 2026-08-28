// controllers/clockInController.js

import ClockIn from "../models/clockInModel.js";
import Workspace from "../models/workspaceModel.js";
import User from "../models/userModel.js";
import asyncHandler from "express-async-handler";
import { createAndSendNotification } from "./notificationController.js";
import { sendMonthlyLeaderboardEmail } from "../utils/sendClockinEmail.js";
import cron from "node-cron";

// ─────────────────────────────────────────────────────────────
// TIMEZONE
// ─────────────────────────────────────────────────────────────

const BUSINESS_TIMEZONE = "Africa/Lagos";
const TIMEZONE_OFFSET_MINUTES = 60;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

const getLagosParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const result = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = Number(part.value);
    }
  }
  return result;
};

const getLagosDateKey = (date = new Date()) => {
  const parts = getLagosParts(date);
  return [
    parts.year,
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
};

const getLagosMinutes = (date = new Date()) => {
  const parts = getLagosParts(date);
  return parts.hour * 60 + parts.minute;
};

const timeToMinutes = (hhmm) => {
  if (!hhmm) return null;
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
};

const makeLagosDate = (dateKey, hhmm) => {
  if (!dateKey || !hhmm) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = hhmm.split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes, 0, 0) -
      TIMEZONE_OFFSET_MINUTES * 60 * 1000
  );
};

const timeOnDate = (base, hhmm) => {
  if (!hhmm) return null;
  const dateKey = getLagosDateKey(base);
  return makeLagosDate(dateKey, hhmm);
};

const getLagosDayStart = (date = new Date()) => {
  const dateKey = getLagosDateKey(date);
  return makeLagosDate(dateKey, "00:00");
};

const getLagosNextDayStart = (date = new Date()) => {
  const start = getLagosDayStart(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
};

const formatLagosTime = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
};

const formatLagosDateTime = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
};

// ─────────────────────────────────────────────────────────────
// Notification helper
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Set Clock-In Settings
// ─────────────────────────────────────────────────────────────

export const setClockInSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;

  console.log("\n🔧 [setClockInSettings] ── INCOMING REQUEST ──────────");
  console.log("🔧 workspaceId:", workspaceId);
  console.log("🔧 userId:", userId);
  console.log("🔧 raw req.body:", JSON.stringify(req.body, null, 2));

  const {
    clockInStart,
    clockInEnd,
    closingTime,
    clockInEnabled,
    autoClockoutEnabled,
  } = req.body;

  console.log("🔧 destructured autoClockoutEnabled:", autoClockoutEnabled, "| typeof:", typeof autoClockoutEnabled);

  if (clockInStart && !TIME_REGEX.test(clockInStart)) {
    return res.status(400).json({
      success: false,
      message: "Invalid start time format. Use HH:MM.",
    });
  }

  if (clockInEnd && !TIME_REGEX.test(clockInEnd)) {
    return res.status(400).json({
      success: false,
      message: "Invalid end time format. Use HH:MM.",
    });
  }

  if (closingTime && !TIME_REGEX.test(closingTime)) {
    return res.status(400).json({
      success: false,
      message: "Invalid closing time format. Use HH:MM.",
    });
  }

  if (clockInStart && clockInEnd && clockInStart >= clockInEnd) {
    return res.status(400).json({
      success: false,
      message: "Clock-in start must be before clock-in end.",
    });
  }

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    console.log("🔧 ❌ Workspace not found for id:", workspaceId);
    return res.status(404).json({
      success: false,
      message: "Workspace not found.",
    });
  }

  console.log("🔧 BEFORE update — workspace.autoClockoutEnabled:", workspace.autoClockoutEnabled);

  if (!isManager(workspace, userId)) {
    console.log("🔧 ❌ User is not manager (owner/admin). Blocked.");
    return res.status(403).json({
      success: false,
      message:
        "Only the workspace owner or admin can set clock-in settings.",
    });
  }

  if (clockInStart !== undefined) {
    workspace.clockInStart = clockInStart;
  }

  if (clockInEnd !== undefined) {
    workspace.clockInEnd = clockInEnd;
  }

  if (closingTime !== undefined) {
    workspace.closingTime = closingTime;
  }

  if (clockInEnabled !== undefined) {
    workspace.clockInEnabled = clockInEnabled;
  }

  if (autoClockoutEnabled !== undefined) {
    console.log("🔧 ✅ Setting workspace.autoClockoutEnabled to:", autoClockoutEnabled);
    workspace.autoClockoutEnabled = autoClockoutEnabled;
  } else {
    console.log("🔧 ⚠️ autoClockoutEnabled is undefined in req.body — NOT touching the field. This is why it stays unchanged if the frontend didn't send it.");
  }

  console.log("🔧 AFTER assignment (pre-save) — workspace.autoClockoutEnabled:", workspace.autoClockoutEnabled);
  console.log("🔧 workspace.isModified('autoClockoutEnabled'):", workspace.isModified("autoClockoutEnabled"));

  const saved = await workspace.save();

  console.log("🔧 AFTER save() — saved.autoClockoutEnabled:", saved.autoClockoutEnabled);

  // Re-fetch fresh from DB to prove it actually persisted, not just in-memory
  const verifyDoc = await Workspace.findById(workspaceId).select("autoClockoutEnabled").lean();
  console.log("🔧 VERIFY — fresh read from DB:", verifyDoc.autoClockoutEnabled);
  console.log("🔧 ── END setClockInSettings ──────────────────────\n");

  res.status(200).json({
    success: true,
    message: "Clock-in settings updated.",
    timezone: BUSINESS_TIMEZONE,
    settings: {
      clockInStart: workspace.clockInStart,
      clockInEnd: workspace.clockInEnd,
      closingTime: workspace.closingTime,
      clockInEnabled: workspace.clockInEnabled,
      autoClockoutEnabled: workspace.autoClockoutEnabled,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// Get Clock-In Settings
// ─────────────────────────────────────────────────────────────

export const getClockInSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    return res.status(404).json({
      success: false,
      message: "Workspace not found.",
    });
  }

  console.log("🔍 [getClockInSettings] returning autoClockoutEnabled:", workspace.autoClockoutEnabled);

  const isMember = workspace.members.some(
    (m) => m.user.toString() === userId && m.status === "active"
  );

  if (!isMember && !isOwner(workspace, userId)) {
    return res.status(403).json({
      success: false,
      message: "You are not a member of this workspace.",
    });
  }

  res.status(200).json({
    success: true,
    timezone: BUSINESS_TIMEZONE,
    currentNigeriaTime: formatLagosDateTime(),
    settings: {
      clockInStart: workspace.clockInStart,
      clockInEnd: workspace.clockInEnd,
      closingTime: workspace.closingTime,
      clockInEnabled: workspace.clockInEnabled,
      autoClockoutEnabled: workspace.autoClockoutEnabled,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// Clock-In
// ─────────────────────────────────────────────────────────────

export const clockIn = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    return res.status(404).json({
      success: false,
      message: "Workspace not found.",
    });
  }

  const membership = workspace.members.find(
    (m) => m.user.toString() === userId && m.status === "active"
  );

  if (!membership && !isOwner(workspace, userId)) {
    return res.status(403).json({
      success: false,
      message: "You are not an active member of this workspace.",
    });
  }

  if (!workspace.clockInEnabled) {
    return res.status(400).json({
      success: false,
      message: "Clock-in is currently disabled for this workspace.",
    });
  }

  const now = new Date();

  const today = getLagosDayStart(now);
  const tomorrow = getLagosNextDayStart(now);

  // 1. Check if already clocked in today without clocking out
  const openRecord = await ClockIn.findOne({
    user: userId,
    workspace: workspaceId,
    date: { $gte: today, $lt: tomorrow },
    clockOutTime: null,
  });

  if (openRecord) {
    return res.status(400).json({
      success: false,
      message:
        "You have already clocked in today and haven't clocked out yet.",
    });
  }

  // 2. Check if already clocked out today (cannot clock in again)
  const closedRecord = await ClockIn.findOne({
    user: userId,
    workspace: workspaceId,
    date: { $gte: today, $lt: tomorrow },
    clockOutTime: { $ne: null },
  });

  if (closedRecord) {
    return res.status(400).json({
      success: false,
      message:
        "You have already clocked out today. You can only clock in once per day.",
    });
  }

  const currentNigeriaMinutes = getLagosMinutes(now);

  const startMinutes = timeToMinutes(workspace.clockInStart);
  const endMinutes = timeToMinutes(workspace.clockInEnd);
  const closingMinutes = timeToMinutes(workspace.closingTime);

  if (
    closingMinutes !== null &&
    currentNigeriaMinutes > closingMinutes
  ) {
    return res.status(400).json({
      success: false,
      message: `Clock-in is not allowed after closing time (${workspace.closingTime}).`,
    });
  }

  if (
    startMinutes !== null &&
    currentNigeriaMinutes < startMinutes
  ) {
    return res.status(400).json({
      success: false,
      message: `Clock-in not yet open. It starts at ${workspace.clockInStart}.`,
      timezone: BUSINESS_TIMEZONE,
      currentTime: formatLagosTime(now),
    });
  }

  let isLate = false;
  let lateMinutes = 0;

  if (
    endMinutes !== null &&
    currentNigeriaMinutes > endMinutes
  ) {
    isLate = true;
    lateMinutes = currentNigeriaMinutes - endMinutes;
  }

  const status = isLate ? "late" : "on-time";
  const isEarly = !isLate;

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

  const adminIds = workspace.members
    .filter((m) => m.role === "Admin" && m.status === "active")
    .map((m) => m.user.toString());

  const ownerId = workspace.owner.toString();

  const recipientIds = [
    ...new Set([...adminIds, ownerId]),
  ].filter((id) => id !== userId);

  const user = await User.findById(userId).select("name");
  const userName = user?.name || "A member";

  const nigeriaTime = formatLagosTime(now);

  if (recipientIds.length > 0) {
    notifyUsers(recipientIds, {
      title: `⏰ ${userName} clocked in`,
      body: `${userName} clocked in at ${nigeriaTime} (${status})`,
      data: {
        type: "clockin",
        workspaceId,
        userId,
        clockInId: clockInDoc._id.toString(),
      },
      emailEventType: "newMessage",
      emailHtml: `<p><strong>${userName}</strong> clocked in at ${nigeriaTime} (${status})</p>`,
    });
  }

  notifyUsers([userId], {
    title: "✅ Clocked in successfully",
    body: `You clocked in at ${nigeriaTime} (${status})`,
    data: {
      type: "clockin-confirmation",
    },
  });

  res.status(200).json({
    success: true,
    message: "Clocked in successfully.",
    timezone: BUSINESS_TIMEZONE,
    clockIn: {
      id: clockInDoc._id,
      time: clockInDoc.clockInTime,
      localTime: nigeriaTime,
      status,
      isLate,
      lateMinutes,
      isEarly,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// Clock-Out
// ─────────────────────────────────────────────────────────────

export const clockOut = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;
  const { reason } = req.body;

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    return res.status(404).json({
      success: false,
      message: "Workspace not found.",
    });
  }

  const membership = workspace.members.find(
    (m) => m.user.toString() === userId && m.status === "active"
  );

  if (!membership && !isOwner(workspace, userId)) {
    return res.status(403).json({
      success: false,
      message: "You are not an active member of this workspace.",
    });
  }

  const now = new Date();

  const today = getLagosDayStart(now);
  const tomorrow = getLagosNextDayStart(now);

  const clockInDoc = await ClockIn.findOne({
    user: userId,
    workspace: workspaceId,
    date: { $gte: today, $lt: tomorrow },
    clockOutTime: null,
  });

  if (!clockInDoc) {
    return res.status(400).json({
      success: false,
      message:
        "You haven't clocked in today or already clocked out.",
    });
  }

  const currentNigeriaMinutes = getLagosMinutes(now);
  const closingMinutes = timeToMinutes(workspace.closingTime);

  // If clocking out before closing time, require a reason
  if (
    closingMinutes !== null &&
    currentNigeriaMinutes < closingMinutes
  ) {
    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: `You are clocking out before closing time (${workspace.closingTime}). Please provide a reason.`,
      });
    }
  }

  let clockOutLate = false;
  let clockOutLateMinutes = 0;

  if (
    closingMinutes !== null &&
    currentNigeriaMinutes > closingMinutes
  ) {
    clockOutLate = true;
    clockOutLateMinutes = currentNigeriaMinutes - closingMinutes;
  }

  clockInDoc.clockOutTime = now;
  clockInDoc.clockOutLate = clockOutLate;
  clockInDoc.clockOutLateMinutes = clockOutLateMinutes;
  if (reason) {
    clockInDoc.clockOutReason = reason.trim();
  }

  await clockInDoc.save();

  const adminIds = workspace.members
    .filter((m) => m.role === "Admin" && m.status === "active")
    .map((m) => m.user.toString());

  const ownerId = workspace.owner.toString();

  const recipientIds = [
    ...new Set([...adminIds, ownerId]),
  ].filter((id) => id !== userId);

  const user = await User.findById(userId).select("name");
  const userName = user?.name || "A member";

  const nigeriaTime = formatLagosTime(now);

  if (recipientIds.length > 0) {
    notifyUsers(recipientIds, {
      title: `⏰ ${userName} clocked out`,
      body: `${userName} clocked out at ${nigeriaTime}${
        reason ? ` — Reason: ${reason.trim()}` : ""
      }`,
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
    body: `You clocked out at ${nigeriaTime}${
      clockOutLate
        ? ` (clocked out ${clockOutLateMinutes} min after closing)`
        : ""
    }${reason ? ` (Reason: ${reason})` : ""}`,
    data: {
      type: "clockout-confirmation",
    },
  });

  res.status(200).json({
    success: true,
    message: "Clocked out successfully.",
    timezone: BUSINESS_TIMEZONE,
    clockOut: {
      id: clockInDoc._id,
      time: clockInDoc.clockOutTime,
      localTime: nigeriaTime,
      clockOutLate,
      clockOutLateMinutes,
      reason: clockInDoc.clockOutReason || null,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// Get User Clock-In History
// ─────────────────────────────────────────────────────────────

export const getUserClockInHistory = asyncHandler(
  async (req, res) => {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    const membership = workspace.members.find(
      (m) =>
        m.user.toString() === userId &&
        m.status === "active"
    );

    if (!membership && !isOwner(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this workspace.",
      });
    }

    const skip = (page - 1) * limit;

    const query = {
      user: userId,
      workspace: workspaceId,
    };

    const history = await ClockIn.find(query)
      .sort({ clockInTime: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await ClockIn.countDocuments(query);

    res.status(200).json({
      success: true,
      history,
      timezone: BUSINESS_TIMEZONE,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  }
);

// ─────────────────────────────────────────────────────────────
// Get All Clock-Ins for Workspace
// ─────────────────────────────────────────────────────────────

export const getWorkspaceClockIns = asyncHandler(
  async (req, res) => {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { date, page = 1, limit = 30 } = req.query;

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    if (!isManager(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message: "Only admins or owner can view all clock-ins.",
      });
    }

    const query = {
      workspace: workspaceId,
    };

    if (date) {
      const start = makeLagosDate(date, "00:00");
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

      query.clockInTime = {
        $gte: start,
        $lte: end,
      };
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
      timezone: BUSINESS_TIMEZONE,
      clockIns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  }
);

// ─────────────────────────────────────────────────────────────
// Attendance Summary
// ─────────────────────────────────────────────────────────────

export const getAttendanceSummary = asyncHandler(
  async (req, res) => {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { date } = req.query;

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    if (!isManager(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message:
          "Only admins or owner can view attendance summary.",
      });
    }

    let targetDateKey = getLagosDateKey();

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Use YYYY-MM-DD.",
        });
      }
      targetDateKey = date;
    }

    const startOfDay = makeLagosDate(
      targetDateKey,
      "00:00"
    );

    const endOfDay = new Date(
      startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1
    );

    const memberIds = workspace.members
      .filter((m) => m.status === "active")
      .map((m) => m.user.toString());

    if (!memberIds.includes(workspace.owner.toString())) {
      memberIds.push(workspace.owner.toString());
    }

    const clockIns = await ClockIn.find({
      workspace: workspaceId,
      clockInTime: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }).populate("user", "name email profile");

    const clockedInIds = clockIns.map((c) =>
      c.user._id.toString()
    );

    const notClockedInIds = memberIds.filter(
      (id) => !clockedInIds.includes(id)
    );

    const clockedInUsers = await User.find({
      _id: { $in: clockedInIds },
    }).select("name email profile");

    const notClockedInUsers = await User.find({
      _id: { $in: notClockedInIds },
    }).select("name email profile");

    res.status(200).json({
      success: true,
      timezone: BUSINESS_TIMEZONE,
      date: targetDateKey,
      totalMembers: memberIds.length,
      clockedIn: clockedInUsers.map((u) => {
        const record = clockIns.find(
          (c) =>
            c.user._id.toString() ===
            u._id.toString()
        );

        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          profile: u.profile,
          clockInTime: record?.clockInTime,
          clockInLocalTime: record
            ? formatLagosDateTime(record.clockInTime)
            : null,
          status: record?.status,
          isLate: record?.isLate,
          autoClockedOut: record?.autoClockedOut,
        };
      }),
      notClockedIn: notClockedInUsers,
    });
  }
);

// ─────────────────────────────────────────────────────────────
// Leaderboard Helper
// ─────────────────────────────────────────────────────────────

const getLeaderboardData = async (
  workspaceId,
  startDate,
  endDate = new Date(),
  limit = 10
) => {
  const allClockIns = await ClockIn.find({
    workspace: workspaceId,
    clockInTime: {
      $gte: startDate,
      $lte: endDate,
    },
  })
    .sort({ clockInTime: 1 })
    .populate("user", "name email profile")
    .lean();

  const byDay = {};

  for (const record of allClockIns) {
    if (!record.user) continue;
    const dayKey = getLagosDateKey(record.clockInTime);
    if (!byDay[dayKey]) {
      byDay[dayKey] = [];
    }
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

    const onTime = dayRecords
      .filter(
        (r) =>
          r.status === "on-time" ||
          r.status === "early"
      )
      .sort(
        (a, b) =>
          new Date(a.clockInTime) -
          new Date(b.clockInTime)
      );

    const late = dayRecords.filter(
      (r) => r.status === "late"
    );

    onTime.forEach((record, index) => {
      const stat = ensureUser(record);
      stat.onTimeCount += 1;
      stat.totalPoints +=
        index < TOP_POINTS.length
          ? TOP_POINTS[index]
          : PARTICIPATION_POINTS;
    });

    late.forEach((record) => {
      const stat = ensureUser(record);
      stat.lateCount += 1;
      stat.totalLateMinutes +=
        record.lateMinutes || 0;
    });
  }

  const leaderboard = Object.values(userStats).map(
    (u) => ({
      user: {
        _id: u.userId,
        name: u.name,
        email: u.email,
        profile: u.profile,
      },
      totalPoints: u.totalPoints,
      earlyCount: u.onTimeCount,
      lateCount: u.lateCount,
      avgLateMinutes:
        u.lateCount > 0
          ? Math.round(
              (u.totalLateMinutes /
                u.lateCount) *
                10
            ) / 10
          : 0,
      score: u.totalPoints,
    })
  );

  leaderboard.sort(
    (a, b) => b.score - a.score
  );

  return leaderboard.slice(0, limit);
};

// ─────────────────────────────────────────────────────────────
// Leaderboard Endpoint
// ─────────────────────────────────────────────────────────────

export const getClockInLeaderboard = asyncHandler(
  async (req, res) => {
    const { workspaceId } = req.params;
    const { period = "month" } = req.query;

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    const now = new Date();

    let startDate;

    if (period === "week") {
      startDate = new Date(
        now.getTime() -
          7 * 24 * 60 * 60 * 1000
      );
    } else if (period === "month") {
      startDate = new Date(now);
      startDate.setUTCMonth(
        startDate.getUTCMonth() - 1
      );
    } else {
      startDate = new Date(0);
    }

    const leaderboard = await getLeaderboardData(
      workspaceId,
      startDate,
      now,
      10
    );

    res.status(200).json({
      success: true,
      timezone: BUSINESS_TIMEZONE,
      leaderboard,
      period,
    });
  }
);

// ─────────────────────────────────────────────────────────────
// Clock-In Reminder Scheduler
// ─────────────────────────────────────────────────────────────

export const startClockInScheduler = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const currentNigeriaMinutes = getLagosMinutes(now);

      const workspaces = await Workspace.find({
        clockInEnabled: true,
        clockInStart: { $ne: null },
      });

      for (const workspace of workspaces) {
        const startMinutes = timeToMinutes(
          workspace.clockInStart
        );

        if (startMinutes === null) continue;

        const diffMinutes =
          startMinutes - currentNigeriaMinutes;

        if (
          diffMinutes === 30 ||
          diffMinutes === 10
        ) {
          const memberIds = workspace.members
            .filter(
              (m) => m.status === "active"
            )
            .map((m) => m.user.toString());

          const ownerId =
            workspace.owner.toString();

          const allIds = [
            ...new Set([
              ...memberIds,
              ownerId,
            ]),
          ];

          const minutesText =
            diffMinutes === 30
              ? "30 minutes"
              : "10 minutes";

          notifyUsers(allIds, {
            title: `⏰ Clock-in in ${minutesText}`,
            body: `Clock-in window opens at ${workspace.clockInStart} Nigeria time. Don't forget to clock in!`,
            data: {
              type: "clockin-reminder",
              workspaceId:
                workspace._id.toString(),
            },
            emailEventType: "newMessage",
            emailHtml: `<p>Reminder: Clock-in starts at <strong>${workspace.clockInStart}</strong> Nigeria time. Please clock in on time.</p>`,
          });
        }
      }
    } catch (error) {
      console.error(
        "Clock-in reminder scheduler error:",
        error
      );
    }
  });
};

// ─────────────────────────────────────────────────────────────
// Automatic Clock-Out Scheduler (including cleanup)
// ─────────────────────────────────────────────────────────────

export const startAutoClockOutScheduler = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const currentNigeriaMinutes = getLagosMinutes(now);
      const todayStart = getLagosDayStart(now);

      const workspaces = await Workspace.find({
        clockInEnabled: true,
        closingTime: { $ne: null },
        autoClockoutEnabled: true,
      });

      for (const workspace of workspaces) {
        const closingMinutes = timeToMinutes(workspace.closingTime);
        const startMinutes = timeToMinutes(workspace.clockInStart);

        // ── 1. Auto‑clock‑out at closing time (existing) ──
        if (closingMinutes !== null) {
          const diff = currentNigeriaMinutes - closingMinutes;
          if (diff >= 0 && diff < 5) {
            const openRecords = await ClockIn.find({
              workspace: workspace._id,
              clockOutTime: null,
              clockInTime: {
                $gte: todayStart,
                $lt: getLagosNextDayStart(now),
              },
            });

            if (openRecords.length > 0) {
              const closingDate = timeOnDate(now, workspace.closingTime);
              for (const record of openRecords) {
                record.clockOutTime = closingDate;
                record.clockOutLate = false;
                record.clockOutLateMinutes = 0;
                record.autoClockedOut = true;
                await record.save();

                notifyUsers([record.user], {
                  title: "⏰ Auto clock‑out",
                  body: `You were automatically clocked out at closing time (${workspace.closingTime} Nigeria time).`,
                  data: { type: "auto-clockout" },
                });
              }
              console.log(
                `✅ Auto clock‑out completed for workspace ${workspace.name} (${openRecords.length} users) at ${formatLagosTime(now)} Nigeria time.`
              );
            }
          }
        }

        // ── 2. NEW: Cleanup previous days' open records 1 hour before clock‑in ──
        if (startMinutes !== null) {
          let cleanupMinute = startMinutes - 60;
          if (cleanupMinute < 0) cleanupMinute += 1440; // wrap around midnight

          if (currentNigeriaMinutes === cleanupMinute) {
            // Find all open records with clockInTime before today
            const openRecords = await ClockIn.find({
              workspace: workspace._id,
              clockOutTime: null,
              clockInTime: { $lt: todayStart },
            });

            if (openRecords.length > 0) {
              const closingTime = workspace.closingTime || "23:59";
              for (const record of openRecords) {
                // Set clockOutTime to the closing time of the day they clocked in
                const closingDate = makeLagosDate(
                  getLagosDateKey(record.clockInTime),
                  closingTime
                );
                record.clockOutTime = closingDate || record.clockInTime;
                record.clockOutLate = false;
                record.clockOutLateMinutes = 0;
                record.autoClockedOut = true;
                await record.save();

                await notifyUsers([record.user], {
                  title: "⏰ Auto clock‑out (previous day)",
                  body: `Your clock‑in from ${formatLagosDateTime(record.clockInTime)} was automatically closed because you forgot to clock out.`,
                  data: { type: "auto-clockout-cleanup" },
                });
              }

              console.log(
                `✅ Cleaned up ${openRecords.length} open records for workspace ${workspace.name} (1h before clock‑in).`
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Auto clock‑out scheduler error:", error);
    }
  });
};

// ─────────────────────────────────────────────────────────────
// Monthly Leaderboard Email
// ─────────────────────────────────────────────────────────────

export const sendMonthlyLeaderboard = async (
  workspaceId
) => {
  try {
    const workspace = await Workspace.findById(
      workspaceId
    );

    if (!workspace) return;

    const now = new Date();
    const startDate = new Date(now);
    startDate.setUTCMonth(
      startDate.getUTCMonth() - 1
    );

    const leaderboardData = await getLeaderboardData(
      workspaceId,
      startDate,
      now,
      5
    );

    if (leaderboardData.length === 0) return;

    const emails = leaderboardData.map(
      (item) => item.user.email
    );

    const owner = await User.findById(
      workspace.owner
    ).select("email");

    const ownerEmail = owner?.email;

    const recipients = [
      ...emails,
      ...(ownerEmail ? [ownerEmail] : []),
    ];

    await sendMonthlyLeaderboardEmail(
      recipients,
      workspace.name,
      leaderboardData,
      startDate
    );
  } catch (error) {
    console.error(
      "Monthly leaderboard email error:",
      error
    );
  }
};

// ─────────────────────────────────────────────────────────────
// Monthly Leaderboard For All Workspaces
// ─────────────────────────────────────────────────────────────

export const sendMonthlyLeaderboardForAllWorkspaces =
  async () => {
    try {
      const workspaces = await Workspace.find({
        clockInEnabled: true,
      });

      for (const workspace of workspaces) {
        await sendMonthlyLeaderboard(
          workspace._id
        );
      }

      console.log(
        `✅ Monthly leaderboard emails sent for ${workspaces.length} workspaces.`
      );
    } catch (error) {
      console.error(
        "❌ sendMonthlyLeaderboardForAllWorkspaces error:",
        error
      );
    }
  };

// ─────────────────────────────────────────────────────────────
// Trigger Monthly Leaderboard
// ─────────────────────────────────────────────────────────────

export const triggerMonthlyLeaderboard =
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(
      workspaceId
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    if (!isManager(workspace, userId)) {
      return res.status(403).json({
        success: false,
        message:
          "Only workspace owner or admin can trigger monthly report.",
      });
    }

    await sendMonthlyLeaderboard(
      workspaceId
    );

    res.status(200).json({
      success: true,
      message:
        "Monthly leaderboard email sent.",
    });
  });

  // ─────────────────────────────────────────────────────────────
// Startup cleanup: close all open records from previous days
// ─────────────────────────────────────────────────────────────

export const closeAllOpenRecordsFromPreviousDays = async () => {
  try {
    const now = new Date();
    const todayStart = getLagosDayStart(now);

    // Find all open records where clockInTime is before today
    const openRecords = await ClockIn.find({
      clockOutTime: null,
      clockInTime: { $lt: todayStart },
    });

    if (openRecords.length === 0) {
      console.log("✅ No open records from previous days found.");
      return;
    }

    console.log(`🔄 Closing ${openRecords.length} open records from previous days...`);

    for (const record of openRecords) {
      // Fetch workspace to get closingTime (or fallback)
      const workspace = await Workspace.findById(record.workspace);
      const closingTime = workspace?.closingTime || "23:59";

      // Set clockOutTime to the closing time of the day they clocked in
      const closingDate = makeLagosDate(
        getLagosDateKey(record.clockInTime),
        closingTime
      );
      record.clockOutTime = closingDate || record.clockInTime; // fallback
      record.clockOutLate = false;
      record.clockOutLateMinutes = 0;
      record.autoClockedOut = true;
      await record.save();

      // Notify the user (optional)
      await notifyUsers([record.user], {
        title: "⏰ Auto clock‑out (previous day)",
        body: `Your clock‑in from ${formatLagosDateTime(record.clockInTime)} was automatically closed because you forgot to clock out.`,
        data: { type: "auto-clockout-cleanup" },
      });
    }

    console.log(`✅ Successfully closed ${openRecords.length} open records from previous days.`);
  } catch (error) {
    console.error("❌ Startup cleanup error:", error);
  }
};