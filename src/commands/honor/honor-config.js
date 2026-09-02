const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('star-config')
    .setDescription('Configure Community Star reward roles and monthly cycle settings.')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Configure Star reward role, duration, winners, and channel.')
        .addRoleOption(opt => opt.setName('role').setDescription('The reward role for top star helpers').setRequired(false))
        .addIntegerOption(opt => opt.setName('duration_days').setDescription('Duration winners keep the role in days (e.g. 30)').setMinValue(1).setMaxValue(365).setRequired(false))
        .addIntegerOption(opt => opt.setName('winners_count').setDescription('How many top helpers receive the role (1-10)').setMinValue(1).setMaxValue(10).setRequired(false))
        .addChannelOption(opt => opt.setName('channel').setDescription('Announcement channel for monthly champions').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addIntegerOption(opt => opt.setName('cooldown_hours').setDescription('Cooldown hours before endorsing the same member again').setMinValue(1).setMaxValue(72).setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current Community Star system configuration.')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  async execute(interaction, db) {
    await interaction.deferReply();

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'set') {
      const role = interaction.options.getRole('role');
      const durationDays = interaction.options.getInteger('duration_days');
      const winnersCount = interaction.options.getInteger('winners_count');
      const channel = interaction.options.getChannel('channel');
      const cooldownHours = interaction.options.getInteger('cooldown_hours');

      await db.setHonorConfig(guild.id, {
        rewardRoleId: role ? role.id : undefined,
        durationDays: durationDays !== null ? durationDays : undefined,
        winnersCount: winnersCount !== null ? winnersCount : undefined,
        channelId: channel ? channel.id : undefined,
        cooldownHours: cooldownHours !== null ? cooldownHours : undefined
      });

      const cfg = await db.getHonorConfig(guild.id);
      const roleObj = cfg && cfg.reward_role_id ? await guild.roles.fetch(cfg.reward_role_id).catch(() => null) : null;
      const channelObj = cfg && cfg.announcement_channel_id ? await guild.channels.fetch(cfg.announcement_channel_id).catch(() => null) : null;

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Community Star Configuration Updated')
        .setColor(config.colors.success)
        .addFields(
          { name: '🎭 Reward Champion Role', value: roleObj ? roleObj.toString() : 'None', inline: true },
          { name: '⏱️ Role Duration', value: `${cfg ? cfg.reward_duration_days : 30} days`, inline: true },
          { name: '🏅 Top Winners Count', value: `Top ${cfg ? cfg.winners_count : 1}`, inline: true },
          { name: '📢 Announcement Channel', value: channelObj ? channelObj.toString() : 'None', inline: true },
          { name: '⏳ Endorsement Cooldown', value: `${cfg ? cfg.cooldown_hours : 6} hours`, inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } else if (sub === 'view') {
      const cfg = await db.getHonorConfig(guild.id);
      if (!cfg) {
        return interaction.editReply({ content: 'No configuration found. Use `/star-config set` to set up.' });
      }

      const roleObj = cfg.reward_role_id ? await guild.roles.fetch(cfg.reward_role_id).catch(() => null) : null;
      const channelObj = cfg.announcement_channel_id ? await guild.channels.fetch(cfg.announcement_channel_id).catch(() => null) : null;

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Current Community Star Configuration')
        .setColor(config.colors.primary)
        .addFields(
          { name: '🎭 Reward Champion Role', value: roleObj ? roleObj.toString() : 'Not configured', inline: true },
          { name: '⏱️ Role Duration', value: `${cfg.reward_duration_days} days`, inline: true },
          { name: '🏅 Top Winners Count', value: `Top ${cfg.winners_count}`, inline: true },
          { name: '📢 Announcement Channel', value: channelObj ? channelObj.toString() : 'Not configured', inline: true },
          { name: '⏳ Endorsement Cooldown', value: `${cfg.cooldown_hours} hours`, inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    }
  }
};
