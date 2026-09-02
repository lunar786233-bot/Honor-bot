const nodeCrypto = require('crypto');
if (!globalThis.crypto) {
  globalThis.crypto = nodeCrypto.webcrypto || nodeCrypto;
}
if (!global.crypto) {
  global.crypto = nodeCrypto;
}

const dns = require('dns');
// Set public DNS servers to guarantee flawless SRV resolution on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const mongoose = require('mongoose');
const {
  UserHonor,
  ThankLog,
  MilestoneRole,
  HonorConfig,
  ActiveReward
} = require('./models');

class MongoDBManager {
  constructor(uri) {
    this.uri = uri;
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;
    try {
      await mongoose.connect(this.uri, {
        serverSelectionTimeoutMS: 5000
      });
      this.connected = true;
      console.log('✅ Connected to MongoDB Cloud (Atlas) database successfully!');
    } catch (err) {
      console.error('❌ Failed to connect to MongoDB:', err);
      throw err;
    }
  }

  getCurrentMonthKey() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  // ---------------- Config ----------------
  async getHonorConfig(guildId) {
    const doc = await HonorConfig.findOne({ guild_id: String(guildId) }).lean();
    return doc || null;
  }

  async setHonorConfig(guildId, { rewardRoleId, durationDays, winnersCount, channelId, cooldownHours }) {
    const update = {};
    if (rewardRoleId !== undefined) update.reward_role_id = rewardRoleId ? String(rewardRoleId) : null;
    if (durationDays !== undefined) update.reward_duration_days = Number(durationDays);
    if (winnersCount !== undefined) update.winners_count = Number(winnersCount);
    if (channelId !== undefined) update.announcement_channel_id = channelId ? String(channelId) : null;
    if (cooldownHours !== undefined) update.cooldown_hours = Number(cooldownHours);

    await HonorConfig.findOneAndUpdate(
      { guild_id: String(guildId) },
      { $set: update },
      { upsert: true, returnDocument: 'after' }
    );
  }

  async setLiveLeaderboard(guildId, channelId, messageId) {
    await HonorConfig.findOneAndUpdate(
      { guild_id: String(guildId) },
      {
        $set: {
          live_leaderboard_channel_id: channelId ? String(channelId) : null,
          live_leaderboard_message_id: messageId ? String(messageId) : null
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
  }

  // ---------------- Reputation & Thanks ----------------
  async getLastThankTime(guildId, giverId, receiverId) {
    const doc = await ThankLog.findOne({
      guild_id: String(guildId),
      giver_id: String(giverId),
      receiver_id: String(receiverId)
    }).sort({ timestamp: -1 }).lean();

    return doc ? new Date(doc.timestamp) : null;
  }

  async addReputation(guildId, giverId, giverName, receiverId, receiverName, reason, points = 1) {
    const monthKey = this.getCurrentMonthKey();

    // 1. Log thank
    await ThankLog.create({
      guild_id: String(guildId),
      giver_id: String(giverId),
      giver_name: String(giverName),
      receiver_id: String(receiverId),
      receiver_name: String(receiverName),
      reason: String(reason),
      month_key: monthKey,
      timestamp: new Date()
    });

    // 2. Fetch or update user
    let user = await UserHonor.findOne({ guild_id: String(guildId), user_id: String(receiverId) });
    let previousMonthly = 0;
    let newMonthly = 0;
    let newTotal = 0;

    if (!user) {
      newMonthly = Math.max(0, Number(points));
      newTotal = Math.max(0, Number(points));
      await UserHonor.create({
        guild_id: String(guildId),
        user_id: String(receiverId),
        monthly_points: newMonthly,
        total_points: newTotal,
        last_given_at: new Date(),
        month_key: monthKey
      });
    } else {
      const oldMonth = user.month_key;
      previousMonthly = oldMonth === monthKey ? user.monthly_points : 0;
      newMonthly = Math.max(0, previousMonthly + Number(points));
      newTotal = Math.max(0, user.total_points + Number(points));

      user.monthly_points = newMonthly;
      user.total_points = newTotal;
      user.last_given_at = new Date();
      user.month_key = monthKey;
      await user.save();
    }

    return { monthlyPoints: newMonthly, totalPoints: newTotal, previousMonthly };
  }

  async getUserHonorStats(guildId, userId) {
    const monthKey = this.getCurrentMonthKey();
    const user = await UserHonor.findOne({ guild_id: String(guildId), user_id: String(userId) }).lean();

    const monthlyPoints = user ? (user.month_key === monthKey ? user.monthly_points : 0) : 0;
    const totalPoints = user ? user.total_points : 0;

    const rankCount = await UserHonor.countDocuments({
      guild_id: String(guildId),
      month_key: monthKey,
      monthly_points: { $gt: monthlyPoints }
    });
    const monthlyRank = rankCount + 1;

    const recentThanks = await ThankLog.find({
      guild_id: String(guildId),
      receiver_id: String(userId)
    }).sort({ timestamp: -1 }).limit(5).lean();

    return {
      monthlyPoints,
      totalPoints,
      monthlyRank,
      recentThanks
    };
  }

  async getLeaderboard(guildId, scope = 'month', limit = 10) {
    const monthKey = this.getCurrentMonthKey();
    if (scope === 'month') {
      const docs = await UserHonor.find({
        guild_id: String(guildId),
        month_key: monthKey,
        monthly_points: { $gt: 0 }
      }).sort({ monthly_points: -1 }).limit(Number(limit)).lean();

      return docs.map(d => ({ user_id: d.user_id, points: d.monthly_points, total_points: d.total_points }));
    } else {
      const docs = await UserHonor.find({
        guild_id: String(guildId),
        total_points: { $gt: 0 }
      }).sort({ total_points: -1 }).limit(Number(limit)).lean();

      return docs.map(d => ({ user_id: d.user_id, points: d.total_points, monthly_points: d.monthly_points }));
    }
  }

  // ---------------- Milestone Roles ----------------
  async getMilestoneRoles(guildId) {
    const docs = await MilestoneRole.find({ guild_id: String(guildId) }).sort({ min_stars: 1 }).lean();
    return docs;
  }

  async setMilestoneRole(guildId, tier, minStars, roleId) {
    await MilestoneRole.findOneAndUpdate(
      { guild_id: String(guildId), tier: Number(tier) },
      { $set: { min_stars: Number(minStars), role_id: String(roleId) } },
      { upsert: true, returnDocument: 'after' }
    );
  }

  async deleteMilestoneRole(guildId, tier) {
    await MilestoneRole.deleteOne({ guild_id: String(guildId), tier: Number(tier) });
  }

  // ---------------- Active Rewards ----------------
  async addActiveReward(guildId, userId, roleId, durationDays) {
    const now = new Date();
    const expires = new Date(now.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000);

    const doc = await ActiveReward.create({
      guild_id: String(guildId),
      user_id: String(userId),
      role_id: String(roleId),
      awarded_at: now,
      expires_at: expires
    });
    return doc._id;
  }

  async getExpiredRewards() {
    const now = new Date();
    const docs = await ActiveReward.find({ expires_at: { $lte: now } }).lean();
    return docs.map(d => ({
      id: d._id.toString(),
      guild_id: d.guild_id,
      user_id: d.user_id,
      role_id: d.role_id,
      expires_at: d.expires_at.toISOString()
    }));
  }

  async removeActiveReward(recordId) {
    await ActiveReward.findByIdAndDelete(recordId);
  }

  async resetMonthlyScores(guildId) {
    const monthKey = this.getCurrentMonthKey();
    await UserHonor.updateMany(
      { guild_id: String(guildId) },
      { $set: { monthly_points: 0, month_key: monthKey } }
    );
  }
}

module.exports = MongoDBManager;
