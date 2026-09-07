// models/stickerModel.js
import mongoose from 'mongoose';

const stickerSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fileUrl: {
      type: String,
      required: true, // Cloudinary or local path
    },
    thumbnailUrl: {
      type: String,
      default: null, // optional thumbnail for videos
    },
    type: {
      type: String,
      enum: ['image', 'animated'], // animated for short videos/gifs
      required: true,
    },
    duration: {
      type: Number, // in seconds, max 6 for animated
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    savedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

stickerSchema.index({ createdBy: 1 });
stickerSchema.index({ savedBy: 1 });
stickerSchema.index({ tags: 1 });

const Sticker = mongoose.model('Sticker', stickerSchema);

export default Sticker;