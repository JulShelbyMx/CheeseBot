// src/events/memberAndLogs.js
import { getGuild } from '../models/index.js';
import { applyVars, makeEmbed, Colors } from '../utils/index.js';

// ─── Member Leave ──────────────────────────────────────────────────────────────
const memberLeave = {
  name: 'guildMemberRemove',
  async execute(member) {
    const cfg = await getGuild(member.guild.id);

    // Logs
    if (cfg.logs?.enabled && cfg.logs.events?.memberLeave && cfg.logs.channelId) {
      const ch = member.guild.channels.cache.get(cfg.logs.channelId);
      if (ch) {
        await ch.send({
          embeds: [makeEmbed({
            color: Colors.error,
            author: { name: `${member.user.tag} left`, iconURL: member.user.displayAvatarURL() },
            fields: [
              { name: 'User', value: `<@${member.id}>`, inline: true },
              { name: 'Joined', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
            ],
          })],
        }).catch(() => {});
      }
    }

    // Goodbye message
    const g = cfg.goodbye;
    if (!g?.enabled || !g.channelId) return;
    const ch = member.guild.channels.cache.get(g.channelId);
    if (!ch) return;

    const vars = { user: member.user.username, username: member.user.username, tag: member.user.tag, server: member.guild.name, memberCount: member.guild.memberCount };
    const text = applyVars(g.message, vars);

    if (g.embedEnabled) {
      await ch.send({
        embeds: [makeEmbed({ color: g.embedColor ?? '#ED4245', description: text })],
      }).catch(() => {});
    } else {
      await ch.send(text).catch(() => {});
    }
  },
};

// ─── Message Deleted ───────────────────────────────────────────────────────────
const messageDelete = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild || message.author?.bot) return;
    const cfg = await getGuild(message.guild.id);
    if (!cfg.logs?.enabled || !cfg.logs.events?.messageDelete || !cfg.logs.channelId) return;

    const ch = message.guild.channels.cache.get(cfg.logs.channelId);
    if (!ch) return;

    await ch.send({
      embeds: [makeEmbed({
        color: Colors.error,
        title: '🗑️ Message Deleted',
        fields: [
          { name: 'Author',  value: message.author ? `<@${message.author.id}> (${message.author.tag})` : 'Unknown', inline: true },
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Content', value: message.content?.slice(0, 1000) || '*Empty or unknown*' },
        ],
      })],
    }).catch(() => {});
  },
};

// ─── Message Edited ────────────────────────────────────────────────────────────
const messageUpdate = {
  name: 'messageUpdate',
  async execute(oldMsg, newMsg) {
    if (!newMsg.guild || newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;
    const cfg = await getGuild(newMsg.guild.id);
    if (!cfg.logs?.enabled || !cfg.logs.events?.messageEdit || !cfg.logs.channelId) return;

    const ch = newMsg.guild.channels.cache.get(cfg.logs.channelId);
    if (!ch) return;

    await ch.send({
      embeds: [makeEmbed({
        color: Colors.warn,
        title: '✏️ Message Edited',
        fields: [
          { name: 'Author',  value: `<@${newMsg.author.id}>`, inline: true },
          { name: 'Channel', value: `<#${newMsg.channel.id}>`, inline: true },
          { name: 'Link',    value: `[Jump to message](${newMsg.url})`, inline: true },
          { name: 'Before',  value: oldMsg.content?.slice(0, 500) || '*Unknown*' },
          { name: 'After',   value: newMsg.content?.slice(0, 500) || '*Empty*' },
        ],
      })],
    }).catch(() => {});
  },
};

// ─── Ban / Unban Logs ──────────────────────────────────────────────────────────
const guildBanAdd = {
  name: 'guildBanAdd',
  async execute(ban) {
    const cfg = await getGuild(ban.guild.id);
    if (!cfg.logs?.enabled || !cfg.logs.events?.memberBan || !cfg.logs.channelId) return;
    const ch = ban.guild.channels.cache.get(cfg.logs.channelId);
    if (!ch) return;
    await ch.send({
      embeds: [makeEmbed({
        color: Colors.error,
        title: '🔨 Member Banned',
        fields: [
          { name: 'User',   value: `${ban.user.tag} (${ban.user.id})`, inline: true },
          { name: 'Reason', value: ban.reason || 'No reason provided' },
        ],
      })],
    }).catch(() => {});
  },
};

const guildBanRemove = {
  name: 'guildBanRemove',
  async execute(ban) {
    const cfg = await getGuild(ban.guild.id);
    if (!cfg.logs?.enabled || !cfg.logs.events?.memberBan || !cfg.logs.channelId) return;
    const ch = ban.guild.channels.cache.get(cfg.logs.channelId);
    if (!ch) return;
    await ch.send({
      embeds: [makeEmbed({
        color: Colors.success,
        title: '✅ Member Unbanned',
        fields: [{ name: 'User', value: `${ban.user.tag} (${ban.user.id})` }],
      })],
    }).catch(() => {});
  },
};

export default [memberLeave, messageDelete, messageUpdate, guildBanAdd, guildBanRemove];
