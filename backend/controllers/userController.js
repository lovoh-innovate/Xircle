// controllers/userController.js

import User from '../models/userModel.js';
import Project from '../models/projectModel.js';
import asyncHandler from 'express-async-handler';
import generateToken from '../utils/generateToken.js';
import { OAuth2Client } from 'google-auth-library';
import { sendOTPEmail, generateOTP } from '../utils/emailService.js';
import { createAndSendNotification } from './notificationController.js';

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
    googleId: data.googleId || '',
    name: data.name || '',
    username: data.username || '',
    email: data.email || '',
    phone: data.phone || '',
    profile: data.profile || '',
    password: data.password || '',
    isVerified: data.isVerified || false,
    authMethod: data.authMethod || 'local',
    role: data.role || 'user',
    acceptedTerms: data.acceptedTerms || false,
    ownedWorkspaces: data.ownedWorkspaces || [],
    joinedWorkspaces: data.joinedWorkspaces || [],
    isAiEnabled: data.isAiEnabled ?? true,
    isBibleEnabled: data.isBibleEnabled ?? false,
    isQuranEnabled: data.isQuranEnabled ?? false,
  };
};

const toBool = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : undefined;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return undefined;
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW: AUTO-LINK PENDING COLLABORATOR INVITES
//
// When a user signs up / logs in / verifies their email, look for any
// project collaborator records whose email matches but whose userId is null.
// Link them, mark them active, and send a "you've been added" notification.
//
// This is idempotent — safe to call on every auth event.
// ─────────────────────────────────────────────────────────────────────────────

const linkPendingCollaboratorInvites = async (user) => {
  if (!user?.email || !user?._id) return { linked: 0, projects: [] };

  try {
    const normalizedEmail = user.email.toLowerCase().trim();

    // Find projects with a pending invite for this email
    const projects = await Project.find({
      'collaborators.email': normalizedEmail,
      'collaborators.userId': null,
      'collaborators.status': { $in: ['invited', 'active'] },
      isTrash: { $ne: true },
    }).select('_id name collaborators workspace');

    if (projects.length === 0) return { linked: 0, projects: [] };

    const now = new Date();
    const linkedProjects = [];

    for (const project of projects) {
      let touched = false;
      for (const collab of project.collaborators) {
        if (
          collab.email === normalizedEmail &&
          !collab.userId &&
          collab.status !== 'revoked'
        ) {
          collab.userId = user._id;
          collab.status = 'active';
          collab.acceptedAt = now;
          touched = true;
        }
      }
      if (touched) {
        await project.save();
        linkedProjects.push({ _id: project._id, name: project.name });
      }
    }

    // Notify the user about each linked project
    if (linkedProjects.length > 0) {
      for (const p of linkedProjects) {
        createAndSendNotification({
          recipient: user._id,
          title: `You're now collaborating on "${p.name}"`,
          body: 'Your Xircle account has been linked. Tasks assigned to you are now actionable.',
          data: {
            notificationType: 'project',
            projectId: p._id.toString(),
          },
          sendPush: true,
          emailEventType: 'teamInvite',
          emailSubject: `You're collaborating on ${p.name}`,
          emailHtml: `<p>Your account is now linked to <strong>${p.name}</strong>.</p>`,
        }).catch((err) => console.error('Collaborator link notify failed:', err.message));
      }
    }

    return { linked: linkedProjects.length, projects: linkedProjects };
  } catch (err) {
    console.error('linkPendingCollaboratorInvites failed:', err.message);
    return { linked: 0, projects: [] };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE AUTH
// POST /api/users/google
// ─────────────────────────────────────────────────────────────────────────────

const googleAuth = asyncHandler(async (req, res) => {
  const { token: googleToken, mode } = req.body;

  if (!googleToken) {
    res.status(400);
    throw new Error('Google token is required');
  }

  if (!mode || !['signup', 'login'].includes(mode)) {
    res.status(400);
    throw new Error('Valid mode (signup or login) is required');
  }

  let googleId = '';
  let email = '';
  let name = '';
  let picture = '';

  try {
    const audiences = [process.env.GOOGLE_WEB_CLIENT_ID].filter(Boolean);

    const ticket = await googleClient.verifyIdToken({
      idToken: googleToken,
      audience: audiences,
    });

    const payload = ticket.getPayload();
    googleId = payload?.sub || '';
    email = payload?.email || '';
    name = payload?.name || '';
    picture = payload?.picture || '';

    console.log('[googleAuth] Token verified for:', email);
  } catch (error) {
    console.error('[googleAuth] Token verification failed:', error.message);
    res.status(401);
    throw new Error('Invalid Google token. Please try again.');
  }

  if (!email) {
    res.status(400);
    throw new Error('Google account email is required');
  }

  let user = await User.findOne({
    $or: [{ googleId }, { email }],
  });

  // ── SIGNUP ────────────────────────────────────────────────────────────────
  if (mode === 'signup') {
    if (user) {
      res.status(400);
      throw new Error('Account already exists. Please login instead.');
    }

    const baseUsername =
      (email?.split('@')[0] || name || 'user')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9_]/g, '') || 'user';

    const username = await generateUniqueUsername(baseUsername);

    user = await User.create(
      createUserObject({
        googleId,
        name: name || '',
        username,
        email,
        phone: '',
        profile: picture || '',
        password: `google-auth-${googleId}`,
        isVerified: true,
        authMethod: 'google',
        role: 'user',
        acceptedTerms: true,
        ownedWorkspaces: [],
        joinedWorkspaces: [],
      })
    );

    // NEW: link any pending collaborator invites that match this email
    await linkPendingCollaboratorInvites(user);
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (mode === 'login') {
    if (!user) {
      res.status(404);
      throw new Error('No account found with this email. Please sign up first.');
    }

    if (!user.googleId) user.googleId = googleId;
    if (!user.profile && picture) user.profile = picture;
    if (!user.name && name) user.name = name;

    user.isVerified = true;
    user.authMethod = 'google';
    await user.save();

    // NEW: also link pending collaborator invites on login
    await linkPendingCollaboratorInvites(user);
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
    createdAt: user.createdAt,
    isAiEnabled: user.isAiEnabled ?? true,
    isBibleEnabled: user.isBibleEnabled ?? false,
    isQuranEnabled: user.isQuranEnabled ?? false,
    token,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL SIGNUP
// POST /api/users/register
// ─────────────────────────────────────────────────────────────────────────────

const registerUser = asyncHandler(async (req, res) => {
  console.log('📝 Registration request received:', req.body);

  const { name, email, phone, password, acceptedTerms } = req.body;

  if (!name || !email || !phone || !password) {
    res.status(400);
    throw new Error('All fields are required');
  }
  if (!acceptedTerms) {
    res.status(400);
    throw new Error('You must accept the Terms and Conditions');
  }

  const userExists = await User.findOne({ email: email.toLowerCase().trim() });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists. Please login.');
  }

  const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  const username = await generateUniqueUsername(baseUsername);
  console.log(`✅ Username generated: ${username}`);

  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  console.log(`🔑 OTP for ${email}: ${otp}`);

  let user;
  try {
    user = await User.create(
      createUserObject({
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
      })
    );
    console.log(`✅ User created: ${user._id}`);
  } catch (createError) {
    console.error('❌ User creation failed:', createError.message);
    res.status(500);
    throw new Error('Failed to create user: ' + createError.message);
  }

  // NOTE: We intentionally do NOT link collaborator invites here.
  // We wait until email verification so unverified users don't get access.

  console.log('📧 Attempting to send OTP email...');
  try {
    await sendOTPEmail(email, otp, 'verification');
    console.log(`✅ OTP email sent to ${email}`);
  } catch (emailError) {
    console.error('❌ Email sending FAILED:', emailError.message);
    await User.findByIdAndDelete(user._id);
    console.log(`🗑️ Deleted user ${user._id} due to email failure`);
    res.status(500);
    throw new Error('Failed to send verification email. Please try again.');
  }

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
    throw new Error('Email and OTP are required');
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.isVerified) {
    res.status(400);
    throw new Error('Email already verified');
  }

  if (user.resetPasswordOTP !== otp) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  if (user.resetPasswordExpires < new Date()) {
    res.status(400);
    throw new Error('OTP has expired. Please request a new one.');
  }

  user.isVerified = true;
  user.resetPasswordOTP = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  // NEW: link collaborator invites on successful verification
  await linkPendingCollaboratorInvites(user);

  const token = generateToken(res, user._id);

  res.status(200).json({
    success: true,
    message: 'Email verified successfully',
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    profile: user.profile,
    authMethod: user.authMethod,
    role: user.role,
    createdAt: user.createdAt,
    isAiEnabled: user.isAiEnabled ?? true,
    isBibleEnabled: user.isBibleEnabled ?? false,
    isQuranEnabled: user.isQuranEnabled ?? false,
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
    throw new Error('Email is required');
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.isVerified) {
    res.status(400);
    throw new Error('Email already verified');
  }

  const otp = generateOTP();
  user.resetPasswordOTP = otp;
  user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  try {
    await sendOTPEmail(email, otp, 'verification');
  } catch (error) {
    res.status(500);
    throw new Error('Failed to send verification email. Please try again.');
  }

  res.status(200).json({
    success: true,
    message: 'New OTP sent to your email',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL LOGIN
// POST /api/users/login
// ─────────────────────────────────────────────────────────────────────────────

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

    if (user.authMethod === 'google' && !user.hasPassword()) {
      console.warn(`❌ Google account with no password: ${email}`);
      res.status(401);
      throw new Error(
        'This account uses Google Sign-In. Please use Google to login, or reset your password.'
      );
    }

    if (!user.isVerified) {
      console.warn(`❌ Unverified email: ${email}`);
      res.status(401);
      throw new Error('Please verify your email first. Check your inbox for the OTP.');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.warn(`❌ Wrong password for ${email}`);
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // NEW: link collaborator invites on login (catches the case where an
    // existing user was later invited by email)
    await linkPendingCollaboratorInvites(user);

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
      createdAt: user.createdAt,
      isAiEnabled: user.isAiEnabled ?? true,
      isBibleEnabled: user.isBibleEnabled ?? false,
      isQuranEnabled: user.isQuranEnabled ?? false,
      token,
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    if (!res.statusCode || res.statusCode === 200) {
      res.status(500);
    }
    throw error;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────────────────────────────────────

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    res.status(404);
    throw new Error('No account found with this email');
  }

  const otp = generateOTP();
  user.resetPasswordOTP = otp;
  user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  try {
    await sendOTPEmail(email, otp, 'reset');
  } catch (error) {
    res.status(500);
    throw new Error('Failed to send reset email. Please try again.');
  }

  res.status(200).json({
    success: true,
    message: 'Password reset OTP sent to your email',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────────────────────────────────────

const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400);
    throw new Error('Email, OTP, and new password are required');
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.resetPasswordOTP !== otp) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  if (user.resetPasswordExpires < new Date()) {
    res.status(400);
    throw new Error('OTP has expired. Please request a new one.');
  }

  user.password = newPassword;
  user.authMethod = 'local';
  user.resetPasswordOTP = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. You can now login with your new password.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD
// ─────────────────────────────────────────────────────────────────────────────

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Current password and new password are required');
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters');
  }

  const user = await User.findById(userId);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.authMethod === 'google' && !user.hasPassword()) {
    user.password = newPassword;
    user.authMethod = 'local';
    await user.save();
    return res.status(200).json({
      success: true,
      message: 'Password set successfully. You can now login with email and password.',
    });
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROFILE
// ─────────────────────────────────────────────────────────────────────────────

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const { name, phone, isAiEnabled, isBibleEnabled, isQuranEnabled } = req.body;
  const profilePicture = req.file?.path;

  if (name) user.name = name.trim();
  if (phone) user.phone = phone.trim();
  if (profilePicture) user.profile = profilePicture;

  const ai = toBool(isAiEnabled);
  const bible = toBool(isBibleEnabled);
  const quran = toBool(isQuranEnabled);

  if (ai !== undefined) user.isAiEnabled = ai;
  if (bible !== undefined) user.isBibleEnabled = bible;
  if (quran !== undefined) user.isQuranEnabled = quran;

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
    createdAt: updatedUser.createdAt,
    isAiEnabled: updatedUser.isAiEnabled ?? true,
    isBibleEnabled: updatedUser.isBibleEnabled ?? false,
    isQuranEnabled: updatedUser.isQuranEnabled ?? false,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL USERS (Admin only)
// ─────────────────────────────────────────────────────────────────────────────

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({})
    .select('-password -resetPasswordOTP -resetPasswordExpires')
    .sort({ createdAt: -1 });
  res.status(200).json(users);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET USER BY ID
// ─────────────────────────────────────────────────────────────────────────────

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    '-password -resetPasswordOTP -resetPasswordExpires'
  );

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.status(200).json(user);
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────

const logoutUser = asyncHandler(async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });

  res.status(200).json({ message: 'Logged out successfully' });
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
  // NEW — optional export if you ever want to call it manually
  linkPendingCollaboratorInvites,
};