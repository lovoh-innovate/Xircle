// controllers/personalNoteController.js
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import PersonalNote from '../models/personalNoteModel.js';
import PersonalNoteFolder from '../models/personalNoteFolderModel.js';
import User from '../models/userModel.js';
import { v4 as uuidv4 } from 'uuid';
import { createAndSendNotification } from './notificationController.js';
import pdf from 'pdfkit';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import { sendEmail } from '../utils/emailService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

const getUserName = async (userId) => {
  const user = await User.findById(userId).select('name');
  return user?.name || 'A Xircle user';
};

const slugify = (text) => {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-word chars
    .replace(/[\s_-]+/g, '-') // swap spaces/underscores for hyphens
    .replace(/^-+|-+$/g, ''); // trim hyphens
};

// Generate a unique slug for a note
const generateUniqueSlug = async (title, excludeId = null) => {
  let base = slugify(title) || 'note';
  let slug = base;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    
    const existing = await PersonalNote.findOne(query);
    if (!existing) return slug;
    
    slug = `${base}-${counter++}`;
  }
};

// Resolve note by ObjectId, Slug, or Share Link
const resolveNoteByIdentifier = async (identifier) => {
  if (!identifier) return null;

  // 1. Try ObjectId (existing links)
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const note = await PersonalNote.findById(identifier);
    if (note) return note;
  }

  // 2. Try Slug (new custom URLs)
  const bySlug = await PersonalNote.findOne({ slug: identifier });
  if (bySlug) return bySlug;

  // 3. Try Share Link (legacy URLs)
  const byShareLink = await PersonalNote.findOne({ shareLink: identifier, isPublic: true });
  if (byShareLink) return byShareLink;

  return null;
};

const resolveFolderId = async (folderId, userId) => {
  if (folderId === undefined) return undefined;
  if (folderId === null || folderId === '' || folderId === 'root') return null;
  if (!mongoose.Types.ObjectId.isValid(folderId)) {
    const err = new Error('Invalid folder ID.');
    err.statusCode = 400;
    throw err;
  }
  const folder = await PersonalNoteFolder.findById(folderId);
  if (!folder) {
    const err = new Error('Folder not found.');
    err.statusCode = 404;
    throw err;
  }
  if (folder.user.toString() !== userId.toString()) {
    const err = new Error('Folder does not belong to you.');
    err.statusCode = 403;
    throw err;
  }
  return folder._id;
};

const wouldCreateCycle = async (folderId, candidateParentId) => {
  if (!candidateParentId) return false;
  let current = candidateParentId;
  const seen = new Set();
  while (current) {
    if (current.toString() === folderId.toString()) return true;
    if (seen.has(current.toString())) return true;
    seen.add(current.toString());
    const parent = await PersonalNoteFolder.findById(current).select('parent');
    if (!parent) return false;
    current = parent.parent;
  }
  return false;
};

const normalizeColor = (color) => {
  if (color === undefined) return undefined;
  if (color === null) return null;
  if (typeof color !== 'string') {
    const err = new Error('Color must be a string.');
    err.statusCode = 400;
    throw err;
  }

  const trimmed = color.trim();
  if (!trimmed) return null;

  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^rgba?\(\s*\d{1,3}\s*[, ]\s*\d{1,3}\s*[, ]\s*\d{1,3}(\s*[,/]\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\)$/i.test(trimmed)) return trimmed;
  if (/^hsla?\(\s*\d{1,3}(deg)?\s*[, ]\s*\d{1,3}%\s*[, ]\s*\d{1,3}%(\s*[,/]\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\)$/i.test(trimmed)) return trimmed;
  if (/^[a-z]{3,20}$/i.test(trimmed)) return trimmed.toLowerCase();

  const err = new Error('Invalid color format.');
  err.statusCode = 400;
  throw err;
};

// ══════════════════════════════════════════════════════════════════════════
//  NOTE CONTROLLERS
// ══════════════════════════════════════════════════════════════════════════

// ─── Create Personal Note ──────────────────────────────────────────────
export const createNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, content, isPublic = false, folderId, color } = req.body;

  const noteTitle = title?.trim() ? title.trim() : 'Untitled';
  const noteContent = content?.trim() ? content.trim() : 'Write your note here...';
  const slug = await generateUniqueSlug(noteTitle);

  let resolvedFolderId = null;
  try {
    const r = await resolveFolderId(folderId, userId);
    if (r !== undefined) resolvedFolderId = r;
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  let resolvedColor = null;
  try {
    const c = normalizeColor(color);
    if (c !== undefined) resolvedColor = c;
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  const attachments =
    req.files?.map(file => ({
      filename: file.originalname,
      path: file.path,
      size: file.size,
      mimeType: file.mimetype,
    })) || [];

  const shareLink = isPublic ? uuidv4() : undefined;

  const note = await PersonalNote.create({
    user: userId,
    folder: resolvedFolderId,
    title: noteTitle,
    content: noteContent,
    slug,
    color: resolvedColor,
    isPublic,
    shareLink,
    attachments,
    lastEditedBy: userId,
    editHistory: [{ user: userId, action: 'Created note' }]
  });

  res.status(201).json({ success: true, note });
});

// ─── Get All Personal Notes ──────────────────────────────────────────────
export const getNotes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { folderId } = req.query;

  const query = { user: userId };

  if (folderId !== undefined) {
    if (folderId === 'root' || folderId === 'unfiled' || folderId === 'null') {
      query.folder = null;
    } else if (mongoose.Types.ObjectId.isValid(folderId)) {
      query.folder = folderId;
    } else {
      res.status(400);
      throw new Error('Invalid folderId.');
    }
  }

  const notes = await PersonalNote.find(query)
    .sort({ updatedAt: -1 })
    .select('-__v -editHistory') // Keep list light, fetch history on single note view
    .populate('lastEditedBy', 'name');

  res.status(200).json({ success: true, notes });
});

// ─── Get Single Personal Note (ID or Slug) ───────────────────────────────
export const getNote = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user.id : null;
  const note = await resolveNoteByIdentifier(req.params.id);

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  await note.populate('collaborators.user', 'name email');
  await note.populate('folder', 'name parent color');
  await note.populate('lastEditedBy', 'name');
  await note.populate('editHistory.user', 'name');

  const isOwner = userId && note.user.toString() === userId;
  const isCollaborator = userId && note.collaborators.some(
    c => c.user._id.toString() === userId && c.permission === 'read'
  );

  if (!isOwner && !isCollaborator && !note.isPublic) {
    res.status(403);
    throw new Error('You do not have permission to view this note.');
  }

  res.status(200).json({ success: true, note });
});

// ─── Get Note Collaborators & Edit History ────────────────────────────────
export const getNoteCollaborators = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await resolveNoteByIdentifier(req.params.id);

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  const isOwner = note.user.toString() === userId;
  const isCollaborator = note.collaborators.some(c => c.user.toString() === userId);

  if (!isOwner && !isCollaborator && !note.isPublic) {
    res.status(403);
    throw new Error('You do not have permission to view collaborators.');
  }

  await note.populate('collaborators.user', 'name email');
  await note.populate('editHistory.user', 'name');

  // Sort edit history newest first
  const sortedHistory = [...note.editHistory].sort((a, b) => b.timestamp - a.timestamp);

  res.status(200).json({
    success: true,
    collaborators: note.collaborators,
    pendingCollaborators: note.pendingCollaborators,
    editHistory: sortedHistory
  });
});

// ─── Get Public Note by Share Link (Legacy URL Support) ─────────────────
export const getNoteByShareLink = asyncHandler(async (req, res) => {
  const { link } = req.params;
  const note = await PersonalNote.findOne({ shareLink: link, isPublic: true })
    .populate('user', 'name email')
    .populate('folder', 'name parent color')
    .populate('lastEditedBy', 'name')
    .select('-__v -editHistory');

  if (!note) {
    res.status(404);
    throw new Error('Note not found or not public.');
  }

  res.status(200).json({ success: true, note });
});

// ─── Update Personal Note (Supports Slug editing) ────────────────────────
export const updateNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, content, isPublic, folderId, color, slug } = req.body;
  const note = await resolveNoteByIdentifier(req.params.id);

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  const isOwner = note.user.toString() === userId;
  const isEditCollaborator = note.collaborators.some(
    c => c.user.toString() === userId && c.permission === 'edit'
  );

  if (!isOwner && !isEditCollaborator) {
    res.status(403);
    throw new Error('You do not have permission to edit this note.');
  }

  let hasChanged = false;

  if (title !== undefined && note.title !== title.trim()) {
    note.title = title.trim() || 'Untitled';
    hasChanged = true;
  }
  
  if (content !== undefined && note.content !== content.trim()) {
    note.content = content.trim();
    hasChanged = true;
  }

  // Only owner can change the slug
  if (slug !== undefined && isOwner) {
    const newSlug = await generateUniqueSlug(slug, note._id);
    if (note.slug !== newSlug) {
      note.slug = newSlug;
      hasChanged = true;
    }
  }

  if (color !== undefined) {
    try {
      const newColor = normalizeColor(color);
      if (note.color !== newColor) {
        note.color = newColor;
        hasChanged = true;
      }
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }
  }

  if (isPublic !== undefined && note.isPublic !== isPublic) {
    note.isPublic = isPublic;
    if (isPublic && !note.shareLink) {
      note.shareLink = uuidv4();
    } else if (!isPublic) {
      note.shareLink = undefined;
    }
    hasChanged = true;
  }

  if (folderId !== undefined && isOwner) {
    try {
      const newFolderId = await resolveFolderId(folderId, userId);
      if (String(note.folder) !== String(newFolderId)) {
        note.folder = newFolderId;
        hasChanged = true;
      }
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }
  }

  if (req.files && req.files.length > 0) {
    note.attachments = req.files.map(file => ({
      filename: file.originalname,
      path: file.path,
      size: file.size,
      mimeType: file.mimetype,
    }));
    hasChanged = true;
  }

  if (hasChanged) {
    note.lastEditedBy = userId;
    
    // Add to edit history (keep last 50 entries)
    note.editHistory.push({
      user: userId,
      action: isOwner ? 'Updated note' : 'Edited content',
      timestamp: new Date()
    });
    
    if (note.editHistory.length > 50) {
      note.editHistory = note.editHistory.slice(-50);
    }
  }

  await note.save();
  res.status(200).json({ success: true, note });
});

// ─── Move Note to Folder ────────────────────────────────────────────────
export const moveNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { folderId } = req.body;
  const note = await resolveNoteByIdentifier(req.params.id);

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  if (note.user.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can move this note.');
  }

  try {
    note.folder = await resolveFolderId(folderId, userId);
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  await note.save();
  await note.populate('folder', 'name parent color');

  res.status(200).json({ success: true, note });
});

// ─── Update Note Color ──────────────────────────────────────────────────
export const updateNoteColor = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { color } = req.body;
  const note = await resolveNoteByIdentifier(req.params.id);

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  const isOwner = note.user.toString() === userId;
  const isEditCollaborator = note.collaborators.some(
    c => c.user.toString() === userId && c.permission === 'edit'
  );
  if (!isOwner && !isEditCollaborator) {
    res.status(403);
    throw new Error('You do not have permission to change this note.');
  }

  try {
    note.color = normalizeColor(color);
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  await note.save();
  res.status(200).json({ success: true, note });
});

// ─── Delete Personal Note ──────────────────────────────────────────────
export const deleteNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await resolveNoteByIdentifier(req.params.id);

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  if (note.user.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can delete this note.');
  }

  await note.deleteOne();
  res.status(200).json({ success: true, message: 'Note deleted.' });
});

// ─── Toggle Public / Generate Share Link ──────────────────────────────
export const togglePublic = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { isPublic } = req.body;
  if (isPublic === undefined) {
    res.status(400);
    throw new Error('isPublic boolean required.');
  }

  const note = await resolveNoteByIdentifier(req.params.id);
  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  if (note.user.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can change public status.');
  }

  note.isPublic = isPublic;
  if (isPublic) {
    note.shareLink = note.shareLink || uuidv4();
  } else {
    note.shareLink = undefined;
  }
  await note.save();

  res.status(200).json({
    success: true,
    isPublic: note.isPublic,
    shareLink: note.shareLink,
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  COLLABORATOR MANAGEMENT & REQUEST ACCESS
// ══════════════════════════════════════════════════════════════════════════

export const addCollaborator = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const rawIdentifier =
    req.body.collaboratorIdentifier ||
    req.body.collaboratorEmail ||
    req.body.email ||
    req.body.username ||
    '';
  const rawPermission = req.body.permission || 'read';
  const permission = rawPermission === 'edit' ? 'edit' : 'read';

  if (!rawIdentifier || !String(rawIdentifier).trim()) {
    res.status(400);
    throw new Error('Collaborator email or username is required.');
  }

  const note = await resolveNoteByIdentifier(req.params.id);
  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  if (note.user.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can add collaborators.');
  }

  const identifier = String(rawIdentifier).trim().toLowerCase();
  const existingUser = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }]
  });

  const inviterName = await getUserName(userId);

  // ── Case 1: User exists ──
  if (existingUser) {
    if (existingUser._id.toString() === userId) {
      res.status(400);
      throw new Error('You cannot add yourself as a collaborator.');
    }

    const alreadyCollaborator = note.collaborators.find(
      c => c.user.toString() === existingUser._id.toString()
    );
    if (alreadyCollaborator) {
      res.status(400);
      throw new Error('User is already a collaborator.');
    }

    note.pendingCollaborators = (note.pendingCollaborators || []).filter(
      p => p.email !== existingUser.email
    );
    
    note.collaboratorRequests = note.collaboratorRequests.filter(
      r => r.user.toString() !== existingUser._id.toString()
    );

    note.collaborators.push({ user: existingUser._id, permission });
    
    note.editHistory.push({
      user: userId,
      action: `Added ${existingUser.name} as ${permission} collaborator`,
      timestamp: new Date()
    });

    await note.save();

    try {
      await sendEmail({
        to: existingUser.email,
        subject: `You've been added as a collaborator to "${note.title}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0d9488;">Xircle</h2>
            <p>Hi ${existingUser.name || 'there'},</p>
            <p><strong>${inviterName}</strong> added you as a <strong>${permission}</strong> collaborator on the note: <strong>${note.title}</strong>.</p>
            <p><a href="${process.env.CLIENT_URL}/notes/${note.slug || note._id}" style="display: inline-block; padding: 10px 20px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 5px;">View Note</a></p>
          </div>
        `
      });
    } catch (err) {
      console.error('Failed to send collaborator email:', err.message);
    }

    try {
      await createAndSendNotification({
        recipient: existingUser._id,
        title: `Added to a note: "${note.title}"`,
        body: `${inviterName} added you as a ${permission} collaborator.`,
        data: { noteId: note._id.toString() },
        sendPush: true,
      });
    } catch (err) {
      console.error('Failed to send collaborator notification:', err.message);
    }

    await note.populate('collaborators.user', 'name email');
    return res.status(200).json({ success: true, note, message: 'Collaborator added successfully.' });
  }

  // ── Case 2: User does NOT exist (Invite them) ──
  if (!identifier.includes('@')) {
    res.status(400);
    throw new Error('User not found. If inviting a new user, please provide a valid email address.');
  }

  const alreadyInvited = (note.pendingCollaborators || []).find(p => p.email === identifier);
  if (alreadyInvited) {
    res.status(400);
    throw new Error('An invitation has already been sent to this email.');
  }

  note.pendingCollaborators.push({ email: identifier, permission });
  
  note.editHistory.push({
    user: userId,
    action: `Invited ${identifier} as ${permission} collaborator`,
    timestamp: new Date()
  });

  await note.save();

  try {
    await sendEmail({
      to: identifier,
      subject: `${inviterName} invited you to collaborate on a note on Xircle`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0d9488;">Xircle</h2>
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has invited you to be a <strong>${permission}</strong> collaborator on the note: <strong>${note.title}</strong>.</p>
          <p><a href="${process.env.CLIENT_URL}/signup?invite_note=${note._id}&email=${encodeURIComponent(identifier)}" style="display: inline-block; padding: 10px 20px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 5px;">Create your account now to join</a></p>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send invite email:', err.message);
  }

  return res.status(200).json({ success: true, message: 'Invitation sent to new user.', pending: true });
});

export const removeCollaborator = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await resolveNoteByIdentifier(req.params.id);

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  if (note.user.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can remove collaborators.');
  }

  const collaboratorId = decodeURIComponent(req.params.collaboratorId);
  const removedUser = await User.findById(collaboratorId).select('name');

  note.collaborators = note.collaborators.filter(
    c => c.user.toString() !== collaboratorId
  );

  note.pendingCollaborators = (note.pendingCollaborators || []).filter(
    p => p.email !== collaboratorId
  );

  note.editHistory.push({
    user: userId,
    action: `Removed collaborator ${removedUser ? removedUser.name : collaboratorId}`,
    timestamp: new Date()
  });

  await note.save();
  await note.populate('collaborators.user', 'name email');
  res.status(200).json({ success: true, note });
});

export const updateCollaboratorPermission = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { permission } = req.body;
  if (!permission || !['read', 'edit'].includes(permission)) {
    res.status(400);
    throw new Error('Permission must be "read" or "edit".');
  }

  const note = await resolveNoteByIdentifier(req.params.id);
  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  if (note.user.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can change collaborator permissions.');
  }

  const collaborator = note.collaborators.find(
    c => c.user.toString() === req.params.collaboratorId
  );
  if (!collaborator) {
    res.status(404);
    throw new Error('Collaborator not found.');
  }

  collaborator.permission = permission;
  
  const targetUser = await User.findById(req.params.collaboratorId).select('name');
  note.editHistory.push({
    user: userId,
    action: `Changed ${targetUser ? targetUser.name : 'collaborator'}'s permission to ${permission}`,
    timestamp: new Date()
  });

  await note.save();
  await note.populate('collaborators.user', 'name email');

  res.status(200).json({ success: true, note });
});

// ─── Request Access to a Public Note ─────────────────────────────────────
export const requestNoteAccess = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await resolveNoteByIdentifier(req.params.id);

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  if (!note.isPublic) {
    res.status(403);
    throw new Error('This note is not public.');
  }

  const isOwner = note.user.toString() === userId;
  if (isOwner) {
    return res.status(400).json({ success: false, message: 'You already own this note.' });
  }

  const isCollaborator = note.collaborators.some(
    c => c.user.toString() === userId && c.permission === 'read'
  );
  if (isCollaborator) {
    return res.status(400).json({ success: false, message: 'You already have access to this note.' });
  }

  const existingRequest = note.collaboratorRequests.find(
    r => r.user.toString() === userId && r.status === 'pending'
  );
  if (existingRequest) {
    return res.status(400).json({ success: false, message: 'You have already requested access.' });
  }

  // If a previous request exists (approved/rejected), clean it up
  note.collaboratorRequests = note.collaboratorRequests.filter(
    r => r.user.toString() !== userId
  );
  
  note.collaboratorRequests.push({ user: userId, status: 'pending' });
  await note.save();

  const requester = await User.findById(userId).select('name email');
  const requesterName = requester?.name || 'A user';
  const noteUrl = `${process.env.CLIENT_URL}/notes/${note.slug || note._id}`;

  // Notify Owner via Email
  try {
    const owner = await User.findById(note.user).select('email name');
    if (owner?.email) {
      await sendEmail({
        to: owner.email,
        subject: `${requesterName} is requesting access to "${note.title}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0d9488;">Xircle</h2>
            <p>Hi ${owner.name || 'there'},</p>
            <p><strong>${requesterName}</strong> has requested access to collaborate on your note: <strong>${note.title}</strong>.</p>
            <p><a href="${noteUrl}" style="display: inline-block; padding: 10px 20px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 5px;">Open Note to Review</a></p>
          </div>
        `
      });
    }
  } catch (err) {
    console.error('Failed to send access request email:', err.message);
  }

  // Notify Owner via Push Notification
  try {
    await createAndSendNotification({
      recipient: note.user,
      title: `Access Request: "${note.title}"`,
      body: `${requesterName} has requested access to view and collaborate on your note.`,
      data: { noteId: note._id.toString() },
      sendPush: true,
    });
  } catch (err) {
    console.error('Failed to send access request notification:', err.message);
  }

  res.status(200).json({ success: true, message: 'Access request sent to the owner.' });
});

// ─── Get All Pending Access Requests (Dashboard) ──────────────────────────
export const getAllPendingRequests = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const notes = await PersonalNote.find({
    user: userId,
    'collaboratorRequests.status': 'pending'
  })
  .select('title collaboratorRequests updatedAt')
  .populate('collaboratorRequests.user', 'name email profile');

  let allRequests = [];
  notes.forEach(note => {
    note.collaboratorRequests.forEach(req => {
      if (req.status === 'pending') {
        allRequests.push({
          noteId: note._id,
          noteTitle: note.title,
          requestId: req._id,
          user: req.user,
          createdAt: req.createdAt || note.updatedAt 
        });
      }
    });
  });

  // Sort newest first
  allRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.status(200).json({ success: true, requests: allRequests });
});

// ─── Get Pending Access Requests for Single Note (Owner only) ────────────
export const getAccessRequests = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await resolveNoteByIdentifier(req.params.id)
    .populate('collaboratorRequests.user', 'name email profile');

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  if (note.user.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can view access requests.');
  }

  const pendingRequests = note.collaboratorRequests.filter(r => r.status === 'pending');

  res.status(200).json({ success: true, requests: pendingRequests });
});

// ─── Resolve Access Request (Approve / Reject) ───────────────────────────
export const resolveAccessRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { action } = req.body; // 'approve' | 'reject'
  const requestId = req.params.requestId;

  if (!['approve', 'reject'].includes(action)) {
    res.status(400);
    throw new Error('Action must be "approve" or "reject".');
  }

  const note = await resolveNoteByIdentifier(req.params.id);
  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  if (note.user.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can resolve access requests.');
  }

  const request = note.collaboratorRequests.id(requestId);
  if (!request || request.status !== 'pending') {
    res.status(404);
    throw new Error('Pending request not found.');
  }

  const requesterId = request.user.toString();
  const requester = await User.findById(requesterId).select('name email');

  if (action === 'approve') {
    note.collaborators.push({ user: requesterId, permission: 'read' });
    
    // Send Approval Email
    if (requester?.email) {
      try {
        await sendEmail({
          to: requester.email,
          subject: `Access granted: "${note.title}"`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #0d9488;">Xircle</h2>
              <p>Hi ${requester.name || 'there'},</p>
              <p>Your request to collaborate on the note: <strong>${note.title}</strong> has been approved.</p>
              <p><a href="${process.env.CLIENT_URL}/notes/${note.slug || note._id}" style="display: inline-block; padding: 10px 20px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 5px;">Open Note</a></p>
            </div>
          `
        });
      } catch (err) {
        console.error('Failed to send approval email:', err.message);
      }
    }

    // Send Approval Notification
    try {
      await createAndSendNotification({
        recipient: requesterId,
        title: `Access granted: "${note.title}"`,
        body: `Your request to collaborate on this note has been approved.`,
        data: { noteId: note._id.toString() },
        sendPush: true,
      });
    } catch (err) {
      console.error('Failed to send approval notification:', err.message);
    }
    
    note.editHistory.push({
      user: userId,
      action: `Approved access request for ${requester ? requester.name : 'a user'}`,
      timestamp: new Date()
    });

  } else {
    // Send Rejection Email
    if (requester?.email) {
      try {
        await sendEmail({
          to: requester.email,
          subject: `Access request declined: "${note.title}"`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #0d9488;">Xircle</h2>
              <p>Hi ${requester.name || 'there'},</p>
              <p>Your request to collaborate on the note: <strong>${note.title}</strong> was declined by the owner.</p>
            </div>
          `
        });
      } catch (err) {
        console.error('Failed to send rejection email:', err.message);
      }
    }
    
    note.editHistory.push({
      user: userId,
      action: `Rejected access request for ${requester ? requester.name : 'a user'}`,
      timestamp: new Date()
    });
  }

  // Remove the request from the array regardless of action
  note.collaboratorRequests = note.collaboratorRequests.filter(
    r => r._id.toString() !== requestId
  );

  await note.save();
  res.status(200).json({ success: true, message: `Request ${action}d successfully.` });
});

// ══════════════════════════════════════════════════════════════════════════
//  AUTO-ASSIGN PENDING COLLABORATIONS (Call on Signup/Verify)
// ══════════════════════════════════════════════════════════════════════════
export const autoAssignPendingCollaborations = async (user) => {
  try {
    const notes = await PersonalNote.find({
      'pendingCollaborators.email': user.email
    });

    for (const note of notes) {
      const pendingInvite = note.pendingCollaborators.find(
        p => p.email === user.email
      );

      if (pendingInvite) {
        note.collaborators.push({
          user: user._id,
          permission: pendingInvite.permission,
        });

        note.pendingCollaborators = note.pendingCollaborators.filter(
          p => p.email !== user.email
        );

        note.editHistory.push({
          user: user._id,
          action: 'Joined as collaborator',
          timestamp: new Date()
        });

        await note.save();
        console.log(`✅ Auto-added ${user.email} as collaborator to note: ${note.title}`);
      }
    }
  } catch (err) {
    console.error('❌ Error auto-assigning pending collaborations:', err);
  }
};

// ─── Export Note as PDF ──────────────────────────────────────────────────
export const exportNotePDF = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await resolveNoteByIdentifier(req.params.id).populate('user', 'name');
  
  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  const isOwner = note.user._id.toString() === userId;
  const isCollaborator = note.collaborators.some(
    c => c.user.toString() === userId && c.permission === 'read'
  );
  if (!isOwner && !isCollaborator && !note.isPublic) {
    res.status(403);
    throw new Error('You do not have permission to export this note.');
  }

  const safeTitle = (note.title || 'Untitled').replace(/[^\w\-]+/g, '_');
  const doc = new pdf({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Note-${safeTitle}.pdf"`
  );

  doc.pipe(res);
  doc.fontSize(20).text(note.title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Author: ${note.user.name}`);
  doc.moveDown();
  doc.text(note.content);

  if (note.attachments && note.attachments.length > 0) {
    doc.moveDown();
    doc.fontSize(10).text('Attachments:');
    note.attachments.forEach((att, i) => {
      doc.text(`  ${i + 1}. ${att.filename} (${att.size} bytes)`);
    });
  }

  doc.end();
});

// ─── Import File to Note ──────────────────────────────────────────────
export const importFileToNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, folderId, color } = req.body;
  const file = req.file;

  if (!file) {
    res.status(400);
    throw new Error('No file uploaded.');
  }

  let resolvedFolderId = null;
  try {
    const r = await resolveFolderId(folderId, userId);
    if (r !== undefined) resolvedFolderId = r;
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  let resolvedColor = null;
  try {
    const c = normalizeColor(color);
    if (c !== undefined) resolvedColor = c;
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  let extractedText = '';
  const mime = file.mimetype;
  const buffer = file.buffer;

  try {
    if (mime === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel'
    ) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let allText = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        json.forEach(row => {
          allText += row.join(' ') + '\n';
        });
      });
      extractedText = allText;
    } else {
      extractedText = buffer.toString('utf-8');
    }

    const noteTitle = (title || file.originalname || '').trim();
    const slug = await generateUniqueSlug(noteTitle);

    const note = await PersonalNote.create({
      user: userId,
      folder: resolvedFolderId,
      title: noteTitle,
      slug,
      content: extractedText.trim() || 'No text could be extracted from the file.',
      color: resolvedColor,
      isPublic: false,
      attachments: [{
        filename: file.originalname,
        path: file.path,
        size: file.size,
        mimeType: file.mimetype,
      }],
      lastEditedBy: userId,
      editHistory: [{ user: userId, action: 'Imported from file' }]
    });

    res.status(201).json({
      success: true,
      message: 'Note created from file content.',
      note,
      extractedTextPreview: extractedText.slice(0, 500),
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500);
    throw new Error('Failed to extract text from file: ' + error.message);
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  FOLDER CONTROLLERS
// ══════════════════════════════════════════════════════════════════════════

export const createNoteFolder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, parentId = null, color = null } = req.body;

  if (!name?.trim()) {
    res.status(400);
    throw new Error('Folder name is required.');
  }

  let parent = null;
  if (parentId) {
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      res.status(400);
      throw new Error('Invalid parent folder ID.');
    }
    const parentFolder = await PersonalNoteFolder.findById(parentId);
    if (!parentFolder) {
      res.status(404);
      throw new Error('Parent folder not found.');
    }
    if (parentFolder.user.toString() !== userId) {
      res.status(403);
      throw new Error('Parent folder belongs to a different user.');
    }
    parent = parentFolder._id;
  }

  let resolvedColor = null;
  try {
    const c = normalizeColor(color);
    if (c !== undefined) resolvedColor = c;
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  try {
    const folder = await PersonalNoteFolder.create({
      user: userId,
      name: name.trim(),
      parent,
      color: resolvedColor,
    });
    res.status(201).json({ success: true, folder });
  } catch (err) {
    if (err.code === 11000) {
      res.status(409);
      throw new Error('A folder with that name already exists here.');
    }
    throw err;
  }
});

export const getNoteFolders = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const folders = await PersonalNoteFolder.find({ user: userId })
    .sort({ parent: 1, order: 1, name: 1 })
    .lean();
  res.status(200).json({ success: true, folders });
});

export const updateNoteFolder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, color, order, parentId } = req.body;

  const folder = await PersonalNoteFolder.findById(req.params.id);
  if (!folder) {
    res.status(404);
    throw new Error('Folder not found.');
  }
  if (folder.user.toString() !== userId) {
    res.status(403);
    throw new Error('You do not have permission to edit this folder.');
  }

  if (name !== undefined) {
    if (!name.trim()) {
      res.status(400);
      throw new Error('Folder name cannot be empty.');
    }
    folder.name = name.trim();
  }

  if (color !== undefined) {
    try {
      folder.color = normalizeColor(color);
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }
  }

  if (order !== undefined) folder.order = order;

  if (parentId !== undefined) {
    if (parentId === null || parentId === 'root') {
      folder.parent = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        res.status(400);
        throw new Error('Invalid parent folder ID.');
      }
      if (parentId.toString() === folder._id.toString()) {
        res.status(400);
        throw new Error('A folder cannot be its own parent.');
      }
      const newParent = await PersonalNoteFolder.findById(parentId);
      if (!newParent) {
        res.status(404);
        throw new Error('Parent folder not found.');
      }
      if (newParent.user.toString() !== folder.user.toString()) {
        res.status(403);
        throw new Error('Parent folder belongs to a different user.');
      }
      if (await wouldCreateCycle(folder._id, newParent._id)) {
        res.status(400);
        throw new Error('Cannot move a folder into one of its own descendants.');
      }
      folder.parent = newParent._id;
    }
  }

  try {
    await folder.save();
    res.status(200).json({ success: true, folder });
  } catch (err) {
    if (err.code === 11000) {
      res.status(409);
      throw new Error('A folder with that name already exists here.');
    }
    throw err;
  }
});

export const updateNoteFolderColor = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { color } = req.body;

  const folder = await PersonalNoteFolder.findById(req.params.id);
  if (!folder) {
    res.status(404);
    throw new Error('Folder not found.');
  }
  if (folder.user.toString() !== userId) {
    res.status(403);
    throw new Error('You do not have permission to change this folder.');
  }

  try {
    folder.color = normalizeColor(color);
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  await folder.save();
  res.status(200).json({ success: true, folder });
});

export const deleteNoteFolder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { moveNotesTo = 'parent' } = req.body || {};

  const folder = await PersonalNoteFolder.findById(req.params.id);
  if (!folder) {
    res.status(404);
    throw new Error('Folder not found.');
  }
  if (folder.user.toString() !== userId) {
    res.status(403);
    throw new Error('You do not have permission to delete this folder.');
  }

  let targetFolderId = folder.parent;
  if (moveNotesTo === 'root') {
    targetFolderId = null;
  } else if (moveNotesTo !== 'parent') {
    if (!mongoose.Types.ObjectId.isValid(moveNotesTo)) {
      res.status(400);
      throw new Error('Invalid moveNotesTo value.');
    }
    const target = await PersonalNoteFolder.findById(moveNotesTo);
    if (!target) {
      res.status(404);
      throw new Error('Target folder for move not found.');
    }
    if (target.user.toString() !== folder.user.toString()) {
      res.status(403);
      throw new Error('Target folder belongs to a different user.');
    }
    targetFolderId = target._id;
  }

  await PersonalNoteFolder.updateMany(
    { parent: folder._id },
    { $set: { parent: folder.parent } }
  );

  await PersonalNote.updateMany(
    { folder: folder._id },
    { $set: { folder: targetFolderId } }
  );

  await folder.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Folder deleted.',
    movedNotesTo: targetFolderId,
  });
});