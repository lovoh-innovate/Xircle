// models/workspaceModel.js
import mongoose from "mongoose";

// ─── Member sub‑schema ──────────────────────────────────────────────
const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  role: {
    type: String,
    // 'Associate' added so associates have a valid role string.
    // They can never be 'Admin' or 'Owner' (enforced at the controller layer).
    enum: ["Owner", "Admin", "Member", "Staff", "Associate"],
    default: "Member",
  },

  // ── Permanent vs associate ─────────────────────────────────────
  // 'permanent' = normal workspace member (can clock in, be admin, etc.)
  // 'associate' = limited external collaborator added from a project
  // Missing on old records → treated as 'permanent' by the app.
  memberType: {
    type: String,
    enum: ["permanent", "associate"],
    default: "permanent",
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

  // ── Associate‑only fields ──────────────────────────────────────
  // Who added this associate (workspace owner/admin who invited them).
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  // Optional expiry for associate access. When the cron sweeps and
  // finds accessExpiresAt < now, the membership is revoked along with
  // every project.associates record for this user in this workspace.
  accessExpiresAt: {
    type: Date,
    default: null,
  },
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

    // ─── Clock‑in settings ──────────────────────────────────────────
    clockInStart: {
      type: String,   // "HH:MM" in 24h format
      default: null,
    },
    clockInEnd: {
      type: String,   // "HH:MM" in 24h format
      default: null,
    },
    clockInEnabled: {
      type: Boolean,
      default: false,
    },

    // ─── Closing time for late clock‑out / auto clock‑out ──────────
    closingTime: {
      type: String,   // "HH:MM" in 24h format
      default: null,
    },

    // ─── Auto‑clock‑out toggle ──────────────────────────────────────
    autoClockoutEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ─── Auto‑generate initials ──────────────────────────────────────
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

// Fast lookups for the associate sweep cron + associate listings
workspaceSchema.index({ "members.memberType": 1 });
workspaceSchema.index({ "members.accessExpiresAt": 1 });

const Workspace = mongoose.model("Workspace", workspaceSchema);
export default Workspace;