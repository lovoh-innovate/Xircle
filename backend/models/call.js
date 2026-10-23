// models/call.js
import mongoose from 'mongoose';

const callSchema = mongoose.Schema(
  {
    // ─── Core identity ────────────────────────────────────────
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,          // ← optional: direct calls & meetings have no workspace
      index: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['voice', 'video'],
      required: true,
    },
    roomId: {
      type: String,
      required: true,
      unique: true,           // LiveKit room name
    },

    // ─── Meeting / shareable-link support ─────────────────────
    isDirect:  { type: Boolean, default: false }, // 1-on-1 call outside a workspace
    isMeeting: { type: Boolean, default: false }, // started as a shareable meeting link
    meetingCode: {
      type: String,
      default: null,          // 8-char code used in /join/:code
    },
    meetingLink: {
      type: String,
      default: null,          // full URL, e.g. https://app.xircle.io/join/abcd1234
    },

    // ─── Scheduling ───────────────────────────────────────────
    scheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,          // admin/owner who created the schedule
    },
    scheduledAt: { type: Date, default: null }, // null = immediate / not scheduled

    // ─── Lifecycle timestamps ─────────────────────────────────
    startedAt: { type: Date, default: null },
    endedAt:   { type: Date, default: null },

    // ─── Status ───────────────────────────────────────────────
    status: {
      type: String,
      enum: ['scheduled', 'ringing', 'ongoing', 'ended', 'missed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    endedReason: {
      type: String,
      enum: ['host-ended', 'everyone-left', 'timeout', 'cancelled', 'never-joined', null],
      default: null,          // used in call logs to show *why* a call ended
    },

    // ─── Live presence (maintained by callCleanupService) ─────
    // everOccupied: someone has actually been seen inside the LiveKit room.
    // emptySince:   when the room was first seen empty (null = not empty).
    presence: {
      everOccupied: { type: Boolean, default: false },
      emptySince:   { type: Date, default: null },
    },

    // ─── Participants (registered users) ──────────────────────
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'ringing', 'accepted', 'rejected', 'missed', 'left'],
          default: 'pending',
        },
        joinedAt: { type: Date, default: null },
        leftAt:   { type: Date, default: null },
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,      // set when invited mid-call (inviteToCall / inviteByUsername)
        },
      },
    ],

    // ─── Guests (meeting-link joiners, no account) ────────────
    guests: [
      {
        name:     { type: String, required: true },  // display name they typed
        identity: { type: String, required: true },  // LiveKit identity (guest_xxx)
        joinedAt: { type: Date, default: () => new Date() },
        leftAt:   { type: Date, default: null },
      },
    ],

    // ═════════════════════════════════════════════════════════
    // AI + LIVE NOTES
    // ═════════════════════════════════════════════════════════

    // Master AI state for this call. All AI features gate on `ai.enabled`.
    ai: {
      enabled: { type: Boolean, default: false },

      // Who turned it on + when
      startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      startedAt: { type: Date, default: null },
      stoppedAt: { type: Date, default: null },

      // Where the final generated note lands.
      //   workspace → WorkspaceNote for call.workspace
      //   personal  → PersonalNote owned by call.creator (used for
      //               direct calls & meetings with no workspace)
      //   none      → AI ran for live Q&A / summary but no final note
      noteDestination: {
        type: String,
        enum: ['workspace', 'personal', 'none'],
        default: 'none',
      },

      // Reference to the note that finalizeCallNotes() created
      generatedNoteId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        refPath: 'ai.generatedNoteKind', // 'WorkspaceNote' | 'PersonalNote'
      },
      generatedNoteKind: {
        type: String,
        enum: ['WorkspaceNote', 'PersonalNote', null],
        default: null,
      },

      // Rolling summary bookkeeping (see callAIService.maybeRollingSummary)
      lastSummarizedAt: { type: Date, default: null },
      lastSummarizedSegmentIndex: { type: Number, default: 0 },
    },

    // ── Live transcript ────────────────────────────────────────
    // Each entry is one short utterance, attributed to a speaker.
    // Capped by the service to keep the doc under Mongo's 16 MB limit.
    transcript: [
      {
        _id: false,
        speakerId:   { type: String, default: null }, // userId OR guest identity
        speakerName: { type: String, default: 'Someone' },
        text:        { type: String, default: '' },
        at:          { type: Date, default: Date.now },
        isFinal:     { type: Boolean, default: true },
      },
    ],

    // ── Rolling live summary (updated in-place by the service) ──
    liveSummary: {
      text:        { type: String, default: '' },
      keyPoints:   { type: [String], default: [] },
      actionItems: [
        {
          _id: false,
          text:     { type: String, default: '' },
          assignee: { type: String, default: null },
          due:      { type: String, default: null },
        },
      ],
      updatedAt: { type: Date, default: null },
    },

    // ── In-call chat (text fallback — bad network / noisy room) ──
    inCallMessages: [
      {
        sender: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,       // null for 'system' or AI-answer messages
        },
        senderName: { type: String, default: 'Someone' },
        content:    { type: String, default: '' },
        kind: {
          type: String,
          enum: ['text', 'ai-question', 'ai-answer', 'system'],
          default: 'text',
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // ── Meeting interactions ───────────────────────────────────
    raisedHands: [
      {
        user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        raisedAt: { type: Date, default: Date.now },
        loweredAt:{ type: Date, default: null },
      },
    ],
    reactions: [
      {
        user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true },
        at:    { type: Date, default: Date.now },
      },
    ],

    // ── Data saver ─────────────────────────────────────────────
    dataSaver: {
      enabled:      { type: Boolean, default: false },
      audioOnly:    { type: Boolean, default: false },
      videoQuality: {
        type: String,
        enum: ['low', 'medium', 'high', 'auto'],
        default: 'auto',
      },
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────

// meetingCode is unique *only when actually set*. Partial index lets us
// keep `default: null` while still allowing many calls without a code.
callSchema.index(
  { meetingCode: 1 },
  {
    unique: true,
    partialFilterExpression: { meetingCode: { $type: 'string' } },
  }
);

// Fast "ongoing calls in this workspace" lookups (logs / ongoing panel)
callSchema.index({ workspace: 1, status: 1, updatedAt: -1 });

// Fast "this user's calls" lookups (personal call log, ongoing list)
callSchema.index({ 'participants.user': 1, status: 1, updatedAt: -1 });

// Fast scheduler tick (find calls whose scheduledAt has passed)
callSchema.index({ status: 1, scheduledAt: 1 });

// AI: quickly find calls with AI enabled that still need a final note
callSchema.index({ 'ai.enabled': 1, 'ai.generatedNoteId': 1 });

// ─────────────────────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────────────────────

// Duration in seconds — handy for the call log UI without extra computation
callSchema.virtual('duration').get(function () {
  if (!this.startedAt || !this.endedAt) return null;
  return Math.max(0, Math.floor((this.endedAt - this.startedAt) / 1000));
});

// Convenience: how many people are actually in the call right now
callSchema.virtual('activeParticipantCount').get(function () {
  const accepted = (this.participants || []).filter(
    (p) => p.status === 'accepted'
  ).length;
  const activeGuests = (this.guests || []).filter((g) => !g.leftAt).length;
  return accepted + activeGuests;
});

// Convenience: hands currently up (ignores lowered ones)
callSchema.virtual('activeRaisedHands').get(function () {
  return (this.raisedHands || []).filter((h) => !h.loweredAt);
});

export default mongoose.model('Call', callSchema);