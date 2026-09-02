/**
 * Dynamic Milestone Roles, Progress Bars & UI Helpers.
 */

async function getMemberMilestoneInfo(guild, monthlyStars, db) {
  const stars = Number(monthlyStars) || 0;
  const milestones = await db.getMilestoneRoles(guild.id); // sorted ASC by min_stars

  if (!milestones || milestones.length === 0) {
    return {
      currentRole: null,
      currentRoleName: 'Member',
      nextRole: null,
      nextRoleName: null,
      minStars: 0,
      nextStars: 50,
      progressBar: '`[▱▱▱▱▱▱▱▱]`'
    };
  }

  let currentTier = null;
  let nextTier = null;

  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    if (stars >= m.min_stars) {
      currentTier = m;
    } else {
      nextTier = m;
      break;
    }
  }

  let currentRole = null;
  let currentRoleName = '🌱 Member';
  if (currentTier) {
    currentRole = await guild.roles.fetch(currentTier.role_id).catch(() => null);
    currentRoleName = currentRole ? currentRole.name : `Tier ${currentTier.tier} (${currentTier.min_stars}⭐)`;
  }

  let nextRole = null;
  let nextRoleName = null;
  let nextStars = null;
  let minStars = currentTier ? currentTier.min_stars : 0;

  if (nextTier) {
    nextRole = await guild.roles.fetch(nextTier.role_id).catch(() => null);
    nextRoleName = nextRole ? nextRole.name : `Tier ${nextTier.tier}`;
    nextStars = nextTier.min_stars;
  }

  // Calculate Progress Bar (8 segments)
  let progressBar = '`[▰▰▰▰▰▰▰▰]` **MAX TIER REACHED** 👑';
  if (nextStars !== null) {
    const range = nextStars - minStars;
    const currentProgress = stars - minStars;
    const ratio = Math.max(0, Math.min(1, currentProgress / range));
    const filled = Math.round(ratio * 8);
    const empty = 8 - filled;
    progressBar = `\`[${'▰'.repeat(filled)}${'▱'.repeat(empty)}]\` **${stars}/${nextStars} ⭐**`;
  }

  return {
    currentRole,
    currentRoleName,
    nextRole,
    nextRoleName,
    minStars,
    nextStars,
    progressBar,
    starsNeeded: nextStars !== null ? Math.max(0, nextStars - stars) : 0
  };
}

module.exports = {
  getMemberMilestoneInfo
};
