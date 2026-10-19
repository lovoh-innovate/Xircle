// controllers/workspaceNoteController.js
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import WorkspaceNote from '../models/workspaceNoteModel.js';
import WorkspaceNoteFolder from '../models/workspaceNoteFolderModel.js';
import Workspace from '../models/workspaceModel.js';
import { createAndSendNotification } from './notificationController.js';
import pdf from 'pdfkit';
import mammoth from 'mammoth';
import XLSX from 'xlsx';

// ══════════════════════════════════════════════════════════════════════════
//  SHARED HELPERS
// ══════════════════════════════════════════════════════════════════════════

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

// Validate that a folder (if provided) belongs to the given workspace.
const resolveFolderId = async (folderId, workspaceId) => {
  if (folderId === undefined) return undefined; // not provided
  if (folderId === null || folderId === '' || folderId === 'root') return null;
  if (!mongoose.Types.ObjectId.isValid(folderId)) {
    const err = new Error('Invalid folder ID.');
    err.statusCode = 400;
    throw err;
  }
  const folder = await WorkspaceNoteFolder.findById(folderId);
  if (!folder) {
    const err = new Error('Folder not found.');
    err.statusCode = 404;
    throw err;
  }
  if (folder.workspace.toString() !== workspaceId.toString()) {
    const err = new Error('Folder does not belong to this workspace.');
    err.statusCode = 400;
    throw err;
  }
  return folder._id;
};

// Detect if making `folderId` a child of `candidateParentId` would create a cycle.
const wouldCreateCycle = async (folderId, candidateParentId) => {
  if (!candidateParentId) return false;
  let current = candidateParentId;
  const seen = new Set();
  while (current) {
    if (current.toString() === folderId.toString()) return true;
    if (seen.has(current.toString())) return true;
    seen.add(current.toString());
    const parent = await WorkspaceNoteFolder.findById(current).select('parent');
    if (!parent) return false;
    current = parent.parent;
  }
  return false;
};

// ─── COLOR HELPER ──────────────────────────────────────────────────────
// Shared by BOTH notes and folders in this controller.
//   undefined  → "not provided, leave as-is"  (returns undefined)
//   null / ''  → clear the color              (returns null)
//   valid      → normalize and return it
//   invalid    → throw 400
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

  // Hex: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  // rgb() / rgba()
  if (/^rgba?\(\s*\d{1,3}\s*[, ]\s*\d{1,3}\s*[, ]\s*\d{1,3}(\s*[,/]\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\)$/i.test(trimmed)) {
    return trimmed;
  }
  // hsl() / hsla()
  if (/^hsla?\(\s*\d{1,3}(deg)?\s*[, ]\s*\d{1,3}%\s*[, ]\s*\d{1,3}%(\s*[,/]\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\)$/i.test(trimmed)) {
    return trimmed;
  }
  // Named colors (basic set)
  if (/^[a-z]{3,20}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const err = new Error('Invalid color format.');
  err.statusCode = 400;
  throw err;
};

// ─── VISIBILITY HELPER ─────────────────────────────────────────────────
//   undefined  → "not provided, leave as-is"
//   true/false → convenience for boolean UIs
//   'public' | 'workspace' → normalized
//   anything else → throw 400
const normalizeVisibility = (visibility) => {
  if (visibility === undefined) return undefined;
  if (visibility === true) return 'public';
  if (visibility === false) return 'workspace';
  if (visibility === 'public' || visibility === 'workspace') return visibility;
  const err = new Error("Visibility must be 'public' or 'workspace'.");
  err.statusCode = 400;
  throw err;
};

// ─── PERMISSION + ATTRIBUTION HELPERS ──────────────────────────────────
const MAX_HISTORY_ENTRIES = 200;

// Works whether `note.author` is an ObjectId or a populated doc.
const authorIdOf = (note) =>
  (note.author && note.author._id ? note.author._id : note.author).toString();

// Author OR Admin OR Owner can edit/move/color/visibility/delete.
const canManageNote = (note, workspace, userId) =>
  authorIdOf(note) === userId.toString() || isAdminOrOwner(workspace, userId);

// Append a history entry + stamp the note as last-edited by `userId`.
const recordHistory = (note, userId, action, changes = []) => {
  if (!Array.isArray(note.history)) note.history = [];
  note.history.push({ user: userId, action, changes, at: new Date() });
  if (note.history.length > MAX_HISTORY_ENTRIES) {
    note.history = note.history.slice(-MAX_HISTORY_ENTRIES);
  }
  note.lastEditedBy = userId;
  note.lastEditedAt = new Date();
};

// ══════════════════════════════════════════════════════════════════════════
//  NOTE CONTROLLERS
// ══════════════════════════════════════════════════════════════════════════

// ─── Create Workspace Note (supports drafts / autosave) ─────────────────
// POST /api/workspace-notes
// Body: { workspaceId, title?, content?, folderId?, color?, visibility? }
export const createWorkspaceNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId, title, content, folderId, color, visibility } = req.body;

  if (!workspaceId) {
    res.status(400);
    throw new Error('Workspace ID is required.');
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

  let resolvedFolderId = null;
  try {
    const r = await resolveFolderId(folderId, workspaceId);
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

  let resolvedVisibility = 'workspace';
  try {
    const v = normalizeVisibility(visibility);
    if (v !== undefined) resolvedVisibility = v;
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

  const note = new WorkspaceNote({
    workspace: workspaceId,
    folder: resolvedFolderId,
    author: userId,
    title: typeof title === 'string' ? title.trim() : '',
    content: typeof content === 'string' ? content.trim() : '',
    color: resolvedColor,
    visibility: resolvedVisibility,
    attachments,
  });

  recordHistory(
    note,
    userId,
    'created',
    resolvedVisibility === 'public' ? ['created', 'visibility'] : ['created']
  );

  await note.save();

  await note.populate('author', 'name email profile');
  await note.populate('lastEditedBy', 'name profile');
  await note.populate('history.user', 'name profile');

  // Only notify for real notes (skip empty autosave drafts)
  const hasContent =
    (note.title && note.title.trim()) || (note.content && note.content.trim());
  const memberIds = getActiveMemberIds(workspace).filter(id => id !== userId);

  if (hasContent && memberIds.length > 0) {
    const authorName = req.user.name || 'A member';
    const displayTitle = note.title || 'Untitled note';
    createAndSendNotification({
      recipient: memberIds,
      title: `New note in "${workspace.name}"`,
      body: `${authorName} posted a new note: "${displayTitle}"`,
      data: { workspaceId, noteId: note._id.toString() },
      sendPush: true,
      emailEventType: 'projectUpdate',
      emailSubject: `New note in ${workspace.name}`,
      emailHtml: `
        <h3>New Workspace Note</h3>
        <p><strong>${authorName}</strong> posted a new note in <strong>${workspace.name}</strong>.</p>
        <p><em>${displayTitle}</em></p>
        <p><a href="${process.env.CLIENT_URL}/workspace/${workspaceId}/notes/${note._id}">View Note</a></p>
      `,
    }).catch(err => console.error('Notification error:', err.message));
  }

  res.status(201).json({ success: true, note });
});

// ─── Get All Workspace Notes ────────────────────────────────────────────
// GET /api/workspace-notes/:workspaceId?folderId=<id|root>
export const getWorkspaceNotes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId } = req.params;
  const { folderId } = req.query;

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  if (!isActiveMember(workspace, userId)) {
    res.status(403);
    throw new Error('You are not a member of this workspace.');
  }

  const query = { workspace: workspaceId };

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

  // List stays light — omit full history for payload size.
  const notes = await WorkspaceNote.find(query)
    .select('-history')
    .populate('author', 'name email profile')
    .populate('lastEditedBy', 'name profile')
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, notes });
});

// ─── Get Single Workspace Note (members only) ───────────────────────────
// GET /api/workspace-notes/note/:id
export const getWorkspaceNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const note = await WorkspaceNote.findById(req.params.id)
    .populate('author', 'name email profile')
    .populate('lastEditedBy', 'name profile')
    .populate('history.user', 'name profile')
    .populate('folder', 'name parent color');

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

// ─── Get PUBLIC Workspace Note (no auth) ────────────────────────────────
// GET /api/workspace-notes/public/:workspaceId/:noteId
// Anyone with the link can read — ONLY if visibility === 'public'.
export const getPublicWorkspaceNote = asyncHandler(async (req, res) => {
  const { workspaceId, noteId } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(workspaceId) ||
    !mongoose.Types.ObjectId.isValid(noteId)
  ) {
    res.status(404);
    throw new Error('Note not found or not publicly shared.');
  }

  const note = await WorkspaceNote.findOne({ _id: noteId, workspace: workspaceId })
    .populate('author', 'name profile')
    .populate('lastEditedBy', 'name profile')
    .populate('history.user', 'name profile');

  // 404 (not 403) so we don't leak the existence of private notes.
  if (!note || note.visibility !== 'public') {
    res.status(404);
    throw new Error('Note not found or not publicly shared.');
  }

  res.status(200).json({ success: true, note });
});

// ─── Update Workspace Note (autosave-safe) ──────────────────────────────
// PUT /api/workspace-notes/:id
// Body (all optional): { title, content, folderId, color, visibility }
export const updateWorkspaceNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { title, content, folderId, color, visibility } = req.body;

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

  if (!canManageNote(note, workspace, userId)) {
    res.status(403);
    throw new Error('You do not have permission to edit this note.');
  }

  const changes = [];

  if (title !== undefined) {
    const next = typeof title === 'string' ? title.trim() : '';
    if (next !== note.title) {
      note.title = next;
      changes.push('title');
    }
  }

  if (content !== undefined) {
    const next = typeof content === 'string' ? content.trim() : '';
    if (next !== note.content) {
      note.content = next;
      changes.push('content');
    }
  }

  if (color !== undefined) {
    try {
      const next = normalizeColor(color);
      const cur = note.color ?? null;
      const val = next ?? null;
      if (val !== cur) {
        note.color = val;
        changes.push('color');
      }
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }
  }

  if (visibility !== undefined) {
    try {
      const next = normalizeVisibility(visibility);
      if (next !== undefined && next !== note.visibility) {
        note.visibility = next;
        changes.push('visibility');
      }
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }
  }

  if (folderId !== undefined) {
    try {
      const next = await resolveFolderId(folderId, note.workspace);
      const cur = note.folder ? note.folder.toString() : null;
      const val = next ? next.toString() : null;
      if (cur !== val) {
        note.folder = next;
        changes.push('folder');
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
    changes.push('attachments');
  }

  if (changes.length > 0) {
    recordHistory(note, userId, 'updated', changes);
  }

  await note.save();
  await note.populate('author', 'name email profile');
  await note.populate('lastEditedBy', 'name profile');
  await note.populate('history.user', 'name profile');
  await note.populate('folder', 'name parent color');

  res.status(200).json({ success: true, note });
});

// ─── Move Note to Folder ────────────────────────────────────────────────
// PATCH /api/workspace-notes/:id/move
export const moveWorkspaceNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { folderId } = req.body;

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

  if (!canManageNote(note, workspace, userId)) {
    res.status(403);
    throw new Error('You do not have permission to move this note.');
  }

  const previous = note.folder ? note.folder.toString() : null;
  try {
    note.folder = await resolveFolderId(folderId, note.workspace);
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }
  const next = note.folder ? note.folder.toString() : null;

  if (previous !== next) {
    recordHistory(note, userId, 'moved', ['folder']);
  }

  await note.save();
  await note.populate('author', 'name email profile');
  await note.populate('lastEditedBy', 'name profile');
  await note.populate('history.user', 'name profile');
  await note.populate('folder', 'name parent color');

  res.status(200).json({ success: true, note });
});

// ─── Update Note Color (dedicated lightweight endpoint) ─────────────────
// PATCH /api/workspace-notes/:id/color
// Body: { color: "#RRGGBB" | null }
export const updateWorkspaceNoteColor = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { color } = req.body;

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

  if (!canManageNote(note, workspace, userId)) {
    res.status(403);
    throw new Error('You do not have permission to change this note.');
  }

  try {
    const next = normalizeColor(color);
    const cur = note.color ?? null;
    const val = next ?? null;
    if (val !== cur) {
      note.color = val;
      recordHistory(note, userId, 'color-changed', ['color']);
    }
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  await note.save();
  await note.populate('lastEditedBy', 'name profile');
  await note.populate('history.user', 'name profile');

  res.status(200).json({ success: true, note });
});

// ─── Update Note Visibility (dedicated endpoint) ────────────────────────
// PATCH /api/workspace-notes/:id/visibility
// Body: { visibility: "public" | "workspace" }
// Allowed: note author OR workspace Admin OR workspace Owner.
export const updateWorkspaceNoteVisibility = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { visibility } = req.body;

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

  if (!canManageNote(note, workspace, userId)) {
    res.status(403);
    throw new Error('You do not have permission to change this note.');
  }

  let next;
  try {
    next = normalizeVisibility(visibility);
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }
  if (next === undefined) {
    res.status(400);
    throw new Error("Visibility is required ('public' or 'workspace').");
  }

  if (next !== note.visibility) {
    note.visibility = next;
    recordHistory(note, userId, 'visibility-changed', ['visibility']);
    await note.save();
  }

  await note.populate('lastEditedBy', 'name profile');
  await note.populate('history.user', 'name profile');

  res.status(200).json({ success: true, note });
});

// ─── Delete Workspace Note ──────────────────────────────────────────────
// DELETE /api/workspace-notes/:id
// Allowed: note author OR workspace Admin OR workspace Owner.
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

  if (!canManageNote(note, workspace, userId)) {
    res.status(403);
    throw new Error('You do not have permission to delete this note.');
  }

  await note.deleteOne();
  res.status(200).json({ success: true, message: 'Note deleted.' });
});

// ─── Export Workspace Note as PDF ───────────────────────────────────────
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

  const safeTitle = (note.title || 'Untitled').replace(/[^\w\-]+/g, '_');
  const doc = new pdf({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="WorkspaceNote-${safeTitle}.pdf"`
  );

  doc.pipe(res);

  doc.fontSize(20).text(note.title || 'Untitled Note', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Author: ${note.author.name}`);
  doc.moveDown();
  doc.text(note.content || '');

  if (note.attachments && note.attachments.length > 0) {
    doc.moveDown();
    doc.fontSize(10).text('Attachments:');
    note.attachments.forEach((att, i) => {
      doc.text(`  ${i + 1}. ${att.filename} (${att.size} bytes)`);
    });
  }

  doc.end();
});

// ─── Import File to Workspace Note ──────────────────────────────────────
// POST /api/workspace-notes/import
// Body: { workspaceId, title?, folderId?, color?, visibility? }
export const importFileToWorkspaceNote = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId, title, folderId, color, visibility } = req.body;
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

  let resolvedFolderId = null;
  try {
    const r = await resolveFolderId(folderId, workspaceId);
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

  let resolvedVisibility = 'workspace';
  try {
    const v = normalizeVisibility(visibility);
    if (v !== undefined) resolvedVisibility = v;
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
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

    const noteTitle = (title || file.originalname || '').trim();

    const note = new WorkspaceNote({
      workspace: workspaceId,
      folder: resolvedFolderId,
      author: userId,
      title: noteTitle,
      content: extractedText.trim() || 'No text could be extracted.',
      color: resolvedColor,
      visibility: resolvedVisibility,
      attachments: [
        {
          filename: file.originalname,
          path: file.path,
          size: file.size,
          mimeType: file.mimetype,
        },
      ],
    });

    recordHistory(
      note,
      userId,
      'imported',
      resolvedVisibility === 'public' ? ['created', 'visibility'] : ['created']
    );

    await note.save();

    await note.populate('author', 'name email profile');
    await note.populate('lastEditedBy', 'name profile');
    await note.populate('history.user', 'name profile');
    await note.populate('folder', 'name parent color');

    const memberIds = getActiveMemberIds(workspace).filter(id => id !== userId);
    if (memberIds.length > 0) {
      const authorName = req.user.name || 'A member';
      const displayTitle = note.title || 'Untitled note';
      createAndSendNotification({
        recipient: memberIds,
        title: `New imported note in "${workspace.name}"`,
        body: `${authorName} imported a note: "${displayTitle}"`,
        data: { workspaceId, noteId: note._id.toString() },
        sendPush: true,
        emailEventType: 'projectUpdate',
        emailSubject: `New note in ${workspace.name}`,
        emailHtml: `<p>${authorName} imported a new note: <strong>${displayTitle}</strong> in <strong>${workspace.name}</strong>.</p>`,
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

// ══════════════════════════════════════════════════════════════════════════
//  FOLDER CONTROLLERS
// ══════════════════════════════════════════════════════════════════════════

// ─── Create Folder ──────────────────────────────────────────────────────
// POST /api/workspace-notes/folders
// Body: { workspaceId, name, parentId?, color? }
export const createNoteFolder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { workspaceId, name, parentId = null, color = null } = req.body;

  if (!workspaceId || !name?.trim()) {
    res.status(400);
    throw new Error('Workspace ID and folder name are required.');
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

  let parent = null;
  if (parentId) {
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      res.status(400);
      throw new Error('Invalid parent folder ID.');
    }
    const parentFolder = await WorkspaceNoteFolder.findById(parentId);
    if (!parentFolder) {
      res.status(404);
      throw new Error('Parent folder not found.');
    }
    if (parentFolder.workspace.toString() !== workspaceId.toString()) {
      res.status(400);
      throw new Error('Parent folder belongs to a different workspace.');
    }
    parent = parentFolder._id;
  }

  // ── FOLDER COLOR ──
  let resolvedColor = null;
  try {
    const c = normalizeColor(color);
    if (c !== undefined) resolvedColor = c;
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  try {
    const folder = await WorkspaceNoteFolder.create({
      workspace: workspaceId,
      name: name.trim(),
      parent,
      color: resolvedColor, // 👈 saved here
      createdBy: userId,
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

// ─── List Folders for a Workspace ───────────────────────────────────────
// GET /api/workspace-notes/folders/:workspaceId
export const getNoteFolders = asyncHandler(async (req, res) => {
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

  const folders = await WorkspaceNoteFolder.find({ workspace: workspaceId })
    .sort({ parent: 1, order: 1, name: 1 })
    .lean();

  res.status(200).json({ success: true, folders });
});

// ─── Update Folder ──────────────────────────────────────────────────────
// PUT /api/workspace-notes/folders/:id
// Body (all optional): { name, color, order, parentId }
export const updateNoteFolder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, color, order, parentId } = req.body;

  const folder = await WorkspaceNoteFolder.findById(req.params.id);
  if (!folder) {
    res.status(404);
    throw new Error('Folder not found.');
  }

  const workspace = await Workspace.findById(folder.workspace);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  const isCreator = folder.createdBy.toString() === userId;
  const isManager = isAdminOrOwner(workspace, userId);
  if (!isCreator && !isManager) {
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

  // ── FOLDER COLOR ──
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
      const newParent = await WorkspaceNoteFolder.findById(parentId);
      if (!newParent) {
        res.status(404);
        throw new Error('Parent folder not found.');
      }
      if (newParent.workspace.toString() !== folder.workspace.toString()) {
        res.status(400);
        throw new Error('Parent folder belongs to a different workspace.');
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

// ─── Update Folder Color (dedicated lightweight endpoint) ───────────────
// PATCH /api/workspace-notes/folders/:id/color
// Body: { color: "#RRGGBB" | null }
export const updateNoteFolderColor = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { color } = req.body;

  const folder = await WorkspaceNoteFolder.findById(req.params.id);
  if (!folder) {
    res.status(404);
    throw new Error('Folder not found.');
  }

  const workspace = await Workspace.findById(folder.workspace);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  const isCreator = folder.createdBy.toString() === userId;
  const isManager = isAdminOrOwner(workspace, userId);
  if (!isCreator && !isManager) {
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

// ─── Delete Folder ──────────────────────────────────────────────────────
// DELETE /api/workspace-notes/folders/:id
// Body (optional): { moveNotesTo: "parent" | "root" | "<folderId>" }
export const deleteNoteFolder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { moveNotesTo = 'parent' } = req.body || {};

  const folder = await WorkspaceNoteFolder.findById(req.params.id);
  if (!folder) {
    res.status(404);
    throw new Error('Folder not found.');
  }

  const workspace = await Workspace.findById(folder.workspace);
  if (!workspace) {
    res.status(404);
    throw new Error('Workspace not found.');
  }

  const isCreator = folder.createdBy.toString() === userId;
  const isManager = isAdminOrOwner(workspace, userId);
  if (!isCreator && !isManager) {
    res.status(403);
    throw new Error('You do not have permission to delete this folder.');
  }

  let targetFolderId = folder.parent; // default: bubble up to parent
  if (moveNotesTo === 'root') {
    targetFolderId = null;
  } else if (moveNotesTo !== 'parent') {
    if (!mongoose.Types.ObjectId.isValid(moveNotesTo)) {
      res.status(400);
      throw new Error('Invalid moveNotesTo value.');
    }
    const target = await WorkspaceNoteFolder.findById(moveNotesTo);
    if (!target) {
      res.status(404);
      throw new Error('Target folder for move not found.');
    }
    if (target.workspace.toString() !== folder.workspace.toString()) {
      res.status(400);
      throw new Error('Target folder belongs to a different workspace.');
    }
    targetFolderId = target._id;
  }

  // Bubble child folders up
  await WorkspaceNoteFolder.updateMany(
    { parent: folder._id },
    { $set: { parent: folder.parent } }
  );

  // Move notes in this folder
  await WorkspaceNote.updateMany(
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