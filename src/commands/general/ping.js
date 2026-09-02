const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription("Check the bot's response time and API latency."),
  async execute(interaction) {
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const ws = Math.round(interaction.client.ws.ping);

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(config.colors.primary)
      .addFields(
        { name: '📡 WebSocket Latency', value: `\`${ws >= 0 ? ws : 0}ms\``, inline: true },
        { name: '⚡ API Round-Trip', value: `\`${roundtrip}ms\``, inline: true }
      )
      .setFooter({ text: `${config.botName} v${config.botVersion}` })
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  }
};
