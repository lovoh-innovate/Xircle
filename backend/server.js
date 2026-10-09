import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import path from "path";
import { fileURLToPath } from "url";

// Routes
import userRoutes from "./routes/userRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import messagingRoutes from "./routes/messagingRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import notificationRoutes from './routes/notificationRoutes.js';
import personalTaskRoutes from './routes/personalTaskRoutes.js';
import appRoutes from './routes/appRoutes.js';
import clockInRoutes from './routes/clockInRoutes.js';
import personalNoteRoutes from "./routes/personalNoteRoutes.js";
import workspaceNoteRoutes from "./routes/workspaceNoteRoutes.js";
import stickerRoutes from './routes/stickerRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import todayRoutes from './routes/todayRoutes.js';
import googleCalendarRoutes from './routes/googleCalendarRoutes.js';

import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { initSocket } from "./controllers/socket.js";

import { checkAndSendReminders } from "./controllers/taskController.js";
import {
  startClockInScheduler,
  startAutoClockOutScheduler,
  sendMonthlyLeaderboardForAllWorkspaces,
} from "./controllers/clockInController.js";
import { sendDailyDigest } from "./controllers/todayController.js";

// 👇 Standalone cleanup script
import {
  startClockOutPreviousDayScheduler,
  runClockOutPreviousDayForAllWorkspaces,
} from "./scripts/clockOutPreviousDay.js";

// 👇 ADDED — the model itself, for the /share/:link OG endpoint below
import PersonalNote from "./models/personalNoteModel.js";

dotenv.config();

// ─── Fix __dirname for ES modules ──────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8000;
const MONGO_URL = process.env.MONGO_URL;

// ── Middleware ──
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// ── CORS ──
const allowedOrigins = [
  'http://localhost:9000',
  'https://xircle.lovohcreate.com',
  'http://localhost',
  'https://localhost',
  'https://www.xircle.in',
  'https://.xircle.in',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`❌ CORS blocked origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

// ─── Serve static files (uploads) ──────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health endpoints ──
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is reachable" });
});
app.get("/", (req, res) => {
  res.send("Xircle API is running 🚀");
});

// ── Routes ──
app.use('/api/today', todayRoutes);
app.use("/api/users", userRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/messages", messagingRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/calls", callRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/personal-tasks', personalTaskRoutes);
app.use('/api/app', appRoutes);
app.use('/api/clockin', clockInRoutes);
app.use('/api/stickers', stickerRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);

// Note routes
app.use("/api/personal-notes", personalNoteRoutes);
app.use("/api/workspace-notes", workspaceNoteRoutes);

// ─────────────────────────────────────────────────────────────────────
// 👇 ADDED — OG / link-preview for shared public notes
//
// Crawlers (WhatsApp, Twitter, FB, LinkedIn, Telegram, Slack, Discord)
// read raw HTML and look for og:* meta tags. This endpoint serves a
// tiny HTML doc with those tags for any bot hitting /share/:link.
//
// Real browsers get the frontend's LIVE index.html fetched and
// returned directly — NOT a redirect (a redirect back to the same
// domain would loop straight back into this same rewrite rule).
// Fetching the root ("/") sidesteps the rule entirely, so we always
// serve whatever's actually live on the frontend's own static host.
// ─────────────────────────────────────────────────────────────────────
const CRAWLER_RE =
  /(whatsapp|facebookexternalhit|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|embedly|quora link preview|showyoubot|outbrain|pinterest|vkShare|W3C_Validator|redditbot|applebot|googlebot|bingbot|yandex|duckduckbot|skypeuripreview)/i;

const escapeHtml = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// note.content is stored as HTML — strip tags for og:description.
const stripHtml = (html = "") =>
  String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

app.get("/share/:link", async (req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  const isCrawler = CRAWLER_RE.test(ua);
  const frontend = (process.env.FRONTEND_URL || "").replace(/\/$/, "");

  // ── Real browsers: fetch the frontend's own live index.html and
  // return it directly. Avoids the redirect-loop problem entirely.
  if (!isCrawler) {
    if (frontend) {
      try {
        const resp = await fetch(`${frontend}/`);
        if (resp.ok) {
          const html = await resp.text();
          return res
            .status(200)
            .set("Content-Type", "text/html; charset=utf-8")
            .send(html);
        }
      } catch (err) {
        console.error("Failed to proxy frontend index.html:", err.message);
      }
    }
    return next();
  }

  // ── Crawler: build OG meta tags from the note ──
  try {
    const note = await PersonalNote.findOne({
      shareLink: req.params.link,
      isPublic: true,
    })
      .select("title content attachments shareLink updatedAt")
      .lean();

    if (!note) {
      return res
        .status(404)
        .type("html")
        .send(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Note not found</title></head><body><p>Note not found.</p></body></html>`
        );
    }

    const url = `${frontend}/share/${note.shareLink || req.params.link}`;
    const title = `${note.title || "Untitled Note"} — Xircle`;
    const desc =
      stripHtml(note.content || "").slice(0, 200) ||
      "A shared note on Xircle.";

    // Use the first image attachment as the preview image, if any.
    const img =
      (note.attachments || []).find((a) =>
        /\.(jpe?g|png|gif|webp)$/i.test(a.path || "")
      )?.path || "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Xircle" />
  ${
    img
      ? `<meta property="og:image" content="${escapeHtml(img)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(img)}" />`
      : ""
  }
  <meta name="twitter:card" content="${
    img ? "summary_large_image" : "summary"
  }" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  ${img ? `<meta name="twitter:image" content="${escapeHtml(img)}" />` : ""}
</head>
<body>
  <p>${escapeHtml(title)}</p>
</body>
</html>`;

    res
      .status(200)
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=60, s-maxage=300")
      .send(html);
  } catch (err) {
    console.error("OG render failed:", err.message);
    next();
  }
});

// ── Error middleware ──
app.use(notFound);
app.use(errorHandler);

// ── Start server ──
mongoose
  .connect(MONGO_URL)
  .then(async () => {
    console.log("✅ Connected to MongoDB");

    // ─── 1. Startup cleanup: close all open records from previous days ──
    await runClockOutPreviousDayForAllWorkspaces();

    // ─── 2. Initialize Socket.io ──────────────────────────────────────
    const io = initSocket(server);
    app.set("io", io);

    // ─── 3. Start HTTP server ────────────────────────────────────────
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Socket.io ready for connections`);
    });

    // ─── 4. Task reminder cron (every 15 minutes) ────────────────────
    cron.schedule('*/15 * * * *', async () => {
      console.log('⏰ Running task reminder cron job...');
      try {
        const count = await checkAndSendReminders();
        if (count > 0) {
          console.log(`📬 Sent ${count} reminder(s).`);
        } else {
          console.log('📭 No reminders needed at this time.');
        }
      } catch (error) {
        console.error('❌ Cron job error:', error);
      }
    });
    console.log('⏰ Reminder cron job scheduled (every 15 minutes).');

    // ─── 5. Clock-in reminder scheduler ──────────────────────────────
    startClockInScheduler();
    console.log('⏰ Clock-in reminder scheduler started.');

    // ─── 6. Auto clock-out scheduler (at closing time only) ──────────
    startAutoClockOutScheduler();
    console.log('⏰ Auto clock-out scheduler started.');

    // ─── 7. Previous-day cleanup scheduler (10 min before clock-in) ──
    startClockOutPreviousDayScheduler();
    console.log('⏰ Previous-day cleanup scheduler started.');

    // ─── 8. Monthly leaderboard email (1st of month, 9 AM) ───────────
    cron.schedule('0 9 1 * *', async () => {
      console.log('📊 Running monthly leaderboard email job...');
      try {
        await sendMonthlyLeaderboardForAllWorkspaces();
        console.log('✅ Monthly leaderboard emails sent.');
      } catch (error) {
        console.error('❌ Monthly leaderboard email error:', error);
      }
    });
    console.log('📊 Monthly leaderboard email cron scheduled (1st of month at 09:00).');

    // ─── 9. Daily Today digest (7:00 AM every day) ───────────────────
    cron.schedule('0 7 * * *', async () => {
      console.log('🌅 Running daily Today digest...');
      try {
        await sendDailyDigest();
        console.log('✅ Daily digests sent.');
      } catch (error) {
        console.error('❌ Daily digest error:', error);
      }
    });
    console.log('🌅 Daily Today digest cron scheduled (07:00).');

  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });