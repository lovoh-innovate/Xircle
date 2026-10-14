// models/workspaceNoteFolderModel.js
import mongoose from 'mongoose';

const workspaceNoteFolderSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Folder name is required'],
      trim: true,
      maxlength: 100,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkspaceNoteFolder',
      default: null,
      index: true,
    },
    color: { type: String, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

workspaceNoteFolderSchema.index(
  { workspace: 1, parent: 1, name: 1 },
  { unique: true }
);
workspaceNoteFolderSchema.index({ workspace: 1, parent: 1, order: 1 });

const WorkspaceNoteFolder = mongoose.model(
  'WorkspaceNoteFolder',
  workspaceNoteFolderSchema
);

export default WorkspaceNoteFolder;