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

// ─── Helpers ──────────────────────────────────────────────────────────────

const getUserName = async (userId) => {
  const user = await User.findById(userId).select('name');
  return user?.name || 'Unknown User';
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

// ══════════════════════════════════════════════════════════════════════════
//  NOTE CONTROLLERS
// ══════════════════════════════════════════════════════════════════════════

// ─── Create Personal Note ──────────────────────────────────────────────
export const createNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, content, isPublic = false, folderId } = req.body;

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

// ─── Get Single Personal Note ────────────────────────────────────────────
export const getNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await PersonalNote.findById(req.params.id)
    .populate('collaborators.user', 'name email')
    .populate('folder', 'name parent');

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  const isOwner = note.user.toString() === userId;
  const isCollaborator = note.collaborators.some(
    c => c.user._id.toString() === userId && c.permission === 'read'
  );
  if (!isOwner && !isCollaborator) {
    res.status(403);
    throw new Error('You do not have permission to view this note.');
  }

  res.status(200).json({ success: true, note });
});

// ─── Update Personal Note ────────────────────────────────────────────────
export const updateNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, content, isPublic, folderId } = req.body;
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
  await note.populate('folder', 'name parent');

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

// ─── Get Public Note by Share Link ────────────────────────────────────
export const getNoteByShareLink = asyncHandler(async (req, res) => {
  const { link } = req.params;
  const note = await PersonalNote.findOne({ shareLink: link, isPublic: true })
    .populate('user', 'name email')
    .select('-__v');

  if (!note) {
    res.status(404);
    throw new Error('Note not found or not public.');
  }

  res.status(200).json({ success: true, note });
});

// ─── Manage Collaborators ──────────────────────────────────────────────
// ✅ KEPT — unchanged from your original file.

// Add collaborator
// POST /api/personal-notes/:id/collaborators
export const addCollaborator = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { collaboratorEmail, permission = 'read' } = req.body;

  if (!collaboratorEmail) {
    res.status(400);
    throw new Error('Collaborator email is required.');
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

  const collaborator = await User.findOne({
    email: collaboratorEmail.trim().toLowerCase(),
  });
  if (!collaborator) {
    res.status(404);
    throw new Error('User not found with that email.');
  }

  if (collaborator._id.toString() === userId) {
    res.status(400);
    throw new Error('You cannot add yourself as a collaborator.');
  }

  const already = note.collaborators.find(
    c => c.user.toString() === collaborator._id.toString()
  );
  if (already) {
    res.status(400);
    throw new Error('User is already a collaborator.');
  }

  note.collaborators.push({
    user: collaborator._id,
    permission: permission === 'edit' ? 'edit' : 'read',
  });
  await note.save();

  await createAndSendNotification({
    recipient: collaborator._id,
    title: `You've been added to a note: "${note.title}"`,
    body: `${req.user.name} added you as a ${permission} collaborator.`,
    data: { noteId: note._id.toString() },
    sendPush: true,
    emailEventType: 'collaboration',
    emailSubject: `Note collaboration: ${note.title}`,
    emailHtml: `<p>${req.user.name} added you as a collaborator with <strong>${permission}</strong> permission on note: <strong>${note.title}</strong>.</p>`,
  });

  await note.populate('collaborators.user', 'name email');
  res.status(200).json({ success: true, note });
});

// Remove collaborator
// DELETE /api/personal-notes/:id/collaborators/:collaboratorId
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

  const collaboratorId = req.params.collaboratorId;
  note.collaborators = note.collaborators.filter(
    c => c.user.toString() !== collaboratorId
  );
  await note.save();

  await note.populate('collaborators.user', 'name email');
  res.status(200).json({ success: true, note });
});

// Update collaborator permission
// PATCH /api/personal-notes/:id/collaborators/:collaboratorId
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
  const { title, folderId } = req.body;
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

// ─── Create Folder ──────────────────────────────────────────────────────
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

  try {
    const folder = await PersonalNoteFolder.create({
      user: userId,
      name: name.trim(),
      parent,
      color,
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

// ─── List Folders ───────────────────────────────────────────────────────
export const getNoteFolders = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const folders = await PersonalNoteFolder.find({ user: userId })
    .sort({ parent: 1, order: 1, name: 1 })
    .lean();
  res.status(200).json({ success: true, folders });
});

// ─── Update Folder ──────────────────────────────────────────────────────
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

  if (color !== undefined) folder.color = color;
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

// ─── Delete Folder ──────────────────────────────────────────────────────
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