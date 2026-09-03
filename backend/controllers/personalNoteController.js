// controllers/personalNoteController.js
import asyncHandler from 'express-async-handler';
import PersonalNote from '../models/personalNoteModel.js';
import User from '../models/userModel.js';
import { v4 as uuidv4 } from 'uuid';
import { createAndSendNotification } from './notificationController.js';
import pdf from 'pdfkit';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
// pdf‑parse is now imported dynamically (see inside importFileToNote)

// ─── Helpers ──────────────────────────────────────────────────────────────

const getUserName = async (userId) => {
  const user = await User.findById(userId).select('name');
  return user?.name || 'Unknown User';
};

// ─── Create Personal Note ──────────────────────────────────────────────
// POST /api/personal-notes
// Empty notes are allowed on creation — title defaults to "Untitled" and
// content defaults to a placeholder string if not supplied.
// IMPORTANT: shareLink must be `undefined` (not `null`) when the note isn't
// public. `shareLink` has a sparse unique index — sparse only skips docs
// where the field is *missing*, not docs where it's explicitly `null`, so
// setting it to `null` on every private note collides on the second one.
export const createNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, content, isPublic = false } = req.body;

  const noteTitle = title?.trim() ? title.trim() : 'Untitled';
  const noteContent = content?.trim() ? content.trim() : 'Write your note here...';

  const attachments = req.files?.map(file => ({
    filename: file.originalname,
    path: file.path,
    size: file.size,
    mimeType: file.mimetype,
  })) || [];

  const shareLink = isPublic ? uuidv4() : undefined;

  const note = await PersonalNote.create({
    user: userId,
    title: noteTitle,
    content: noteContent,
    isPublic,
    shareLink,
    attachments,
  });

  res.status(201).json({ success: true, note });
});

// ─── Get All Personal Notes ──────────────────────────────────────────────
// GET /api/personal-notes
export const getNotes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const notes = await PersonalNote.find({ user: userId })
    .sort({ updatedAt: -1 })
    .select('-__v');
  res.status(200).json({ success: true, notes });
});

// ─── Get Single Personal Note ────────────────────────────────────────────
// GET /api/personal-notes/:id
export const getNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await PersonalNote.findById(req.params.id)
    .populate('collaborators.user', 'name email');

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
// PUT /api/personal-notes/:id
// NOTE: uses `!== undefined` checks (not truthiness) so that saving an
// intentionally-emptied title/content (e.g. user deleted everything in the
// editor) actually persists instead of being silently skipped.
// Also: shareLink is unset with `undefined`, never `null` — see createNote
// comment above for why.
export const updateNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, content, isPublic } = req.body;
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

// ─── Delete Personal Note ──────────────────────────────────────────────
// DELETE /api/personal-notes/:id
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
// PATCH /api/personal-notes/:id/public
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
// GET /api/personal-notes/share/:link
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

  const collaborator = await User.findOne({ email: collaboratorEmail.trim().toLowerCase() });
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
// GET /api/personal-notes/:id/export-pdf
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

  const doc = new pdf({
    size: 'A4',
    margin: 50,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Note-${note.title}.pdf"`);

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
      doc.text(`  ${i+1}. ${att.filename} (${att.size} bytes)`);
    });
  }

  doc.end();
});

// ─── Import File to Note ──────────────────────────────────────────────
// POST /api/personal-notes/import
export const importFileToNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const file = req.file;

  if (!file) {
    res.status(400);
    throw new Error('No file uploaded.');
  }

  let extractedText = '';
  const mime = file.mimetype;
  const buffer = file.buffer;

  try {
    if (mime === 'application/pdf') {
      // ✅ dynamic import for pdf-parse
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

    const title = req.body.title || file.originalname;

    const note = await PersonalNote.create({
      user: userId,
      title: title.trim(),
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