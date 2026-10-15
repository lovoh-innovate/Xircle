// models/projectModel.js
import mongoose from 'mongoose';

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const NAMED_COLORS = [
  'red', 'blue', 'green', 'yellow', 'orange', 'purple',
  'pink', 'teal', 'indigo', 'gray', 'grey', 'slate',
  'emerald', 'rose', 'amber', 'cyan', 'violet',
];

const projectSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: {
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
    // ── Project color ─────────────────────────────────────────────
    color: {
      type: String,
      default: '#6366F1', // indigo fallback
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) => {
          if (!v) return true; // allow empty → default applies
          const value = String(v).trim().toLowerCase();
          return HEX_RE.test(value) || NAMED_COLORS.includes(value);
        },
        message: (props) =>
          `"${props.value}" is not a valid color. Use a hex code like #3B82F6 or one of: ${NAMED_COLORS.join(', ')}.`,
      },
    },
    links: [
      {
        type: String,
      },
    ],
    documents: [
      {
        name: String,
        url: String,
        publicId: String,
        size: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    coverImage: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    projectManagers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    teamMembers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['lead', 'senior', 'member', 'junior'],
          default: 'member',
        },
        status: {
          type: String,
          enum: ['active', 'inactive', 'removed'],
          default: 'active',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        leftAt: {
          type: Date,
          default: null,
        },
      },
    ],

    // ── NEW: Guests / external collaborators ──────────────────────
    // People invited by email who are NOT workspace members.
    // - role 'viewer'  → read-only, no actions
    // - role 'editor'  → can complete/comment on tasks they are assigned to
    // userId is null until they sign up with the matching email;
    // then it gets auto-linked by linkPendingCollaboratorInvites().
    collaborators: [
      {
        email: {
          type: String,
          required: true,
          lowercase: true,
          trim: true,
        },
        name: {
          type: String,
          default: '',
          trim: true,
        },
        role: {
          type: String,
          enum: ['viewer', 'editor'],
          default: 'viewer',
        },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
        status: {
          type: String,
          enum: ['invited', 'active', 'revoked'],
          default: 'invited',
        },
        inviteToken: {
          type: String,
          default: null,
        },
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
        invitedAt: {
          type: Date,
          default: Date.now,
        },
        acceptedAt: {
          type: Date,
          default: null,
        },
      },
    ],

    // ── NEW: Project-wide read-only share link ────────────────────
    // Anyone with this token can view the project (sanitized) but
    // cannot perform any action until they sign up AND are linked
    // as a collaborator above.
    publicShareToken: {
      type: String,
      default: null,
    },
    publicShareEnabled: {
      type: Boolean,
      default: false,
    },

    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['planning', 'in-progress', 'on-hold', 'completed', 'cancelled'],
      default: 'planning',
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    projectType: {
      type: String,
      enum: ['general', 'software', 'design', 'social_media', 'marketing'],
      default: 'general',
    },
    dailyReportTime: {
      type: String,
      default: '17:00', // Format: HH:mm (24-hour)
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    teamChat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      default: null,
    },
    attachments: [
      {
        name: String,
        url: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    readyForCompletion: {
      type: Boolean,
      default: false,
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
    // ── Per‑user archive ──────────────────────────────────────────
    archivedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        archivedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // ── Global soft‑delete (trash) ────────────────────────────────
    isTrash: {
      type: Boolean,
      default: false,
      index: true, // quick filter
    },
    trashedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────────────────────────────
// Indexes for performance
// ─────────────────────────────────────────────────────────────────────
projectSchema.index({ workspace: 1, status: 1 });
projectSchema.index({ projectManagers: 1 });
projectSchema.index({ 'teamMembers.user': 1 });
projectSchema.index({ projectType: 1 });
// Additional index for trash queries
projectSchema.index({ isTrash: 1, trashedAt: 1 });

// ── NEW: indexes for guest / collaborator lookups ─────────────────────
// Fast lookup for auto-linking on signup (find projects with a pending
// invite for this email) and for the "my collaborated projects" query.
projectSchema.index({ 'collaborators.email': 1, 'collaborators.status': 1 });
projectSchema.index({ 'collaborators.userId': 1, 'collaborators.status': 1 });
projectSchema.index({ 'collaborators.inviteToken': 1 }, { sparse: true });

// Fast lookup for the project-wide share link endpoint
projectSchema.index(
  { publicShareToken: 1 },
  { sparse: true, partialFilterExpression: { publicShareToken: { $type: 'string' } } }
);

// ─────────────────────────────────────────────────────────────────────
// Virtuals / small helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Returns the effective permission set for a given user on this project.
 * NOT the full access resolver — that lives in projectController.js and
 * takes a populated workspace into account. This is only used for quick
 * internal checks (e.g. guards in middleware).
 */
projectSchema.methods.getCollaboratorFor = function (userId) {
  if (!userId || !this.collaborators?.length) return null;
  const uid = userId.toString();
  return (
    this.collaborators.find(
      (c) => c.userId && c.userId.toString() === uid && c.status === 'active'
    ) || null
  );
};

/**
 * Convenience helper — is this email already a collaborator (any status
 * except revoked)?
 */
projectSchema.methods.hasCollaboratorEmail = function (email) {
  if (!email || !this.collaborators?.length) return false;
  const normalized = email.toLowerCase().trim();
  return this.collaborators.some(
    (c) => c.email === normalized && c.status !== 'revoked'
  );
};

const Project = mongoose.model('Project', projectSchema);
export default Project;