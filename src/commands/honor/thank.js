const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const config = require('../../config');
const { getMemberMilestoneInfo } = require('../../utils/stars');
const { syncMemberMilestoneRoles } = require('../../services/starRoles');
const { updateLiveLeaderboard } = require('../../services/liveLeaderboard');
const { sendSuspiciousTradeAlert, sendStarTransactionStaffLog } = require('../../services/adminAlerts');

// Default thank channel requested: 1545036041583595562 (🫂・ᴛʜᴀɴᴋ)
const DEFAULT_THANK_CHANNEL_ID = '1545036041583595562';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('thank')
    .setDescription('Thank a member who helped you and award them +1 ⭐ Community Star!')
    .addUserOption(option =>
      option.setName('member')
        .setDescription('The member who helped you')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('What did they help you with?')
        .setRequired(true)
    )
    .setDMPermission(false),
  async execute(interaction, db) {
    const target = interaction.options.getUser('member');
    const reason = interaction.options.getString('reason');
    const guildId = interaction.guild.id;

    // 1. Basic validation
    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ You cannot award stars to yourself!',
        ephemeral: true
      });
    }

    if (target.bot) {
      return interaction.reply({
        content: '❌ You cannot award stars to bots!',
        ephemeral: true
      });
    }

    const cfg = await db.getHonorConfig(guildId);

    // 2. Channel Restriction Check (Default: #1545036041583595562 - 🫂・ᴛʜᴀɴᴋ)
    const allowedChannelId = cfg && cfg.allowed_thank_channel_id
      ? cfg.allowed_thank_channel_id
      : DEFAULT_THANK_CHANNEL_ID;

    if (allowedChannelId && interaction.channelId !== allowedChannelId) {
      return interaction.reply({
        content: `📍 **Channel Restricted!** The \`/thank\` command can only be used in <#${allowedChannelId}>.`,
        ephemeral: true
      });
    }

    // 3. Minimum Account Age Requirement (15 Days Anti-Alt Protection)
    const accountAgeMs = Date.now() - interaction.user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
    const minDaysRequired = 15;

    if (accountAgeDays < minDaysRequired) {
      return interaction.reply({
        content: `🛡️ **Anti-Alt Protection!** Your Discord account must be at least **${minDaysRequired} days old** to award community stars.\n*(Your account age: ${accountAgeDays} day${accountAgeDays === 1 ? '' : 's'})*`,
        ephemeral: true
      });
    }

    // 4. SAME-PERSON COOLDOWN (8 Hours):
    // You cannot give a star to the SAME person twice within 8 hours!
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000; // 8 hours
    const lastThankToTarget = await db.getLastThankTime(guildId, interaction.user.id, target.id);
    if (lastThankToTarget) {
      const elapsedTarget = Date.now() - new Date(lastThankToTarget).getTime();
      if (elapsedTarget < EIGHT_HOURS_MS) {
        const remTarget = EIGHT_HOURS_MS - elapsedTarget;
        const hoursRem = Math.floor(remTarget / (3600 * 1000));
        const minsRem = Math.floor((remTarget % (3600 * 1000)) / (60 * 1000));
        return interaction.reply({
          content: `⏳ **Same-Member Cooldown (8 Hours)!**\nYou already gave a star to <@${target.id}> recently.\nYou cannot thank them again for **${hoursRem}h ${minsRem}m**.\n*(You can freely thank any other member who helps you).*`,
          ephemeral: true
        });
      }
    }

    // 5. MUTUAL TRADE LOCK (8 Hours):
    // If User B gave a star to User A, User A CANNOT give a star back to User B for 8 hours!
    const reverseThankTime = await db.getLastThankTime(guildId, target.id, interaction.user.id);
    if (reverseThankTime) {
      const elapsedReverse = Date.now() - new Date(reverseThankTime).getTime();
      if (elapsedReverse < EIGHT_HOURS_MS) {
        const remainingReverse = EIGHT_HOURS_MS - elapsedReverse;
        const hoursRem = Math.floor(remainingReverse / (3600 * 1000));
        const minsRem = Math.floor((remainingReverse % (3600 * 1000)) / (60 * 1000));
        return interaction.reply({
          content: `🚫 **Mutual Star Trading Protection!**\n<@${target.id}> gave you a star recently. To maintain system integrity, reciprocal star exchanges are locked for **${hoursRem}h ${minsRem}m**.\n\n⚠️ **Warning:** Engaging in mutual star trading, artificial star farming, or quid-pro-quo rings will result in an immediate **full reset of all your stars and milestone roles**.\n*(You can freely thank any other member who helps you).*`,
          ephemeral: true
        });
      }
    }

    await interaction.deferReply();

    // 6. Process Star Award
    const { monthlyPoints, totalPoints, previousMonthly } = await db.addReputation(
      guildId,
      interaction.user.id,
      interaction.user.tag,
      target.id,
      target.tag,
      reason,
      1
    );

    // 7. Send Real-Time Staff Log to Admin/Staff Channel (1318164139788468227)
    await sendStarTransactionStaffLog(interaction.client, interaction.guild, {
      giver: interaction.user,
      receiver: target,
      points: 1,
      monthlyTotal: monthlyPoints,
      totalPoints,
      reason,
      channel: interaction.channel
    }).catch(err => console.error('Failed to send staff transaction log:', err));

    // 8. Auto-Detection of Suspicious Trading Patterns -> Send Alert to Admin Channel (1318164139788468227)
    if (db.detectSuspiciousTrading) {
      const alertInfo = await db.detectSuspiciousTrading(guildId, interaction.user.id, target.id).catch(() => ({ isSuspicious: false }));
      if (alertInfo && alertInfo.isSuspicious) {
        await sendSuspiciousTradeAlert(interaction.client, interaction.guild, {
          giver: interaction.user,
          receiver: target,
          reason,
          type: alertInfo.type,
          details: alertInfo.details
        }).catch(err => console.error('Failed to dispatch suspicious trading alert:', err));
      }
    }

    const info = await getMemberMilestoneInfo(interaction.guild, monthlyPoints, db);

    const embed = new EmbedBuilder()
      .setTitle('✨ Community Star Awarded!')
      .setDescription(
        `🎁 ${interaction.user.toString()} gave **+1 ⭐ Star** to ${target.toString()}!\n\n` +
        `💬 **Endorsement Note:**\n*“${reason}”*`
      )
      .setColor(info.currentRole && info.currentRole.color ? info.currentRole.color : config.colors.success)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '📅 Monthly Stars', value: `⭐ **${monthlyPoints}**`, inline: true },
        { name: '🌟 Lifetime Stars', value: `✨ **${totalPoints}**`, inline: true },
        {
          name: '🎯 Milestone Progress',
          value: info.nextRole
            ? `${info.progressBar}\n*(**${info.starsNeeded} more ⭐** for ${info.nextRole.toString()})*`
            : '👑 **Max Tier Achieved**',
          inline: false
        }
      )
      .setFooter({
        text: `Given with appreciation by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // 9. Check if target reached any monthly milestone roles (and dispatch audit log to admin channel)
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) {
      await syncMemberMilestoneRoles(
        interaction.guild,
        member,
        monthlyPoints,
        db,
        interaction.channel
      );
    }

    // 10. Trigger instant real-time live leaderboard refresh
    await updateLiveLeaderboard(interaction.client, db, guildId);
  }
};
