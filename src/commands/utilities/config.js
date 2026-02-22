// src/commands/utilities/config.js
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { ok, err, makeEmbed, Colors } from '../../utils/index.js';
import { getGuild } from '../../models/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('CheeseBot server configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── Logs ──────────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('logs')
      .setDescription('Configure the server logs channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel where logs are posted').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addBooleanOption(o => o.setName('message_delete').setDescription('Log deleted messages (default: on)'))
      .addBooleanOption(o => o.setName('message_edit').setDescription('Log edited messages (default: on)'))
      .addBooleanOption(o => o.setName('member_join').setDescription('Log member joins (default: on)'))
      .addBooleanOption(o => o.setName('member_leave').setDescription('Log member leaves (default: on)'))
      .addBooleanOption(o => o.setName('bans').setDescription('Log bans/unbans (default: on)'))
      .addBooleanOption(o => o.setName('voice').setDescription('Log voice activity (default: off)')))

    .addSubcommand(s => s
      .setName('logs_disable')
      .setDescription('Disable all logging'))

    // ── Suggestions ───────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('suggestions')
      .setDescription('Configure the suggestions channel')
      .addChannelOption(o => o.setName('channel').setDescription('Where suggestions are posted').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addBooleanOption(o => o.setName('threads').setDescription('Create a thread per suggestion for discussion? (default: yes)')))

    .addSubcommand(s => s
      .setName('suggestions_disable')
      .setDescription('Disable suggestions'))

    // ── Auto Voice Channels ───────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('autochannel')
      .setDescription('Set a trigger voice channel that auto-creates temp voice channels')
      .addChannelOption(o => o.setName('trigger').setDescription('The voice channel users join to create a new channel').setRequired(true).addChannelTypes(ChannelType.GuildVoice))
      .addStringOption(o => o.setName('name_template').setDescription("New channel name — use {user} or {username} (default: \"{user}'s Channel\")"))
      .addIntegerOption(o => o.setName('user_limit').setDescription('Max users (0 = unlimited)').setMinValue(0).setMaxValue(99)))

    .addSubcommand(s => s
      .setName('autochannel_remove')
      .setDescription('Remove an auto-channel trigger')
      .addChannelOption(o => o.setName('trigger').setDescription('The trigger channel to remove').setRequired(true)))

    // ── Language & Prefix ─────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('prefix')
      .setDescription('Set the prefix for legacy text commands (like !clear)')
      .addStringOption(o => o.setName('prefix').setDescription('New prefix, e.g. ! or ? or .').setRequired(true).setMaxLength(5)))

    // ── Status ────────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('status')
      .setDescription('View the full server configuration')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const cfg = await getGuild(interaction.guild.id);

    // ── logs ──────────────────────────────────────────────────────────────────
    if (sub === 'logs') {
      const channel = interaction.options.getChannel('channel');
      const msgDel  = interaction.options.getBoolean('message_delete');
      const msgEdit = interaction.options.getBoolean('message_edit');
      const join    = interaction.options.getBoolean('member_join');
      const leave   = interaction.options.getBoolean('member_leave');
      const bans    = interaction.options.getBoolean('bans');
      const voice   = interaction.options.getBoolean('voice');

      if (!cfg.logs) cfg.logs = { enabled: false, events: {} };
      cfg.logs.enabled   = true;
      cfg.logs.channelId = channel.id;
      if (!cfg.logs.events) cfg.logs.events = {};
      if (msgDel  !== null) cfg.logs.events.messageDelete = msgDel;
      if (msgEdit !== null) cfg.logs.events.messageEdit   = msgEdit;
      if (join    !== null) cfg.logs.events.memberJoin    = join;
      if (leave   !== null) cfg.logs.events.memberLeave   = leave;
      if (bans    !== null) cfg.logs.events.memberBan     = bans;
      if (voice   !== null) cfg.logs.events.voiceUpdate   = voice;

      cfg.markModified('logs');
      await cfg.save();

      const ev = cfg.logs.events;
      const bool = v => (v ?? true) ? '✅' : '❌';
      return interaction.editReply({ embeds: [makeEmbed({
        color: Colors.success, title: '✅ Logs configured!',
        fields: [
          { name: 'Channel',         value: `<#${channel.id}>`, inline: true },
          { name: 'Message Delete',  value: bool(ev.messageDelete), inline: true },
          { name: 'Message Edit',    value: bool(ev.messageEdit),   inline: true },
          { name: 'Member Join',     value: bool(ev.memberJoin),    inline: true },
          { name: 'Member Leave',    value: bool(ev.memberLeave),   inline: true },
          { name: 'Bans',            value: bool(ev.memberBan),     inline: true },
          { name: 'Voice Activity',  value: bool(ev.voiceUpdate),   inline: true },
        ],
      })] });
    }

    if (sub === 'logs_disable') {
      cfg.logs = { ...(cfg.logs ?? {}), enabled: false };
      cfg.markModified('logs');
      await cfg.save();
      return interaction.editReply({ embeds: [ok('Logging **disabled**.')] });
    }

    // ── suggestions ───────────────────────────────────────────────────────────
    if (sub === 'suggestions') {
      const channel = interaction.options.getChannel('channel');
      const threads = interaction.options.getBoolean('threads');

      if (!cfg.suggestions) cfg.suggestions = {};
      cfg.suggestions.enabled   = true;
      cfg.suggestions.channelId = channel.id;
      if (threads !== null) cfg.suggestions.threadEnabled = threads;

      cfg.markModified('suggestions');
      await cfg.save();
      return interaction.editReply({ embeds: [ok(`Suggestions channel set to <#${channel.id}>!\nThreads: ${cfg.suggestions.threadEnabled ? 'Yes' : 'No'}`)] });
    }

    if (sub === 'suggestions_disable') {
      cfg.suggestions = { ...(cfg.suggestions ?? {}), enabled: false };
      cfg.markModified('suggestions');
      await cfg.save();
      return interaction.editReply({ embeds: [ok('Suggestions **disabled**.')] });
    }

    // ── autochannel ───────────────────────────────────────────────────────────
    if (sub === 'autochannel') {
      const trigger   = interaction.options.getChannel('trigger');
      const template  = interaction.options.getString('name_template') ?? "{user}'s Channel";
      const userLimit = interaction.options.getInteger('user_limit')   ?? 0;

      if (!cfg.autoChannels) cfg.autoChannels = [];
      const idx = cfg.autoChannels.findIndex(ac => ac.triggerId === trigger.id);
      const data = { triggerId: trigger.id, categoryId: trigger.parentId, nameTemplate: template, userLimit };
      if (idx !== -1) cfg.autoChannels[idx] = data;
      else cfg.autoChannels.push(data);

      cfg.markModified('autoChannels');
      await cfg.save();
      return interaction.editReply({ embeds: [makeEmbed({
        color: Colors.success, title: '✅ Auto-channel configured!',
        description: `When someone joins <#${trigger.id}>, a new voice channel named \`${template}\` will be created for them automatically. It deletes itself when empty.`,
        fields: [{ name: 'User Limit', value: userLimit === 0 ? 'Unlimited' : String(userLimit), inline: true }],
      })] });
    }

    if (sub === 'autochannel_remove') {
      const trigger = interaction.options.getChannel('trigger');
      if (!cfg.autoChannels) return interaction.editReply({ embeds: [err('No auto-channels configured.')] });
      const before = cfg.autoChannels.length;
      cfg.autoChannels = cfg.autoChannels.filter(ac => ac.triggerId !== trigger.id);
      if (cfg.autoChannels.length === before) return interaction.editReply({ embeds: [err('That channel is not configured as a trigger.')] });
      cfg.markModified('autoChannels');
      await cfg.save();
      return interaction.editReply({ embeds: [ok(`Auto-channel trigger removed.`)] });
    }

    // ── prefix ────────────────────────────────────────────────────────────────
    if (sub === 'prefix') {
      const prefix = interaction.options.getString('prefix');
      cfg.prefix = prefix;
      await cfg.save();
      return interaction.editReply({ embeds: [ok(`Prefix set to \`${prefix}\`.\nExample: \`${prefix}clear 10\``)] });
    }

    // ── status ────────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const ac = cfg.autoChannels ?? [];
      return interaction.editReply({ embeds: [makeEmbed({
        color: Colors.brand,
        title: `🧀 CheeseBot — ${interaction.guild.name}`,
        thumbnail: interaction.guild.iconURL(),
        fields: [
          { name: '🇬🇧 Language',     value: 'English (UK)',                                          inline: true },
          { name: '⌨️ Prefix',        value: `\`${cfg.prefix ?? '!'}\``,                               inline: true },
          { name: '\u200B',           value: '\u200B',                                                  inline: true },
          { name: '📋 Logs',         value: cfg.logs?.enabled ? `<#${cfg.logs.channelId}>` : '❌ Off', inline: true },
          { name: '👋 Welcome',      value: cfg.welcome?.enabled ? `<#${cfg.welcome.channelId}>` : '❌ Off', inline: true },
          { name: '🚪 Goodbye',      value: cfg.goodbye?.enabled ? `<#${cfg.goodbye.channelId}>` : '❌ Off', inline: true },
          { name: '🤖 AutoMod',      value: cfg.automod?.enabled ? '✅ On' : '❌ Off',                 inline: true },
          { name: '🛡️ Anti-Raid',   value: cfg.antiraid?.enabled ? '✅ On' : '❌ Off',                inline: true },
          { name: '💡 Suggestions',  value: cfg.suggestions?.enabled ? `<#${cfg.suggestions.channelId}>` : '❌ Off', inline: true },
          { name: '🔊 Auto-Channels',value: ac.length > 0 ? ac.map(a => `<#${a.triggerId}>`).join(' ') : 'None', inline: false },
          { name: '🎭 Auto-Roles',   value: cfg.welcome?.autoroles?.length > 0 ? cfg.welcome.autoroles.map(r => `<@&${r}>`).join(' ') : 'None', inline: false },
        ],
      })] });
    }
  },
};
