// src/utils/index.js
import ms from 'ms';
import { EmbedBuilder } from 'discord.js';

// ─── Colors ────────────────────────────────────────────────────────────────────
export const Colors = {
  brand:   '#F5C542',   // CheeseBot yellow
  success: '#57F287',
  error:   '#ED4245',
  warn:    '#FEE75C',
  info:    '#5865F2',
  muted:   '#4F545C',
};

// ─── Embeds ────────────────────────────────────────────────────────────────────
export function makeEmbed({ color = Colors.brand, title, description, fields, footer, thumbnail, image, author, timestamp = true } = {}) {
  const e = new EmbedBuilder().setColor(color);
  if (timestamp) e.setTimestamp();
  if (title)       e.setTitle(title);
  if (description) e.setDescription(description);
  if (fields)      e.addFields(fields);
  if (footer)      e.setFooter(typeof footer === 'string' ? { text: footer } : footer);
  if (thumbnail)   e.setThumbnail(thumbnail);
  if (image)       e.setImage(image);
  if (author)      e.setAuthor(typeof author === 'string' ? { name: author } : author);
  return e;
}

export const ok  = (text)     => makeEmbed({ color: Colors.success, description: `✅  ${text}` });
export const err = (text)     => makeEmbed({ color: Colors.error,   description: `❌  ${text}` });
export const warn = (text)    => makeEmbed({ color: Colors.warn,    description: `⚠️  ${text}` });
export const info = (opts)    => makeEmbed({ color: Colors.info, ...opts });
export const brand = (opts)   => makeEmbed({ color: Colors.brand, ...opts });

// ─── Reply helpers ─────────────────────────────────────────────────────────────
export async function reply(interaction, embedOrText, ephemeral = true) {
  const payload = typeof embedOrText === 'string'
    ? { content: embedOrText, ephemeral }
    : { embeds: [embedOrText], ephemeral };

  if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
  return interaction.reply(payload);
}

// ─── Duration ──────────────────────────────────────────────────────────────────
export function parseDuration(str) {
  if (!str) return null;
  const v = ms(str);
  return Number.isNaN(v) ? null : v;
}

export function humanDuration(ms_val) {
  if (!ms_val) return 'Permanent';
  const s = Math.floor(ms_val / 1000);
  if (s < 60)   return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// ─── Permission check ──────────────────────────────────────────────────────────
/**
 * Returns an error string if the action is not allowed, null if it's fine.
 */
export function modCheckError(interaction, target) {
  if (!target?.id) return 'Member not found.';
  if (target.id === interaction.user.id) return 'You cannot moderate yourself.';
  if (target.id === interaction.guild.ownerId) return 'You cannot moderate the server owner.';
  const me = interaction.guild.members.me;
  if (target.roles?.highest.position >= me.roles.highest.position)
    return 'I cannot moderate this member — their role is higher than or equal to mine.';
  if (interaction.user.id !== interaction.guild.ownerId &&
      interaction.member.roles.highest.position <= target.roles?.highest.position)
    return 'You cannot moderate a member with an equal or higher role than yours.';
  return null;
}

// ─── Spam cache ────────────────────────────────────────────────────────────────
export const spamCache = new Map();

export function isSpamming(userId, guildId, config) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const data = spamCache.get(key) ?? { count: 0, start: now };

  if (now - data.start > config.interval) {
    spamCache.set(key, { count: 1, start: now });
    return false;
  }
  data.count++;
  spamCache.set(key, data);
  return data.count >= config.threshold;
}

// ─── Progress bar ──────────────────────────────────────────────────────────────
export function progressBar(current, total, len = 12) {
  const pct = Math.min(current / total, 1);
  const fill = Math.round(pct * len);
  return `${'█'.repeat(fill)}${'░'.repeat(len - fill)} ${Math.round(pct * 100)}%`;
}

// ─── Random ID ─────────────────────────────────────────────────────────────────
export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Replace template variables ───────────────────────────────────────────────
export function applyVars(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
