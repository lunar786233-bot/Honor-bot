const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { resetGuildMilestoneRoles } = require('../../services/starRoles');
const { updateLiveLeaderboard } = require('../../services/liveLeaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('force-reset')
    .setDescription("Force reset monthly stars and milestone roles (Lifetime stars preserved).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  async execute(interaction, db) {
    await interaction.deferReply();

    // 1. Reset scores in DB
    await db.resetMonthlyScores(interaction.guild.id);

    // 2. Revoke monthly milestone roles from members
    const removedRolesCount = await resetGuildMilestoneRoles(interaction.guild, db);

    // 3. Trigger instant real-time live leaderboard refresh
    await updateLiveLeaderboard(interaction.client, db, interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle('🔄 Monthly Star Cycle Reset Complete')
      .setDescription(
        'All monthly stars have been reset to **0** for the fresh cycle!\n' +
        `• Automatically cleared monthly milestone roles from **${removedRolesCount}** member assignment(s).\n` +
        '• Lifetime stars and Hall of Fame ranks remain safely preserved.'
      )
      .setColor(config.colors.success);

    await interaction.editReply({ embeds: [embed] });
  }
};
