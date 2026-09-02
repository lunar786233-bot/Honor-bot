const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Explore all Community Stars commands and Milestone Roles.'),
  async execute(interaction, db) {
    await interaction.deferReply();

    const milestones = await db.getMilestoneRoles(interaction.guild.id);

    let milestoneText = '• 50 ⭐ ➔ Tier 1\n• 100 ⭐ ➔ Tier 2\n• 200 ⭐ ➔ Tier 3\n• 350 ⭐ ➔ Tier 4\n• 500 ⭐ ➔ Tier 5';
    if (milestones && milestones.length > 0) {
      milestoneText = milestones.map(m => `• **${m.min_stars} ⭐ Stars** ➔ <@&${m.role_id}>`).join('\n');
    }

    const embed = new EmbedBuilder()
      .setTitle(`✨ ${interaction.guild.name} • Community Stars Guide`)
      .setDescription(
        'Help fellow members, earn **⭐ Community Stars**, climb the leaderboard, and automatically unlock monthly milestone roles!'
      )
      .setColor(0xFEE75C)
      .addFields(
        {
          name: '🌟 Member Commands',
          value:
            '• `/thank [member] [reason]` — Give **+1 ⭐ Star** to someone who helped you.\n' +
            '• `/stars [member]` — View Star profile, next role progress bar, and praise notes.\n' +
            '• `/leaderboard` — Interactive Leaderboard with live Monthly & All-Time Star tabs.\n' +
            '• `/ping` — Check bot latency and response speed.',
          inline: false
        },
        {
          name: '🎖️ Server Star Milestone Roles (Monthly Reset)',
          value: milestoneText,
          inline: false
        },
        {
          name: '⚙️ Admin Management Commands',
          value:
            '• `/star-roles set/view/remove` — Configure monthly milestone roles.\n' +
            '• `/star-config set/view` — Configure announcement channel and cooldowns.\n' +
            '• `/post-celebration` — Generate & send graphic leaderboard image card.\n' +
            '• `/add-stars` / `/remove-stars` — Grant or deduct ⭐ Stars.\n' +
            '• `/force-cycle` — Run monthly reward calculation right now.\n' +
            '• `/force-reset` — Reset monthly stars and clear milestone roles.',
          inline: false
        }
      )
      .setFooter({ text: `${interaction.guild.name} • Community Stars System` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
