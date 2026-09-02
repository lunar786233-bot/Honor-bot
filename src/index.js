const nodeCrypto = require('crypto');
if (!globalThis.crypto) {
  globalThis.crypto = nodeCrypto.webcrypto || nodeCrypto;
}
if (!global.crypto) {
  global.crypto = nodeCrypto;
}

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const { getDatabaseInstance } = require('./database');

// Lightweight Keep-Alive HTTP server for Railway & Cloud hosting platforms
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('World Government Discord Bot is 24/7 ONLINE & HEALTHY!\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${port} in use, continuing bot startup.`);
  } else {
    console.error('HTTP server error:', err);
  }
});

server.listen(port, () => {
  console.log(`🌐 Keep-Alive HTTP server listening on port ${port}`);
});

async function bootstrap() {
  // Check token
  if (!config.token || config.token === 'your_bot_token_here') {
    console.log('\n' + '='.repeat(60));
    console.log('❌ MISSING DISCORD BOT TOKEN!');
    console.log('Please set DISCORD_TOKEN in environment variables.');
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  }

  // Initialize Client with Intents
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions
    ]
  });

  // Initialize Database (MongoDB Atlas if MONGODB_URI set, else SQLite)
  const db = await getDatabaseInstance();
  client.db = db;
  client.commands = new Collection();

  // Load Commands Dynamically
  const foldersPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[Command] Loaded /${command.data.name}`);
      } else {
        console.warn(`[WARNING] Command at ${filePath} missing "data" or "execute".`);
      }
    }
  }

  // Load Events Dynamically
  const eventsPath = path.join(__dirname, 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, db));
    } else {
      client.on(event.name, (...args) => event.execute(...args, db));
    }
    console.log(`[Event] Registered listener: ${event.name}`);
  }

  // Login
  await client.login(config.token).catch(err => {
    console.error('Failed to log in to Discord:', err);
  });
}

bootstrap().catch(err => {
  console.error('Fatal error starting bot:', err);
});
