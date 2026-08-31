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

// 2. For public notes lookup by shareLink (already unique, but explicit)
personalNoteSchema.index({ shareLink: 1 });

// 3. For filtering public notes (e.g., listing public notes)
personalNoteSchema.index({ isPublic: 1, createdAt: -1 });

// 4. For finding notes shared with a specific collaborator (array field)
//    This helps queries like: { collaborators: { $elemMatch: { user: userId } } }
personalNoteSchema.index({ 'collaborators.user': 1 });

// 5. Compound index for collaborators + permission (if needed)
personalNoteSchema.index({ 'collaborators.user': 1, 'collaborators.permission': 1 });

// 6. Text search index on title and content (enable full-text search)
personalNoteSchema.index(
  { title: 'text', content: 'text' },
  { weights: { title: 10, content: 5 }, name: 'text_search_index' }
);

const PersonalNote = mongoose.model('PersonalNote', personalNoteSchema);
export default PersonalNote;