const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('star-roles')
    .setDescription('Configure monthly Star milestone roles starting from 50 Stars.')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set a milestone role for reaching a specific number of monthly Stars.')
        .addIntegerOption(opt => opt.setName('tier').setDescription('Tier number (1 to 10)').setMinValue(1).setMaxValue(10).setRequired(true))
        .addIntegerOption(opt => opt.setName('min_stars').setDescription('Minimum monthly stars required (e.g. 50, 100, 200)').setMinValue(1).setMaxValue(10000).setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('The Discord role to award').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Delete a milestone tier.')
        .addIntegerOption(opt => opt.setName('tier').setDescription('Tier number to delete').setMinValue(1).setMaxValue(10).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View all configured monthly Star milestone roles.')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  async execute(interaction, db) {
    await interaction.deferReply();

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'set') {
      const tier = interaction.options.getInteger('tier');
      const minStars = interaction.options.getInteger('min_stars');
      const role = interaction.options.getRole('role');

      await db.setMilestoneRole(guild.id, tier, minStars, role.id);

      const embed = new EmbedBuilder()
        .setTitle('✅ Star Milestone Role Configured')
        .setDescription(
          `**Tier ${tier}** configured!\n\n` +
          `• **Required Monthly Stars:** **${minStars} ⭐**\n` +
          `• **Awarded Role:** ${role.toString()}\n\n` +
          `Members will automatically receive this role upon hitting **${minStars} ⭐ Stars** this month.`
        )
        .setColor(config.colors.success);

      await interaction.editReply({ embeds: [embed] });
    } else if (sub === 'remove') {
      const tier = interaction.options.getInteger('tier');
      await db.deleteMilestoneRole(guild.id, tier);

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Star Milestone Tier Removed')
        .setDescription(`Tier **${tier}** has been removed.`)
        .setColor(config.colors.warning);

      await interaction.editReply({ embeds: [embed] });
    } else if (sub === 'view') {
      const milestones = await db.getMilestoneRoles(guild.id);

      const embed = new EmbedBuilder()
        .setTitle('🌟 Monthly Star Milestone Roles')
        .setDescription(
          'Members automatically unlock these roles when reaching the required monthly stars. Roles reset at the end of each month!\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        )
        .setColor(0xFEE75C);

      if (!milestones || milestones.length === 0) {
        embed.addFields({
          name: '⚠️ No Milestone Roles Set',
          value: 'Use `/star-roles set tier:1 min_stars:50 role:@Role` to create your first milestone tier!'
        });
      } else {
        for (const m of milestones) {
          const role = await guild.roles.fetch(m.role_id).catch(() => null);
          const roleDisplay = role ? role.toString() : `Role ID \`${m.role_id}\` (Not found)`;
          embed.addFields({
            name: `Tier ${m.tier} — ${m.min_stars} ⭐ Stars`,
            value: `Award: ${roleDisplay}`,
            inline: false
          });
        }
      }

      embed.setFooter({ text: 'Configure with /star-roles set' });
      await interaction.editReply({ embeds: [embed] });
    }
  }
};
