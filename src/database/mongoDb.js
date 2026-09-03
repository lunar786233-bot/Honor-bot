const nodeCrypto = require('crypto');
if (!globalThis.crypto) {
  globalThis.crypto = nodeCrypto.webcrypto || nodeCrypto;
}
if (!global.crypto) {
  global.crypto = nodeCrypto;
}

const dns = require('dns');
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

  async setHonorConfig(guildId, { rewardRoleId, durationDays, winnersCount, channelId, thankChannelId, cooldownHours }) {
    const update = {};
    if (rewardRoleId !== undefined) update.reward_role_id = rewardRoleId ? String(rewardRoleId) : null;
    if (durationDays !== undefined) update.reward_duration_days = Number(durationDays);
    if (winnersCount !== undefined) update.winners_count = Number(winnersCount);
    if (channelId !== undefined) update.announcement_channel_id = channelId ? String(channelId) : null;
    if (thankChannelId !== undefined) update.allowed_thank_channel_id = thankChannelId ? String(thankChannelId) : null;
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

  async getUserHonorDoc(guildId, userId) {
    const doc = await UserHonor.findOne({
      guild_id: String(guildId),
      user_id: String(userId)
    }).lean();
    return doc || null;
  }

  async getMonthlyUserThankLogs(guildId, userId) {
    const monthKey = this.getCurrentMonthKey();
    const docs = await ThankLog.find({
      guild_id: String(guildId),
      receiver_id: String(userId),
      month_key: monthKey
    }).sort({ timestamp: -1 }).lean();

    return docs;
  }

  async detectSuspiciousTrading(guildId, giverId, receiverId) {
    const monthKey = this.getCurrentMonthKey();

    // 1. Direct mutual count this month
    const giverToReceiverCount = await ThankLog.countDocuments({
      guild_id: String(guildId),
      giver_id: String(giverId),
      receiver_id: String(receiverId),
      month_key: monthKey
    });

    const receiverToGiverCount = await ThankLog.countDocuments({
      guild_id: String(guildId),
      giver_id: String(receiverId),
      receiver_id: String(giverId),
      month_key: monthKey
    });

    if (giverToReceiverCount >= 2 && receiverToGiverCount >= 2) {
      return {
        isSuspicious: true,
        type: 'Mutual Star Exchange Loop (2-Way)',
        details: `<@${giverId}> gave <@${receiverId}> **${giverToReceiverCount} stars** this month, while <@${receiverId}> gave <@${giverId}> **${receiverToGiverCount} stars**.`
      };
    }

    // 2. High Frequency (Giver gave receiver 3+ stars in a single week)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFromGiver = await ThankLog.countDocuments({
      guild_id: String(guildId),
      giver_id: String(giverId),
      receiver_id: String(receiverId),
      timestamp: { $gte: sevenDaysAgo }
    });

    if (recentFromGiver >= 3) {
      return {
        isSuspicious: true,
        type: 'Frequent Same-User Feeding (1-Way Concentration)',
        details: `<@${giverId}> has given <@${receiverId}> **${recentFromGiver} stars** within the last 7 days.`
      };
    }

    // 3. 3-Way Circular Ring: Check if receiver recently gave to someone who gave to giver
    const receiverThanks = await ThankLog.find({
      guild_id: String(guildId),
      giver_id: String(receiverId),
      timestamp: { $gte: sevenDaysAgo }
    }).lean();

    for (const rt of receiverThanks) {
      const thirdUserId = rt.receiver_id;
      if (thirdUserId !== giverId) {
        const thirdGaveToGiver = await ThankLog.findOne({
          guild_id: String(guildId),
          giver_id: String(thirdUserId),
          receiver_id: String(giverId),
          timestamp: { $gte: sevenDaysAgo }
        }).lean();

        if (thirdGaveToGiver) {
          return {
            isSuspicious: true,
            type: '3-Way Circular Star Ring (A ➔ B ➔ C ➔ A)',
            details: `Circular loop detected:\n• <@${giverId}> ➔ <@${receiverId}>\n• <@${receiverId}> ➔ <@${thirdUserId}>\n• <@${thirdUserId}> ➔ <@${giverId}>`
          };
        }
      }
    }

    return { isSuspicious: false };
  }

  async addReputation(guildId, giverId, giverName, receiverId, receiverName, reason, points = 1) {
    const monthKey = this.getCurrentMonthKey();
    const now = new Date();

    // 1. Log thank
    await ThankLog.create({
      guild_id: String(guildId),
      giver_id: String(giverId),
      giver_name: String(giverName),
      receiver_id: String(receiverId),
      receiver_name: String(receiverName),
      reason: String(reason),
      month_key: monthKey,
      timestamp: now
    });

    // 2. Update Giver's last_given_at timestamp
    await UserHonor.findOneAndUpdate(
      { guild_id: String(guildId), user_id: String(giverId) },
      { $set: { last_given_at: now }, $setOnInsert: { month_key: monthKey, monthly_points: 0, total_points: 0 } },
      { upsert: true }
    );

    // 3. Fetch or update receiver
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
        last_received_at: now,
        month_key: monthKey
      });
    } else {
      const oldMonth = user.month_key;
      previousMonthly = oldMonth === monthKey ? user.monthly_points : 0;
      newMonthly = Math.max(0, previousMonthly + Number(points));
      newTotal = Math.max(0, user.total_points + Number(points));

      user.monthly_points = newMonthly;
      user.total_points = newTotal;
      user.last_received_at = now;
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
