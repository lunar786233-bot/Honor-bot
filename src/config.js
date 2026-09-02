const path = require('path');
const dotenv = require('dotenv');

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID || '',
  dbPath: path.resolve(__dirname, '../data/bot_data.db'),
  botName: 'Community Stars Bot',
  botVersion: '1.0.0',
  colors: {
    primary: 0x5865F2, // Discord Blurple
    gold: 0xFEE75C,    // Radiant Gold
    success: 0x57F287, // Discord Green
    warning: 0xFEE75C, // Discord Yellow
    error: 0xED4245,   // Discord Red
    info: 0x3BA55D,    // Mint / Green
    dark: 0x2B2D31     // Discord Dark
  }
};
