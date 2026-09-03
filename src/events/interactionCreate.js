const { Events, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config');
const { buildLiveLeaderboardPayload } = require('../services/liveLeaderboard');

const DEFAULT_THANK_CHANNEL_ID = '1545036041583595562';

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, db) {
    // 0. Server Whitelist Security Check
    if (interaction.guildId && config.allowedGuilds && config.allowedGuilds.length > 0) {
      if (!config.allowedGuilds.includes(interaction.guildId)) {
        const unauthorizedEmbed = new EmbedBuilder()
          .setTitle('⛔ Unauthorized Server')
          .setDescription(
            `This bot is proprietary and only authorized to run in designated community servers.\n\n` +
            `💬 For authorization or inquiries, contact the developer: <@${config.developerId}>.`
          )
          .setColor(config.colors.error);

        return interaction.reply({
          embeds: [unauthorizedEmbed],
          flags: [MessageFlags.Ephemeral]
        }).catch(() => null);
      }
    }

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

    // Channel restriction: In thank channel, ONLY /thank is allowed!
    if (db) {
      const cfg = await db.getHonorConfig(interaction.guildId).catch(() => null);
      const thankChannelId = (cfg && cfg.allowed_thank_channel_id) ? cfg.allowed_thank_channel_id : DEFAULT_THANK_CHANNEL_ID;
      if (interaction.channelId === thankChannelId && interaction.commandName !== 'thank') {
        return interaction.reply({
          content: `❌ In <#${thankChannelId}>, strictly **only the \`/thank\` command** is allowed!\nPlease use \`/${interaction.commandName}\` in your bot commands channel.`,
          ephemeral: true
        }).catch(() => null);
      }
    }

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

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }
    }
  }
};
