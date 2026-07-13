import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  totalMessages: { type: Number, default: 0, min: 0 },
  trackingStartedAt: { type: Date, default: Date.now },
  lastMessageAt: { type: Date, default: null },
  realInvites: { type: Number, default: 0, min: 0 },
  joinedViaCode: { type: String, default: null },
  invitedById: { type: String, default: null },
}, { timestamps: true });

schema.index({ guildId: 1, userId: 1 }, { unique: true });

export const MemberStats = mongoose.model('MemberStats', schema);
