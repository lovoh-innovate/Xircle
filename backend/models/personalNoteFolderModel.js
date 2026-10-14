// models/personalNoteFolderModel.js
import mongoose from 'mongoose';

const personalNoteFolderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Folder name is required'],
      trim: true,
      maxlength: 100,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PersonalNoteFolder',
      default: null, // null = top-level folder
      index: true,
    },
    color: { type: String, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Prevent duplicate folder names under the same parent for the same user
personalNoteFolderSchema.index(
  { user: 1, parent: 1, name: 1 },
  { unique: true }
);

// Fast listing
personalNoteFolderSchema.index({ user: 1, parent: 1, order: 1 });

const PersonalNoteFolder = mongoose.model(
  'PersonalNoteFolder',
  personalNoteFolderSchema
);

export default PersonalNoteFolder;