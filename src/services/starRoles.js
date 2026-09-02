const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Evaluates and grants newly unlocked monthly star milestone roles.
 */
async function checkAndAssignMilestones(guild, member, previousMonthly, newMonthly, db, channel = null) {
  if (!guild || !member) return [];

  const milestones = await db.getMilestoneRoles(guild.id);
  if (!milestones || milestones.length === 0) return [];

  const unlocked = [];

  for (const m of milestones) {
    const minStars = Number(m.min_stars);
    const roleId = m.role_id;

    // Check if the member just crossed the threshold or doesn't have the role
    if (newMonthly >= minStars) {
      const role = await guild.roles.fetch(roleId).catch(() => null);
      if (role && !member.roles.cache.has(role.id)) {
        try {
          await member.roles.add(role, `Reached monthly milestone: ${minStars} Stars`);
          unlocked.push({ role, minStars });
        } catch (err) {
          console.error(`Failed to add milestone role ${role.name} to ${member.user.tag}:`, err);
        }
      }
    }
  }

  // Send celebration embed if new milestone unlocked
  if (unlocked.length > 0 && channel) {
    for (const item of unlocked) {
      const embed = new EmbedBuilder()
        .setTitle('🎉 Monthly Star Milestone Reached!')
        .setDescription(
          `🌟 **Level Up!** ${member.toString()} has reached **${item.minStars} ⭐ Stars** this month!\n\n` +
          `They have been awarded the ${item.role.toString()} role! Congratulations! 🚀`
        )
        .setColor(0xFEE75C)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Keep helping to unlock higher star milestone roles!' })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => null);
    }
  }

  return unlocked;
}

/**
 * Resets/removes all milestone roles from all members at month end.
 */
async function resetGuildMilestoneRoles(guild, db) {
  if (!guild) return 0;
  const milestones = await db.getMilestoneRoles(guild.id);
  if (!milestones || milestones.length === 0) return 0;

  let totalRemoved = 0;

  for (const m of milestones) {
    const role = await guild.roles.fetch(m.role_id).catch(() => null);
    if (role) {
      for (const [memberId, member] of role.members) {
        try {
          await member.roles.remove(role, 'Monthly star cycle reset');
          totalRemoved++;
        } catch (err) {
          console.error(`Failed to remove milestone role from ${member.user.tag}:`, err);
        }
      }
    }
  }

  return totalRemoved;
}

module.exports = {
  checkAndAssignMilestones,
  resetGuildMilestoneRoles
};
