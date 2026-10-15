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

// ─── Linked notes (workspace + personal) ──────────────────────────
const linkedNoteSchema = new mongoose.Schema(
  {
    note: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    source: {
      type: String,
      enum: ['workspace', 'personal'],
      required: true,
    },
    addedAt: { type: Date, default: Date.now },
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

    // ─── NEW: per-subtask assignee ────────────────────────────────
    // A subtask can be assigned to one person. The value MUST be one
    // of the parent task's `assignees`. Enforced at the controller
    // level (`isValidSubTaskAssignee`), NOT at the schema level, so
    // that removing an assignee from the task doesn't silently break
    // historical subtasks — the resolver handles dangling references
    // gracefully (the assignee just doesn't match anyone anymore).
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

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
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },

    // ─── RECURRENCE ────────────────────────────────────────────────
    recurrenceType: {
      type: String,
      enum: ['none', 'daily', 'weekly'],
      default: 'none',
    },
    recurrenceDays: {
      type: [Number], // 0=Sunday, 6=Saturday
      default: [],
    },
    recurrenceEndDate: {
      type: Date,
      default: null,
    },

    // ─── ORDER ─────────────────────────────────────────────────────
    order: { type: Number, default: 0 },
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

    // ─── MULTI-ASSIGNEE ────────────────────────────────────────────
    // Multiple people can own a task. Empty array = unassigned.
    // Subtasks can ONLY be assigned to someone in this list.
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],

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
      default: 0,
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

    // ─── LINKED NOTES ──────────────────────────────────────────────
    linkedNotes: {
      type: [linkedNoteSchema],
      default: [],
    },

    reminderSent: {
      type: Boolean,
      default: false,
    },
    dailyReminderTime: {
      type: String, // "HH:MM"
      default: null,
    },
    lastDailyReminderSent: {
      type: Date,
      default: null,
    },

    // ─── RECURRENCE ────────────────────────────────────────────────
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

    // ─── ORDER ─────────────────────────────────────────────────────
    order: { type: Number, default: 0 },

    // ─── ARCHIVE / TRASH ───────────────────────────────────────────
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
      index: true,
    },
    trashedAt: {
      type: Date,
      default: null,
    },

    // ─── COMPLETION / CONFIRMATION ─────────────────────────────────
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
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    finalLinks: [String],
    finalAttachments: [attachmentSchema],

    // ─── LEGACY FIELDS ─────────────────────────────────────────────
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

// ─── Indexes ───────────────────────────────────────────────────────
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignees: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ isTrash: 1, trashedAt: 1 });
taskSchema.index({ project: 1, order: 1 });
taskSchema.index({ 'linkedNotes.note': 1, 'linkedNotes.source': 1 });
taskSchema.index({ 'subTasks.assignee': 1, 'subTasks.status': 1 }); // 👈 NEW
taskSchema.index({ assignees: 1, 'subTasks.status': 1 });           // 👈 NEW

const Task = mongoose.model('Task', taskSchema);
export default Task;