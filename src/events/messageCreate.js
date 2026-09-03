const { Events, PermissionFlagsBits } = require('discord.js');

const DEFAULT_THANK_CHANNEL_ID = '1545036041583595562';

module.exports = {
  name: Events.MessageCreate,
  async execute(message, db) {
    // Ignore bot messages, system messages, and DMs
    if (!message.guild || message.author.bot) return;

    if (!db) return;

    try {
      const cfg = await db.getHonorConfig(message.guild.id).catch(() => null);
      const thankChannelId = (cfg && cfg.allowed_thank_channel_id) ? cfg.allowed_thank_channel_id : DEFAULT_THANK_CHANNEL_ID;

      // If message is sent in the thank channel by a non-bot user
      if (message.channelId === thankChannelId) {
        // Allow server administrators to type announcements if needed, otherwise delete all chat
        const isStaff = message.member && message.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) {
          // Delete user message to keep the channel 100% clean
          await message.delete().catch(() => null);

          // Send a temporary self-deleting warning
          const warning = await message.channel.send({
            content: `⚠️ ${message.author.toString()}, this channel is strictly reserved for the **\`/thank\`** command only! Chatting and text messages are not allowed here.`
          }).catch(() => null);

          if (warning) {
            setTimeout(() => {
              warning.delete().catch(() => null);
            }, 4000);
          }
        }
      }
    } catch (err) {
      console.error('Error handling messageCreate in thank channel:', err);
    }
  }
};
