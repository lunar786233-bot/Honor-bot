const { Events, ActivityType } = require('discord.js');
const config = require('../config');
const { startScheduler } = require('../services/scheduler');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client, db) {
    const guildCount = client.guilds.cache.size;

    console.log('='.repeat(50));
    console.log(`✅ ${client.user.tag} (${client.user.id}) is ONLINE & READY!`);
    console.log(`🌐 Connected to ${guildCount} server(s)`);
    console.log('='.repeat(50));

    // Rich Presence Activity
    client.user.setActivity('⭐ /help | Community Stars & Justice ⚖️', {
      type: ActivityType.Watching
    });

    // Start background reward scheduler
    startScheduler(client, db);
  }
};
