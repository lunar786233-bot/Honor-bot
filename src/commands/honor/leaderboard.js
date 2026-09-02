const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const config = require('../../config');

const PAGE_SIZE = 8;
const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

async function buildLeaderboardPayload(guild, db, scope = 'month', page = 1) {
  const allRows = await db.getLeaderboard(guild.id, scope, 100);
  const totalItems = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageRows = allRows.slice(startIdx, startIdx + PAGE_SIZE);

  const milestones = await db.getMilestoneRoles(guild.id);

  const title = scope === 'month' ? '🌟 Monthly Community Stars Leaderboard' : '👑 All-Time Stars Hall of Fame';
  const subtitle = scope === 'month'
    ? '✨ Top community helpers earning ⭐ Stars this month!\n'
    : '💫 Total lifetime ⭐ Stars earned across all cycles!\n';

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(scope === 'month' ? config.colors.primary : 0xFEE75C)
    .setTimestamp();

  if (pageRows.length === 0) {
    embed.setDescription(
      subtitle +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '✨ **No Stars Awarded Yet for this period!**\n' +
      'Help fellow members and type `/thank @member reason` to give them their first ⭐ Star!\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );
  } else {
    const lines = pageRows.map((row, idx) => {
      const globalRank = startIdx + idx + 1;
      const medal = MEDALS[globalRank - 1] || `\`#${globalRank}\``;
      const starIcon = globalRank === 1 ? '🌟' : (globalRank <= 3 ? '✨' : '⭐');

      // Determine achieved milestone role
      let achievedRole = null;
      if (milestones && milestones.length > 0) {
        for (const m of milestones) {
          if (row.points >= m.min_stars) {
            achievedRole = m;
          }
        }
      }

      const roleBadge = achievedRole ? ` • <@&${achievedRole.role_id}>` : '';

      return (
        `${medal} <@${row.user_id}>\n` +
        `   ${starIcon} **${row.points} Stars**${roleBadge}`
      );
    });

    embed.setDescription(
      subtitle +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      lines.join('\n\n') +
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );
  }

  embed.setFooter({
    text: `Page ${currentPage} of ${totalPages} • Total Helpers: ${totalItems} • Click buttons below to switch tabs!`,
    iconURL: guild.iconURL({ dynamic: true }) || undefined
  });

  // Interactive Buttons Row
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`lb_tab_month_${currentPage}`)
      .setLabel('📅 Monthly Stars')
      .setStyle(scope === 'month' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(scope === 'month'),
    new ButtonBuilder()
      .setCustomId(`lb_tab_alltime_${currentPage}`)
      .setLabel('👑 All-Time Stars')
      .setStyle(scope === 'alltime' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(scope === 'alltime'),
    new ButtonBuilder()
      .setCustomId(`lb_prev_${scope}_${currentPage - 1}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`lb_next_${scope}_${currentPage + 1}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage >= totalPages),
    new ButtonBuilder()
      .setCustomId(`lb_refresh_${scope}_${currentPage}`)
      .setLabel('🔄')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row, totalPages, currentPage };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display server Community Stars leaderboard with interactive buttons.')
    .addStringOption(option =>
      option.setName('view')
        .setDescription('Default view to open')
        .setRequired(false)
        .addChoices(
          { name: '📅 Monthly Stars', value: 'month' },
          { name: '👑 All-Time Stars', value: 'alltime' }
        )
    )
    .setDMPermission(false),
  async execute(interaction, db) {
    const initialScope = interaction.options.getString('view') || 'month';
    let currentScope = initialScope;
    let currentPage = 1;

    const { embed, row } = await buildLeaderboardPayload(interaction.guild, db, currentScope, currentPage);

    const reply = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (i) => {
      const customId = i.customId;

      if (customId.startsWith('lb_tab_month')) {
        currentScope = 'month';
        currentPage = 1;
      } else if (customId.startsWith('lb_tab_alltime')) {
        currentScope = 'alltime';
        currentPage = 1;
      } else if (customId.startsWith('lb_prev')) {
        currentPage = Math.max(1, currentPage - 1);
      } else if (customId.startsWith('lb_next')) {
        currentPage = currentPage + 1;
      } else if (customId.startsWith('lb_refresh')) {
        // Refresh view
      }

      const updated = await buildLeaderboardPayload(i.guild, db, currentScope, currentPage);
      await i.update({
        embeds: [updated.embed],
        components: [updated.row]
      }).catch(() => null);
    });

    collector.on('end', async () => {
      const disabledRow = ActionRowBuilder.from(row);
      disabledRow.components.forEach(btn => btn.setDisabled(true));
      await interaction.editReply({ components: [disabledRow] }).catch(() => null);
    });
  }
};
