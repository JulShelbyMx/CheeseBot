// src/handlers/automod.js
import { isSpamming, uid, makeEmbed, Colors } from '../utils/index.js';
import { getMember } from '../models/index.js';

/**
 * Runs all automod checks on a message.
 * Returns true if the message was flagged and deleted.
 */
export async function runAutomod(message, cfg) {
  const am = cfg.automod;
  if (!am?.enabled) return false;

  // Skip bots and users with Manage Messages
  if (message.author.bot) return false;
  if (message.member?.permissions.has('ManageMessages')) return false;

  // Skip immune roles / channels
  if (am.immuneRoles?.some(r => message.member?.roles.cache.has(r))) return false;
  if (am.immuneChannels?.includes(message.channel.id)) return false;

  let violation = null;

  // — Anti-Spam
  if (!violation && am.antiSpam?.enabled) {
    if (isSpamming(message.author.id, message.guild.id, am.antiSpam)) {
      violation = { rule: 'Anti-Spam', label: 'spam detected' };
    }
  }

  // — Bad Words
  if (!violation && am.badWords?.enabled && am.badWords.words?.length > 0) {
    const lower = message.content.toLowerCase();
    const found = am.badWords.words.find(w => lower.includes(w.toLowerCase()));
    if (found) violation = { rule: 'Bad Words', label: `forbidden word: \`${found}\`` };
  }

  // — Anti-Links
  if (!violation && am.antiLinks?.enabled) {
    const urlPattern = /https?:\/\/\S+/gi;
    const urls = message.content.match(urlPattern) || [];
    const whitelist = am.antiLinks.whitelist || [];
    const blocked = urls.some(url => !whitelist.some(w => url.includes(w)));
    if (blocked) violation = { rule: 'Anti-Links', label: 'unauthorised link' };
  }

  // — Anti-Invites
  if (!violation && am.antiInvites?.enabled) {
    if (/discord\.gg\/\S+/i.test(message.content)) {
      violation = { rule: 'Anti-Invites', label: 'Discord invite link' };
    }
  }

  // — Anti-Caps
  if (!violation && am.antiCaps?.enabled && message.content.length > 10) {
    const letters = message.content.replace(/[^a-zA-Z]/g, '');
    if (letters.length > 5) {
      const capsPct = (message.content.replace(/[^A-Z]/g, '').length / letters.length) * 100;
      if (capsPct >= (am.antiCaps.threshold ?? 70)) {
        violation = { rule: 'Anti-Caps', label: `${Math.round(capsPct)}% caps` };
      }
    }
  }

  if (!violation) return false;

  // Delete the message
  await message.delete().catch(() => {});

  // Warn message in channel (self-destructs after 6s)
  const { t, getLang } = await import('../locales/index.js');
  const lang = getLang(cfg);
  const warnMsg = await message.channel.send({
    embeds: [makeEmbed({
      color: Colors.warn,
      description: t('automod_violation', lang, { user: message.author.toString(), rule: violation.rule, detail: violation.label }),
      timestamp: false,
    })],
  }).catch(() => null);
  if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 6000);

  // Apply punishment
  const punishment = am.punishment ?? 'warn';
  const reason = `[AutoMod] ${violation.rule}: ${violation.label}`;

  if (punishment === 'warn') {
    const data = await getMember(message.author.id, message.guild.id);
    data.warns.push({ id: uid(), reason, moderatorId: message.client.user.id });
    await data.save();
  }
  if (punishment === 'mute') {
    const dur = (am.muteDuration ?? 10) * 60 * 1000;
    await message.member.timeout(dur, reason).catch(() => {});
  }
  if (punishment === 'kick') {
    await message.member.kick(reason).catch(() => {});
  }
  if (punishment === 'ban') {
    await message.guild.bans.create(message.author.id, { reason }).catch(() => {});
  }

  // Log
  if (am.logChannelId) {
    const { t: tLog, getLang: getL } = await import('../locales/index.js');
    const ch = message.guild.channels.cache.get(am.logChannelId);
    if (ch) {
      await ch.send({
        embeds: [makeEmbed({
          color: Colors.warn, title: tLog('automod_log_title', getL(cfg)),
          fields: [
            { name: 'User',    value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
            { name: 'Rule',    value: violation.rule,     inline: true },
            { name: 'Action',  value: punishment,         inline: true },
            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
            { name: 'Content', value: message.content?.slice(0, 500) || '*empty*' },
          ],
        })],
      }).catch(() => {});
    }
  }

  return true;
}
