const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const { sendMilestoneRoleAuditAlert } = require('./adminAlerts');

/**
 * Synchronizes a member's milestone roles based on their exact monthly star count.
 * Automatically grants newly unlocked roles AND revokes roles if stars drop below threshold.
 */
async function syncMemberMilestoneRoles(guild, member, currentMonthly, db, channel = null) {
  if (!guild || !member) return { added: [], removed: [] };

  const milestones = await db.getMilestoneRoles(guild.id);
  if (!milestones || milestones.length === 0) return { added: [], removed: [] };

  const added = [];
  const removed = [];

  for (const m of milestones) {
    const minStars = Number(m.min_stars);
    const roleId = m.role_id;

    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) continue;

    const hasRole = member.roles.cache.has(role.id);

    if (currentMonthly >= minStars) {
      // Eligible for this milestone role
      if (!hasRole) {
        try {
          await member.roles.add(role, `Reached monthly milestone: ${minStars} Stars`);
          added.push({ role, minStars });
        } catch (err) {
          console.error(`Failed to add milestone role ${role.name} to ${member.user.tag}:`, err);
        }
      }
    } else {
      // Stars dropped below threshold -> Revoke role
      if (hasRole) {
        try {
          await member.roles.remove(role, `Stars decreased below milestone threshold: ${minStars} Stars`);
          removed.push({ role, minStars });
        } catch (err) {
          console.error(`Failed to remove milestone role ${role.name} from ${member.user.tag}:`, err);
        }
      }
    }
  }

  // Handle milestone unlock events
  if (added.length > 0) {
    // 1. Send public celebration in channel
    if (channel) {
      for (const item of added) {
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

    // 2. Fetch full star receipt logs and send audit report to Admin Alert Channel (1318164139788468227)
    const starLogs = await db.getMonthlyUserThankLogs(guild.id, member.id).catch(() => []);
    for (const item of added) {
      await sendMilestoneRoleAuditAlert(
        guild.client,
        guild,
        member,
        item.role,
        item.minStars,
        currentMonthly,
        starLogs
      ).catch(err => console.error('Failed to send milestone audit log:', err));
    }
  }

  return { added, removed };
}

/**
 * Backward compatibility alias for checkAndAssignMilestones
 */
async function checkAndAssignMilestones(guild, member, previousMonthly, newMonthly, db, channel = null) {
  const result = await syncMemberMilestoneRoles(guild, member, newMonthly, db, channel);
  return result.added;
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
  syncMemberMilestoneRoles,
  checkAndAssignMilestones,
  resetGuildMilestoneRoles
};
