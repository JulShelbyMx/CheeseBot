// src/commands/moderation/antiraid.js
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { ok, err, makeEmbed, Colors } from '../../utils/index.js';
import { getGuild } from '../../models/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Configure anti-raid protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(s => s
      .setName('setup')
      .setDescription('Enable and configure anti-raid')
      .addIntegerOption(o => o.setName('threshold').setDescription('How many joins in the interval triggers the raid alert (default 10)').setMinValue(2).setMaxValue(100))
      .addIntegerOption(o => o.setName('interval_seconds').setDescription('Time window in seconds (default 10)').setMinValue(2).setMaxValue(60))
      .addStringOption(o => o.setName('action').setDescription('What to do with raiders').addChoices(
        { name: '👢 Kick',       value: 'kick'     },
        { name: '🔨 Ban',        value: 'ban'      },
        { name: '🔒 Lockdown',   value: 'lockdown' },
      ))
      .addChannelOption(o => o.setName('log_channel').setDescription('Channel for raid alerts').addChannelTypes(ChannelType.GuildText)))

    .addSubcommand(s => s.setName('disable').setDescription('Disable anti-raid protection'))

    .addSubcommand(s => s
      .setName('lockdown')
      .setDescription('Manually lock or unlock all text channels')
      .addBooleanOption(o => o.setName('lock').setDescription('True = lock, False = unlock').setRequired(true)))

    .addSubcommand(s => s.setName('status').setDescription('View anti-raid settings')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const cfg = await getGuild(interaction.guild.id);

    if (sub === 'setup') {
      if (!cfg.antiraid) cfg.antiraid = {};
      const threshold = interaction.options.getInteger('threshold');
      const interval  = interaction.options.getInteger('interval_seconds');
      const action    = interaction.options.getString('action');
      const logCh     = interaction.options.getChannel('log_channel');

      cfg.antiraid.enabled = true;
      if (threshold) cfg.antiraid.threshold = threshold;
      if (interval)  cfg.antiraid.interval  = interval * 1000;
      if (action)    cfg.antiraid.action    = action;
      if (logCh)     cfg.antiraid.logChannelId = logCh.id;

      cfg.markModified('antiraid');
      await cfg.save();
      return interaction.editReply({ embeds: [ok(
        `Anti-raid **enabled**!\n` +
        `Threshold: **${cfg.antiraid.threshold}** joins in **${cfg.antiraid.interval / 1000}s** → **${cfg.antiraid.action}**`
      )] });
    }

    if (sub === 'disable') {
      cfg.antiraid = { ...(cfg.antiraid ?? {}), enabled: false };
      cfg.markModified('antiraid');
      await cfg.save();
      return interaction.editReply({ embeds: [ok('Anti-raid **disabled**.')] });
    }

    if (sub === 'lockdown') {
      const lock = interaction.options.getBoolean('lock');
      const text = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
      let count = 0;
      for (const [, ch] of text) {
        await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: lock ? false : null }).catch(() => {});
        count++;
      }
      return interaction.editReply({ embeds: [ok(
        lock
          ? `🔒 **Locked** ${count} channels. Use \`/antiraid lockdown lock:False\` to unlock.`
          : `🔓 **Unlocked** ${count} channels.`
      )] });
    }

    if (sub === 'status') {
      const ar = cfg.antiraid ?? {};
      return interaction.editReply({ embeds: [makeEmbed({
        color: Colors.brand, title: '🛡️ Anti-Raid Status',
        fields: [
          { name: 'Enabled',      value: ar.enabled ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Action',       value: ar.action ?? 'kick',             inline: true },
          { name: 'Log Channel',  value: ar.logChannelId ? `<#${ar.logChannelId}>` : 'Not set', inline: true },
          { name: 'Threshold',    value: `${ar.threshold ?? 10} joins`,   inline: true },
          { name: 'Interval',     value: `${(ar.interval ?? 10000) / 1000}s`, inline: true },
        ],
      })] });
    }
  },
};
