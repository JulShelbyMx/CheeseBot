// src/commands/roles/rr.js
import {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType,
} from 'discord.js';
import { ok, err, makeEmbed, Colors } from '../../utils/index.js';
import { ReactionRole } from '../../models/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rr')
    .setDescription('Reaction roles — let members self-assign roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

    .addSubcommand(s => s
      .setName('create')
      .setDescription('Create a new reaction role message')
      .addStringOption(o => o.setName('title').setDescription('Title of the embed').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Description / instructions').setRequired(true))
      .addStringOption(o => o.setName('mode').setDescription('Role assignment mode').addChoices(
        { name: '🔵 Multiple — pick as many as you want (default)', value: 'multiple' },
        { name: '🟡 Unique — only one role at a time',               value: 'unique'   },
        { name: '🟢 Toggle — click again to remove',                  value: 'toggle'   },
        { name: '⏳ Temporary — role expires after a set time',        value: 'temp'     },
      ))
      .addStringOption(o => o.setName('color').setDescription('Embed colour hex (default: #F5C542)'))
      .addBooleanOption(o => o.setName('use_dropdown').setDescription('Use a dropdown menu instead of buttons? (max 25 options)'))
      .addIntegerOption(o => o.setName('temp_minutes').setDescription('For temp mode: how many minutes the role lasts').setMinValue(1))
      .addChannelOption(o => o.setName('channel').setDescription('Where to post (defaults to current channel)').addChannelTypes(ChannelType.GuildText)))

    .addSubcommand(s => s
      .setName('addoption')
      .setDescription('Add a role option to an existing RR message')
      .addStringOption(o => o.setName('message_id').setDescription('The ID of the RR message').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true))
      .addStringOption(o => o.setName('label').setDescription('Button/option label').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji for the button/option'))
      .addStringOption(o => o.setName('description').setDescription('Short description (shown in dropdown)')))

    .addSubcommand(s => s
      .setName('removeoption')
      .setDescription('Remove an option from an RR message')
      .addStringOption(o => o.setName('message_id').setDescription('RR message ID').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))

    .addSubcommand(s => s
      .setName('restrict')
      .setDescription('Restrict RR access by role')
      .addStringOption(o => o.setName('message_id').setDescription('RR message ID').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Type').setRequired(true).addChoices(
        { name: 'Required (must have to use)', value: 'required' },
        { name: 'Blacklist (blocked from using)', value: 'blacklist' },
      ))
      .addStringOption(o => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices(
        { name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' },
      ))
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))

    .addSubcommand(s => s
      .setName('delete')
      .setDescription('Delete an RR message and its config')
      .addStringOption(o => o.setName('message_id').setDescription('RR message ID').setRequired(true)))

    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all reaction role messages in this server')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (sub === 'create') {
      const title       = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const mode        = interaction.options.getString('mode')       ?? 'multiple';
      const color       = interaction.options.getString('color')      ?? '#F5C542';
      const useSelect   = interaction.options.getBoolean('use_dropdown') ?? false;
      const tempMin     = interaction.options.getInteger('temp_minutes');
      const channel     = interaction.options.getChannel('channel')   ?? interaction.channel;

      const modeLabels = {
        multiple: '🔵 Multiple',
        unique:   '🟡 Unique',
        toggle:   '🟢 Toggle',
        temp:     `⏳ Temporary (${tempMin ?? '?'}min)`,
      };

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({ text: `Mode: ${modeLabels[mode]} · Add options with /rr addoption` })
        .setTimestamp();

      const sent = await channel.send({ embeds: [embed] });

      await ReactionRole.create({
        guildId:   interaction.guild.id,
        channelId: channel.id,
        messageId: sent.id,
        title, description, color, mode, useSelect,
        tempDuration: tempMin,
        options: [],
      });

      return interaction.editReply({ embeds: [makeEmbed({
        color: Colors.success, title: '✅ Reaction Role created!',
        fields: [
          { name: 'Channel',    value: `<#${channel.id}>`,    inline: true },
          { name: 'Mode',       value: modeLabels[mode],       inline: true },
          { name: 'Interface',  value: useSelect ? 'Dropdown menu' : 'Buttons', inline: true },
          { name: 'Next step',  value: `Use \`/rr addoption message_id:${sent.id}\` to add roles.` },
        ],
      })] });
    }

    // ── ADD OPTION ────────────────────────────────────────────────────────────
    if (sub === 'addoption') {
      const messageId = interaction.options.getString('message_id');
      const role      = interaction.options.getRole('role');
      const label     = interaction.options.getString('label');
      const emoji     = interaction.options.getString('emoji');
      const desc      = interaction.options.getString('description');

      const cfg = await ReactionRole.findOne({ guildId: interaction.guild.id, messageId });
      if (!cfg) return interaction.editReply({ embeds: [err(`No RR found with message ID \`${messageId}\`. Make sure you copied the right ID.`)] });

      const maxOptions = cfg.useSelect ? 25 : 25; // max 25 either way
      if (cfg.options.length >= maxOptions) return interaction.editReply({ embeds: [err(`Maximum ${maxOptions} options reached.`)] });

      // Check for duplicate role
      if (cfg.options.some(o => o.roleId === role.id)) {
        return interaction.editReply({ embeds: [err(`**${role.name}** is already in this RR message.`)] });
      }

      cfg.options.push({ emoji, label, description: desc, roleId: role.id });
      await cfg.save();

      // Update message components
      await updateRRMessage(interaction.guild, cfg);

      return interaction.editReply({ embeds: [ok(`Option **${label}** → <@&${role.id}> added! (${cfg.options.length} total)`)] });
    }

    // ── REMOVE OPTION ─────────────────────────────────────────────────────────
    if (sub === 'removeoption') {
      const messageId = interaction.options.getString('message_id');
      const role      = interaction.options.getRole('role');

      const cfg = await ReactionRole.findOne({ guildId: interaction.guild.id, messageId });
      if (!cfg) return interaction.editReply({ embeds: [err('RR not found.')] });

      const before = cfg.options.length;
      cfg.options = cfg.options.filter(o => o.roleId !== role.id);
      if (cfg.options.length === before) return interaction.editReply({ embeds: [err(`**${role.name}** was not in this RR.`)] });

      await cfg.save();
      await updateRRMessage(interaction.guild, cfg);
      return interaction.editReply({ embeds: [ok(`**${role.name}** removed. (${cfg.options.length} options left)`)] });
    }

    // ── RESTRICT ──────────────────────────────────────────────────────────────
    if (sub === 'restrict') {
      const messageId = interaction.options.getString('message_id');
      const type      = interaction.options.getString('type');
      const action    = interaction.options.getString('action');
      const role      = interaction.options.getRole('role');

      const cfg = await ReactionRole.findOne({ guildId: interaction.guild.id, messageId });
      if (!cfg) return interaction.editReply({ embeds: [err('RR not found.')] });

      const field = type === 'required' ? 'requiredRoles' : 'blacklistRoles';
      if (!cfg[field]) cfg[field] = [];

      if (action === 'add') {
        if (!cfg[field].includes(role.id)) cfg[field].push(role.id);
      } else {
        cfg[field] = cfg[field].filter(r => r !== role.id);
      }

      await cfg.save();
      return interaction.editReply({ embeds: [ok(`**${role.name}** ${action === 'add' ? 'added to' : 'removed from'} **${type}** list.`)] });
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const messageId = interaction.options.getString('message_id');
      const cfg = await ReactionRole.findOneAndDelete({ guildId: interaction.guild.id, messageId });
      if (!cfg) return interaction.editReply({ embeds: [err('RR not found.')] });

      // Try to delete the Discord message too
      const ch = interaction.guild.channels.cache.get(cfg.channelId);
      if (ch) {
        const msg = await ch.messages.fetch(messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      }
      return interaction.editReply({ embeds: [ok('Reaction role message deleted.')] });
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const all = await ReactionRole.find({ guildId: interaction.guild.id });
      if (all.length === 0) return interaction.editReply({ embeds: [makeEmbed({
        color: Colors.brand, description: 'No reaction roles configured yet. Use `/rr create` to get started!',
      })] });

      const fields = all.slice(0, 10).map(r => ({
        name: r.title,
        value: `Channel: <#${r.channelId}> | Mode: **${r.mode}** | Options: ${r.options.length}\nMessage ID: \`${r.messageId}\``,
      }));

      return interaction.editReply({ embeds: [makeEmbed({
        color: Colors.brand, title: `🎭 Reaction Roles (${all.length})`, fields,
      })] });
    }
  },
};

// ─── Build and update the message's buttons/select ─────────────────────────────
async function updateRRMessage(guild, cfg) {
  try {
    const ch = guild.channels.cache.get(cfg.channelId);
    if (!ch) return;
    const msg = await ch.messages.fetch(cfg.messageId).catch(() => null);
    if (!msg) return;

    const components = buildComponents(cfg);
    await msg.edit({ components });
  } catch (e) {
    console.error('[RR] updateRRMessage error:', e.message);
  }
}

function buildComponents(cfg) {
  if (cfg.options.length === 0) return [];
  const rows = [];

  if (cfg.useSelect) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`rr_sel_${cfg.messageId}`)
      .setPlaceholder('Select a role...')
      .setMinValues(1)
      .setMaxValues(cfg.mode === 'unique' ? 1 : Math.min(cfg.options.length, 25))
      .addOptions(cfg.options.slice(0, 25).map(opt => {
        const o = { label: opt.label, value: opt.roleId };
        if (opt.emoji) o.emoji = opt.emoji;
        if (opt.description) o.description = opt.description.slice(0, 100);
        return o;
      }));
    rows.push(new ActionRowBuilder().addComponents(select));
  } else {
    // Buttons — max 5 per row, max 5 rows = 25
    for (let i = 0; i < Math.min(cfg.options.length, 25); i += 5) {
      const row = new ActionRowBuilder();
      for (const opt of cfg.options.slice(i, i + 5)) {
        const btn = new ButtonBuilder()
          .setCustomId(`rr_btn_${cfg.messageId}_${opt.roleId}`)
          .setLabel(opt.label)
          .setStyle(ButtonStyle.Secondary);
        if (opt.emoji) {
          try { btn.setEmoji(opt.emoji); } catch { /* invalid emoji, skip */ }
        }
        row.addComponents(btn);
      }
      rows.push(row);
    }
  }

  return rows;
}
