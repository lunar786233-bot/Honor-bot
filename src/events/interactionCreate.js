const { Events, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config');
const { buildLiveLeaderboardPayload } = require('../services/liveLeaderboard');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, db) {
    // 1. Handle Button Interactions
    if (interaction.isButton()) {
      if (interaction.customId === 'live_lb_manual_refresh') {
        try {
          await interaction.deferUpdate().catch(() => null);
          const { embed, row } = await buildLiveLeaderboardPayload(interaction.guild, db);
          await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
        } catch (e) {}
        return;
      }
      return;
    }

    // 2. Handle Slash Commands
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction, db);
    } catch (error) {
      if (error.code === 10062) {
        // Unknown interaction - Discord network token timeout, ignore gracefully
        return;
      }

      console.error(`Error executing ${interaction.commandName}:`, error);

      const embed = new EmbedBuilder()
        .setTitle('⚠️ Command Error')
        .setDescription('An unexpected error occurred while executing this command. Check the console for details.')
        .setColor(config.colors.error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }
    }
  }
};
