// src/events/guildMemberAdd.js
import { EmbedBuilder } from 'discord.js';
import { getGuild } from '../models/index.js';
import { applyVars, makeEmbed, Colors } from '../utils/index.js';
import { handleAntiRaid } from '../handlers/antiraid.js';
import { t, getLang } from '../locales/index.js';

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    const cfg  = await getGuild(member.guild.id);
    const lang = getLang(cfg);

    // ── Anti-Raid ─────────────────────────────────────────────────────────────
    if (cfg.antiraid?.enabled) {
      const raided = await handleAntiRaid(member, cfg);
      if (raided) return;
    }

    // ── Auto-Roles ────────────────────────────────────────────────────────────
    const autoroles = cfg.welcome?.autoroles ?? [];
    const delay     = cfg.welcome?.autoroleDelay ?? 0;
    const assign = async () => {
      for (const roleId of autoroles) {
        const role = member.guild.roles.cache.get(roleId);
        if (role && member.manageable) await member.roles.add(role).catch(() => {});
      }
    };
    if (autoroles.length > 0) {
      if (delay > 0) setTimeout(assign, delay * 1000);
      else await assign();
    }

    // ── Logs ──────────────────────────────────────────────────────────────────
    if (cfg.logs?.enabled && cfg.logs.events?.memberJoin && cfg.logs.channelId) {
      const ch = member.guild.channels.cache.get(cfg.logs.channelId);
      if (ch) {
        await ch.send({
          embeds: [makeEmbed({
            color: Colors.success,
            author: { name: t('log_member_joined', lang, { tag: member.user.tag }), iconURL: member.user.displayAvatarURL() },
            fields: [
              { name: 'User',             value: `<@${member.id}>`, inline: true },
              { name: 'Account created',  value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
              { name: 'Member #',         value: String(member.guild.memberCount), inline: true },
            ],
          })],
        }).catch(() => {});
      }
    }

    // ── Welcome Message ───────────────────────────────────────────────────────
    const w = cfg.welcome;
    if (!w?.enabled || !w.channelId) return;
    const ch = member.guild.channels.cache.get(w.channelId);
    if (!ch) return;

    const vars = {
      user:        `<@${member.id}>`,
      username:    member.user.username,
      tag:         member.user.tag,
      server:      member.guild.name,
      memberCount: member.guild.memberCount,
    };

    // If the admin set a custom message, use it; otherwise use the translated default
    const rawMsg = w.message || t('welcome_default_message', lang, vars);
    const text   = applyVars(rawMsg, vars);

    if (w.embedEnabled ?? true) {
      const e = new EmbedBuilder()
        .setColor(w.embedColor ?? '#F5C542')
        .setTitle(applyVars(t('welcome_title', lang, vars), vars))
        .setDescription(text)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: applyVars(t('welcome_footer', lang, vars), vars) })
        .setTimestamp();
      if (w.embedImage) e.setImage(w.embedImage);
      await ch.send({ embeds: [e] }).catch(() => {});
    } else {
      await ch.send(text).catch(() => {});
    }

    // DM
    if (w.dmMessage) await member.send(applyVars(w.dmMessage, vars)).catch(() => {});
  },
};
