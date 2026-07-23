import mongoose from 'mongoose';

const callSchema = mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['voice', 'video'], required: true },
    roomId: { type: String, required: true, unique: true },    // used for WebRTC room name
    scheduledAt: { type: Date, default: null },                // null = immediate call
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['scheduled', 'ringing', 'ongoing', 'ended', 'missed', 'cancelled'],
      default: 'scheduled',    // scheduled until it starts ringing
    },
    participants: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: {
          type: String,
          enum: ['pending', 'ringing', 'accepted', 'rejected', 'missed', 'left'],
          default: 'pending',
        },
        joinedAt: Date,
        leftAt: Date,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Call', callSchema);