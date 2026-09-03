const { Events } = require('discord.js');

const DEFAULT_THANK_CHANNEL_ID = '1545036041583595562';

module.exports = {
  name: Events.MessageCreate,
  async execute(message, db) {
    if (!message.guild) return;

    // Allow our own bot's messages (embeds / responses)
    if (message.author.id === message.client.user.id) return;

    if (!db) return;

    try {
      const cfg = await db.getHonorConfig(message.guild.id).catch(() => null);
      const thankChannelId = (cfg && cfg.allowed_thank_channel_id) ? cfg.allowed_thank_channel_id : DEFAULT_THANK_CHANNEL_ID;

      // If ANY message is sent in the thank channel (by users, admins, or other bots)
      if (message.channelId === thankChannelId) {
        // Delete ALL messages (user chatter, admin tests, other bot prefix responses)
        await message.delete().catch(() => null);

        // If it was a human user, send a quick self-deleting warning
        if (!message.author.bot) {
          const warning = await message.channel.send({
            content: `⚠️ ${message.author.toString()}, strictly **only the \`/thank\` command** is allowed in this channel! All chatting, text, and other bot commands are auto-deleted.`
          }).catch(() => null);

          if (warning) {
            setTimeout(() => {
              warning.delete().catch(() => null);
            }, 3500);
          }
        }
      }
    } catch (err) {
      console.error('Error handling messageCreate in thank channel:', err);
    }
  }
};
