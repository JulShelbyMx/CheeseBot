// src/handlers/antiraid.js
import { makeEmbed, Colors } from '../utils/index.js';
import { ChannelType } from 'discord.js';

const joinLog = new Map(); // guildId → { count, start }

export async function handleAntiRaid(member, cfg) {
  const ar = cfg.antiraid;
  if (!ar?.enabled) return false;

  const gId = member.guild.id;
  const now = Date.now();
  const data = joinLog.get(gId) ?? { count: 0, start: now };

  if (now - data.start > ar.interval) {
    joinLog.set(gId, { count: 1, start: now });
    return false;
  }

  data.count++;
  joinLog.set(gId, data);

  if (data.count < ar.threshold) return false;

  // ─── RAID DETECTED ───────────────────────────────────────────────────────────
  const logCh = ar.logChannelId ? member.guild.channels.cache.get(ar.logChannelId) : null;
  const raidEmbed = makeEmbed({
    color: Colors.error,
    title: '🚨 Anti-Raid Triggered',
    description: `**${data.count}** members joined in under ${ar.interval / 1000}s.\n**Action:** ${ar.action.toUpperCase()}`,
  });

  if (logCh) await logCh.send({ embeds: [raidEmbed] }).catch(() => {});

  switch (ar.action) {
    case 'kick':
      await member.kick('[CheeseBot] Anti-Raid').catch(() => {});
      break;
    case 'ban':
      await member.ban({ reason: '[CheeseBot] Anti-Raid' }).catch(() => {});
      break;
    case 'lockdown': {
      await member.kick('[CheeseBot] Anti-Raid lockdown').catch(() => {});
      const textChannels = member.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
      for (const [, ch] of textChannels) {
        await ch.permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: false }).catch(() => {});
      }
      if (logCh) await logCh.send('🔒 Server locked down. Will auto-unlock in 10 minutes.').catch(() => {});
      // Auto-unlock after 10 min
      setTimeout(async () => {
        for (const [, ch] of textChannels) {
          await ch.permissionOverwrites.edit(member.guild.roles.everyone, { SendMessages: null }).catch(() => {});
        }
        if (logCh) await logCh.send('🔓 Lockdown lifted.').catch(() => {});
      }, 10 * 60 * 1000);
      break;
    }
  }

  return true;
}
