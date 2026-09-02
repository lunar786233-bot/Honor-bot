const path = require('path');
const fs = require('fs');
const assert = require('assert');

// 1. Test Command Files Structure
console.log('Testing command files structure and loading...');
const foldersPath = path.join(__dirname, 'src/commands');
const commandFolders = fs.readdirSync(foldersPath);
let totalCommands = 0;

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    assert(command.data, `Command ${file} must have a "data" property.`);
    assert(typeof command.execute === 'function', `Command ${file} must have an "execute" function.`);
    totalCommands++;
    console.log(`  ✓ Loaded command: /${command.data.name}`);
  }
}
console.log(`✅ Loaded and verified all ${totalCommands} Star commands.`);

// 2. Test Canvas Image Card Generator
console.log('\nTesting Canvas Image Card Generation...');
const { generateCelebrationCard } = require('./src/utils/imageGenerator');

(async () => {
  const buffer = await generateCelebrationCard({
    title: '🌟 TEST STAR LEADERBOARD',
    subtitle: 'Testing automated image card generation',
    guildName: 'Test Discord Server',
    topUsers: [
      { rank: 1, username: 'Hiro', displayName: 'Hiro', stars: 55, roleName: '🌟・Star Helper' },
      { rank: 2, username: 'UserTwo', displayName: 'Takila', stars: 30, roleName: 'Member' },
      { rank: 3, username: 'UserThree', displayName: 'Inosuke', stars: 15, roleName: 'Member' }
    ]
  });

  assert(buffer instanceof Buffer, 'Generated card must return a Buffer');
  assert(buffer.length > 5000, 'Image buffer must have valid PNG byte size');
  console.log(`✅ Image card rendered successfully! Size: ${(buffer.length / 1024).toFixed(1)} KB.`);

  console.log('\n🎉 ALL CARD GENERATION & STAR TESTS PASSED (100% OK)!');
})();
