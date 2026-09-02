const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const channel = member.guild.systemChannel;
    if (channel && channel.permissionsFor(member.guild.members.me).has('SendMessages')) {
      const embed = new EmbedBuilder()
        .setTitle(`👋 Welcome to ${member.guild.name}!`)
        .setDescription(`Welcome ${member.toString()}! We're thrilled to have you here.\nUse \`/help\` to explore available bot commands.`)
        .setColor(config.colors.success)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Member #${member.guild.memberCount}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => null);
    }
  }
};
