const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

// Lock to prevent concurrent overlapping message edits
let isUpdatingMap = new Map();

async function buildLiveLeaderboardPayload(guild, db) {
  const topRows = await db.getLeaderboard(guild.id, 'month', 10);
  const milestones = await db.getMilestoneRoles(guild.id);

  const nowEpoch = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setTitle(`🌟 ${guild.name} • Live Star Leaderboard`)
    .setColor(0xFEE75C)
    .setThumbnail(guild.iconURL({ dynamic: true }) || undefined)
    .setTimestamp();

  if (!topRows || topRows.length === 0) {
    embed.setDescription(
      `### 🏆 Top 10 Community Star Helpers (This Month)\n` +
      `✨ *Live real-time rankings • Updates automatically*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✨ **No Stars Awarded Yet this month!**\n` +
      `Help fellow members in chat and type \`/thank @member reason\` to give them their first ⭐ Star!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔄 **Last Live Refresh:** <t:${nowEpoch}:R>`
    );
  } else {
    const lines = topRows.map((row, idx) => {
      const medal = MEDALS[idx] || `\`#${idx + 1}\``;
      const starIcon = idx === 0 ? '🌟' : (idx < 3 ? '✨' : '⭐');

      // Determine achieved milestone role
      let achievedRole = null;
      if (milestones && milestones.length > 0) {
        for (const m of milestones) {
          if (row.points >= m.min_stars) {
            achievedRole = m;
          }
        }
      }

      const roleBadge = achievedRole ? ` • <@&${achievedRole.role_id}>` : '';

      return (
        `${medal} <@${row.user_id}>\n` +
        `   ${starIcon} **${row.points} Stars**${roleBadge}`
      );
    });

    embed.setDescription(
      `### 🏆 Top 10 Community Star Helpers (This Month)\n` +
      `✨ *Live real-time rankings • Auto-refreshes automatically*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      lines.join('\n\n') +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔄 **Last Live Refresh:** <t:${nowEpoch}:R>`
    );
  }

  embed.setFooter({
    text: `Help members & use /thank to earn ⭐ Stars! • Auto-updates live`,
    iconURL: guild.iconURL({ dynamic: true }) || undefined
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('live_lb_manual_refresh')
      .setLabel('🔄 Refresh Now')
      .setStyle(ButtonStyle.Success)
  );

  return { embed, row };
}

async function updateLiveLeaderboard(client, db, guildId) {
  if (isUpdatingMap.get(guildId)) return false;
  isUpdatingMap.set(guildId, true);

  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return false;

    const cfg = await db.getHonorConfig(guildId);
    if (!cfg || !cfg.live_leaderboard_channel_id || !cfg.live_leaderboard_message_id) return false;

    const channel = await guild.channels.fetch(cfg.live_leaderboard_channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) return false;

    const message = await channel.messages.fetch(cfg.live_leaderboard_message_id).catch(() => null);
    if (!message) return false;

    const { embed, row } = await buildLiveLeaderboardPayload(guild, db);
    await message.edit({ embeds: [embed], components: [row] });
    return true;
  } catch (err) {
    // Non-fatal background error
    return false;
  } finally {
    setTimeout(() => {
      isUpdatingMap.set(guildId, false);
    }, 2000);
  }
}

module.exports = {
  buildLiveLeaderboardPayload,
  updateLiveLeaderboard
};
