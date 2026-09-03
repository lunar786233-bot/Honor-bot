const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('star-config')
    .setDescription('Configure Community Star reward roles, channels, and anti-abuse settings.')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Configure Star reward role, duration, winners, and dedicated channels.')
        .addRoleOption(opt => opt.setName('role').setDescription('The reward role for top star helpers').setRequired(false))
        .addIntegerOption(opt => opt.setName('duration_days').setDescription('Duration winners keep the role in days (e.g. 30)').setMinValue(1).setMaxValue(365).setRequired(false))
        .addIntegerOption(opt => opt.setName('winners_count').setDescription('How many top helpers receive the role (1-10)').setMinValue(1).setMaxValue(10).setRequired(false))
        .addChannelOption(opt => opt.setName('channel').setDescription('Announcement channel for monthly champions').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addChannelOption(opt => opt.setName('thank_channel').setDescription('Dedicated channel where /thank command is allowed').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addIntegerOption(opt => opt.setName('cooldown_hours').setDescription('Cooldown hours before endorsing the same member again (e.g. 24)').setMinValue(1).setMaxValue(168).setRequired(false))
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
      const thankChannel = interaction.options.getChannel('thank_channel');
      const cooldownHours = interaction.options.getInteger('cooldown_hours');

      await db.setHonorConfig(guild.id, {
        rewardRoleId: role ? role.id : undefined,
        durationDays: durationDays !== null ? durationDays : undefined,
        winnersCount: winnersCount !== null ? winnersCount : undefined,
        channelId: channel ? channel.id : undefined,
        thankChannelId: thankChannel ? thankChannel.id : undefined,
        cooldownHours: cooldownHours !== null ? cooldownHours : undefined
      });

      const cfg = await db.getHonorConfig(guild.id);
      const roleObj = cfg && cfg.reward_role_id ? await guild.roles.fetch(cfg.reward_role_id).catch(() => null) : null;
      const channelObj = cfg && cfg.announcement_channel_id ? await guild.channels.fetch(cfg.announcement_channel_id).catch(() => null) : null;
      const thankChannelObj = cfg && cfg.allowed_thank_channel_id ? await guild.channels.fetch(cfg.allowed_thank_channel_id).catch(() => null) : null;

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Community Star Configuration Updated')
        .setColor(config.colors.success)
        .addFields(
          { name: '🎭 Reward Champion Role', value: roleObj ? roleObj.toString() : 'None', inline: true },
          { name: '⏱️ Role Duration', value: `${cfg ? cfg.reward_duration_days : 30} days`, inline: true },
          { name: '🏅 Top Winners Count', value: `Top ${cfg ? cfg.winners_count : 1}`, inline: true },
          { name: '📢 Announcement Channel', value: channelObj ? channelObj.toString() : 'None', inline: true },
          { name: '📍 Allowed /thank Channel', value: thankChannelObj ? thankChannelObj.toString() : 'All (or Default)', inline: true },
          { name: '⏳ Endorsement Cooldown', value: `${cfg ? cfg.cooldown_hours : 24} hours`, inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } else if (sub === 'view') {
      const cfg = await db.getHonorConfig(guild.id);
      if (!cfg) {
        return interaction.editReply({ content: 'No configuration found. Use `/star-config set` to set up.' });
      }

      const roleObj = cfg.reward_role_id ? await guild.roles.fetch(cfg.reward_role_id).catch(() => null) : null;
      const channelObj = cfg.announcement_channel_id ? await guild.channels.fetch(cfg.announcement_channel_id).catch(() => null) : null;
      const thankChannelObj = cfg.allowed_thank_channel_id ? await guild.channels.fetch(cfg.allowed_thank_channel_id).catch(() => null) : null;

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Community Star System Configuration')
        .setColor(config.colors.primary)
        .addFields(
          { name: '🎭 Reward Champion Role', value: roleObj ? roleObj.toString() : 'None', inline: true },
          { name: '⏱️ Role Duration', value: `${cfg.reward_duration_days || 30} days`, inline: true },
          { name: '🏅 Top Winners Count', value: `Top ${cfg.winners_count || 1}`, inline: true },
          { name: '📢 Announcement Channel', value: channelObj ? channelObj.toString() : 'None', inline: true },
          { name: '📍 Allowed /thank Channel', value: thankChannelObj ? thankChannelObj.toString() : (guild.id === '1544347574109208639' ? '<#1544716619325112410>' : 'All Channels'), inline: true },
          { name: '⏳ Endorsement Cooldown', value: `${cfg.cooldown_hours || 24} hours`, inline: true },
          { name: '⚡ Global Server Cooldown', value: '5 Minutes between any /thank', inline: true },
          { name: '🛡️ Anti-Alt Min Account Age', value: '15 Days', inline: true },
          { name: '🔄 Mutual Trade Lock', value: '24 Hours Reciprocal Lock', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    }
  }
};
