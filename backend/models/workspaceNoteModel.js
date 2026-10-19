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
      ref: 'WorkspaceNoteFolder',
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
    color: {
      type: String,
      default: null,
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

    // 👇 NEW — public shareability
    //   'workspace' → only active members can read
    //   'public'    → anyone with the link can read via the public endpoint
    visibility: {
      type: String,
      enum: ['workspace', 'public'],
      default: 'workspace',
      index: true,
    },

    // 👇 NEW — attribution: who touched this note last
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastEditedAt: {
      type: Date,
      default: null,
    },

    // 👇 NEW — edit timeline: created → every update / move / color / visibility change
    history: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        action: {
          type: String,
          enum: [
            'created',
            'imported',
            'updated',
            'moved',
            'color-changed',
            'visibility-changed',
          ],
          required: true,
        },
        // which fields changed, e.g. ['title', 'content']
        changes: [{ type: String }],
        at: { type: Date, default: Date.now },
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

// 👇 NEW — fast public lookups by (workspace, _id) for the share endpoint
workspaceNoteSchema.index({ workspace: 1, visibility: 1, createdAt: -1 });

const WorkspaceNote = mongoose.model('WorkspaceNote', workspaceNoteSchema);
export default WorkspaceNote;