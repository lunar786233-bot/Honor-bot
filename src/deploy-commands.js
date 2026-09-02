const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      console.warn(`[WARNING] The command at ${filePath} is missing required "data" or "execute" property.`);
    }
  }
}

if (!config.token) {
  console.error('❌ DISCORD_TOKEN is missing in .env!');
  process.exit(1);
}

if (!config.clientId) {
  console.error('❌ CLIENT_ID is missing in .env!');
  process.exit(1);
}

const rest = new REST().setToken(config.token);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands across authorized guilds...`);

    const targetGuilds = config.allowedGuilds || ['1544347574109208639', '1214910672719319060'];
    for (const gid of targetGuilds) {
      try {
        const data = await rest.put(
          Routes.applicationGuildCommands(config.clientId, gid),
          { body: commands }
        );
        console.log(`✅ Successfully deployed ${data.length} application (/) commands to guild ID ${gid}.`);
      } catch (err) {
        console.error(`❌ Failed deploying to guild ${gid}:`, err.message);
      }
    }
  } catch (error) {
    console.error('Error deploying slash commands:', error);
  }
})();
