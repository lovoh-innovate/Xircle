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
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
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

// ─── Indexes for performance ────────────────────────────────────────────

// 1. Primary query: get all notes for a workspace (sorted by latest)
workspaceNoteSchema.index({ workspace: 1, createdAt: -1 });

// 2. Get notes by a specific author within a workspace
workspaceNoteSchema.index({ workspace: 1, author: 1, createdAt: -1 });

// 3. Get notes by author across all workspaces (for a user's activity)
workspaceNoteSchema.index({ author: 1, createdAt: -1 });

// 4. Text search index on title and content
workspaceNoteSchema.index(
  { title: 'text', content: 'text' },
  { weights: { title: 10, content: 5 }, name: 'text_search_index' }
);

// 5. Index on attachments (if you ever query by attachment fields)
workspaceNoteSchema.index({ 'attachments.filename': 1 });

const WorkspaceNote = mongoose.model('WorkspaceNote', workspaceNoteSchema);
export default WorkspaceNote;