// src/commands/welcome/welcome.js
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import { ok, err, brand, makeEmbed, Colors, applyVars } from '../../utils/index.js';
import { getGuild } from '../../models/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome & goodbye messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── Welcome ────────────────────────────────────────────────────────────────
    .addSubcommandGroup(g => g
      .setName('join')
      .setDescription('Welcome message settings')
      .addSubcommand(s => s
        .setName('setup')
        .setDescription('Set up the welcome message')
        .addChannelOption(o => o.setName('channel').setDescription('Where to send welcome messages').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption(o => o.setName('message').setDescription('Welcome text — use {user} {server} {memberCount} {username}'))
        .addBooleanOption(o => o.setName('embed').setDescription('Send as a nice embed? (default: yes)'))
        .addStringOption(o => o.setName('color').setDescription('Embed colour hex (e.g. #F5C542)'))
        .addStringOption(o => o.setName('banner').setDescription('URL for a banner image in the embed'))
        .addStringOption(o => o.setName('dm_message').setDescription('Send this message to the new member as a DM')))
      .addSubcommand(s => s
        .setName('disable')
        .setDescription('Disable the welcome message'))
      .addSubcommand(s => s
        .setName('test')
        .setDescription('Preview the welcome message right now')))

    // ── Goodbye ───────────────────────────────────────────────────────────────
    .addSubcommandGroup(g => g
      .setName('leave')
      .setDescription('Goodbye message settings')
      .addSubcommand(s => s
        .setName('setup')
        .setDescription('Set up the goodbye message')
        .addChannelOption(o => o.setName('channel').setDescription('Where to send goodbye messages').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption(o => o.setName('message').setDescription('Goodbye text — use {username} {server} {memberCount}'))
        .addBooleanOption(o => o.setName('embed').setDescription('Send as an embed?'))
        .addStringOption(o => o.setName('color').setDescription('Embed colour hex')))
      .addSubcommand(s => s
        .setName('disable')
        .setDescription('Disable the goodbye message')))

    // ── Auto-roles ────────────────────────────────────────────────────────────
    .addSubcommandGroup(g => g
      .setName('autoroles')
      .setDescription('Roles automatically given to new members')
      .addSubcommand(s => s
        .setName('add')
        .setDescription('Add a role to auto-assign on join')
        .addRoleOption(o => o.setName('role').setDescription('Role to auto-assign').setRequired(true))
        .addIntegerOption(o => o.setName('delay_seconds').setDescription('Delay before assigning (0 = instant)').setMinValue(0).setMaxValue(600)))
      .addSubcommand(s => s
        .setName('remove')
        .setDescription('Remove an auto-role')
        .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
      .addSubcommand(s => s
        .setName('list')
        .setDescription('See all configured auto-roles')))

    // ── Status ────────────────────────────────────────────────────────────────
    .addSubcommand(s => s
      .setName('status')
      .setDescription('View welcome/goodbye/autorole configuration')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();
    const cfg   = await getGuild(interaction.guild.id);

    // ── Welcome ──────────────────────────────────────────────────────────────
    if (group === 'join') {
      if (sub === 'setup') {
        const channel  = interaction.options.getChannel('channel');
        const message  = interaction.options.getString('message');
        const useEmbed = interaction.options.getBoolean('embed');
        const color    = interaction.options.getString('color');
        const banner   = interaction.options.getString('banner');
        const dm       = interaction.options.getString('dm_message');

        if (!cfg.welcome) cfg.welcome = {};
        cfg.welcome.enabled = true;
        cfg.welcome.channelId = channel.id;
        if (message  !== null) cfg.welcome.message      = message;
        if (useEmbed !== null) cfg.welcome.embedEnabled = useEmbed;
        if (color    !== null) cfg.welcome.embedColor   = color;
        if (banner   !== null) cfg.welcome.embedImage   = banner;
        if (dm       !== null) cfg.welcome.dmMessage    = dm;

        cfg.markModified('welcome');
        await cfg.save();

        return interaction.editReply({ embeds: [makeEmbed({
          color: Colors.success, title: '✅ Welcome configured!',
          fields: [
            { name: 'Channel',  value: `<#${channel.id}>`, inline: true },
            { name: 'Embed',    value: cfg.welcome.embedEnabled ? 'Yes' : 'No', inline: true },
            { name: 'Message',  value: cfg.welcome.message, inline: false },
            { name: 'DM',       value: cfg.welcome.dmMessage || 'None', inline: false },
          ],
          footer: `Tip: use {user} {username} {server} {memberCount} as placeholders`,
        })] });
      }

      if (sub === 'disable') {
        cfg.welcome = { ...(cfg.welcome ?? {}), enabled: false };
        cfg.markModified('welcome');
        await cfg.save();
        return interaction.editReply({ embeds: [ok('Welcome message **disabled**.')] });
      }

      if (sub === 'test') {
        const w = cfg.welcome;
        if (!w?.channelId) return interaction.editReply({ embeds: [err('No welcome channel configured yet. Run `/welcome join setup` first.')] });
        const ch = interaction.guild.channels.cache.get(w.channelId);
        if (!ch) return interaction.editReply({ embeds: [err('Configured channel not found. Please re-configure.')] });

        const vars = {
          user: `<@${interaction.user.id}>`,
          username: interaction.user.username,
          tag:  interaction.user.tag,
          server: interaction.guild.name,
          memberCount: interaction.guild.memberCount,
        };
        const text = applyVars(w.message ?? 'Welcome {user}!', vars);

        if (w.embedEnabled ?? true) {
          const e = new EmbedBuilder()
            .setColor(w.embedColor ?? '#F5C542')
            .setTitle(`Welcome to ${interaction.guild.name}! 🎉`)
            .setDescription(text)
            .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: `Member #${interaction.guild.memberCount}` })
            .setTimestamp();
          if (w.embedImage) e.setImage(w.embedImage);
          await ch.send({ embeds: [e] });
        } else {
          await ch.send(text);
        }

        return interaction.editReply({ embeds: [ok(`Test message sent to <#${ch.id}>!`)] });
      }
    }

    // ── Goodbye ──────────────────────────────────────────────────────────────
    if (group === 'leave') {
      if (sub === 'setup') {
        const channel  = interaction.options.getChannel('channel');
        const message  = interaction.options.getString('message');
        const useEmbed = interaction.options.getBoolean('embed');
        const color    = interaction.options.getString('color');

        if (!cfg.goodbye) cfg.goodbye = {};
        cfg.goodbye.enabled   = true;
        cfg.goodbye.channelId = channel.id;
        if (message  !== null) cfg.goodbye.message      = message;
        if (useEmbed !== null) cfg.goodbye.embedEnabled = useEmbed;
        if (color    !== null) cfg.goodbye.embedColor   = color;

        cfg.markModified('goodbye');
        await cfg.save();
        return interaction.editReply({ embeds: [ok(`Goodbye message configured in <#${channel.id}>!`)] });
      }

      if (sub === 'disable') {
        cfg.goodbye = { ...(cfg.goodbye ?? {}), enabled: false };
        cfg.markModified('goodbye');
        await cfg.save();
        return interaction.editReply({ embeds: [ok('Goodbye message **disabled**.')] });
      }
    }

    // ── Auto-roles ────────────────────────────────────────────────────────────
    if (group === 'autoroles') {
      if (!cfg.welcome) cfg.welcome = {};
      if (!cfg.welcome.autoroles) cfg.welcome.autoroles = [];

      if (sub === 'add') {
        const role  = interaction.options.getRole('role');
        const delay = interaction.options.getInteger('delay_seconds') ?? 0;

        if (cfg.welcome.autoroles.length >= 10) {
          return interaction.editReply({ embeds: [err('Maximum 10 auto-roles.')] });
        }
        if (!cfg.welcome.autoroles.includes(role.id)) cfg.welcome.autoroles.push(role.id);
        cfg.welcome.autoroleDelay = delay;
        cfg.markModified('welcome');
        await cfg.save();
        return interaction.editReply({ embeds: [ok(`**${role.name}** will be assigned to new members${delay > 0 ? ` after ${delay}s` : ' instantly'}.`)] });
      }

      if (sub === 'remove') {
        const role = interaction.options.getRole('role');
        cfg.welcome.autoroles = cfg.welcome.autoroles.filter(r => r !== role.id);
        cfg.markModified('welcome');
        await cfg.save();
        return interaction.editReply({ embeds: [ok(`**${role.name}** removed from auto-roles.`)] });
      }

      if (sub === 'list') {
        const roles = cfg.welcome.autoroles ?? [];
        return interaction.editReply({ embeds: [makeEmbed({
          color: Colors.brand, title: '🎭 Auto-Roles',
          description: roles.length > 0 ? roles.map(r => `• <@&${r}>`).join('\n') : 'No auto-roles configured.',
          fields: roles.length > 0 ? [{ name: 'Delay', value: `${cfg.welcome.autoroleDelay ?? 0}s`, inline: true }] : [],
        })] });
      }
    }

    // ── Status ────────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const w = cfg.welcome ?? {};
      const g = cfg.goodbye ?? {};
      return interaction.editReply({ embeds: [makeEmbed({
        color: Colors.brand, title: '👋 Welcome & Goodbye Status',
        fields: [
          { name: '✅ Welcome',       value: w.enabled ? `<#${w.channelId}>` : '❌ Disabled', inline: true },
          { name: '👋 Goodbye',       value: g.enabled ? `<#${g.channelId}>` : '❌ Disabled', inline: true },
          { name: '🎭 Auto-roles',    value: w.autoroles?.length > 0 ? w.autoroles.map(r => `<@&${r}>`).join(' ') : 'None', inline: false },
          { name: 'Welcome Message',  value: w.message ?? '*Default*' },
          { name: 'Goodbye Message',  value: g.message ?? '*Default*' },
          { name: 'DM on join',       value: w.dmMessage ?? 'None', inline: true },
        ],
      })] });
    }
  },
};
