// models/taskModel.js
import mongoose from 'mongoose';

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
      enum: ['pending', 'in-progress', 'review', 'completed', 'cancelled'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    dueDate: {
      type: Date,
      default: null,
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
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completionFeedback: {
      type: String,
      default: '',
    },
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    links: [
      {
        type: String,
      },
    ],
    // Attachments are stored as structured subdocuments, not plain strings.
    // Each attachment must be an object: { name, url, publicId, size, type }
    attachments: [
      {
        name: { type: String },
        url: { type: String },
        publicId: { type: String },
        size: { type: Number },
        type: { type: String },
        _id: false,
      },
    ],
    stages: [
      {
        name: { type: String, required: true },
        order: { type: Number, default: 0 },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date, default: null },
        completedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
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
        attachments: [
          {
            type: String,
          },
        ],
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

const Task = mongoose.model('Task', taskSchema);
export default Task;