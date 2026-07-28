// models/taskModel.js
import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String },
    url: { type: String },
    publicId: { type: String },
    size: { type: Number },
    type: { type: String },
  },
  { _id: false }
);

const subTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    bufferTime: { type: Number, default: 0 }, // minutes
    links: [String],
    attachments: [attachmentSchema],
    status: {
      type: String,
      enum: ['pending', 'done', 'confirmed'],
      default: 'pending',
    },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    confirmedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    feedback: { type: String, default: '' },
    reminderSent: { type: Boolean, default: false },
    // Rejection fields
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    // ── NEW: Folder reference ─────────────────────────────────────
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    detailedDescription: {
      type: String,
      default: '',
    },
    taskType: {
      type: String,
      enum: ['general', 'bug', 'feature', 'improvement', 'design', 'content', 'other'],
      default: 'general',
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'in-progress',
        'ready_for_completion',
        'completed',
        'confirmed_completed',
        'cancelled',
      ],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    startDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    bufferTime: {
      type: Number,
      default: 0, // minutes
    },
    estimatedHours: {
      type: Number,
      default: null,
    },
    actualHours: {
      type: Number,
      default: null,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    subTasks: [subTaskSchema],
    allowAssigneeEditSubtasks: {
      type: Boolean,
      default: false,
    },
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    links: [String],
    attachments: [attachmentSchema],
    reminderSent: {
      type: Boolean,
      default: false,
    },
    // ── NEW: Daily reminder time & tracking ────────────────────────
    dailyReminderTime: {
      type: String,          // e.g., "09:00" (HH:MM)
      default: null,
    },
    lastDailyReminderSent: {
      type: Date,
      default: null,
    },
    // ── NEW: Archive / Trash fields ────────────────────────────────
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    isTrash: {
      type: Boolean,
      default: false,
      index: true,           // useful for queries filtering out trash
    },
    trashedAt: {
      type: Date,
      default: null,
    },
    // ── Existing fields continue ────────────────────────────────────
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completionNotes: {
      type: String,
      default: '',
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    completionFeedback: {
      type: String,
      default: '',
    },
    finalLinks: [String],
    finalAttachments: [attachmentSchema],
    // Legacy fields – kept for backward compatibility
    submittedProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    approved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    stages: [
      {
        name: { type: String, required: true },
        order: { type: Number, default: 0 },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date, default: null },
        completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        notes: { type: String, default: '' },
      },
    ],
    currentStage: {
      type: String,
      default: 'To Do',
    },
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        comment: { type: String, required: true },
        mentions: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
        ],
        attachments: [String],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    reassignmentHistory: [
      {
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reassignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, default: '' },
        reassignedAt: { type: Date, default: Date.now },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignee: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
// New index for efficient trash queries
taskSchema.index({ isTrash: 1, trashedAt: 1 });

const Task = mongoose.model('Task', taskSchema);
export default Task;