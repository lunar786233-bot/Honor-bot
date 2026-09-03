const mongoose = require('mongoose');

// 1. User Honor Schema
const UserHonorSchema = new mongoose.Schema({
  guild_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  monthly_points: { type: Number, default: 0 },
  total_points: { type: Number, default: 0 },
  last_given_at: { type: Date, default: null },
  month_key: { type: String, required: true }
}, { timestamps: true });

UserHonorSchema.index({ guild_id: 1, user_id: 1 }, { unique: true });

// 2. Thank / Endorsement Log Schema
const ThankLogSchema = new mongoose.Schema({
  guild_id: { type: String, required: true, index: true },
  giver_id: { type: String, required: true },
  giver_name: { type: String, required: true },
  receiver_id: { type: String, required: true, index: true },
  receiver_name: { type: String, required: true },
  reason: { type: String, required: true },
  month_key: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// 3. Milestone Roles Schema (50, 100, 200, 350, 500 Stars)
const MilestoneRoleSchema = new mongoose.Schema({
  guild_id: { type: String, required: true, index: true },
  tier: { type: Number, required: true },
  min_stars: { type: Number, required: true },
  role_id: { type: String, required: true }
});

MilestoneRoleSchema.index({ guild_id: 1, tier: 1 }, { unique: true });

// 4. Server Configuration Schema
const HonorConfigSchema = new mongoose.Schema({
  guild_id: { type: String, required: true, unique: true },
  reward_role_id: { type: String, default: null },
  reward_duration_days: { type: Number, default: 30 },
  winners_count: { type: Number, default: 1 },
  announcement_channel_id: { type: String, default: null },
  allowed_thank_channel_id: { type: String, default: null },
  cooldown_hours: { type: Number, default: 24 },
  last_processed_month: { type: String, default: null },
  live_leaderboard_channel_id: { type: String, default: null },
  live_leaderboard_message_id: { type: String, default: null }
});

// 5. Active Role Rewards (Expiry Tracking)
const ActiveRewardSchema = new mongoose.Schema({
  guild_id: { type: String, required: true },
  user_id: { type: String, required: true },
  role_id: { type: String, required: true },
  awarded_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true, index: true }
});

module.exports = {
  UserHonor: mongoose.models.UserHonor || mongoose.model('UserHonor', UserHonorSchema),
  ThankLog: mongoose.models.ThankLog || mongoose.model('ThankLog', ThankLogSchema),
  MilestoneRole: mongoose.models.MilestoneRole || mongoose.model('MilestoneRole', MilestoneRoleSchema),
  HonorConfig: mongoose.models.HonorConfig || mongoose.model('HonorConfig', HonorConfigSchema),
  ActiveReward: mongoose.models.ActiveReward || mongoose.model('ActiveReward', ActiveRewardSchema)
};
