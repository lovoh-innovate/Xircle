// models/personalNoteModel.js
import mongoose from 'mongoose';

// Slug format: lowercase letters, numbers, and hyphens only.
// 2–120 chars. Generated from the title, or custom-set by the owner.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

    // ── Slug (custom URL) ────────────────────────────────────────────
    // Optional human-readable identifier. If set, it can be used in
    // place of the ObjectId in URLs (e.g. /notes/my-project-note).
    // The controller auto-generates one when a note is created, and
    // users can edit it. Unique across all notes when present.
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
      index: true,
      validate: {
        validator: (v) => !v || SLUG_RE.test(v),
        message: (props) =>
          `"${props.value}" is not a valid slug. Use lowercase letters, numbers, and hyphens only (e.g. "my-project-note").`,
      },
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

    // ── Access Requests (from public viewers) ───────────────────────
    // Any signed-in user who can view a public note can request
    // collaborator access. The owner gets an email + push and can
    // approve or reject. Approved requests become real collaborators.
    collaboratorRequests: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        // Optional note the requester can leave for the owner.
        message: {
          type: String,
          default: '',
          trim: true,
          maxlength: 500,
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

    // ── Audit & Edit History ────────────────────────────────────────
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true, // Quick lookup for "who touched this last"
    },
    editHistory: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        action: {
          type: String,
          default: 'Edited note',
          trim: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
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

// 8. For finding notes a user has an active pending request on
personalNoteSchema.index({ 'collaboratorRequests.user': 1, 'collaboratorRequests.status': 1 });

// 9. For the owner's "pending access requests" dashboard
personalNoteSchema.index({ user: 1, 'collaboratorRequests.status': 1 });

// 10. Slug lookup (sparse so notes without a slug don't collide)
personalNoteSchema.index(
  { slug: 1 },
  { unique: true, sparse: true, partialFilterExpression: { slug: { $type: 'string' } } }
);

// 11. Text search index on title and content
personalNoteSchema.index(
  { title: 'text', content: 'text' },
  { weights: { title: 10, content: 5 }, name: 'text_search_index' }
);

// 12. Fast lookup for recently edited notes by a specific user
personalNoteSchema.index({ lastEditedBy: 1, updatedAt: -1 });

const PersonalNote = mongoose.model('PersonalNote', personalNoteSchema);
export default PersonalNote;