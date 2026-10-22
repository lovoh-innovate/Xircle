// models/personalNoteModel.js
import mongoose from 'mongoose';

const personalNoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PersonalNoteFolder',
      default: null, // null = unfiled / root
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
      default: 'untitled',
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      default: 'Type your content here',
    },
    color: {
      type: String,
      default: null,
      trim: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    shareLink: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    
    // ── Active Collaborators ────────────────────────────────────────
    collaborators: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        permission: {
          type: String,
          enum: ['read', 'edit'],
          default: 'read',
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ── Pending Invites (For users without accounts) ────────────────
    pendingCollaborators: [
      {
        email: {
          type: String,
          required: true,
          lowercase: true,
          trim: true,
        },
        permission: {
          type: String,
          enum: ['read', 'edit'],
          default: 'read',
        },
        invitedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

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

// 1. For retrieving a user's own notes (sorted by creation)
personalNoteSchema.index({ user: 1, createdAt: -1 });

// 2. Notes within a specific folder (or root when folder is null)
personalNoteSchema.index({ user: 1, folder: 1, updatedAt: -1 });

// 3. For public notes lookup by shareLink
personalNoteSchema.index({ shareLink: 1 });

// 4. For filtering public notes (e.g., listing public notes)
personalNoteSchema.index({ isPublic: 1, createdAt: -1 });

// 5. For finding notes shared with a specific collaborator (array field)
personalNoteSchema.index({ 'collaborators.user': 1 });

// 6. Compound index for collaborators + permission
personalNoteSchema.index({ 'collaborators.user': 1, 'collaborators.permission': 1 });

// 7. For finding notes where a user has a pending invite
personalNoteSchema.index({ 'pendingCollaborators.email': 1 });

// 8. Text search index on title and content
personalNoteSchema.index(
  { title: 'text', content: 'text' },
  { weights: { title: 10, content: 5 }, name: 'text_search_index' }
);

const PersonalNote = mongoose.model('PersonalNote', personalNoteSchema);
export default PersonalNote;