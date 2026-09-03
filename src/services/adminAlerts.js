const { EmbedBuilder } = require('discord.js');
const config = require('../config');

const DEFAULT_ADMIN_ALERT_CHANNEL_ID = '1318164139788468227';

/**
 * Sends a high-priority alert to the admin alert channel when suspicious trading is detected.
 */
async function sendSuspiciousTradeAlert(client, guild, { giver, receiver, reason, type, details }) {
  if (!guild || !client) return;

  const alertChannel = await client.channels.fetch(DEFAULT_ADMIN_ALERT_CHANNEL_ID).catch(() => null)
    || (guild.channels.cache.get(DEFAULT_ADMIN_ALERT_CHANNEL_ID));

  if (!alertChannel) {
    console.warn(`Admin alert channel ${DEFAULT_ADMIN_ALERT_CHANNEL_ID} not found.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🚨 SUSPICIOUS STAR TRADING DETECTED')
    .setColor(config.colors.error || 0xED4245)
    .setDescription(
      `⚠️ **Warning:** The system has detected a potential star farming / trading pattern in **${guild.name}**.`
    )
    .addFields(
      { name: '👤 Giver', value: `${giver.toString()} (\`${giver.tag}\` • ID: \`${giver.id}\`)`, inline: true },
      { name: '🎯 Receiver', value: `${receiver.toString()} (\`${receiver.tag}\` • ID: \`${receiver.id}\`)`, inline: true },
      { name: '🔍 Detection Type', value: `\`${type}\``, inline: false },
      { name: '📋 Pattern Details', value: details, inline: false },
      { name: '💬 Endorsement Reason Given', value: `*"${reason}"*`, inline: false },
      { name: '🛠️ Recommended Admin Actions', value: '• Review history with `/stars @member`\n• Deduct illegitimate stars with `/remove-stars @member <stars> <reason>`', inline: false }
    )
    .setFooter({ text: 'World Government Anti-Abuse Sentinel' })
    .setTimestamp();

  await alertChannel.send({ embeds: [embed] }).catch(err => console.error('Failed to send admin alert:', err));
}

/**
 * Sends a comprehensive audit report to the admin alert channel whenever a member unlocks a milestone role.
 * Includes a full receipt breakdown of where and why they received each star this month.
 */
async function sendMilestoneRoleAuditAlert(client, guild, member, role, minStars, totalMonthlyStars, starLogs = []) {
  if (!guild || !client || !member) return;

  const alertChannel = await client.channels.fetch(DEFAULT_ADMIN_ALERT_CHANNEL_ID).catch(() => null)
    || (guild.channels.cache.get(DEFAULT_ADMIN_ALERT_CHANNEL_ID));

  if (!alertChannel) {
    console.warn(`Admin alert channel ${DEFAULT_ADMIN_ALERT_CHANNEL_ID} not found.`);
    return;
  }

  // Format Star Receipt Logs (Top 25 most recent for this month)
  let historyText = '';
  if (!starLogs || starLogs.length === 0) {
    historyText = '*No endorsement logs recorded (granted via admin / bonus).*';
  } else {
    const formatted = starLogs.slice(0, 20).map((log, index) => {
      const ts = Math.floor(new Date(log.timestamp).getTime() / 1000);
      return `**${index + 1}.** From <@${log.giver_id}>: *"${log.reason}"* — <t:${ts}:R>`;
    });

    historyText = formatted.join('\n');
    if (starLogs.length > 20) {
      historyText += `\n*...and ${starLogs.length - 20} more earlier star endorsements.*`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 MILESTONE ROLE UNLOCKED — AUDIT LOG')
    .setColor(0xFEE75C) // Radiant Gold
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setDescription(
      `🎉 **Member Unlocked Milestone Role!**\n\n` +
      `👤 **Member:** ${member.toString()} (\`${member.user.tag}\` • ID: \`${member.id}\`)\n` +
      `🎭 **Role Awarded:** ${role.toString()} (\`${role.name}\` • ID: \`${role.id}\`)\n` +
      `⭐ **Milestone Threshold:** **${minStars} ⭐ Stars** (Current Monthly: **${totalMonthlyStars} ⭐**)`
    )
    .addFields(
      {
        name: `📜 Star Earnings Breakdown (${starLogs.length} Total Endorsements This Month)`,
        value: historyText.length > 1000 ? historyText.slice(0, 990) + '...' : historyText,
        inline: false
      }
    )
    .setFooter({ text: 'Community Stars Audit & Verification System' })
    .setTimestamp();

  await alertChannel.send({ embeds: [embed] }).catch(err => console.error('Failed to send milestone audit alert:', err));
}

module.exports = {
  DEFAULT_ADMIN_ALERT_CHANNEL_ID,
  sendSuspiciousTradeAlert,
  sendMilestoneRoleAuditAlert
};
