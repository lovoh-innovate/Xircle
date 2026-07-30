// models/messagingModel.js
import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const messageSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: false,      // ✅ change from true to false
      default: null,        // ✅ add default
      index: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      trim: true,
      default: '',
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file'],
      default: 'text',
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    mediaName: {
      type: String,
      default: null,
    },
    mediaSize: {
      type: Number,
      default: null,
    },
    mediaDuration: {
      type: Number,
      default: null,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    starredBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ workspace: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ archivedBy: 1 });
messageSchema.index({ starredBy: 1 });

const Message = mongoose.model('Message', messageSchema);

// ─────────────────────────────────────────────────────────────────────────────
// CHAT SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const chatSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: function () {
        return this.scope === 'workspace';
      },
      index: true,
    },
    type: {
      type: String,
      enum: ['group', 'direct'],
      required: true,
    },
    scope: {
      type: String,
      enum: ['workspace', 'public'],
      default: 'workspace',
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    avatar: {
      type: String,
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['admin', 'member'],
          default: 'member',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        lastReadAt: {
          type: Date,
          default: Date.now,
        },
        online: {
          type: Boolean,
          default: false,
        },
        lastSeen: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    joinRequests: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'rejected'],
          default: 'pending',
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

chatSchema.index({ workspace: 1, 'participants.user': 1 });
chatSchema.index({ workspace: 1, type: 1 });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ scope: 1, isPublic: 1 });
chatSchema.index({ archivedBy: 1 });

const Chat = mongoose.model('Chat', chatSchema);

// ─────────────────────────────────────────────────────────────────────────────
// TYPING INDICATOR SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const typingIndicatorSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      expires: 5000,
    },
  },
  {
    timestamps: false,
  }
);

const TypingIndicator = mongoose.model('TypingIndicator', typingIndicatorSchema);

export { Message, Chat, TypingIndicator };