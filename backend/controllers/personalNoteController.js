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
    color: resolvedColor,
    isPublic,
    shareLink,
    attachments,
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
    .select('-__v');

  res.status(200).json({ success: true, notes });
});

// ─── Get Single Personal Note (Guest Access Supported) ───────────────────
export const getNote = asyncHandler(async (req, res) => {
  // req.user will be undefined if it's a guest, so we check gracefully
  const userId = req.user ? req.user.id : null;

  const note = await PersonalNote.findById(req.params.id)
    .populate('collaborators.user', 'name email')
    .populate('folder', 'name parent color');

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  const isOwner = userId && note.user.toString() === userId;
  const isCollaborator = userId && note.collaborators.some(
    c => c.user._id.toString() === userId && c.permission === 'read'
  );

  // Allow access if user is owner, collaborator, OR if the note is public
  if (!isOwner && !isCollaborator && !note.isPublic) {
    res.status(403);
    throw new Error('You do not have permission to view this note.');
  }

  res.status(200).json({ success: true, note });
});

// ─── Update Personal Note ────────────────────────────────────────────────
export const updateNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, content, isPublic, folderId, color } = req.body;
  const note = await PersonalNote.findById(req.params.id);

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

  if (title !== undefined) note.title = title.trim() || 'Untitled';
  if (content !== undefined) note.content = content.trim();

  if (color !== undefined) {
    try {
      note.color = normalizeColor(color);
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }
  }

  if (isPublic !== undefined) {
    note.isPublic = isPublic;
    if (isPublic && !note.shareLink) {
      note.shareLink = uuidv4();
    } else if (!isPublic) {
      note.shareLink = undefined;
    }
  }

  if (folderId !== undefined) {
    if (!isOwner) {
      res.status(403);
      throw new Error('Only the owner can move this note.');
    }
    try {
      note.folder = await resolveFolderId(folderId, userId);
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
  }

  await note.save();
  res.status(200).json({ success: true, note });
});

// ─── Move Note to Folder ────────────────────────────────────────────────
export const moveNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { folderId } = req.body;

  const note = await PersonalNote.findById(req.params.id);
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

  const note = await PersonalNote.findById(req.params.id);
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
  const note = await PersonalNote.findById(req.params.id);

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

  const note = await PersonalNote.findById(req.params.id);
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

// ─── Manage Collaborators (Invite by Email or Username) ────────────────

export const addCollaborator = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // ── Accept ANY of these field names for maximum compatibility ──
  // (Older frontend versions sent `collaboratorEmail` or `email`;
  //  newer versions send `collaboratorIdentifier`.)
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

  const note = await PersonalNote.findById(req.params.id);
  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  if (note.user.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can add collaborators.');
  }

  const identifier = String(rawIdentifier).trim().toLowerCase();

  // Check if user exists by email OR username
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

    // Remove from pending list if they were invited previously
    note.pendingCollaborators = (note.pendingCollaborators || []).filter(
      p => p.email !== existingUser.email
    );

    note.collaborators.push({
      user: existingUser._id,
      permission,
    });
    await note.save();

    // Send "Added" email
    try {
      await sendEmail({
        to: existingUser.email,
        subject: `You've been added as a collaborator to "${note.title}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0d9488;">Xircle</h2>
            <p>Hi ${existingUser.name || 'there'},</p>
            <p><strong>${inviterName}</strong> added you as a <strong>${permission}</strong> collaborator on the note: <strong>${note.title}</strong>.</p>
            <p><a href="${process.env.CLIENT_URL}/notes/${note._id}" style="display: inline-block; padding: 10px 20px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 5px;">View Note</a></p>
          </div>
        `
      });
    } catch (err) {
      console.error('Failed to send collaborator email:', err.message);
    }

    // In-app notification
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
  // Ensure it looks like an email
  if (!identifier.includes('@')) {
    res.status(400);
    throw new Error('User not found. If inviting a new user, please provide a valid email address.');
  }

  const alreadyInvited = (note.pendingCollaborators || []).find(p => p.email === identifier);
  if (alreadyInvited) {
    res.status(400);
    throw new Error('An invitation has already been sent to this email.');
  }

  note.pendingCollaborators.push({
    email: identifier,
    permission,
  });
  await note.save();

  // Send "Invite" email
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
          <p style="font-size: 12px; color: #666; margin-top: 20px;">Once you create your account, you will be automatically added to this note.</p>
        </div>
      `
    });
  } catch (err) {
    console.error('Failed to send invite email:', err.message);
    // Still return success because the invite was saved
  }

  return res.status(200).json({ success: true, message: 'Invitation sent to new user.', pending: true });
});

// Remove collaborator
export const removeCollaborator = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await PersonalNote.findById(req.params.id);
  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  if (note.user.toString() !== userId) {
    res.status(403);
    throw new Error('Only the owner can remove collaborators.');
  }

  const collaboratorId = decodeURIComponent(req.params.collaboratorId);

  // Remove from active collaborators
  note.collaborators = note.collaborators.filter(
    c => c.user.toString() !== collaboratorId
  );

  // Also remove from pending if they were somehow there (by email)
  note.pendingCollaborators = (note.pendingCollaborators || []).filter(
    p => p.email !== collaboratorId
  );

  await note.save();
  await note.populate('collaborators.user', 'name email');
  res.status(200).json({ success: true, note });
});

// Update collaborator permission
export const updateCollaboratorPermission = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { permission } = req.body;
  if (!permission || !['read', 'edit'].includes(permission)) {
    res.status(400);
    throw new Error('Permission must be "read" or "edit".');
  }

  const note = await PersonalNote.findById(req.params.id);
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
  await note.save();
  await note.populate('collaborators.user', 'name email');

  res.status(200).json({ success: true, note });
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
        // Add as collaborator
        note.collaborators.push({
          user: user._id,
          permission: pendingInvite.permission,
        });

        // Remove from pending
        note.pendingCollaborators = note.pendingCollaborators.filter(
          p => p.email !== user.email
        );

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
  const note = await PersonalNote.findById(req.params.id).populate('user', 'name');
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

    const note = await PersonalNote.create({
      user: userId,
      folder: resolvedFolderId,
      title: noteTitle,
      content: extractedText.trim() || 'No text could be extracted from the file.',
      color: resolvedColor,
      isPublic: false,
      attachments: [{
        filename: file.originalname,
        path: file.path,
        size: file.size,
        mimeType: file.mimetype,
      }],
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