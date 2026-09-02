const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { buildLiveLeaderboardPayload } = require('../../services/liveLeaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('live-leaderboard')
    .setDescription('Set up an auto-updating live Top 10 Leaderboard embed in a channel.')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to post the live leaderboard (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  async execute(interaction, db) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    const { embed, row } = await buildLiveLeaderboardPayload(guild, db);

    const liveMessage = await targetChannel.send({
      embeds: [embed],
      components: [row]
    });

    await db.setLiveLeaderboard(guild.id, targetChannel.id, liveMessage.id);

    await interaction.editReply({
      content: `✅ **Live Leaderboard is Active!**\n\nPosted to ${targetChannel.toString()}! The bot will now **automatically update this embed every 1 minute** and in real-time whenever members earn stars! 🚀`
    });
  }
};
