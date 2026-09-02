const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  AttachmentBuilder,
  ChannelType
} = require('discord.js');
const { generateCelebrationCard } = require('../../utils/imageGenerator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post-celebration')
    .setDescription('Generate and send a graphic Star Leaderboard Celebration Card to a channel.')
    .addStringOption(opt =>
      opt.setName('period')
        .setDescription('Leaderboard period to display')
        .setRequired(false)
        .addChoices(
          { name: '🌟 Monthly Star Champions', value: 'month' },
          { name: '👑 All-Time Stars Hall of Fame', value: 'alltime' }
        )
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send the celebration card (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  async execute(interaction, db) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const period = interaction.options.getString('period') || 'month';
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    const rows = await db.getLeaderboard(guild.id, period, 5);
    const milestones = await db.getMilestoneRoles(guild.id);

    const topUsers = [];
    if (rows && rows.length > 0) {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let userObj = null;
        let memberObj = null;

        try {
          memberObj = await guild.members.fetch(row.user_id).catch(() => null);
          userObj = memberObj ? memberObj.user : await interaction.client.users.fetch(row.user_id).catch(() => null);
        } catch (e) {}

        let roleName = '⭐ Community Helper';
        if (milestones && milestones.length > 0) {
          for (const m of milestones) {
            if (row.points >= m.min_stars) {
              const r = guild.roles.cache.get(m.role_id);
              if (r) roleName = r.name;
            }
          }
        }

        topUsers.push({
          rank: i + 1,
          username: userObj ? userObj.username : `User ${row.user_id}`,
          displayName: memberObj ? memberObj.displayName : (userObj ? userObj.displayName || userObj.username : `User ${row.user_id}`),
          avatarUrl: userObj ? userObj.displayAvatarURL({ extension: 'png', size: 256 }) : null,
          stars: row.points,
          roleName
        });
      }
    }

    const title = period === 'month' ? '🌟 MONTHLY STAR CHAMPIONS' : '👑 ALL-TIME STARS HALL OF FAME';
    const subtitle = period === 'month' ? 'Celebrating this month\'s top community helpers!' : 'Lifetime Community Legend contributors!';

    const imageBuffer = await generateCelebrationCard({
      title,
      subtitle,
      guildName: guild.name,
      guildIconUrl: guild.iconURL({ extension: 'png', size: 128 }),
      topUsers
    });

    const attachment = new AttachmentBuilder(imageBuffer, { name: 'star-celebration-card.png' });

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${guild.name} • Star Celebration`)
      .setDescription(
        `🎉 **Congratulations to our top star helpers!**\n` +
        `Thank you for helping others and shining bright in our community! ✨`
      )
      .setColor(0xFEE75C)
      .setImage('attachment://star-celebration-card.png')
      .setFooter({ text: 'Help someone and use /thank to earn ⭐ Stars!' })
      .setTimestamp();

    await targetChannel.send({ embeds: [embed], files: [attachment] });

    await interaction.editReply({
      content: `✅ Celebration image card has been generated and sent to ${targetChannel.toString()}!`
    });
  }
};
