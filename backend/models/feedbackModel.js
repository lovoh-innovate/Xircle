// models/feedbackModel.js
import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['progress_update', 'daily_report', 'review'],
      required: true,
    },
    // The progress value this entry carries:
    //  - progress_update: the progress the assignee submitted
    //  - daily_report:    the progress at check-in time (optional)
    //  - review:          the progress the reviewer approved (or current on reject)
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    notes: { type: String, default: '' },
    links: { type: [String], default: [] },
    attachments: {
      type: [
        {
          name: String,
          url: String,
          publicId: String,
          size: Number,
          type: String,
        },
      ],
      default: [],
    },
    // ── daily_report only ──
    blocks: { type: [String], default: [] },
    isLate: { type: Boolean, default: false },
    // ── review only ──
    approved: { type: Boolean, default: null },
    feedback: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

feedbackSchema.index({ task: 1, type: 1, createdAt: -1 });
// For the one-report-per-day upsert
feedbackSchema.index({ task: 1, user: 1, type: 1, createdAt: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);
export default Feedback;