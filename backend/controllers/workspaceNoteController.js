// controllers/workspaceNoteController.js
import asyncHandler from 'express-async-handler';
import WorkspaceNote from '../models/workspaceNoteModel.js';
import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import { createAndSendNotification } from './notificationController.js';
import pdf from 'pdfkit';
import mammoth from 'mammoth';
import XLSX from 'xlsx';

// ─── Helpers ──────────────────────────────────────────────────────────────

const isActiveMember = (workspace, userId) =>
  workspace.members.some(
    m => m.user.toString() === userId && m.status === 'active'
  );

const isAdminOrOwner = (workspace, userId) => {
  const isOwner = workspace.owner.toString() === userId;
  const isAdmin = workspace.members.some(
    m => m.user.toString() === userId && m.role === 'Admin' && m.status === 'active'
  );
  return isOwner || isAdmin;
};

const getActiveMemberIds = (workspace) =>
  workspace.members
    .filter(m => m.status === 'active')
    .map(m => m.user.toString());

// ─── Create Workspace Note ──────────────────────────────────────────────
// POST /api/workspace-notes
export const createWorkspaceNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId, title, content } = req.body;

  if (!workspaceId || !title?.trim() || !content?.trim()) {
    res.status(400);
    throw new Error('Workspace ID, title, and content are required.');
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (!isActiveMember(workspace, userId)) {
    res.status(403);
    throw new Error('You are not an active member of this workspace.');
  }

  const attachments = req.files?.map(file => ({
    filename: file.originalname,
    path: file.path,
    size: file.size,
    mimeType: file.mimetype,
  })) || [];

  const note = await WorkspaceNote.create({
    workspace: workspaceId,
    author: userId,
    title: title.trim(),
    content: content.trim(),
    attachments,
  });

  await note.populate('author', 'name email profile');

  // ─── Notify all active members (except author) ────────────────────────
  const memberIds = getActiveMemberIds(workspace).filter(id => id !== userId);
  if (memberIds.length > 0) {
    const authorName = req.user.name || 'A member';
    createAndSendNotification({
      recipient: memberIds,
      title: `New note in "${workspace.name}"`,
      body: `${authorName} posted a new note: "${note.title}"`,
      data: { workspaceId, noteId: note._id.toString() },
      sendPush: true,
      emailEventType: 'projectUpdate',
      emailSubject: `New note in ${workspace.name}`,
      emailHtml: `
        <h3>New Workspace Note</h3>
        <p><strong>${authorName}</strong> posted a new note in <strong>${workspace.name}</strong>.</p>
        <p><em>${note.title}</em></p>
        <p><a href="${process.env.CLIENT_URL}/workspace/${workspaceId}/notes/${note._id}">View Note</a></p>
      `,
    }).catch(err => console.error('Notification error:', err.message));
  }

  res.status(201).json({ success: true, note });
});

// ─── Get All Workspace Notes ────────────────────────────────────────────
// GET /api/workspace-notes/:workspaceId
export const getWorkspaceNotes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (!isActiveMember(workspace, userId)) {
    res.status(403);
    throw new Error('You are not a member of this workspace.');
  }

  const notes = await WorkspaceNote.find({ workspace: workspaceId })
    .populate('author', 'name email profile')
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, notes });
});

// ─── Get Single Workspace Note ──────────────────────────────────────────
// GET /api/workspace-notes/note/:id
export const getWorkspaceNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await WorkspaceNote.findById(req.params.id)
    .populate('author', 'name email profile');

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  const workspace = await Workspace.findById(note.workspace);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found for this note.');
  }

  if (!isActiveMember(workspace, userId)) {
    res.status(403);
    throw new Error('You are not a member of this workspace.');
  }

  res.status(200).json({ success: true, note });
});

// ─── Update Workspace Note ──────────────────────────────────────────────
// PUT /api/workspace-notes/:id
export const updateWorkspaceNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, content } = req.body;
  const note = await WorkspaceNote.findById(req.params.id)
    .populate('author', 'name');

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  const workspace = await Workspace.findById(note.workspace);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  const isAuthor = note.author._id.toString() === userId;
  const isManager = isAdminOrOwner(workspace, userId);

  if (!isAuthor && !isManager) {
    res.status(403);
    throw new Error('You do not have permission to edit this note.');
  }

  if (title) note.title = title.trim();
  if (content) note.content = content.trim();

  if (req.files && req.files.length > 0) {
    note.attachments = req.files.map(file => ({
      filename: file.originalname,
      path: file.path,
      size: file.size,
      mimeType: file.mimetype,
    }));
  }

  await note.save();
  await note.populate('author', 'name email profile');

  res.status(200).json({ success: true, note });
});

// ─── Delete Workspace Note ──────────────────────────────────────────────
// DELETE /api/workspace-notes/:id
export const deleteWorkspaceNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await WorkspaceNote.findById(req.params.id);

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  const workspace = await Workspace.findById(note.workspace);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  const isAuthor = note.author.toString() === userId;
  const isManager = isAdminOrOwner(workspace, userId);

  if (!isAuthor && !isManager) {
    res.status(403);
    throw new Error('You do not have permission to delete this note.');
  }

  await note.deleteOne();
  res.status(200).json({ success: true, message: 'Note deleted.' });
});

// ─── Export Workspace Note as PDF ──────────────────────────────────────
// GET /api/workspace-notes/:id/export-pdf
export const exportWorkspaceNotePDF = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await WorkspaceNote.findById(req.params.id)
    .populate('author', 'name');

  if (!note) {
    res.status(404);
    throw new Error('Note not found.');
  }

  const workspace = await Workspace.findById(note.workspace);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (!isActiveMember(workspace, userId)) {
    res.status(403);
    throw new Error('You are not a member of this workspace.');
  }

  const doc = new pdf({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="WorkspaceNote-${note.title}.pdf"`);

  doc.pipe(res);

  doc.fontSize(20).text(note.title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Author: ${note.author.name}`);
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

// ─── Import File to Workspace Note ──────────────────────────────────────
// POST /api/workspace-notes/import
export const importFileToWorkspaceNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId, title } = req.body;
  const file = req.file;

  if (!workspaceId || !file) {
    res.status(400);
    throw new Error('Workspace ID and file are required.');
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (!isActiveMember(workspace, userId)) {
    res.status(403);
    throw new Error('You are not an active member of this workspace.');
  }

  let extractedText = '';
  const buffer = file.buffer;
  const mime = file.mimetype;

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

    const noteTitle = title || file.originalname;

    const note = await WorkspaceNote.create({
      workspace: workspaceId,
      author: userId,
      title: noteTitle.trim(),
      content: extractedText.trim() || 'No text could be extracted.',
      attachments: [{
        filename: file.originalname,
        path: file.path,
        size: file.size,
        mimeType: file.mimetype,
      }],
    });

    await note.populate('author', 'name email profile');

    // ─── Notify all active members (except author) ────────────────────────
    const memberIds = getActiveMemberIds(workspace).filter(id => id !== userId);
    if (memberIds.length > 0) {
      const authorName = req.user.name || 'A member';
      createAndSendNotification({
        recipient: memberIds,
        title: `New imported note in "${workspace.name}"`,
        body: `${authorName} imported a note: "${note.title}"`,
        data: { workspaceId, noteId: note._id.toString() },
        sendPush: true,
        emailEventType: 'projectUpdate',
        emailSubject: `New note in ${workspace.name}`,
        emailHtml: `<p>${authorName} imported a new note: <strong>${note.title}</strong> in <strong>${workspace.name}</strong>.</p>`,
      }).catch(err => console.error('Notification error:', err.message));
    }

    res.status(201).json({
      success: true,
      message: 'Workspace note created from file.',
      note,
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500);
    throw new Error('Failed to extract text from file: ' + error.message);
  }
});