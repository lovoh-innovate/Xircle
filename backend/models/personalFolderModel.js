import mongoose from 'mongoose';

const personalFolderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Folder name is required'],
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    color: {
      type: String,
      default: '#4f46e5',
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const PersonalFolder = mongoose.model('PersonalFolder', personalFolderSchema);

export default PersonalFolder;