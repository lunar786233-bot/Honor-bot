require('dotenv').config();
const path = require('path');
const SQLiteDBManager = require('./src/database/db');
const MongoDBManager = require('./src/database/mongoDb');
const {
  UserHonor,
  ThankLog,
  MilestoneRole,
  HonorConfig,
  ActiveReward
} = require('./src/database/models');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGODB_URI found in .env');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB Cloud...');
  const mongo = new MongoDBManager(uri);
  await mongo.connect();

  console.log('📂 Reading SQLite database...');
  const sqlite = new SQLiteDBManager();

  const guildId = '1544347574109208639';

  // 1. Migrate Milestone Roles
  const milestones = sqlite.getMilestoneRoles(guildId);
  console.log(`  Found ${milestones.length} milestone roles in SQLite.`);
  for (const m of milestones) {
    await MilestoneRole.findOneAndUpdate(
      { guild_id: m.guild_id, tier: m.tier },
      { $set: { min_stars: m.min_stars, role_id: m.role_id } },
      { upsert: true }
    );
    console.log(`    ✓ Migrated Tier ${m.tier}: ${m.min_stars}⭐ -> Role ${m.role_id}`);
  }

  // 2. Migrate User Reputation Scores
  const scoresStmt = sqlite.db.prepare('SELECT * FROM reputation_scores');
  const scores = scoresStmt.all();
  console.log(`  Found ${scores.length} user star records in SQLite.`);
  for (const s of scores) {
    await UserHonor.findOneAndUpdate(
      { guild_id: s.guild_id, user_id: s.user_id },
      {
        $set: {
          monthly_points: s.monthly_points,
          total_points: s.total_points,
          last_given_at: s.last_given_at ? new Date(s.last_given_at) : null,
          month_key: s.month_key
        }
      },
      { upsert: true }
    );
    console.log(`    ✓ Migrated User ${s.user_id}: ${s.monthly_points} Monthly / ${s.total_points} Total Stars`);
  }

  // 3. Migrate Reputation Logs
  const logsStmt = sqlite.db.prepare('SELECT * FROM reputation_logs');
  const logs = logsStmt.all();
  console.log(`  Found ${logs.length} thank logs in SQLite.`);
  for (const l of logs) {
    await ThankLog.create({
      guild_id: l.guild_id,
      giver_id: l.giver_id,
      giver_name: l.giver_name,
      receiver_id: l.receiver_id,
      receiver_name: l.receiver_name,
      reason: l.reason,
      month_key: l.month_key,
      timestamp: new Date(l.timestamp)
    });
  }

  // 4. Migrate Honor Config
  const cfg = sqlite.getHonorConfig(guildId);
  if (cfg) {
    await HonorConfig.findOneAndUpdate(
      { guild_id: cfg.guild_id },
      {
        $set: {
          reward_role_id: cfg.reward_role_id,
          reward_duration_days: cfg.reward_duration_days,
          winners_count: cfg.winners_count,
          announcement_channel_id: cfg.announcement_channel_id,
          cooldown_hours: cfg.cooldown_hours,
          last_processed_month: cfg.last_processed_month
        }
      },
      { upsert: true }
    );
    console.log('    ✓ Migrated Server Honor Configuration.');
  }

  console.log('\n🎉 ALL DATA MIGRATED TO MONGODB ATLAS CLOUD SUCCESSFULLY!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
