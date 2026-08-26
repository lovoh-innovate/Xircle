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

import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { initSocket } from "./controllers/socket.js";

import { checkAndSendReminders } from "./controllers/taskController.js";
import {
  startClockInScheduler,
  startAutoClockOutScheduler,
  sendMonthlyLeaderboardForAllWorkspaces,
  closeAllOpenRecordsFromPreviousDays,   // 👈 new import
} from "./controllers/clockInController.js";

dotenv.config();

// ─── Fix __dirname for ES modules ──────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8000;
const MONGO_URL = process.env.MONGO_URL;

// ── Middleware ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── CORS ──
const allowedOrigins = [
  'http://localhost:9000',
  'https://xircle.lovohcreate.com',
  'http://localhost',
  'https://localhost'
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

// ── Error middleware ──
app.use(notFound);
app.use(errorHandler);

// ── Start server ──
mongoose
  .connect(MONGO_URL)
  .then(async () => {   // make the callback async to use await
    console.log("✅ Connected to MongoDB");

    // ─── 1. Startup cleanup: close all open records from previous days ──
    // This runs once, immediately, so users can clock in today.
    await closeAllOpenRecordsFromPreviousDays();

    // ─── 2. Initialize Socket.io ──────────────────────────────────────
    const io = initSocket(server);
    app.set("io", io);

    // ─── 3. Start HTTP server ────────────────────────────────────────
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Socket.io ready for connections`);
    });

    // ─── 4. Schedule task reminder cron job (every 15 minutes) ────
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

    // ─── 5. Start clock‑in reminder scheduler ──────────────────────
    startClockInScheduler();
    console.log('⏰ Clock‑in reminder scheduler started.');

    // ─── 6. Start auto clock‑out scheduler (includes cleanup logic) ─
    startAutoClockOutScheduler();
    console.log('⏰ Auto clock‑out scheduler started.');

    // ─── 7. Schedule monthly leaderboard email (1st of month, 9 AM) ─
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

  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });