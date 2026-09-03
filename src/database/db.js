const path = require('path');
const fs = require('fs');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  DatabaseSync = null;
}

const config = require('../config');

class DBManager {
  constructor(customPath = null) {
    if (!DatabaseSync) {
      throw new Error('Native SQLite is only supported in Node.js 22+. For cloud deployment, please set MONGODB_URI.');
    }

    const dbFile = customPath || config.dbPath;
    const dbDir = path.dirname(dbFile);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new DatabaseSync(dbFile);
    this.init();
  }

  getCurrentMonthKey() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  init() {
    // Enable WAL mode & busy timeout to prevent 'database is locked' errors
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS honor_config (
        guild_id TEXT PRIMARY KEY,
        reward_role_id TEXT,
        reward_duration_days INTEGER DEFAULT 30,
        winners_count INTEGER DEFAULT 1,
        announcement_channel_id TEXT,
        allowed_thank_channel_id TEXT,
        cooldown_hours INTEGER DEFAULT 24,
        last_processed_month TEXT,
        live_leaderboard_channel_id TEXT,
        live_leaderboard_message_id TEXT
      );

      CREATE TABLE IF NOT EXISTS reputation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        giver_id TEXT NOT NULL,
        giver_name TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        receiver_name TEXT NOT NULL,
        reason TEXT NOT NULL,
        month_key TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reputation_scores (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        monthly_points INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0,
        last_given_at DATETIME,
        month_key TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS active_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        awarded_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL
      );

      CREATE TABLE IF NOT EXISTS milestone_roles (
        guild_id TEXT NOT NULL,
        tier INTEGER NOT NULL,
        min_stars INTEGER NOT NULL,
        role_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, tier)
      );
    `);
  }

  // ---------------- Honor & Reputation ----------------
  getHonorConfig(guildId) {
    const stmt = this.db.prepare('SELECT * FROM honor_config WHERE guild_id = ?');
    return stmt.get(String(guildId)) || null;
  }

  setHonorConfig(guildId, { rewardRoleId, durationDays, winnersCount, channelId, thankChannelId, cooldownHours }) {
    const current = this.getHonorConfig(guildId);
    const roleToSave = rewardRoleId !== undefined ? (rewardRoleId ? String(rewardRoleId) : null) : (current ? current.reward_role_id : null);
    const daysToSave = durationDays !== undefined ? Number(durationDays) : (current ? current.reward_duration_days : 30);
    const winnersToSave = winnersCount !== undefined ? Number(winnersCount) : (current ? current.winners_count : 1);
    const channelToSave = channelId !== undefined ? (channelId ? String(channelId) : null) : (current ? current.announcement_channel_id : null);
    const thankChannelToSave = thankChannelId !== undefined ? (thankChannelId ? String(thankChannelId) : null) : (current ? current.allowed_thank_channel_id : null);
    const cooldownToSave = cooldownHours !== undefined ? Number(cooldownHours) : (current ? current.cooldown_hours : 24);

    const stmt = this.db.prepare(`
      INSERT INTO honor_config (guild_id, reward_role_id, reward_duration_days, winners_count, announcement_channel_id, allowed_thank_channel_id, cooldown_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        reward_role_id = excluded.reward_role_id,
        reward_duration_days = excluded.reward_duration_days,
        winners_count = excluded.winners_count,
        announcement_channel_id = excluded.announcement_channel_id,
        allowed_thank_channel_id = excluded.allowed_thank_channel_id,
        cooldown_hours = excluded.cooldown_hours
    `);
    stmt.run(String(guildId), roleToSave, daysToSave, winnersToSave, channelToSave, thankChannelToSave, cooldownToSave);
  }

  setLiveLeaderboard(guildId, channelId, messageId) {
    const stmt = this.db.prepare(`
      INSERT INTO honor_config (guild_id, live_leaderboard_channel_id, live_leaderboard_message_id)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        live_leaderboard_channel_id = excluded.live_leaderboard_channel_id,
        live_leaderboard_message_id = excluded.live_leaderboard_message_id
    `);
    stmt.run(String(guildId), channelId ? String(channelId) : null, messageId ? String(messageId) : null);
  }

  getLastThankTime(guildId, giverId, receiverId) {
    const stmt = this.db.prepare(`
      SELECT timestamp FROM reputation_logs
      WHERE guild_id = ? AND giver_id = ? AND receiver_id = ?
      ORDER BY id DESC LIMIT 1
    `);
    const row = stmt.get(String(guildId), String(giverId), String(receiverId));
    return row ? new Date(row.timestamp) : null;
  }

  addReputation(guildId, giverId, giverName, receiverId, receiverName, reason, points = 1) {
    const monthKey = this.getCurrentMonthKey();
    const nowIso = new Date().toISOString();

    const logStmt = this.db.prepare(`
      INSERT INTO reputation_logs (guild_id, giver_id, giver_name, receiver_id, receiver_name, reason, month_key, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    logStmt.run(String(guildId), String(giverId), String(giverName), String(receiverId), String(receiverName), String(reason), String(monthKey), String(nowIso));

    const getStmt = this.db.prepare('SELECT * FROM reputation_scores WHERE guild_id = ? AND user_id = ?');
    const existing = getStmt.get(String(guildId), String(receiverId));

    let newMonthly = 0;
    let newTotal = 0;
    let previousMonthly = 0;

    if (!existing) {
      newMonthly = Math.max(0, Number(points));
      newTotal = Math.max(0, Number(points));
      const insertStmt = this.db.prepare(`
        INSERT INTO reputation_scores (guild_id, user_id, monthly_points, total_points, last_given_at, month_key)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(String(guildId), String(receiverId), newMonthly, newTotal, nowIso, monthKey);
    } else {
      const oldMonth = existing.month_key;
      previousMonthly = oldMonth === monthKey ? Number(existing.monthly_points) : 0;
      newMonthly = Math.max(0, previousMonthly + Number(points));
      newTotal = Math.max(0, Number(existing.total_points) + Number(points));

      const updateStmt = this.db.prepare(`
        UPDATE reputation_scores
        SET monthly_points = ?, total_points = ?, last_given_at = ?, month_key = ?
        WHERE guild_id = ? AND user_id = ?
      `);
      updateStmt.run(newMonthly, newTotal, nowIso, monthKey, String(guildId), String(receiverId));
    }

    return { monthlyPoints: newMonthly, totalPoints: newTotal, previousMonthly };
  }

  getUserHonorStats(guildId, userId) {
    const monthKey = this.getCurrentMonthKey();
    const stmt = this.db.prepare('SELECT * FROM reputation_scores WHERE guild_id = ? AND user_id = ?');
    const user = stmt.get(String(guildId), String(userId));

    const monthlyPoints = user ? (user.month_key === monthKey ? Number(user.monthly_points) : 0) : 0;
    const totalPoints = user ? Number(user.total_points) : 0;

    const rankStmt = this.db.prepare(`
      SELECT COUNT(*) AS rank_count FROM reputation_scores
      WHERE guild_id = ? AND month_key = ? AND monthly_points > ?
    `);
    const rankRow = rankStmt.get(String(guildId), String(monthKey), monthlyPoints);
    const monthlyRank = (rankRow ? Number(rankRow.rank_count) : 0) + 1;

    const thanksStmt = this.db.prepare(`
      SELECT giver_name, reason, timestamp FROM reputation_logs
      WHERE guild_id = ? AND receiver_id = ?
      ORDER BY id DESC LIMIT 5
    `);
    const recentThanks = thanksStmt.all(String(guildId), String(userId));

    return {
      monthlyPoints,
      totalPoints,
      monthlyRank,
      recentThanks
    };
  }

  getLeaderboard(guildId, scope = 'month', limit = 10) {
    const monthKey = this.getCurrentMonthKey();
    if (scope === 'month') {
      const stmt = this.db.prepare(`
        SELECT user_id, monthly_points AS points, total_points
        FROM reputation_scores
        WHERE guild_id = ? AND month_key = ? AND monthly_points > 0
        ORDER BY monthly_points DESC
        LIMIT ?
      `);
      return stmt.all(String(guildId), String(monthKey), Number(limit));
    } else {
      const stmt = this.db.prepare(`
        SELECT user_id, total_points AS points, monthly_points
        FROM reputation_scores
        WHERE guild_id = ? AND total_points > 0
        ORDER BY total_points DESC
        LIMIT ?
      `);
      return stmt.all(String(guildId), Number(limit));
    }
  }

  // ---------------- Milestone Roles ----------------
  getMilestoneRoles(guildId) {
    const stmt = this.db.prepare('SELECT * FROM milestone_roles WHERE guild_id = ? ORDER BY min_stars ASC');
    return stmt.all(String(guildId));
  }

  setMilestoneRole(guildId, tier, minStars, roleId) {
    const stmt = this.db.prepare(`
      INSERT INTO milestone_roles (guild_id, tier, min_stars, role_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, tier) DO UPDATE SET
        min_stars = excluded.min_stars,
        role_id = excluded.role_id
    `);
    stmt.run(String(guildId), Number(tier), Number(minStars), String(roleId));
  }

  deleteMilestoneRole(guildId, tier) {
    const stmt = this.db.prepare('DELETE FROM milestone_roles WHERE guild_id = ? AND tier = ?');
    stmt.run(String(guildId), Number(tier));
  }

  // ---------------- Reward Tracking & Expiration ----------------
  addActiveReward(guildId, userId, roleId, durationDays) {
    const now = new Date();
    const expires = new Date(now.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000);

    const stmt = this.db.prepare(`
      INSERT INTO active_rewards (guild_id, user_id, role_id, awarded_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(String(guildId), String(userId), String(roleId), now.toISOString(), expires.toISOString());
    return info.lastInsertRowid;
  }

  getExpiredRewards() {
    const nowIso = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT id, guild_id, user_id, role_id, expires_at
      FROM active_rewards
      WHERE expires_at <= ?
    `);
    return stmt.all(nowIso);
  }

  removeActiveReward(recordId) {
    const stmt = this.db.prepare('DELETE FROM active_rewards WHERE id = ?');
    stmt.run(Number(recordId));
  }

  resetMonthlyScores(guildId) {
    const monthKey = this.getCurrentMonthKey();
    const stmt = this.db.prepare(`
      UPDATE reputation_scores
      SET monthly_points = 0, month_key = ?
      WHERE guild_id = ?
    `);
    stmt.run(String(monthKey), String(guildId));
  }
}

module.exports = DBManager;
