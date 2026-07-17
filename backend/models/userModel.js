import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, default: "" },
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    profile: { type: String, default: "" },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    authMethod: { 
      type: String, 
      enum: ["google", "local"], 
      default: "local" 
    },
    role: { 
      type: String, 
      enum: ["user", "admin", "super_admin"], 
      default: "user" 
    },
    acceptedTerms: { 
      type: Boolean, 
      default: false 
    },
    ownedWorkspaces: [{ type: mongoose.Schema.Types.ObjectId, ref: "Workspace" }],
    joinedWorkspaces: [{ type: mongoose.Schema.Types.ObjectId, ref: "Workspace" }],
    resetPasswordOTP: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

// ✅ FIXED: no `next` parameter – just use async/await
userSchema.pre("save", async function () {
  // Only hash if password is modified and not Google auth
  if (!this.isModified("password")) return;
  if (this.password.startsWith("google-auth-")) return;
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (this.authMethod === "google" && this.password.startsWith("google-auth-")) {
    return false;
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.hasPassword = function () {
  return !this.password.startsWith("google-auth-");
};

const User = mongoose.model("User", userSchema);
export default User;