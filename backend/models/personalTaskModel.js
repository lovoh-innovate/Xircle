// models/personalTaskModel.js
import mongoose from 'mongoose';

const personalTaskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PersonalFolder',
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'archived'],
      default: 'pending',
    },
    dueDate: {
      type: Date,
      default: null,
      index: true, // for reminder queries
    },
    // ─── Manual ordering (drag & drop) ──────────────────────
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    // ─── Recurrence ──────────────────────────────────────────
    recurrenceType: {
      type: String,
      enum: ['none', 'daily', 'weekly'],
      default: 'none',
    },
    recurrenceDays: {
      type: [Number], // 0=Sunday, 6=Saturday; used only for weekly
      default: [],
    },
    recurrenceEndDate: {
      type: Date,
      default: null,
    },
    // ─── Reminder tracking ──────────────────────────────────
    reminderSentAt: {
      type: Date,
      default: null,
      index: true, // to find tasks that haven't been reminded
    },
    // ─── Legacy fields (kept for compatibility) ─────────────
    dailyReminderTime: {
      type: String,           // HH:MM (24‑hour format)
      default: null,
    },
    lastDailyReminderSent: {
      type: Date,
      default: null,
    },
    // ─── Archiving & Trash ──────────────────────────────────
    isTrash: {
      type: Boolean,
      default: false,
      index: true,
    },
    trashedAt: {
      type: Date,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    subtasks: [
      {
        title: { type: String, required: true },
        done: { type: Boolean, default: false },
        dueDate: Date,
        // ─── Sub‑task recurrence ─────────────────────────────
        recurrenceType: {
          type: String,
          enum: ['none', 'daily', 'weekly'],
          default: 'none',
        },
        recurrenceDays: {
          type: [Number], // 0=Sunday, 6=Saturday; used only for weekly
          default: [],
        },
        recurrenceEndDate: {
          type: Date,
          default: null,
        },
      },
    ],
    notes: {
      type: String,
      default: '',
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient reminder queries
personalTaskSchema.index({ dueDate: 1, reminderSentAt: 1, status: 1, isArchived: 1, isTrash: 1 });
// Compound index for efficient list ordering
personalTaskSchema.index({ user: 1, order: 1 });

const PersonalTask = mongoose.model('PersonalTask', personalTaskSchema);
export default PersonalTask;