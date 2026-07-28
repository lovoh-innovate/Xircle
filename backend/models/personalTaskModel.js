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
    },
    dailyReminderTime: {
      type: String,           // HH:MM (24‑hour format)
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

const PersonalTask = mongoose.model('PersonalTask', personalTaskSchema);
export default PersonalTask;