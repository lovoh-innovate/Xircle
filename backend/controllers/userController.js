import User from "../models/userModel.js";
import asyncHandler from "express-async-handler";
import generateToken from "../utils/generateToken.js";
import { OAuth2Client } from "google-auth-library";
import { sendOTPEmail, generateOTP } from "../utils/emailService.js";

const googleClient = new OAuth2Client();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const generateUniqueUsername = async (baseUsername) => {
  let username = baseUsername;
  let counter = 1;
  while (await User.findOne({ username })) {
    username = `${baseUsername}${counter++}`;
  }
  return username;
};

const createUserObject = (data) => {
  return {
    googleId: data.googleId || "",
    name: data.name || "",
    username: data.username || "",
    email: data.email || "",
    phone: data.phone || "",
    profile: data.profile || "",
    password: data.password || "",
    isVerified: data.isVerified || false,
    authMethod: data.authMethod || "local",
    role: data.role || "user",
    acceptedTerms: data.acceptedTerms || false,
    ownedWorkspaces: data.ownedWorkspaces || [],
    joinedWorkspaces: data.joinedWorkspaces || [],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE AUTH
// POST /api/users/google
// ─────────────────────────────────────────────────────────────────────────────

const googleAuth = asyncHandler(async (req, res) => {
  const { token: googleToken, mode } = req.body;

  if (!googleToken) {
    res.status(400);
    throw new Error("Google token is required");
  }

  if (!mode || !["signup", "login"].includes(mode)) {
    res.status(400);
    throw new Error("Valid mode (signup or login) is required");
  }

  let googleId = "";
  let email = "";
  let name = "";
  let picture = "";

  // Verify Google token
  try {
    const audiences = [process.env.GOOGLE_WEB_CLIENT_ID].filter(Boolean);

    const ticket = await googleClient.verifyIdToken({
      idToken: googleToken,
      audience: audiences,
    });

    const payload = ticket.getPayload();
    googleId = payload?.sub || "";
    email = payload?.email || "";
    name = payload?.name || "";
    picture = payload?.picture || "";

    console.log("[googleAuth] Token verified for:", email);
  } catch (error) {
    console.error("[googleAuth] Token verification failed:", error.message);
    res.status(401);
    throw new Error("Invalid Google token. Please try again.");
  }

  if (!email) {
    res.status(400);
    throw new Error("Google account email is required");
  }

  let user = await User.findOne({
    $or: [{ googleId }, { email }],
  });

  // ── SIGNUP ────────────────────────────────────────────────────────────────
  if (mode === "signup") {
    if (user) {
      res.status(400);
      throw new Error("Account already exists. Please login instead.");
    }

    // Generate username
    const baseUsername = (email?.split("@")[0] || name || "user")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9_]/g, "") || "user";
    
    const username = await generateUniqueUsername(baseUsername);

    user = await User.create({
      googleId,
      name: name || "",
      username,
      email,
      phone: "", // Phone will be collected separately
      profile: picture || "",
      password: `google-auth-${googleId}`,
      isVerified: true,
      authMethod: "google",
      role: "user",
      acceptedTerms: true, // Google signup implies T&C acceptance
      ownedWorkspaces: [],
      joinedWorkspaces: [],
    });
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (mode === "login") {
    if (!user) {
      res.status(404);
      throw new Error("No account found with this email. Please sign up first.");
    }

    // Update user info if needed
    if (!user.googleId) user.googleId = googleId;
    if (!user.profile && picture) user.profile = picture;
    if (!user.name && name) user.name = name;

    user.isVerified = true;
    user.authMethod = "google";
    await user.save();
  }

  const token = generateToken(res, user._id);

  res.status(200).json({
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    profile: user.profile,
    authMethod: user.authMethod,
    role: user.role,
    token,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL SIGNUP (email/password)
// POST /api/users/register
// ─────────────────────────────────────────────────────────────────────────────

// controllers/userController.js

const registerUser = asyncHandler(async (req, res) => {
  console.log('📝 Registration request received:', req.body);

  const { name, email, phone, password, acceptedTerms } = req.body;

  // ── Validate ──
  if (!name || !email || !phone || !password) {
    res.status(400);
    throw new Error('All fields are required');
  }
  if (!acceptedTerms) {
    res.status(400);
    throw new Error('You must accept the Terms and Conditions');
  }

  // ── Check existing user ──
  const userExists = await User.findOne({ email: email.toLowerCase().trim() });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists. Please login.');
  }

  // ── Generate username ──
  const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  const username = await generateUniqueUsername(baseUsername);
  console.log(`✅ Username generated: ${username}`);

  // ── Generate OTP ──
  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  console.log(`🔑 OTP for ${email}: ${otp}`);

  // ── Create user (unverified) with OTP ──
  let user;
  try {
    user = await User.create({
      name: name.trim(),
      username,
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      isVerified: false,
      authMethod: 'local',
      role: 'user',
      acceptedTerms: true,
      resetPasswordOTP: otp,
      resetPasswordExpires: otpExpires,
    });
    console.log(`✅ User created: ${user._id}`);
  } catch (createError) {
    console.error('❌ User creation failed:', createError.message);
    res.status(500);
    throw new Error('Failed to create user: ' + createError.message);
  }

  // ── Send OTP email (ALWAYS try, no bypass) ──
  console.log('📧 Attempting to send OTP email...');
  try {
    await sendOTPEmail(email, otp, 'verification');
    console.log(`✅ OTP email sent to ${email}`);
  } catch (emailError) {
    console.error('❌ Email sending FAILED:', emailError.message);
    // Clean up – delete the user (no partial registration)
    await User.findByIdAndDelete(user._id);
    console.log(`🗑️ Deleted user ${user._id} due to email failure`);
    res.status(500);
    throw new Error('Failed to send verification email. Please try again.');
  }

  // ── Success response (waiting for OTP verification) ──
  console.log('✅ Registration complete, waiting for OTP verification');
  res.status(201).json({
    success: true,
    message: 'User registered. Please verify your email with the OTP sent.',
    userId: user._id,
    email: user.email,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY EMAIL (OTP)
// POST /api/users/verify-email
// ─────────────────────────────────────────────────────────────────────────────

const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error("Email and OTP are required");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (user.isVerified) {
    res.status(400);
    throw new Error("Email already verified");
  }

  // Check OTP
  if (user.resetPasswordOTP !== otp) {
    res.status(400);
    throw new Error("Invalid OTP");
  }

  if (user.resetPasswordExpires < new Date()) {
    res.status(400);
    throw new Error("OTP has expired. Please request a new one.");
  }

  // Verify user
  user.isVerified = true;
  user.resetPasswordOTP = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  // Generate token and log user in
  const token = generateToken(res, user._id);

  res.status(200).json({
    success: true,
    message: "Email verified successfully",
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    profile: user.profile,
    authMethod: user.authMethod,
    role: user.role,
    token,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RESEND OTP
// POST /api/users/resend-otp
// ─────────────────────────────────────────────────────────────────────────────

const resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (user.isVerified) {
    res.status(400);
    throw new Error("Email already verified");
  }

  // Generate new OTP
  const otp = generateOTP();
  user.resetPasswordOTP = otp;
  user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  // Send OTP email
  try {
    await sendOTPEmail(email, otp, 'verification');
  } catch (error) {
    res.status(500);
    throw new Error("Failed to send verification email. Please try again.");
  }

  res.status(200).json({
    success: true,
    message: "New OTP sent to your email",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL LOGIN (email/password)
// POST /api/users/login
// ─────────────────────────────────────────────────────────────────────────────

// controllers/userController.js

const loginUser = asyncHandler(async (req, res) => {
  console.log('🔐 Login attempt:', req.body.email);

  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      console.warn(`❌ No user found for ${email}`);
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // Google auth check
    if (user.authMethod === 'google' && !user.hasPassword()) {
      console.warn(`❌ Google account with no password: ${email}`);
      res.status(401);
      throw new Error('This account uses Google Sign-In. Please use Google to login, or reset your password.');
    }

    // Email verified?
    if (!user.isVerified) {
      console.warn(`❌ Unverified email: ${email}`);
      res.status(401);
      throw new Error('Please verify your email first. Check your inbox for the OTP.');
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.warn(`❌ Wrong password for ${email}`);
      res.status(401);
      throw new Error('Invalid email or password');
    }

    const token = generateToken(res, user._id);
    console.log(`✅ Login successful: ${email}`);

    res.status(200).json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      profile: user.profile,
      authMethod: user.authMethod,
      role: user.role,
      token,
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    // If error already has status, re-throw; else set 500
    if (!res.statusCode || res.statusCode === 200) {
      res.status(500);
    }
    throw error;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD - Send OTP
// POST /api/users/forgot-password
// ─────────────────────────────────────────────────────────────────────────────

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    res.status(404);
    throw new Error("No account found with this email");
  }

  // Generate OTP
  const otp = generateOTP();
  user.resetPasswordOTP = otp;
  user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  // Send OTP email
  try {
    await sendOTPEmail(email, otp, 'reset');
  } catch (error) {
    res.status(500);
    throw new Error("Failed to send reset email. Please try again.");
  }

  res.status(200).json({
    success: true,
    message: "Password reset OTP sent to your email",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD - Verify OTP and set new password
// POST /api/users/reset-password
// ─────────────────────────────────────────────────────────────────────────────

const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400);
    throw new Error("Email, OTP, and new password are required");
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Check OTP
  if (user.resetPasswordOTP !== otp) {
    res.status(400);
    throw new Error("Invalid OTP");
  }

  if (user.resetPasswordExpires < new Date()) {
    res.status(400);
    throw new Error("OTP has expired. Please request a new one.");
  }

  // Set new password and clear OTP
  user.password = newPassword;
  user.authMethod = "local"; // Even if they were google auth, they now have a password
  user.resetPasswordOTP = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password reset successfully. You can now login with your new password.",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD (authenticated user)
// POST /api/users/change-password
// ─────────────────────────────────────────────────────────────────────────────

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("Current password and new password are required");
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error("New password must be at least 6 characters");
  }

  const user = await User.findById(userId);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // If user is using Google auth without a password
  if (user.authMethod === "google" && !user.hasPassword()) {
    // They can set a password directly without current password
    user.password = newPassword;
    user.authMethod = "local"; // Now they have a local password too
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: "Password set successfully. You can now login with email and password.",
    });
  }

  // Verify current password
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }

  // Set new password
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password changed successfully",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROFILE
// PUT /api/users/profile
// ─────────────────────────────────────────────────────────────────────────────

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const { name, phone } = req.body;
  const profilePicture = req.file?.path;

  if (name) user.name = name.trim();
  if (phone) user.phone = phone.trim();
  if (profilePicture) user.profile = profilePicture;

  const updatedUser = await user.save();

  res.status(200).json({
    _id: updatedUser._id,
    name: updatedUser.name,
    username: updatedUser.username,
    email: updatedUser.email,
    phone: updatedUser.phone,
    profile: updatedUser.profile,
    authMethod: updatedUser.authMethod,
    role: updatedUser.role,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL USERS (Admin only)
// GET /api/users
// ─────────────────────────────────────────────────────────────────────────────

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({})
    .select("-password -resetPasswordOTP -resetPasswordExpires")
    .sort({ createdAt: -1 });
  res.status(200).json(users);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET USER BY ID
// GET /api/users/:id
// ─────────────────────────────────────────────────────────────────────────────

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select("-password -resetPasswordOTP -resetPasswordExpires");
  
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  
  res.status(200).json(user);
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// POST /api/users/logout
// ─────────────────────────────────────────────────────────────────────────────

const logoutUser = asyncHandler(async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("jwt", "", {
    httpOnly: true,
    expires: new Date(0),
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });

  res.status(200).json({ message: "Logged out successfully" });
});

// ─────────────────────────────────────────────────────────────────────────────

export {
  googleAuth,
  registerUser,
  verifyEmail,
  resendOTP,
  loginUser,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  getUsers,
  getUserById,
  logoutUser,
};