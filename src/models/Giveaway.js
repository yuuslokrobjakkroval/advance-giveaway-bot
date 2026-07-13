import mongoose from 'mongoose';

const requirementsSchema = new mongoose.Schema({
  roleId: { type: String, default: null },
  minMessages: { type: Number, min: 0, default: 0 },
  minDailyAverage: { type: Number, min: 0, default: 0 },
  minInvites: { type: Number, min: 0, default: 0 },
  minAccountAgeDays: { type: Number, min: 0, default: 0 },
  minServerAgeDays: { type: Number, min: 0, default: 0 },
}, { _id: false });

const schema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  messageId: { type: String, default: null },
  hostId: { type: String, required: true },
  prize: { type: String, required: true, maxlength: 256 },
  winnerCount: { type: Number, required: true, min: 1, max: 20 },
  endsAt: { type: Date, required: true, index: true },
  endedAt: { type: Date, default: null },
  status: { type: String, enum: ['pending', 'active', 'ending', 'ended', 'cancelled'], default: 'pending', index: true },
  processingStartedAt: { type: Date, default: null },
  requirements: { type: requirementsSchema, default: () => ({}) },
  entrants: { type: [String], default: [] },
  winners: { type: [String], default: [] },
  winnerHistory: { type: [[String]], default: [] },
}, { timestamps: true });

schema.index({ guildId: 1, messageId: 1 }, { unique: true, partialFilterExpression: { messageId: { $type: 'string' } } });
schema.index({ status: 1, endsAt: 1 });

export const Giveaway = mongoose.model('Giveaway', schema);
