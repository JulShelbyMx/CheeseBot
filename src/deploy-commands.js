// src/deploy-commands.js
// Run this once with: npm run deploy
// It registers all slash commands with Discord.

import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const commands = [];

const folders = readdirSync(join(__dirname, 'commands'));
for (const folder of folders) {
  const files = readdirSync(join(__dirname, 'commands', folder)).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const mod = await import(pathToFileURL(join(__dirname, 'commands', folder, file)).href);
    for (const key of Object.keys(mod)) {
      if (mod[key]?.data) commands.push(mod[key].data.toJSON());
    }
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

console.log(`\n📤 Registering ${commands.length} slash commands...\n`);

try {
  if (process.env.GUILD_ID) {
    // Guild deploy — appears INSTANTLY (great for testing)
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log(`✅ ${commands.length} commands deployed to your dev server (instant).`);
    console.log('   → Tip: remove GUILD_ID from .env for global deploy when ready.\n');
  } else {
    // Global deploy — can take up to 1 hour to appear everywhere
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log(`✅ ${commands.length} commands deployed globally.`);
    console.log('   → Note: global commands can take up to 1 hour to appear.\n');
  }
} catch (e) {
  console.error('❌ Deploy failed:', e.message);
  if (e.message.includes('401')) {
    console.error('   → Your DISCORD_TOKEN or CLIENT_ID is wrong. Check your .env file.');
  }
}
