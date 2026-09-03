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
    collaborators: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
        email: {
          type: String,
          required: true,
          trim: true,
          lowercase: true,
        },
        role: {
          type: String,
          enum: ['read', 'write'],
          default: 'write',
        },
        accepted: {
          type: Boolean,
          default: false,
        },
        invitationToken: {
          type: String,
          required: true,
          unique: true,
        },
        invitedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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
    // ─── Who marked it as completed ──────────────────────────
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    recurrenceType: {
      type: String,
      enum: ['none', 'daily', 'weekly'],
      default: 'none',
    },
    recurrenceDays: {
      type: [Number],
      default: [],
    },
    recurrenceEndDate: {
      type: Date,
      default: null,
    },
    reminderSentAt: {
      type: Date,
      default: null,
      index: true,
    },
    dailyReminderTime: {
      type: String,
      default: null,
    },
    lastDailyReminderSent: {
      type: Date,
      default: null,
    },
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
        recurrenceType: {
          type: String,
          enum: ['none', 'daily', 'weekly'],
          default: 'none',
        },
        recurrenceDays: {
          type: [Number],
          default: [],
        },
        recurrenceEndDate: {
          type: Date,
          default: null,
        },
        // ─── Who toggled this subtask ─────────────────────────
        toggledBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
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

personalTaskSchema.index({ dueDate: 1, reminderSentAt: 1, status: 1, isArchived: 1, isTrash: 1 });
personalTaskSchema.index({ user: 1, order: 1 });
personalTaskSchema.index({ 'collaborators.user': 1 });

const PersonalTask = mongoose.model('PersonalTask', personalTaskSchema);
export default PersonalTask;