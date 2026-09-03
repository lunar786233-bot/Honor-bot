const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const config = require('../../config');
const { getMemberMilestoneInfo } = require('../../utils/stars');
const { syncMemberMilestoneRoles } = require('../../services/starRoles');
const { updateLiveLeaderboard } = require('../../services/liveLeaderboard');
const { sendSuspiciousTradeAlert } = require('../../services/adminAlerts');

// In-memory global server cooldown tracker (5 minutes between ANY thank per guild)
const globalServerThankMap = new Map();

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

    // 4. Server-Wide Global Cooldown Check (5 Minutes between ANY thank in server)
    const GLOBAL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
    const lastGlobalThank = globalServerThankMap.get(guildId);
    if (lastGlobalThank) {
      const elapsedGlobal = Date.now() - lastGlobalThank;
      if (elapsedGlobal < GLOBAL_COOLDOWN_MS) {
        const remainingGlobal = GLOBAL_COOLDOWN_MS - elapsedGlobal;
        const minsRem = Math.floor(remainingGlobal / 60000);
        const secsRem = Math.floor((remainingGlobal % 60000) / 1000);
        return interaction.reply({
          content: `⏳ **Server Global Cooldown!** A community star was recently awarded in this server.\nTo prevent spam and star farming, everyone must wait **${minsRem}m ${secsRem}s** before the next \`/thank\` can be used.`,
          ephemeral: true
        });
      }
    }

    // 5. GIVER COOLDOWN (8 Hours): User who gave a star must wait 8 hours before giving a star to anyone again
    const callerDoc = await db.getUserHonorDoc(guildId, interaction.user.id);
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000; // 8 hours

    if (callerDoc && callerDoc.last_given_at) {
      const elapsedGiven = Date.now() - new Date(callerDoc.last_given_at).getTime();
      if (elapsedGiven < EIGHT_HOURS_MS) {
        const remainingGiven = EIGHT_HOURS_MS - elapsedGiven;
        const hoursRem = Math.floor(remainingGiven / (3600 * 1000));
        const minsRem = Math.floor((remainingGiven % (3600 * 1000)) / (60 * 1000));
        return interaction.reply({
          content: `⏳ **Giving Cooldown Active (8 Hours)!**\nYou recently awarded a star to someone. You must wait **${hoursRem}h ${minsRem}m** before you can give a star to anyone again.`,
          ephemeral: true
        });
      }
    }

    // 6. MUTUAL 8-HOUR TRADE LOCK (Between Caller & Target specifically):
    // If target gave stars to caller in the last 8 hours, caller CANNOT give stars back to target!
    // (Caller can still give stars to other members, but NOT back to the person who gave them a star).
    const reverseThankTime = await db.getLastThankTime(guildId, target.id, interaction.user.id);
    if (reverseThankTime) {
      const elapsedReverse = Date.now() - new Date(reverseThankTime).getTime();
      if (elapsedReverse < EIGHT_HOURS_MS) {
        const remainingReverse = EIGHT_HOURS_MS - elapsedReverse;
        const hoursRem = Math.floor(remainingReverse / (3600 * 1000));
        const minsRem = Math.floor((remainingReverse % (3600 * 1000)) / (60 * 1000));
        return interaction.reply({
          content: `🚫 **Mutual Trade Lock (8 Hours)!**\n<@${target.id}> gave you a star recently.\nTo prevent *"tum mujhe do, mai tumhe deta hu"* trading, you cannot give a star back to them for **${hoursRem}h ${minsRem}m**.\n*(You can still thank other members who helped you).*`,
          ephemeral: true
        });
      }
    }

    // Same-recipient 24-hour check
    const lastThankToTarget = await db.getLastThankTime(guildId, interaction.user.id, target.id);
    if (lastThankToTarget) {
      const elapsedTarget = Date.now() - new Date(lastThankToTarget).getTime();
      if (elapsedTarget < EIGHT_HOURS_MS) {
        const remTarget = EIGHT_HOURS_MS - elapsedTarget;
        const hoursRem = Math.floor(remTarget / (3600 * 1000));
        const minsRem = Math.floor((remTarget % (3600 * 1000)) / (60 * 1000));
        return interaction.reply({
          content: `⏳ **User Cooldown!** You already endorsed <@${target.id}> recently. You can thank them again in **${hoursRem}h ${minsRem}m**.`,
          ephemeral: true
        });
      }
    }

    await interaction.deferReply();

    // 7. Process Star Award
    const { monthlyPoints, totalPoints, previousMonthly } = await db.addReputation(
      guildId,
      interaction.user.id,
      interaction.user.tag,
      target.id,
      target.tag,
      reason,
      1
    );

    // Set server-wide global cooldown timestamp
    globalServerThankMap.set(guildId, Date.now());

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
