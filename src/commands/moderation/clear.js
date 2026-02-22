// src/commands/moderation/clear.js
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ok, err, brand, makeEmbed, Colors } from '../../utils/index.js';
import { getGuild } from '../../models/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete a number of messages in the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o
      .setName('amount')
      .setDescription('How many messages to delete (1 – 1000)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(1000))
    .addUserOption(o => o
      .setName('user')
      .setDescription('Only delete messages from this user'))
    .addStringOption(o => o
      .setName('filter')
      .setDescription('Optional filter')
      .addChoices(
        { name: 'All (default)', value: 'all' },
        { name: 'Bots only',     value: 'bots' },
        { name: 'Links only',    value: 'links' },
      )),

  async execute(interaction) {
    if (!interaction.channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ embeds: [err("I don't have **Manage Messages** permission in this channel.")], ephemeral: true });
    }

    const amount  = interaction.options.getInteger('amount');
    const target  = interaction.options.getUser('user');
    const filter  = interaction.options.getString('filter') ?? 'all';

    await interaction.deferReply({ ephemeral: true });

    const deleted = await doClear(interaction.channel, amount, target?.id, filter);

    const cfg = await getGuild(interaction.guild.id);
    await logClear(interaction.guild, cfg, interaction.channel, interaction.user, deleted, target);

    return interaction.editReply({
      embeds: [ok(`Deleted **${deleted}** message(s)${target ? ` from ${target.username}` : ''}.`)],
    });
  },

  // ─── Prefix: !clear <amount> [@user] ───────────────────────────────────────
  async prefixExecute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply('❌ You need **Manage Messages** permission.');
    }
    if (!message.channel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
      return message.reply("❌ I don't have **Manage Messages** permission here.");
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 1000) {
      return message.reply('❌ Please provide a number between 1 and 1000. Example: `!clear 50`');
    }

    const targetUser = message.mentions.users.first();

    // Delete the command message itself
    await message.delete().catch(() => {});

    const deleted = await doClear(message.channel, amount, targetUser?.id, 'all');
    const cfg = await getGuild(message.guild.id);
    await logClear(message.guild, cfg, message.channel, message.author, deleted, targetUser);

    const notice = await message.channel.send({
      embeds: [ok(`Deleted **${deleted}** message(s)${targetUser ? ` from ${targetUser.username}` : ''}.`)],
    });
    setTimeout(() => notice.delete().catch(() => {}), 5000);
  },
};

// ─── Core delete logic ─────────────────────────────────────────────────────────
async function doClear(channel, total, targetId, filter) {
  let deleted = 0;
  let remaining = total;

  while (remaining > 0) {
    // Fetch up to 100 messages
    const fetched = await channel.messages.fetch({ limit: Math.min(remaining, 100) }).catch(() => null);
    if (!fetched || fetched.size === 0) break;

    // Apply filters
    let toDelete = fetched;
    if (targetId) toDelete = toDelete.filter(m => m.author.id === targetId);
    if (filter === 'bots')  toDelete = toDelete.filter(m => m.author.bot);
    if (filter === 'links') toDelete = toDelete.filter(m => /https?:\/\/\S+/i.test(m.content));

    if (toDelete.size === 0) break;

    // Split into bulk-deletable (<14 days) and old (must delete one-by-one)
    const cutoff = Date.now() - 13.9 * 24 * 60 * 60 * 1000;
    const fresh = toDelete.filter(m => m.createdTimestamp > cutoff);
    const old   = toDelete.filter(m => m.createdTimestamp <= cutoff);

    // Bulk delete fresh messages (requires ≥2)
    if (fresh.size >= 2) {
      const result = await channel.bulkDelete(fresh, true).catch(() => null);
      deleted += result?.size ?? 0;
    } else if (fresh.size === 1) {
      await fresh.first().delete().catch(() => {});
      deleted++;
    }

    // One-by-one for old messages (rate-limited)
    for (const [, msg] of old) {
      await msg.delete().catch(() => {});
      deleted++;
      await sleep(350); // avoid hitting the rate limit
    }

    remaining -= fetched.size;
    if (fetched.size < 100) break;
    await sleep(500);
  }

  return deleted;
}

// ─── Log to mod-log channel ────────────────────────────────────────────────────
async function logClear(guild, cfg, channel, mod, count, targetUser) {
  if (!cfg.logs?.enabled || !cfg.logs.channelId) return;
  const logCh = guild.channels.cache.get(cfg.logs.channelId);
  if (!logCh) return;
  const { makeEmbed, Colors } = await import('../../utils/index.js');
  await logCh.send({
    embeds: [makeEmbed({
      color: Colors.error, title: '🗑️ Messages Cleared',
      fields: [
        { name: 'Moderator',  value: `<@${mod.id}>`, inline: true },
        { name: 'Channel',    value: `<#${channel.id}>`, inline: true },
        { name: 'Deleted',    value: String(count), inline: true },
        { name: 'Target',     value: targetUser ? targetUser.tag : 'Everyone', inline: true },
      ],
    })],
  }).catch(() => {});
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
