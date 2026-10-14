// models/workspaceNoteModel.js
import mongoose from 'mongoose';

const workspaceNoteSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkspaceNoteFolder', // ✅ matches the model name below
      default: null,              // null = "unfiled" / root
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    content: {
      type: String,
      trim: true,
      default: '',
    },
    attachments: [
      {
        filename: { type: String, required: true },
        path: { type: String, required: true },
        size: { type: Number, required: true },
        mimeType: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// ─── Indexes ────────────────────────────────────────────────────────────
workspaceNoteSchema.index({ workspace: 1, createdAt: -1 });
workspaceNoteSchema.index({ workspace: 1, folder: 1, createdAt: -1 });
workspaceNoteSchema.index({ workspace: 1, author: 1, createdAt: -1 });
workspaceNoteSchema.index({ author: 1, createdAt: -1 });
workspaceNoteSchema.index(
  { title: 'text', content: 'text' },
  { weights: { title: 10, content: 5 }, name: 'text_search_index' }
);
workspaceNoteSchema.index({ 'attachments.filename': 1 });

const WorkspaceNote = mongoose.model('WorkspaceNote', workspaceNoteSchema);
export default WorkspaceNote;