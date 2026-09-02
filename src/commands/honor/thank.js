const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const config = require('../../config');
const { getMemberMilestoneInfo } = require('../../utils/stars');
const { checkAndAssignMilestones } = require('../../services/starRoles');
const { updateLiveLeaderboard } = require('../../services/liveLeaderboard');

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

    const cfg = await db.getHonorConfig(interaction.guild.id);
    const cooldownHours = cfg ? cfg.cooldown_hours : 6;

    const lastThank = await db.getLastThankTime(interaction.guild.id, interaction.user.id, target.id);
    if (lastThank) {
      const now = new Date();
      const elapsedMs = now - lastThank;
      const cooldownMs = cooldownHours * 3600 * 1000;
      if (elapsedMs < cooldownMs) {
        const remainingMs = cooldownMs - elapsedMs;
        const hoursRem = Math.floor(remainingMs / (3600 * 1000));
        const minsRem = Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000));
        return interaction.reply({
          content: `⏳ Cooldown active! You already endorsed <@${target.id}>. You can thank them again in **${hoursRem}h ${minsRem}m**.`,
          ephemeral: true
        });
      }
    }

    await interaction.deferReply();

    const { monthlyPoints, totalPoints, previousMonthly } = await db.addReputation(
      interaction.guild.id,
      interaction.user.id,
      interaction.user.tag,
      target.id,
      target.tag,
      reason,
      1
    );

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

    // 1. Check if target reached any monthly milestone roles
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) {
      await checkAndAssignMilestones(
        interaction.guild,
        member,
        previousMonthly,
        monthlyPoints,
        db,
        interaction.channel
      );
    }

    // 2. Trigger instant real-time live leaderboard refresh
    await updateLiveLeaderboard(interaction.client, db, interaction.guild.id);
  }
};
