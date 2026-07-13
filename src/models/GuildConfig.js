import mongoose from 'mongoose';

const embedSchema = new mongoose.Schema({
  title: { type: String, default: '🎉 {prize}' },
  description: { type: String, default: 'Click the button below to enter!\n\n**Winners:** {winners}\n**Ends:** {end_relative}\n**Hosted by:** {host}\n**Requirements:** {requirements}' },
  footer: { type: String, default: '{entries} entries • {server}' },
  author: { type: String, default: '' },
  thumbnail: { type: String, default: '' },
  image: { type: String, default: '' },
  color: { type: String, default: '#5865F2' },
}, { _id: false });

const bonusRoleSchema = new mongoose.Schema({
  roleId: { type: String, required: true },
  multiplier: { type: Number, min: 1, max: 100, required: true },
}, { _id: false });

const schema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  embed: { type: embedSchema, default: () => ({}) },
  buttonStyle: { type: String, enum: ['Primary', 'Secondary', 'Success', 'Danger'], default: 'Primary' },
  buttonLabel: { type: String, default: 'Enter Giveaway', maxlength: 80 },
  managerRoleIds: { type: [String], default: [] },
  bonusRoles: { type: [bonusRoleSchema], default: [] },
}, { timestamps: true });

export const GuildConfig = mongoose.model('GuildConfig', schema);

export async function getGuildConfig(guildId) {
  return GuildConfig.findOneAndUpdate(
    { guildId },
    { $setOnInsert: { guildId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}
