const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const config = require('../../config');
const { getMemberMilestoneInfo } = require('../../utils/stars');
const { syncMemberMilestoneRoles } = require('../../services/starRoles');
const { updateLiveLeaderboard } = require('../../services/liveLeaderboard');

// In-memory global server cooldown tracker (5 minutes between ANY thank per guild)
const globalServerThankMap = new Map();

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

    // 2. Channel Restriction Check (Default: #1544716619325112410 on test server or configured channel)
    const allowedChannelId = cfg && cfg.allowed_thank_channel_id
      ? cfg.allowed_thank_channel_id
      : (guildId === '1544347574109208639' ? '1544716619325112410' : null);

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

    // 5. Mutual Trade Lock (Reciprocal Block - 24 Hours)
    // If target gave stars to caller in the last 24 hours, caller cannot thank them back!
    const MUTUAL_LOCK_MS = 24 * 60 * 60 * 1000; // 24 hours
    const reverseThankTime = await db.getLastThankTime(guildId, target.id, interaction.user.id);
    if (reverseThankTime) {
      const elapsedReverse = Date.now() - new Date(reverseThankTime).getTime();
      if (elapsedReverse < MUTUAL_LOCK_MS) {
        const remainingReverse = MUTUAL_LOCK_MS - elapsedReverse;
        const hoursRem = Math.floor(remainingReverse / (3600 * 1000));
        const minsRem = Math.floor((remainingReverse % (3600 * 1000)) / (60 * 1000));
        return interaction.reply({
          content: `🚫 **Mutual Star Trading Blocked!**\n<@${target.id}> gave you a star recently.\nTo prevent *"tum mujhe do, mai tumhe deta hu"* trading, you cannot thank them back for another **${hoursRem}h ${minsRem}m**.`,
          ephemeral: true
        });
      }
    }

    // 6. Per-User Same-Recipient Cooldown (Default 24 Hours)
    const cooldownHours = cfg && cfg.cooldown_hours ? cfg.cooldown_hours : 24;
    const lastThank = await db.getLastThankTime(guildId, interaction.user.id, target.id);
    if (lastThank) {
      const elapsedMs = Date.now() - new Date(lastThank).getTime();
      const cooldownMs = cooldownHours * 3600 * 1000;
      if (elapsedMs < cooldownMs) {
        const remainingMs = cooldownMs - elapsedMs;
        const hoursRem = Math.floor(remainingMs / (3600 * 1000));
        const minsRem = Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000));
        return interaction.reply({
          content: `⏳ **User Cooldown Active!** You already endorsed <@${target.id}>.\nYou can thank them again in **${hoursRem}h ${minsRem}m**.`,
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

    // 8. Check if target reached any monthly milestone roles
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

    // 9. Trigger instant real-time live leaderboard refresh
    await updateLiveLeaderboard(interaction.client, db, guildId);
  }
};
