const cron = require('node-cron');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../config');
const { resetGuildMilestoneRoles } = require('./starRoles');
const { generateCelebrationCard } = require('../utils/imageGenerator');
const { updateLiveLeaderboard } = require('./liveLeaderboard');

async function sendGuildCelebrationCard(guild, db, period = 'month', customTitle = null) {
  const cfg = await db.getHonorConfig(guild.id);
  if (!cfg || !cfg.announcement_channel_id) return null;

  const channel = await guild.channels.fetch(cfg.announcement_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return null;

  const rows = await db.getLeaderboard(guild.id, period, 5);
  const milestones = await db.getMilestoneRoles(guild.id);

  const topUsers = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let memberObj = null;
    let userObj = null;
    try {
      memberObj = await guild.members.fetch(row.user_id).catch(() => null);
      userObj = memberObj ? memberObj.user : await guild.client.users.fetch(row.user_id).catch(() => null);
    } catch (e) {}

    let roleName = '⭐ Community Helper';
    if (milestones && milestones.length > 0) {
      for (const m of milestones) {
        if (row.points >= m.min_stars) {
          const r = guild.roles.cache.get(m.role_id);
          if (r) roleName = r.name;
        }
      }
    }

    topUsers.push({
      rank: i + 1,
      username: userObj ? userObj.username : `User ${row.user_id}`,
      displayName: memberObj ? memberObj.displayName : (userObj ? userObj.displayName || userObj.username : `User ${row.user_id}`),
      avatarUrl: userObj ? userObj.displayAvatarURL({ extension: 'png', size: 256 }) : null,
      stars: row.points,
      roleName
    });
  }

  const defaultTitle = period === 'month' ? '🌟 MONTHLY STAR CHAMPIONS' : '🏆 WEEKLY STAR LEADERBOARD';
  const subtitle = period === 'month' ? 'Celebrating this month\'s top community helpers!' : 'Top community helpers of the week!';

  const imageBuffer = await generateCelebrationCard({
    title: customTitle || defaultTitle,
    subtitle,
    guildName: guild.name,
    guildIconUrl: guild.iconURL({ extension: 'png', size: 128 }),
    topUsers
  });

  const attachment = new AttachmentBuilder(imageBuffer, { name: 'star-celebration-card.png' });

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${guild.name} • Star Celebration`)
    .setDescription(
      `🎉 **Congratulations to our top community helpers!**\n` +
      `Thank you for helping others and shining bright in our community! ✨`
    )
    .setColor(0xFEE75C)
    .setImage('attachment://star-celebration-card.png')
    .setFooter({ text: 'Help someone and use /thank to earn ⭐ Stars!' })
    .setTimestamp();

  await channel.send({ embeds: [embed], files: [attachment] }).catch(err => {
    console.error('Failed to post scheduled celebration card:', err);
  });

  return true;
}

async function processGuildCycle(guild, db) {
  const cfg = await db.getHonorConfig(guild.id);
  const winnersCount = cfg && cfg.winners_count ? cfg.winners_count : 1;
  const durationDays = cfg && cfg.reward_duration_days ? cfg.reward_duration_days : 30;

  let role = null;
  if (cfg && cfg.reward_role_id) {
    role = await guild.roles.fetch(cfg.reward_role_id).catch(() => null);
  }

  const topHelpers = await db.getLeaderboard(guild.id, 'month', winnersCount);
  const awardedWinners = [];

  if (role && topHelpers && topHelpers.length > 0) {
    for (const helper of topHelpers) {
      try {
        const member = await guild.members.fetch(helper.user_id).catch(() => null);
        if (member) {
          await member.roles.add(role, `Community Star Champion reward (${helper.points} Stars)`);
          await db.addActiveReward(guild.id, member.id, role.id, durationDays);
          awardedWinners.push({ member, mention: member.toString(), points: helper.points });
        }
      } catch (err) {
        console.error(`Failed to assign role to user ${helper.user_id}:`, err);
      }
    }
  }

  // Generate & Post graphic celebration card image
  await sendGuildCelebrationCard(guild, db, 'month', '🌟 MONTHLY STAR CHAMPIONS');

  return {
    success: true,
    message: `Successfully calculated winners and posted celebration card image!`,
    winners: awardedWinners,
    roleId: role ? role.id : null,
    durationDays
  };
}

async function processExpiredRewards(client, db) {
  const expiredList = await db.getExpiredRewards();
  let removedCount = 0;

  for (const record of expiredList) {
    try {
      const guild = await client.guilds.fetch(record.guild_id).catch(() => null);
      if (guild) {
        const member = await guild.members.fetch(record.user_id).catch(() => null);
        const role = await guild.roles.fetch(record.role_id).catch(() => null);
        if (member && role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role, 'Monthly Star champion duration expired');
          removedCount++;
          console.log(`[Scheduler] Removed expired role ${role.name} from ${member.user.tag}`);
        }
      }
    } catch (err) {
      console.error(`Error processing expired reward for record ${record.id}:`, err);
    }

    await db.removeActiveReward(record.id);
  }

  return removedCount;
}

function startScheduler(client, db) {
  // 1. Hourly Task: Check Expired Roles
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[Scheduler] Running hourly expiration check...');
      await processExpiredRewards(client, db);
    } catch (err) {
      console.error('[Scheduler] Error in hourly task:', err);
    }
  });

  // 2. Weekly Task: Every Sunday at 23:59 UTC - Post Weekly Leaderboard Card Image
  cron.schedule('59 23 * * 0', async () => {
    try {
      console.log('[Scheduler] Sunday detected! Sending Weekly Star Leaderboard Card images...');
      for (const [guildId, guild] of client.guilds.cache) {
        await sendGuildCelebrationCard(guild, db, 'month', '🏆 WEEKLY STAR LEADERBOARD');
      }
    } catch (err) {
      console.error('[Scheduler] Error in weekly task:', err);
    }
  });

  // 3. Monthly Task: 1st of every month at 00:00 UTC - Monthly Grand Celebration Card & Reset
  cron.schedule('0 0 1 * *', async () => {
    try {
      console.log('[Scheduler] 1st of month detected! Running monthly star reward cycle & celebration cards...');
      for (const [guildId, guild] of client.guilds.cache) {
        await processGuildCycle(guild, db);
        await resetGuildMilestoneRoles(guild, db);
        await db.resetMonthlyScores(guildId);
      }
    } catch (err) {
      console.error('[Scheduler] Error in monthly cycle task:', err);
    }
  });

  // 4. Live Leaderboard Auto-Refresh: Runs every 1 minute
  cron.schedule('*/1 * * * *', async () => {
    try {
      for (const [guildId] of client.guilds.cache) {
        await updateLiveLeaderboard(client, db, guildId);
      }
    } catch (err) {
      console.error('[Scheduler] Error in live leaderboard auto-update:', err);
    }
  });

  console.log('✅ Background Scheduler registered (1-Min Live Leaderboard, Hourly Expiry, Weekly Card, Monthly Reset).');
}

module.exports = {
  processGuildCycle,
  processExpiredRewards,
  sendGuildCelebrationCard,
  startScheduler
};
