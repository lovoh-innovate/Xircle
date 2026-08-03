// models/appVersionModel.js
import mongoose from 'mongoose';

const appVersionSchema = new mongoose.Schema(
  {
    version: { type: String, required: true },
    platform: { type: String, enum: ['android', 'ios'], default: 'android' },
    releaseNotes: { type: String, default: '' },
    fileUrl: { type: String, required: true },
    fileSize: { type: Number },
    fileName: { type: String },
    filePublicId: { type: String },
    isRequired: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('AppVersion', appVersionSchema);