// models/workspaceModel.js
import mongoose from "mongoose";

// ─── Member sub‑schema ──────────────────────────────────────────────
const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: {
    type: String,
    enum: ["Owner", "Admin", "Member", "Staff"],
    default: "Member",
  },
  status: {
    type: String,
    enum: ["pending", "active", "inactive"],
    default: "active",
  },
  department: {
    type: String,
    default: "General",
  },
  joinedAt: { type: Date, default: Date.now },
});

// ─── Workspace schema ──────────────────────────────────────────────
const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    industry: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    initials: { type: String },
    color: { type: String, default: "#1a3a6b" },
    logo: { type: String, default: "" },
    size: { type: String, default: "" },
    website: { type: String, default: "" },
    location: { type: String, default: "" },
    phone: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [memberSchema],
    activeTasks: { type: Number, default: 0 },
    inviteCode: { type: String, unique: true },
    verified: { type: Boolean, default: false },

    // ─── Clock‑in settings (range based) ──────────────────────────
    clockInStart: {
      type: String,   // "HH:MM" in 24h format, e.g., "08:30"
      default: null,
    },
    clockInEnd: {
      type: String,   // "HH:MM" in 24h format, e.g., "09:00"
      default: null,
    },
    clockInEnabled: {
      type: Boolean,
      default: false,
    },

    // ─── Optional: closing time for clock‑out penalty ─────────────
    closingTime: {
      type: String,   // "HH:MM" in 24h format, e.g., "18:00"
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Auto‑generate initials from name ──────────────────────────────
workspaceSchema.pre("save", function () {
  if (this.isModified("name") && this.name) {
    const words = this.name.trim().split(/\s+/);
    this.initials = words
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("");
  }
});

// ─── Indexes ────────────────────────────────────────────────────────
workspaceSchema.index({ inviteCode: 1 });
workspaceSchema.index({ owner: 1 });
workspaceSchema.index({ "members.user": 1 });
workspaceSchema.index({ "members.status": 1 });

const Workspace = mongoose.model("Workspace", workspaceSchema);
export default Workspace;