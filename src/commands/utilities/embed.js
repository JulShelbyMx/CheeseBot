// src/commands/utilities/embed.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import { ok, err, makeEmbed, Colors } from '../../utils/index.js';
import { getGuild } from '../../models/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and send rich embeds')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

    .addSubcommand(s => s
      .setName('create')
      .setDescription('Build and send a custom embed')
      .addStringOption(o => o.setName('description').setDescription('Main text of the embed').setRequired(true))
      .addStringOption(o => o.setName('title').setDescription('Title'))
      .addStringOption(o => o.setName('color').setDescription('Hex colour (e.g. #FF0000) — default: CheeseBot yellow'))
      .addStringOption(o => o.setName('image').setDescription('URL for a large image at the bottom'))
      .addStringOption(o => o.setName('thumbnail').setDescription('URL for a small image in the corner'))
      .addStringOption(o => o.setName('footer').setDescription('Footer text'))
      .addStringOption(o => o.setName('author').setDescription('Author text shown above title'))
      .addStringOption(o => o.setName('author_icon').setDescription('Icon URL next to author text'))
      .addStringOption(o => o.setName('fields').setDescription('Fields: "Name:Value|Name2:Value2" — add :inline at end for inline'))
      .addBooleanOption(o => o.setName('timestamp').setDescription('Add a timestamp? (default: false)'))
      .addChannelOption(o => o.setName('channel').setDescription('Where to send (default: current channel)').addChannelTypes(ChannelType.GuildText)))

    .addSubcommand(s => s
      .setName('json')
      .setDescription('Send an embed using raw Discord JSON')
      .addStringOption(o => o.setName('json').setDescription('Paste your Discord embed JSON here').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Target channel')))

    .addSubcommand(s => s
      .setName('edit')
      .setDescription('Edit an existing embed posted by CheeseBot')
      .addStringOption(o => o.setName('message_id').setDescription('ID of the message to edit').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('New description'))
      .addStringOption(o => o.setName('title').setDescription('New title'))
      .addStringOption(o => o.setName('color').setDescription('New colour'))
      .addStringOption(o => o.setName('image').setDescription('New image URL'))
      .addStringOption(o => o.setName('footer').setDescription('New footer')))

    .addSubcommand(s => s
      .setName('template')
      .setDescription('Manage embed templates')
      .addStringOption(o => o.setName('action').setDescription('What to do').setRequired(true).addChoices(
        { name: '💾 Save (saves current channel\'s message)', value: 'save'   },
        { name: '📤 Load (sends a saved template)',           value: 'load'   },
        { name: '🗑️ Delete',                                  value: 'delete' },
        { name: '📋 List all templates',                      value: 'list'   },
      ))
      .addStringOption(o => o.setName('name').setDescription('Template name'))
      .addStringOption(o => o.setName('message_id').setDescription('Message ID to save as template'))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send loaded template to'))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (sub === 'create') {
      const description = interaction.options.getString('description');
      const title       = interaction.options.getString('title');
      const color       = interaction.options.getString('color') ?? '#F5C542';
      const image       = interaction.options.getString('image');
      const thumbnail   = interaction.options.getString('thumbnail');
      const footer      = interaction.options.getString('footer');
      const author      = interaction.options.getString('author');
      const authorIcon  = interaction.options.getString('author_icon');
      const fieldsStr   = interaction.options.getString('fields');
      const timestamp   = interaction.options.getBoolean('timestamp') ?? false;
      const channel     = interaction.options.getChannel('channel') ?? interaction.channel;

      const e = new EmbedBuilder().setDescription(description);

      try { e.setColor(color); } catch { e.setColor('#F5C542'); }
      if (title)    e.setTitle(title);
      if (image)    e.setImage(image);
      if (thumbnail)e.setThumbnail(thumbnail);
      if (footer)   e.setFooter({ text: footer });
      if (author)   e.setAuthor({ name: author, iconURL: authorIcon || undefined });
      if (timestamp)e.setTimestamp();

      if (fieldsStr) {
        const parsed = fieldsStr.split('|').map(f => {
          const inline = f.toLowerCase().endsWith(':inline');
          const clean  = f.replace(/:inline$/i, '');
          const colon  = clean.indexOf(':');
          if (colon === -1) return null;
          const name  = clean.slice(0, colon).trim();
          const value = clean.slice(colon + 1).trim();
          return name && value ? { name, value, inline } : null;
        }).filter(Boolean).slice(0, 25);
        if (parsed.length) e.addFields(parsed);
      }

      await channel.send({ embeds: [e] });
      return interaction.editReply({ embeds: [ok(`Embed sent to <#${channel.id}>!`)] });
    }

    // ── JSON ──────────────────────────────────────────────────────────────────
    if (sub === 'json') {
      const raw     = interaction.options.getString('json');
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      try {
        const data = JSON.parse(raw);
        const e = new EmbedBuilder(data);
        await channel.send({ embeds: [e] });
        return interaction.editReply({ embeds: [ok('Embed sent!')] });
      } catch (ex) {
        return interaction.editReply({ embeds: [err(`Invalid JSON: \`${ex.message}\`\n\nMake sure you paste valid embed JSON. You can build one at https://discohook.org`)] });
      }
    }

    // ── EDIT ──────────────────────────────────────────────────────────────────
    if (sub === 'edit') {
      const msgId  = interaction.options.getString('message_id');
      const msg    = await interaction.channel.messages.fetch(msgId).catch(() => null);

      if (!msg) return interaction.editReply({ embeds: [err('Message not found in this channel.')] });
      if (msg.author.id !== interaction.client.user.id) return interaction.editReply({ embeds: [err("I can only edit my own messages.")] });
      if (!msg.embeds.length) return interaction.editReply({ embeds: [err("That message doesn't contain an embed.")] });

      const e = EmbedBuilder.from(msg.embeds[0]);

      const desc   = interaction.options.getString('description');
      const title  = interaction.options.getString('title');
      const color  = interaction.options.getString('color');
      const image  = interaction.options.getString('image');
      const footer = interaction.options.getString('footer');

      if (desc)   e.setDescription(desc);
      if (title)  e.setTitle(title);
      if (color)  { try { e.setColor(color); } catch {} }
      if (image)  e.setImage(image);
      if (footer) e.setFooter({ text: footer });

      await msg.edit({ embeds: [e] });
      return interaction.editReply({ embeds: [ok('Embed updated!')] });
    }

    // ── TEMPLATE ──────────────────────────────────────────────────────────────
    if (sub === 'template') {
      const action  = interaction.options.getString('action');
      const name    = interaction.options.getString('name');
      const msgId   = interaction.options.getString('message_id');
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      const cfg     = await getGuild(interaction.guild.id);
      if (!cfg.embedTemplates) cfg.embedTemplates = [];

      if (action === 'list') {
        const templates = cfg.embedTemplates ?? [];
        return interaction.editReply({ embeds: [makeEmbed({
          color: Colors.brand, title: '📋 Embed Templates',
          description: templates.length > 0
            ? templates.map(t => `• **${t.name}** — saved by <@${t.createdBy}>`).join('\n')
            : 'No templates saved yet. Use `/embed template save` to save one.',
        })] });
      }

      if (action === 'save') {
        if (!name) return interaction.editReply({ embeds: [err('Please provide a template name.')] });
        if (!msgId) return interaction.editReply({ embeds: [err('Please provide the message ID to save as template.')] });

        const msg = await interaction.channel.messages.fetch(msgId).catch(() => null);
        if (!msg?.embeds?.length) return interaction.editReply({ embeds: [err('Message with embed not found.')] });

        const idx = cfg.embedTemplates.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
        const tpl = { name, data: msg.embeds[0].toJSON(), createdBy: interaction.user.id };
        if (idx !== -1) cfg.embedTemplates[idx] = tpl;
        else cfg.embedTemplates.push(tpl);

        cfg.markModified('embedTemplates');
        await cfg.save();
        return interaction.editReply({ embeds: [ok(`Template **${name}** saved!`)] });
      }

      if (action === 'load') {
        if (!name) return interaction.editReply({ embeds: [err('Please provide the template name.')] });
        const tpl = cfg.embedTemplates.find(t => t.name.toLowerCase() === name.toLowerCase());
        if (!tpl) return interaction.editReply({ embeds: [err(`Template **${name}** not found.`)] });

        const e = new EmbedBuilder(tpl.data);
        await channel.send({ embeds: [e] });
        return interaction.editReply({ embeds: [ok(`Template **${name}** sent to <#${channel.id}>!`)] });
      }

      if (action === 'delete') {
        if (!name) return interaction.editReply({ embeds: [err('Please provide the template name.')] });
        const before = cfg.embedTemplates.length;
        cfg.embedTemplates = cfg.embedTemplates.filter(t => t.name.toLowerCase() !== name.toLowerCase());
        if (cfg.embedTemplates.length === before) return interaction.editReply({ embeds: [err(`Template **${name}** not found.`)] });
        cfg.markModified('embedTemplates');
        await cfg.save();
        return interaction.editReply({ embeds: [ok(`Template **${name}** deleted.`)] });
      }
    }
  },
};
