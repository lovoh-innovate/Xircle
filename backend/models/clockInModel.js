import mongoose from "mongoose";

const clockInSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    clockInTime: {
      type: Date,
      required: true,
    },
    clockOutTime: {
      type: Date,
      default: null,
    },
    date: {
      type: Date,
      required: true,
    },
    // "on-time"  = clocked in within [clockInStart, clockInEnd]
    // "late"     = clocked in after clockInEnd
    // ("early" kept in enum only so old documents don't break validation on re-save)
    status: {
      type: String,
      enum: ["on-time", "late", "early"],
      default: "on-time",
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    lateMinutes: {
      type: Number,
      default: 0,
    },
    isEarly: {
      type: Boolean, // true whenever isLate is false (kept for frontend compatibility)
      default: true,
    },
    // ─── Clock-out side ──────────────────────────────────────────────
    clockOutLate: {
      type: Boolean,
      default: false,
    },
    clockOutLateMinutes: {
      type: Number,
      default: 0,
    },
    // Was this clock-out done automatically by the closing-time scheduler?
    // This is INTENTIONALLY separate from `status` so a person's on-time/late
    // record for the day is never lost/overwritten when they get auto-clocked-out.
    autoClockedOut: {
      type: Boolean,
      default: false,
    },
    // Reason for clocking out before clockOutEarliest. Visible to owner/admin.
    clockOutReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
clockInSchema.index({ workspace: 1, date: 1 });
clockInSchema.index({ user: 1, date: 1 });
clockInSchema.index({ workspace: 1, clockInTime: 1 });

const ClockIn = mongoose.model("ClockIn", clockInSchema);
export default ClockIn;