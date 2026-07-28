// models/projectModel.js
import mongoose from 'mongoose';

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
    // ── NEW: Per‑user archive ─────────────────────────────────────
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
    // ── NEW: Global soft‑delete (trash) ───────────────────────────
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

// Indexes for performance
projectSchema.index({ workspace: 1, status: 1 });
projectSchema.index({ projectManagers: 1 });
projectSchema.index({ 'teamMembers.user': 1 });
projectSchema.index({ projectType: 1 });
// Additional index for trash queries
projectSchema.index({ isTrash: 1, trashedAt: 1 });

const Project = mongoose.model('Project', projectSchema);
export default Project;