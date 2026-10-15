// models/projectModel.js
import mongoose from 'mongoose';

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const NAMED_COLORS = [
  'red', 'blue', 'green', 'yellow', 'orange', 'purple',
  'pink', 'teal', 'indigo', 'gray', 'grey', 'slate',
  'emerald', 'rose', 'amber', 'cyan', 'violet',
];

// ─── Associate sub-schema ─────────────────────────────────────────
// Associates are limited external collaborators added to a project.
// They are also mirrored as workspace members with
// memberType: 'associate' (see workspaceModel).
//
// Roles:
//   'viewer'          – read-only on tasks assigned to them
//   'editor'          – can act on tasks assigned to them
//   'projectManager'  – full project control (also added to
//                       projectManagers array by the controller)
const associateSchema = new mongoose.Schema(
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
      enum: ['viewer', 'editor', 'projectManager'],
      default: 'editor',
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

    // Who added them (workspace owner, admin, or a PM on the project)
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },

    // Optional access window. When set and elapsed, the cron sweeps
    // and revokes the associate (both here and at the workspace level).
    accessExpiresAt: {
      type: Date,
      default: null,
    },

    // Revocation audit
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: true }
);

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
    color: {
      type: String,
      default: '#6366F1',
      trim: true,
      lowercase: true,
      validate: {
        validator: (v) => {
          if (!v) return true;
          const value = String(v).trim().toLowerCase();
          return HEX_RE.test(value) || NAMED_COLORS.includes(value);
        },
        message: (props) =>
          `"${props.value}" is not a valid color. Use a hex code like #3B82F6 or one of: ${NAMED_COLORS.join(', ')}.`,
      },
    },
    links: [{ type: String }],
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

    // ── Associates (external limited collaborators) ──────────────
    // No invite tokens — associates are added by project ID / email
    // and, once linked, access is scoped via their workspace
    // membership (memberType: 'associate').
    associates: [associateSchema],

    // ── Project-wide read-only public share link ─────────────────
    // This is the ONLY token-based access path remaining.
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
      default: '17:00',
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
    isTrash: {
      type: Boolean,
      default: false,
      index: true,
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

// ─── Indexes ───────────────────────────────────────────────────────
projectSchema.index({ workspace: 1, status: 1 });
projectSchema.index({ projectManagers: 1 });
projectSchema.index({ 'teamMembers.user': 1 });
projectSchema.index({ projectType: 1 });
projectSchema.index({ isTrash: 1, trashedAt: 1 });

// Associate lookups
projectSchema.index({ 'associates.email': 1, 'associates.status': 1 });
projectSchema.index({ 'associates.userId': 1, 'associates.status': 1 });

// Expiry sweep (used by expireAssociates cron in workspaceController
// and revokeExpiredAssociateInvites in userController)
projectSchema.index({ 'associates.accessExpiresAt': 1 });

// Public share link lookup (still the only token-based access)
projectSchema.index(
  { publicShareToken: 1 },
  { sparse: true, partialFilterExpression: { publicShareToken: { $type: 'string' } } }
);

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Return the active associate record for this user on this project,
 * or null. Safe against populated user documents.
 */
projectSchema.methods.getAssociateFor = function (userId) {
  if (!userId || !this.associates?.length) return null;
  const uid = userId.toString();
  return (
    this.associates.find(
      (a) => a.userId && a.userId.toString() === uid && a.status === 'active'
    ) || null
  );
};

/**
 * Check whether an email is already an associate on this project
 * (invited or active — not revoked).
 */
projectSchema.methods.hasAssociateEmail = function (email) {
  if (!email || !this.associates?.length) return false;
  const normalized = email.toLowerCase().trim();
  return this.associates.some(
    (a) => a.email === normalized && a.status !== 'revoked'
  );
};

/**
 * True if this user is both an associate AND a project manager.
 * (Associate who has been promoted — they get full PM powers.)
 */
projectSchema.methods.isAssociatePM = function (userId) {
  if (!userId) return false;
  const uid = userId.toString();
  const isPM = (this.projectManagers || []).some(
    (pm) => pm.toString() === uid
  );
  if (!isPM) return false;
  return !!this.getAssociateFor(userId);
};

const Project = mongoose.model('Project', projectSchema);
export default Project;