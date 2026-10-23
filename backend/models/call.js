// models/call.js
import mongoose from 'mongoose';

const callSchema = mongoose.Schema(
  {
    // ─── Core identity ────────────────────────────────────────
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,          // ← now optional: direct calls & meetings have no workspace
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
      enum: ['host-ended', 'everyone-left', 'timeout', 'cancelled', null],
      default: null,          // used in call logs to show *why* a call ended
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

export default mongoose.model('Call', callSchema);