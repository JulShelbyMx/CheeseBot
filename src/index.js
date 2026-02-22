// src/index.js
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection, ActivityType } from 'discord.js';
import mongoose from 'mongoose';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import cron from 'node-cron';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Client ────────────────────────────────────────────────────────────────────
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User,
  ],
});

client.commands = new Collection();   // slash commands
client.prefixCmds = new Collection(); // prefix-only commands

// ─── Auto-load commands ────────────────────────────────────────────────────────
async function loadCommands() {
  const folders = readdirSync(join(__dirname, 'commands'));
  for (const folder of folders) {
    const files = readdirSync(join(__dirname, 'commands', folder)).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const mod = await import(pathToFileURL(join(__dirname, 'commands', folder, file)).href);

      // Named exports (e.g. suggest, giveaway from the same file)
      for (const key of Object.keys(mod)) {
        const cmd = mod[key];
        if (!cmd?.data) continue;
        client.commands.set(cmd.data.name, cmd);
        if (cmd.prefixExecute) client.prefixCmds.set(cmd.data.name, cmd);
      }
    }
  }
  console.log(`✅ ${client.commands.size} slash commands loaded.`);
}

// ─── Auto-load events ──────────────────────────────────────────────────────────
async function loadEvents() {
  const files = readdirSync(join(__dirname, 'events')).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const mod = await import(pathToFileURL(join(__dirname, 'events', file)).href);

    // A file can export an array of event objects or a single default
    const events = Array.isArray(mod.default) ? mod.default : [mod.default].filter(Boolean);
    for (const ev of events) {
      if (!ev?.name) continue;
      if (ev.once) client.once(ev.name, (...args) => ev.execute(...args, client));
      else         client.on(ev.name,   (...args) => ev.execute(...args, client));
    }
  }
  console.log(`✅ ${files.length} event files loaded.`);
}

// ─── Scheduler ─────────────────────────────────────────────────────────────────
async function startScheduler() {
  const { checkTempActions, checkGiveaways } = await import('./handlers/scheduler.js');

  // Every 30 seconds
  cron.schedule('*/30 * * * * *', () => checkTempActions(client));
  // Every minute
  cron.schedule('* * * * *', () => checkGiveaways(client));
  console.log('✅ Scheduler started.');
}

// ─── Boot ──────────────────────────────────────────────────────────────────────
async function main() {
  // Database
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected.');
  } catch (e) {
    console.error('❌ MongoDB connection failed:', e.message);
    console.error('   → Check your MONGODB_URI in the .env file');
    process.exit(1);
  }

  await loadCommands();
  await loadEvents();
  await startScheduler();

  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (e) {
    console.error('❌ Discord login failed:', e.message);
    console.error('   → Check your DISCORD_TOKEN in the .env file');
    process.exit(1);
  }
}

main();
