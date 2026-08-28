// scripts/clockOutPreviousDay.js

import cron from "node-cron";
import ClockIn from "../models/clockInModel.js";
import Workspace from "../models/workspaceModel.js";
import { createAndSendNotification } from "../controllers/notificationController.js";

// ─── Timezone helpers (copied from controller) ──────────────────────────────
const BUSINESS_TIMEZONE = "Africa/Lagos";
const TIMEZONE_OFFSET_MINUTES = 60;

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

const getLagosDayStart = (date = new Date()) => {
  const dateKey = getLagosDateKey(date);
  return makeLagosDate(dateKey, "00:00");
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

// ─── Notification helper ────────────────────────────────────────────────────
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

// ─── Core cleanup function ──────────────────────────────────────────────────
export const closePreviousDayOpenRecords = async (workspaceId) => {
  const now = new Date();
  const todayStart = getLagosDayStart(now);

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return;

  const closingTime = workspace.closingTime || "23:59";

  const openRecords = await ClockIn.find({
    workspace: workspaceId,
    clockOutTime: null,
    clockInTime: { $lt: todayStart },
  });

  if (openRecords.length === 0) return;

  for (const record of openRecords) {
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
      body: `Your clock‑in from ${formatLagosDateTime(
        record.clockInTime
      )} was automatically closed because you forgot to clock out.`,
      data: { type: "auto-clockout-cleanup" },
    });
  }

  console.log(
    `✅ Closed ${openRecords.length} previous‑day records for workspace ${workspace.name}`
  );
};

// ─── Run cleanup for all workspaces that are 10 min before clock‑in ──────
export const runClockOutPreviousDayForAllWorkspaces = async () => {
  try {
    const now = new Date();
    const currentMinutes = getLagosMinutes(now);

    const workspaces = await Workspace.find({
      clockInEnabled: true,
      clockInStart: { $ne: null },
    });

    for (const workspace of workspaces) {
      const startMinutes = timeToMinutes(workspace.clockInStart);
      if (startMinutes === null) continue;

      const targetMinute = (startMinutes - 10 + 1440) % 1440;
      if (currentMinutes === targetMinute) {
        await closePreviousDayOpenRecords(workspace._id);
      }
    }
  } catch (error) {
    console.error("❌ runClockOutPreviousDayForAllWorkspaces error:", error);
  }
};

// ─── Scheduler ─────────────────────────────────────────────────────────────
export const startClockOutPreviousDayScheduler = () => {
  cron.schedule("* * * * *", async () => {
    await runClockOutPreviousDayForAllWorkspaces();
  });
  console.log("⏰ Previous‑day cleanup scheduler started (runs every minute).");
};