// models/clockInModel.js
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
    status: {
      type: String,
      enum: ["early", "on-time", "late"],
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
      type: Boolean,
      default: false,
    },
    earlyMinutes: {
      type: Number,
      default: 0,
    },
    clockOutLate: {
      type: Boolean,
      default: false,
    },
    clockOutLateMinutes: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
clockInSchema.index({ workspace: 1, date: 1 });
clockInSchema.index({ user: 1, date: 1 });

const ClockIn = mongoose.model("ClockIn", clockInSchema);
export default ClockIn;