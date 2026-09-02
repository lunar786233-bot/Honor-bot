const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { processExpiredRewards } = require('../../services/scheduler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('force-expire-roles')
    .setDescription('Instantly check and remove reward roles from members whose duration has expired.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  async execute(interaction, db) {
    await interaction.deferReply({ ephemeral: true });

    const removedCount = await processExpiredRewards(interaction.client, db);

    const embed = new EmbedBuilder()
      .setTitle('🧹 Role Expiration Check Complete')
      .setDescription(`Checked all active reward records. Automatically removed roles from **${removedCount}** expired member(s).`)
      .setColor(config.colors.info);

    await interaction.editReply({ embeds: [embed] });
  }
};
