// services/callAIService.js
//
// Owns the whole AI lifecycle for a call:
//   • enable / disable AI per call
//   • ingest live transcript segments (from client STT or audio chunks)
//   • maintain a rolling in-call summary
//   • answer mid-call questions (voice or text)
//   • finalize → write a WorkspaceNote or PersonalNote
//
// All AI calls go through geminiService (Groq-only).

import Call from '../models/call.js';
import WorkspaceNote from '../models/workspaceNoteModel.js';
import PersonalNote from '../models/personalNoteModel.js';
import Workspace from '../models/workspaceModel.js';
import User from '../models/userModel.js';
import { generateCallNotes, answerCallQuestion } from './geminiService.js';
import { getIO } from '../controllers/socket.js';

// ─────────────────────────────────────────────────────────────
// Tunables
// ─────────────────────────────────────────────────────────────
const MAX_TRANSCRIPT_SEGMENTS  = 3000;
const MAX_INCALL_MESSAGES      = 1000;
const SUMMARY_EVERY_N_SEGMENTS = 15;
const SUMMARY_MIN_INTERVAL_MS  = 45_000;

// Prevent two ingests from launching parallel summary jobs.
const summaryInFlight = new Set();

// ─────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────
const err = (msg, status = 400) =>
  Object.assign(new Error(msg), { status });

const stringId = (v) => (v == null ? '' : String(v._id || v));

const assertParticipant = (call, userId) => {
  const uid = String(userId);
  const found = (call.participants || []).some(
    (p) => stringId(p.user) === uid
  );
  if (!found) throw err('Access denied.', 403);
};

function safeEmit(room, event, payload) {
  try {
    const io = getIO();
    io.to(room).emit(event, payload);
  } catch {
    // Socket not initialised (tests / scripts) → ignore.
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(text) {
  return (
    String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'note'
  );
}

// Friendly slug + 6 random chars = collision-free enough in practice.
function makeSlug(title) {
  const base = slugify(title);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}m ${String(r).padStart(2, '0')}s`;
}

// ─────────────────────────────────────────────────────────────
// 1. Enable AI on a call
// ─────────────────────────────────────────────────────────────
/**
 * Turn on AI for a call. All AI features gate on `call.ai.enabled`.
 *
 * @param {Object} opts
 * @param {string} opts.callId
 * @param {string} opts.userId
 * @param {'workspace'|'personal'|'none'} [opts.noteDestination]
 * @returns {Promise<{ enabled: true, noteDestination: string, transcriptCount: number }>}
 */
export async function enableCallAI({ callId, userId, noteDestination }) {
  const call = await Call.findById(callId);
  if (!call) throw err('Call not found.', 404);
  if (!['ringing', 'ongoing'].includes(call.status)) {
    throw err('Call is not active.', 400);
  }
  assertParticipant(call, userId);

  if (!call.ai) call.ai = {};

  // Default destination:
  //   workspace → if the call is inside a workspace
  //   personal  → direct calls and workspace-less meetings
  //               (note goes to the *creator's* personal notes)
  const defaultDest = call.workspace ? 'workspace' : 'personal';
  const dest = ['workspace', 'personal', 'none'].includes(noteDestination)
    ? noteDestination
    : call.ai.noteDestination && call.ai.noteDestination !== 'none'
      ? call.ai.noteDestination
      : defaultDest;

  call.ai.enabled = true;
  call.ai.startedBy = userId;
  call.ai.startedAt = call.ai.startedAt || new Date();
  call.ai.noteDestination = dest;

  await call.save();

  return {
    enabled: true,
    noteDestination: call.ai.noteDestination,
    transcriptCount: (call.transcript || []).length,
  };
}

// ─────────────────────────────────────────────────────────────
// 2. Disable AI → finalize notes
// ─────────────────────────────────────────────────────────────
/**
 * Turn off AI for a call, then immediately finalize the notes.
 *
 * @returns {Promise<{ created: boolean, noteId?: string, kind?: string, title?: string, reason?: string }>}
 */
export async function disableCallAI({ callId, userId }) {
  const call = await Call.findById(callId);
  if (!call) throw err('Call not found.', 404);
  assertParticipant(call, userId);

  if (!call.ai) call.ai = {};
  call.ai.enabled = false;
  call.ai.stoppedAt = new Date();
  await call.save();

  return await finalizeCallNotes(callId);
}

// ─────────────────────────────────────────────────────────────
// 3. Ingest transcript segments
// ─────────────────────────────────────────────────────────────
/**
 * Append transcript segments to the call, broadcast to the room,
 * and (throttled) refresh the rolling summary.
 *
 * @param {Object} opts
 * @param {string} opts.callId
 * @param {Array<{ speakerId: string, speakerName: string, text: string, at?: Date, isFinal?: boolean }>} opts.segments
 * @returns {Promise<{ added: number }>}
 */
export async function ingestTranscript({ callId, segments }) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { added: 0 };
  }

  const call = await Call.findById(callId);
  if (!call) throw err('Call not found.', 404);
  if (!call.ai?.enabled) return { added: 0, disabled: true };

  const fresh = [];
  for (const seg of segments) {
    const text = String(seg?.text || '').trim();
    if (!text) continue;

    fresh.push({
      speakerId: String(seg.speakerId || 'unknown').slice(0, 80),
      speakerName: String(seg.speakerName || 'Someone').slice(0, 80),
      text: text.slice(0, 2000),
      at: seg.at ? new Date(seg.at) : new Date(),
      isFinal: seg.isFinal !== false,
    });
  }

  if (fresh.length === 0) return { added: 0 };

  call.transcript.push(...fresh);
  if (call.transcript.length > MAX_TRANSCRIPT_SEGMENTS) {
    call.transcript = call.transcript.slice(-MAX_TRANSCRIPT_SEGMENTS);
  }
  await call.save();

  // Broadcast immediately so every participant sees the live transcript
  safeEmit(`room:${call.roomId}`, 'call-transcript-update', {
    callId: String(call._id),
    segments: fresh,
  });

  // Fire-and-forget: rolling summary (throttled internally)
  maybeRollingSummary(String(call._id)).catch((e) =>
    console.error('maybeRollingSummary failed:', e.message)
  );

  return { added: fresh.length };
}

// ─────────────────────────────────────────────────────────────
// 4. Rolling summary (internal)
// ─────────────────────────────────────────────────────────────
async function maybeRollingSummary(callId) {
  if (summaryInFlight.has(callId)) return;
  summaryInFlight.add(callId);

  try {
    const call = await Call.findById(callId);
    if (!call || !call.ai?.enabled) return;

    const lastIdx = call.ai.lastSummarizedSegmentIndex || 0;
    const newSegs = (call.transcript || []).length - lastIdx;
    if (newSegs < SUMMARY_EVERY_N_SEGMENTS) return;

    const lastAt = call.ai.lastSummarizedAt
      ? new Date(call.ai.lastSummarizedAt).getTime()
      : 0;
    if (Date.now() - lastAt < SUMMARY_MIN_INTERVAL_MS) return;

    // Rolling window = last 100 turns (fresh context only)
    const window = (call.transcript || []).slice(-100);

    const summary = await generateCallNotes({
      transcript: window,
      callType: call.type,
      participants: call.participants,
      mode: 'rolling',
    });

    call.liveSummary = {
      text: summary.summary || '',
      keyPoints: summary.keyPoints || [],
      actionItems: summary.actionItems || [],
      updatedAt: new Date(),
    };
    call.ai.lastSummarizedSegmentIndex = call.transcript.length;
    call.ai.lastSummarizedAt = new Date();
    await call.save();

    safeEmit(`room:${call.roomId}`, 'call-summary-update', {
      callId: String(call._id),
      summary: call.liveSummary,
    });
  } finally {
    summaryInFlight.delete(callId);
  }
}

// ─────────────────────────────────────────────────────────────
// 5. Ask AI mid-call
// ─────────────────────────────────────────────────────────────
/**
 * Answer a live mid-call question using recent transcript + metadata.
 * Works with any transcript that exists (i.e. after AI was enabled once).
 * The question + answer are appended to `inCallMessages` and broadcast
 * so everyone in the room sees the exchange.
 *
 * @param {Object} opts
 * @param {string} opts.callId
 * @param {string} opts.userId
 * @param {string} opts.question
 * @returns {Promise<{ answer: string, sources: string[] }>}
 */
export async function askCallAI({ callId, userId, question }) {
  const q = String(question || '').trim();
  if (!q) throw err('Question is required.', 400);

  const call = await Call.findById(callId).populate(
    'participants.user',
    'name'
  );
  if (!call) throw err('Call not found.', 404);
  assertParticipant(call, userId);

  const recentTranscript = (call.transcript || []).slice(-200);

  const callMeta = {
    type: call.type,
    workspace: call.workspace ? String(call.workspace) : null,
    isMeeting: !!call.isMeeting,
    participants: (call.participants || [])
      .map((p) => p.user?.name)
      .filter(Boolean),
    durationSec: call.startedAt
      ? Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000)
      : 0,
    liveSummary: call.liveSummary,
  };

  const result = await answerCallQuestion({
    question: q,
    transcript: recentTranscript,
    callMeta,
  });

  // Persist the exchange for history + in-call chat view
  const user = await User.findById(userId).select('name');
  call.inCallMessages.push({
    sender: userId,
    senderName: user?.name || 'You',
    content: q,
    kind: 'ai-question',
  });
  call.inCallMessages.push({
    sender: null,
    senderName: 'Xircle AI',
    content: result.answer,
    kind: 'ai-answer',
  });
  if (call.inCallMessages.length > MAX_INCALL_MESSAGES) {
    call.inCallMessages = call.inCallMessages.slice(-MAX_INCALL_MESSAGES);
  }
  await call.save();

  safeEmit(`room:${call.roomId}`, 'call-ai-exchange', {
    callId: String(call._id),
    userId: String(userId),
    question: q,
    answer: result.answer,
    sources: result.sources,
  });

  return result;
}

// ─────────────────────────────────────────────────────────────
// 6. Finalize → generate note, save to WorkspaceNote or PersonalNote
// ─────────────────────────────────────────────────────────────
/**
 * Generate the final structured notes from the transcript and write them
 * to the right place:
 *   • WorkspaceNote (if destination = 'workspace' and call has a workspace)
 *   • PersonalNote  (if destination = 'personal', owned by the call creator)
 *
 * Idempotent — calling this twice returns the already-created note.
 *
 * @param {string} callId
 * @returns {Promise<{
 *   created: boolean,
 *   noteId?: string,
 *   kind?: 'WorkspaceNote'|'PersonalNote',
 *   title?: string,
 *   reason?: string,
 *   alreadyFinalized?: boolean
 * }>}
 */
export async function finalizeCallNotes(callId) {
  const call = await Call.findById(callId)
    .populate('participants.user', 'name email')
    .populate('creator', 'name');
  if (!call) throw err('Call not found.', 404);

  // Idempotency — don't create two notes for the same call
  if (call.ai?.generatedNoteId) {
    return {
      created: false,
      alreadyFinalized: true,
      noteId: String(call.ai.generatedNoteId),
      kind: call.ai.generatedNoteKind,
    };
  }

  if (!(call.transcript || []).length) {
    return { created: false, reason: 'No transcript to summarize.' };
  }

  // Decide destination
  const destination =
    call.ai?.noteDestination && call.ai.noteDestination !== 'none'
      ? call.ai.noteDestination
      : call.workspace
        ? 'workspace'
        : 'personal';

  if (destination === 'none') {
    return { created: false, reason: 'Note destination is set to none.' };
  }

  // Generate structured notes
  const notes = await generateCallNotes({
    transcript: call.transcript,
    callType: call.type,
    participants: call.participants,
    mode: 'final',
  });

  const creatorId = stringId(call.creator);
  if (!creatorId) throw err('Call has no creator.', 500);

  const startedAt = call.startedAt || call.createdAt || new Date();
  const title =
    notes.title ||
    `${call.isMeeting
      ? 'Meeting'
      : call.type === 'video'
        ? 'Video call'
        : 'Call'} — ${new Date(startedAt).toLocaleString()}`;

  const html = buildNoteHtml({ notes, call });

  let savedNote = null;
  let kind = null;

  // ── Workspace note ──
  if (destination === 'workspace' && call.workspace) {
    const workspace = await Workspace.findById(call.workspace).select('_id');
    if (!workspace) {
      throw err('Workspace for this call no longer exists.', 404);
    }

    savedNote = await WorkspaceNote.create({
      workspace: call.workspace,
      author: creatorId,
      folder: null,
      title,
      content: html,
      color: null,
      visibility: 'workspace',
      attachments: [],
      lastEditedBy: creatorId,
      lastEditedAt: new Date(),
      history: [
        {
          user: creatorId,
          action: 'created',
          changes: ['created', 'ai-generated'],
          at: new Date(),
        },
      ],
    });
    kind = 'WorkspaceNote';
  } else {
    // ── Personal note (creator's own notes) ──
    savedNote = await createPersonalNoteSafe({
      user: creatorId,
      folder: null,
      title,
      content: html,
      color: null,
      isPublic: false,
      attachments: [],
      lastEditedBy: creatorId,
      editHistory: [
        {
          user: creatorId,
          action: 'Created from AI call notes',
          timestamp: new Date(),
        },
      ],
    });
    kind = 'PersonalNote';
  }

  // Attach reference to the call
  if (!call.ai) call.ai = {};
  call.ai.generatedNoteId = savedNote._id;
  call.ai.generatedNoteKind = kind;
  await call.save();

  safeEmit(`room:${call.roomId}`, 'call-note-ready', {
    callId: String(call._id),
    noteId: String(savedNote._id),
    kind,
    title,
  });

  return {
    created: true,
    noteId: String(savedNote._id),
    kind,
    title,
  };
}

// ─────────────────────────────────────────────────────────────
// PersonalNote create with slug-collision retry
// ─────────────────────────────────────────────────────────────
async function createPersonalNoteSafe(payload) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await PersonalNote.create({
        ...payload,
        slug: makeSlug(payload.title),
      });
    } catch (e) {
      lastErr = e;
      if (e.code !== 11000) throw e; // 11000 = duplicate key → retry
    }
  }
  throw lastErr || new Error('Failed to create personal note.');
}

// ─────────────────────────────────────────────────────────────
// 7. HTML builder — Tiptap-compatible
// ─────────────────────────────────────────────────────────────
function buildNoteHtml({ notes, call }) {
  const parts = [];
  const e = escapeHtml;

  // Summary
  if (notes.summary) {
    const paras = String(notes.summary)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const p of paras) {
      parts.push(`<p>${e(p)}</p>`);
    }
  }

  // Key points
  if (notes.keyPoints?.length) {
    parts.push('<h2>Key points</h2>');
    parts.push('<ul>');
    for (const k of notes.keyPoints) {
      parts.push(`<li>${e(k)}</li>`);
    }
    parts.push('</ul>');
  }

  // Action items
  if (notes.actionItems?.length) {
    parts.push('<h2>Action items</h2>');
    parts.push('<ul>');
    for (const a of notes.actionItems) {
      const who = a.assignee ? ` — <strong>${e(a.assignee)}</strong>` : '';
      const due = a.due ? ` <em>(due ${e(a.due)})</em>` : '';
      parts.push(`<li>${e(a.text)}${who}${due}</li>`);
    }
    parts.push('</ul>');
  }

  // Decisions
  if (notes.decisions?.length) {
    parts.push('<h2>Decisions</h2>');
    parts.push('<ul>');
    for (const d of notes.decisions) {
      parts.push(`<li>${e(d)}</li>`);
    }
    parts.push('</ul>');
  }

  // Topics
  if (notes.topics?.length) {
    parts.push(
      `<p><strong>Topics:</strong> ${notes.topics.map(e).join(', ')}</p>`
    );
  }

  // Footer: call metadata
  const participants = (call.participants || [])
    .map((p) => p.user?.name)
    .filter(Boolean);
  const guestNames = (call.guests || []).map((g) => `${g.name} (guest)`);
  const everyone = [...participants, ...guestNames];

  const durationSec = call.startedAt
    ? Math.floor(
        ((call.endedAt ? new Date(call.endedAt) : new Date()) -
          new Date(call.startedAt)) /
          1000
      )
    : 0;

  parts.push('<hr>');
  parts.push(
    `<p><small>Call type: ${e(call.type)}${
      call.isMeeting
        ? ' · Meeting'
        : call.workspace
          ? ' · Workspace call'
          : ' · Direct call'
    }</small></p>`
  );
  if (everyone.length) {
    parts.push(`<p><small>Participants: ${e(everyone.join(', '))}</small></p>`);
  }
  parts.push(
    `<p><small>Started: ${new Date(
      call.startedAt || call.createdAt
    ).toLocaleString()} · Duration: ${e(formatDuration(durationSec))}</small></p>`
  );

  return parts.join('\n');
}