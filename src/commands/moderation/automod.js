// src/commands/moderation/automod.js
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { ok, err, brand, makeEmbed, Colors } from '../../utils/index.js';
import { getGuild } from '../../models/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure automatic moderation')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(s => s
      .setName('setup')
      .setDescription('Enable automod and set main options')
      .addChannelOption(o => o.setName('log_channel').setDescription('Channel where violations are logged').addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('punishment').setDescription('Default punishment').addChoices(
        { name: '⚠️ Warn',   value: 'warn' },
        { name: '🔇 Mute',   value: 'mute' },
        { name: '👢 Kick',   value: 'kick' },
        { name: '🔨 Ban',    value: 'ban'  },
      ))
      .addIntegerOption(o => o.setName('mute_minutes').setDescription('How many minutes for auto-mute (default 10)').setMinValue(1).setMaxValue(10080)))

    .addSubcommand(s => s
      .setName('rules')
      .setDescription('Toggle individual automod rules')
      .addBooleanOption(o => o.setName('anti_spam').setDescription('Block spam (5+ messages in 5s)'))
      .addBooleanOption(o => o.setName('anti_links').setDescription('Block all links'))
      .addBooleanOption(o => o.setName('anti_invites').setDescription('Block Discord invite links'))
      .addBooleanOption(o => o.setName('anti_caps').setDescription('Block excessive caps (>70%)'))
      .addBooleanOption(o => o.setName('bad_words').setDescription('Block forbidden words')))

    .addSubcommand(s => s
      .setName('badwords')
      .setDescription('Manage the forbidden word list')
      .addStringOption(o => o.setName('action').setDescription('What to do').setRequired(true).addChoices(
        { name: 'Add words',    value: 'add'    },
        { name: 'Remove words', value: 'remove' },
        { name: 'View list',    value: 'list'   },
      ))
      .addStringOption(o => o.setName('words').setDescription('Words separated by commas (e.g. word1, word2)')))

    .addSubcommand(s => s
      .setName('whitelist')
      .setDescription('Manage link whitelist (allowed links when anti-links is on)')
      .addStringOption(o => o.setName('action').setDescription('What to do').setRequired(true).addChoices(
        { name: 'Add domain',    value: 'add'    },
        { name: 'Remove domain', value: 'remove' },
        { name: 'View list',     value: 'list'   },
      ))
      .addStringOption(o => o.setName('domain').setDescription('Domain to add/remove (e.g. youtube.com)')))

    .addSubcommand(s => s
      .setName('immune')
      .setDescription('Add/remove immune roles or channels (exempt from automod)')
      .addStringOption(o => o.setName('type').setDescription('Type').setRequired(true).addChoices(
        { name: 'Role',    value: 'role'    },
        { name: 'Channel', value: 'channel' },
      ))
      .addStringOption(o => o.setName('action').setDescription('Add or Remove').setRequired(true).addChoices(
        { name: 'Add',    value: 'add'    },
        { name: 'Remove', value: 'remove' },
      ))
      .addRoleOption(o => o.setName('role').setDescription('Role to add/remove'))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to add/remove')))

    .addSubcommand(s => s
      .setName('disable')
      .setDescription('Disable automod entirely'))

    .addSubcommand(s => s
      .setName('status')
      .setDescription('View current automod configuration')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const cfg = await getGuild(interaction.guild.id);
    if (!cfg.automod) cfg.automod = {};

    // ── setup ──────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const logCh   = interaction.options.getChannel('log_channel');
      const punish  = interaction.options.getString('punishment');
      const muteMin = interaction.options.getInteger('mute_minutes');

      cfg.automod.enabled = true;
      if (logCh)   cfg.automod.logChannelId  = logCh.id;
      if (punish)  cfg.automod.punishment    = punish;
      if (muteMin) cfg.automod.muteDuration  = muteMin;

      cfg.markModified('automod');
      await cfg.save();
      return interaction.editReply({ embeds: [ok('AutoMod **enabled** and configured! ✅\nUse `/automod rules` to turn on specific rules.')] });
    }

    // ── rules ──────────────────────────────────────────────────────────────────
    if (sub === 'rules') {
      const spam    = interaction.options.getBoolean('anti_spam');
      const links   = interaction.options.getBoolean('anti_links');
      const invites = interaction.options.getBoolean('anti_invites');
      const caps    = interaction.options.getBoolean('anti_caps');
      const bw      = interaction.options.getBoolean('bad_words');

      if (!cfg.automod.antiSpam)   cfg.automod.antiSpam   = {};
      if (!cfg.automod.antiLinks)  cfg.automod.antiLinks  = {};
      if (!cfg.automod.antiCaps)   cfg.automod.antiCaps   = {};
      if (!cfg.automod.antiInvites)cfg.automod.antiInvites= {};
      if (!cfg.automod.badWords)   cfg.automod.badWords   = {};

      if (spam    !== null) cfg.automod.antiSpam.enabled    = spam;
      if (links   !== null) cfg.automod.antiLinks.enabled   = links;
      if (invites !== null) cfg.automod.antiInvites.enabled = invites;
      if (caps    !== null) cfg.automod.antiCaps.enabled    = caps;
      if (bw      !== null) cfg.automod.badWords.enabled    = bw;

      cfg.markModified('automod');
      await cfg.save();
      return interaction.editReply({ embeds: [ok('AutoMod rules updated!')] });
    }

    // ── badwords ───────────────────────────────────────────────────────────────
    if (sub === 'badwords') {
      const action = interaction.options.getString('action');
      const raw    = interaction.options.getString('words');

      if (!cfg.automod.badWords) cfg.automod.badWords = { enabled: false, words: [] };

      if (action === 'list') {
        const words = cfg.automod.badWords.words ?? [];
        return interaction.editReply({ embeds: [makeEmbed({
          color: Colors.warn, title: '🚫 Forbidden Words',
          description: words.length > 0 ? `\`${words.join('` `')}\`` : '*No words added yet.*',
        })] });
      }

      if (!raw) return interaction.editReply({ embeds: [err('Please provide words separated by commas.')] });
      const words = raw.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);

      if (action === 'add') {
        for (const w of words) {
          if (!cfg.automod.badWords.words.includes(w)) cfg.automod.badWords.words.push(w);
        }
      } else {
        cfg.automod.badWords.words = cfg.automod.badWords.words.filter(w => !words.includes(w));
      }

      cfg.markModified('automod');
      await cfg.save();
      return interaction.editReply({ embeds: [ok(`Word list updated. Total: **${cfg.automod.badWords.words.length}** words.`)] });
    }

    // ── whitelist ──────────────────────────────────────────────────────────────
    if (sub === 'whitelist') {
      const action = interaction.options.getString('action');
      const domain = interaction.options.getString('domain');

      if (!cfg.automod.antiLinks) cfg.automod.antiLinks = { enabled: false, whitelist: [] };
      if (!cfg.automod.antiLinks.whitelist) cfg.automod.antiLinks.whitelist = [];

      if (action === 'list') {
        const list = cfg.automod.antiLinks.whitelist ?? [];
        return interaction.editReply({ embeds: [makeEmbed({
          color: Colors.info, title: '🔗 Link Whitelist',
          description: list.length > 0 ? list.map(d => `\`${d}\``).join('\n') : '*Empty*',
        })] });
      }

      if (!domain) return interaction.editReply({ embeds: [err('Please provide a domain.')] });
      const clean = domain.replace(/^https?:\/\//,'').split('/')[0].toLowerCase();

      if (action === 'add') {
        if (!cfg.automod.antiLinks.whitelist.includes(clean)) cfg.automod.antiLinks.whitelist.push(clean);
      } else {
        cfg.automod.antiLinks.whitelist = cfg.automod.antiLinks.whitelist.filter(d => d !== clean);
      }

      cfg.markModified('automod');
      await cfg.save();
      return interaction.editReply({ embeds: [ok(`Whitelist updated. \`${clean}\` ${action === 'add' ? 'added' : 'removed'}.`)] });
    }

    // ── immune ─────────────────────────────────────────────────────────────────
    if (sub === 'immune') {
      const type   = interaction.options.getString('type');
      const action = interaction.options.getString('action');
      const role   = interaction.options.getRole('role');
      const ch     = interaction.options.getChannel('channel');

      if (type === 'role') {
        if (!role) return interaction.editReply({ embeds: [err('Please provide a role.')] });
        if (!cfg.automod.immuneRoles) cfg.automod.immuneRoles = [];
        if (action === 'add') { if (!cfg.automod.immuneRoles.includes(role.id)) cfg.automod.immuneRoles.push(role.id); }
        else cfg.automod.immuneRoles = cfg.automod.immuneRoles.filter(r => r !== role.id);
        cfg.markModified('automod');
        await cfg.save();
        return interaction.editReply({ embeds: [ok(`Role **${role.name}** ${action === 'add' ? 'added to' : 'removed from'} immune list.`)] });
      }
      if (type === 'channel') {
        if (!ch) return interaction.editReply({ embeds: [err('Please provide a channel.')] });
        if (!cfg.automod.immuneChannels) cfg.automod.immuneChannels = [];
        if (action === 'add') { if (!cfg.automod.immuneChannels.includes(ch.id)) cfg.automod.immuneChannels.push(ch.id); }
        else cfg.automod.immuneChannels = cfg.automod.immuneChannels.filter(c => c !== ch.id);
        cfg.markModified('automod');
        await cfg.save();
        return interaction.editReply({ embeds: [ok(`Channel <#${ch.id}> ${action === 'add' ? 'added to' : 'removed from'} immune list.`)] });
      }
    }

    // ── disable ────────────────────────────────────────────────────────────────
    if (sub === 'disable') {
      cfg.automod.enabled = false;
      cfg.markModified('automod');
      await cfg.save();
      return interaction.editReply({ embeds: [ok('AutoMod **disabled**.')] });
    }

    // ── status ─────────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const am = cfg.automod ?? {};
      const bool = v => v ? '✅ On' : '❌ Off';
      return interaction.editReply({ embeds: [makeEmbed({
        color: Colors.brand, title: '🤖 AutoMod Status',
        fields: [
          { name: 'Global',       value: bool(am.enabled),                              inline: true },
          { name: 'Punishment',   value: am.punishment ?? 'warn',                       inline: true },
          { name: 'Log Channel',  value: am.logChannelId ? `<#${am.logChannelId}>` : 'Not set', inline: true },
          { name: 'Anti-Spam',    value: bool(am.antiSpam?.enabled),                    inline: true },
          { name: 'Anti-Links',   value: bool(am.antiLinks?.enabled),                   inline: true },
          { name: 'Anti-Invites', value: bool(am.antiInvites?.enabled),                 inline: true },
          { name: 'Anti-Caps',    value: bool(am.antiCaps?.enabled),                    inline: true },
          { name: 'Bad Words',    value: `${bool(am.badWords?.enabled)} (${am.badWords?.words?.length ?? 0} words)`, inline: true },
          { name: 'Immune Roles', value: am.immuneRoles?.length ? am.immuneRoles.map(r => `<@&${r}>`).join(' ') : 'None' },
          { name: 'Immune Channels', value: am.immuneChannels?.length ? am.immuneChannels.map(c => `<#${c}>`).join(' ') : 'None' },
        ],
      })] });
    }
  },
};
