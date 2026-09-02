const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { getMemberMilestoneInfo } = require('../../utils/stars');
const { syncMemberMilestoneRoles } = require('../../services/starRoles');
const { updateLiveLeaderboard } = require('../../services/liveLeaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-stars')
    .setDescription('Admin: Manually grant bonus ⭐ Stars to a member.')
    .addUserOption(option =>
      option.setName('member')
        .setDescription('The member')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('stars')
        .setDescription('Number of ⭐ Stars to add')
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for bonus')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  async execute(interaction, db) {
    await interaction.deferReply();

    const target = interaction.options.getUser('member');
    const stars = interaction.options.getInteger('stars');
    const reason = interaction.options.getString('reason') || 'Admin grant';

    const { monthlyPoints, totalPoints } = await db.addReputation(
      interaction.guild.id,
      interaction.user.id,
      `[Admin] ${interaction.user.tag}`,
      target.id,
      target.tag,
      reason,
      stars
    );

    const info = await getMemberMilestoneInfo(interaction.guild, monthlyPoints, db);

    const embed = new EmbedBuilder()
      .setTitle('⭐ Bonus Stars Granted')
      .setDescription(`Granted **+${stars} ⭐ Stars** to ${target.toString()}.\n💬 Reason: *"${reason}"*`)
      .setColor(config.colors.success)
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
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Check if target reached milestone
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

    // Trigger instant real-time live leaderboard refresh
    await updateLiveLeaderboard(interaction.client, db, interaction.guild.id);
  }
};
