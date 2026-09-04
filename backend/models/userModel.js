import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ── Push Token sub‑schema ────────────────────────────────────────
const pushTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,     // FCM token or VAPID endpoint
    },
    deviceType: {
      type: String,
      enum: ["web", "ios", "android"],
      required: true,
    },
    subscription: {
      type: Object,       // web push subscription object (only for web)
      default: null,
    },
    platform: {
      type: String,       // optional: "capacitor", "react-native", etc.
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// ── Notification preferences sub‑schemas ─────────────────────────
const emailPreferencesSchema = new mongoose.Schema(
  {
    newMessage: { type: Boolean, default: true },
    taskAssignment: { type: Boolean, default: true },
    taskUpdate: { type: Boolean, default: true },
    projectUpdate: { type: Boolean, default: true },
    teamInvite: { type: Boolean, default: true },
    dailyReport: { type: Boolean, default: false },
  },
  { _id: false }
);

const pushPreferencesSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    newMessage: { type: Boolean, default: true },
    taskAssignment: { type: Boolean, default: true },
    taskUpdate: { type: Boolean, default: true },
    projectUpdate: { type: Boolean, default: false },
    teamInvite: { type: Boolean, default: true },
    dailyReport: { type: Boolean, default: false },
  },
  { _id: false }
);

const notificationPreferencesSchema = new mongoose.Schema(
  {
    email: { type: emailPreferencesSchema, default: () => ({}) },
    push: { type: pushPreferencesSchema, default: () => ({}) },
  },
  { _id: false }
);

// ── Main User schema ─────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, default: "" },
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: { type: String, trim: true, default: "" },
    profile: { type: String, default: "" },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    authMethod: {
      type: String,
      enum: ["google", "local"],
      default: "local",
    },
    role: {
      type: String,
      enum: ["user", "admin", "super_admin"],
      default: "user",
    },
    acceptedTerms: { type: Boolean, default: false },
    ownedWorkspaces: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Workspace" },
    ],
    joinedWorkspaces: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Workspace" },
    ],
    resetPasswordOTP: { type: String },
    resetPasswordExpires: { type: Date },

    // ── New fields for email verification ──────────────────────
    verificationOTP: { type: String },
    verificationOTPExpires: { type: Date },

    // ── Push tokens & preferences ──────────────────────────────
    pushTokens: { type: [pushTokenSchema], default: [] },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

// ── TTL index to auto‑delete unverified accounts ──────────────
// Deletes documents where isVerified = false after 10 minutes (600 seconds)
// Adjust `expireAfterSeconds` to your desired delay.
userSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 600,
    partialFilterExpression: { isVerified: false },
  }
);

// ── Password hashing ─────────────────────────────────────────────
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  if (this.password.startsWith("google-auth-")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ── Instance methods ─────────────────────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (
    this.authMethod === "google" &&
    this.password.startsWith("google-auth-")
  ) {
    return false;
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.hasPassword = function () {
  return !this.password.startsWith("google-auth-");
};

const User = mongoose.model("User", userSchema);
export default User;