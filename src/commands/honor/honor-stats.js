const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { getMemberMilestoneInfo } = require('../../utils/stars');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stars')
    .setDescription("View your or another member's Community Star profile, milestone rank, and progress.")
    .addUserOption(option =>
      option.setName('member')
        .setDescription('Member to view (leave blank for yourself)')
        .setRequired(false)
    )
    .setDMPermission(false),
  async execute(interaction, db) {
    await interaction.deferReply();

    const target = interaction.options.getUser('member') || interaction.user;
    const stats = await db.getUserHonorStats(interaction.guild.id, target.id);

    const info = await getMemberMilestoneInfo(interaction.guild, stats.monthlyPoints, db);

    const embed = new EmbedBuilder()
      .setTitle(`🌟 Community Star Profile: ${target.displayName || target.username}`)
      .setColor(info.currentRole && info.currentRole.color ? info.currentRole.color : config.colors.primary)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `### 🎖️ ${info.currentRole ? info.currentRole.toString() : '🌱 **Member**'}\n` +
        `**Next Milestone:** ${info.progressBar}\n` +
        (info.nextRole
          ? `*(Earn **${info.starsNeeded} more ⭐** this month to unlock ${info.nextRole.toString()})*\n`
          : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        { name: '📅 Current Month', value: `⭐ **${stats.monthlyPoints} Stars**`, inline: true },
        { name: '🏆 Monthly Rank', value: `🏅 **#${stats.monthlyRank}**`, inline: true },
        { name: '💫 Lifetime Stars', value: `✨ **${stats.totalPoints} Stars**`, inline: true }
      )
      .setTimestamp();

    if (stats.recentThanks && stats.recentThanks.length > 0) {
      const notes = stats.recentThanks.map(t => `• From **${t.giver_name}**: *"${t.reason}"*`).join('\n');
      embed.addFields({ name: '📝 Recent Star Endorsements', value: notes, inline: false });
    } else {
      embed.addFields({ name: '📝 Recent Star Endorsements', value: 'No stars received yet. Help someone to earn ⭐!', inline: false });
    }

    embed.setFooter({ text: `${interaction.guild.name} • Community Stars System` });

    await interaction.editReply({ embeds: [embed] });
  }
};
