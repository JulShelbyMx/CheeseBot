// src/events/messageCreate.js
import { getGuild } from '../models/index.js';
import { runAutomod } from '../handlers/automod.js';

export default {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const cfg = await getGuild(message.guild.id);

    // ─── AutoMod ─────────────────────────────────────────────────────────────
    if (cfg.automod?.enabled) {
      const blocked = await runAutomod(message, cfg);
      if (blocked) return;
    }

    // ─── Prefix Commands (only !clear in this bot) ────────────────────────────
    const prefix = cfg.prefix ?? '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const name = args.shift().toLowerCase();

    const cmd = message.client.prefixCmds.get(name);
    if (!cmd?.prefixExecute) return;

    try {
      await cmd.prefixExecute(message, args, cfg);
    } catch (e) {
      console.error(`[PREFIX ERROR] ${name}:`, e);
      message.reply('❌ An error occurred.').catch(() => {});
    }
  },
};
