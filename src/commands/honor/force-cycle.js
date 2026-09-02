const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { processGuildCycle } = require('../../services/scheduler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('force-cycle')
    .setDescription('Force calculate monthly Star winners right now, award roles, and post celebration.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  async execute(interaction, db) {
    await interaction.deferReply({ ephemeral: false });

    const result = await processGuildCycle(interaction.guild, db);

    if (!result.success) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Force Cycle Failed')
        .setDescription(result.message)
        .setColor(config.colors.error);
      return interaction.editReply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setTitle('🌟 Monthly Star Cycle Executed Successfully!')
      .setDescription(result.message)
      .setColor(config.colors.success);

    if (result.winners && result.winners.length > 0) {
      const winnersText = result.winners.map(w => `• ${w.mention} — **${w.points} ⭐ Stars**`).join('\n');
      embed.addFields(
        { name: '🏅 Awarded Star Champions', value: winnersText, inline: false },
        { name: '🎭 Role Assigned', value: `<@&${result.roleId}>`, inline: true },
        { name: '⏱️ Role Duration', value: `${result.durationDays} days`, inline: true }
      );
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
