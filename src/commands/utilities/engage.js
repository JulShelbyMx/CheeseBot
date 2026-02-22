// src/commands/utilities/engage.js
import {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { ok, err, brand, makeEmbed, Colors, parseDuration, humanDuration } from '../../utils/index.js';
import { getGuild, Giveaway } from '../../models/index.js';
import { finalizeGiveaway } from '../../handlers/scheduler.js';

// ═══════════════════════════════════════════════════════════════════════════════
// POLL
// ═══════════════════════════════════════════════════════════════════════════════
export const poll = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll with up to 10 options')
    .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Options separated by | (e.g. Yes|No|Maybe). Leave empty for Yes/No poll.'))
    .addIntegerOption(o => o.setName('duration_minutes').setDescription('Auto-close after X minutes').setMinValue(1).setMaxValue(10080))
    .addBooleanOption(o => o.setName('anonymous').setDescription('Hide vote counts until poll ends')),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const rawOpts  = interaction.options.getString('options');
    const duration = interaction.options.getInteger('duration_minutes');
    const anon     = interaction.options.getBoolean('anonymous') ?? false;

    const options = rawOpts
      ? rawOpts.split('|').map(o => o.trim()).filter(Boolean).slice(0, 10)
      : ['👍 Yes', '👎 No'];

    const numberEmojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

    const desc = options.map((o, i) => `${numberEmojis[i]}  ${o}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(Colors.brand)
      .setTitle('📊 ' + question)
      .setDescription(desc)
      .setFooter({ text: `Poll by ${interaction.user.username}${duration ? ` · Closes in ${duration}min` : ''}${anon ? ' · Anonymous' : ''}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    const msg = await interaction.fetchReply();

    for (let i = 0; i < options.length; i++) {
      await msg.react(numberEmojis[i]).catch(() => {});
    }

    if (duration) {
      setTimeout(async () => {
        const fresh = await msg.fetch().catch(() => null);
        if (!fresh) return;

        const results = options.map((opt, i) => ({
          option: opt,
          count: (fresh.reactions.cache.get(numberEmojis[i])?.count ?? 1) - 1,
        })).sort((a, b) => b.count - a.count);

        const total = results.reduce((s, r) => s + r.count, 0);
        const bar = (v, t, len = 14) => {
          const pct = t > 0 ? v / t : 0;
          return `${'█'.repeat(Math.round(pct * len))}${'░'.repeat(len - Math.round(pct * len))} ${Math.round(pct * 100)}%`;
        };

        const resultDesc = results.map((r, i) =>
          `${i === 0 && r.count > 0 ? '🏆' : numberEmojis[results.indexOf(r)]}  **${r.option}**\n${bar(r.count, total)}  ${r.count} vote(s)`
        ).join('\n\n');

        await msg.edit({ embeds: [makeEmbed({
          color: Colors.success, title: `📊 Results: ${question}`, description: resultDesc,
          footer: `${total} total votes`,
        })], }).catch(() => {});
      }, duration * 60 * 1000);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUGGEST
// ═══════════════════════════════════════════════════════════════════════════════
export const suggest = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit a suggestion')
    .addStringOption(o => o.setName('suggestion').setDescription('Your idea').setRequired(true).setMaxLength(1000))
    .addStringOption(o => o.setName('category').setDescription('Optional category').setMaxLength(50)),

  async execute(interaction) {
    const text     = interaction.options.getString('suggestion');
    const category = interaction.options.getString('category');
    const cfg = await getGuild(interaction.guild.id);

    if (!cfg.suggestions?.enabled || !cfg.suggestions?.channelId) {
      return interaction.reply({
        embeds: [err('Suggestions are not set up. Ask an admin to run `/config suggestions`.')],
        ephemeral: true,
      });
    }

    const ch = interaction.guild.channels.cache.get(cfg.suggestions.channelId);
    if (!ch) return interaction.reply({ embeds: [err('Suggestion channel not found.')], ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(Colors.brand)
      .setTitle('💡 New Suggestion')
      .setDescription(text)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .addFields(
        { name: 'Status', value: '⏳ Pending', inline: true },
        ...(category ? [{ name: 'Category', value: category, inline: true }] : []),
      )
      .setTimestamp();

    const msg = await ch.send({ embeds: [embed] });
    await msg.react('👍').catch(() => {});
    await msg.react('👎').catch(() => {});

    if (cfg.suggestions.threadEnabled) {
      await msg.startThread({ name: `Suggestion by ${interaction.user.username}` }).catch(() => {});
    }

    return interaction.reply({ embeds: [ok('Your suggestion has been submitted! 💡')], ephemeral: true });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GIVEAWAY
// ═══════════════════════════════════════════════════════════════════════════════
export const giveaway = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(s => s
      .setName('start')
      .setDescription('Start a giveaway')
      .addStringOption(o => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('How long? (e.g. 1h, 2d, 30m)').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(20))
      .addStringOption(o => o.setName('description').setDescription('Extra description or rules'))
      .addRoleOption(o => o.setName('required_role').setDescription('Only members with this role can enter'))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post in (default: current)')))

    .addSubcommand(s => s
      .setName('end')
      .setDescription('End a giveaway early')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)))

    .addSubcommand(s => s
      .setName('reroll')
      .setDescription('Pick a new winner for a finished giveaway')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID of the finished giveaway').setRequired(true))
      .addIntegerOption(o => o.setName('count').setDescription('How many new winners to pick').setMinValue(1).setMaxValue(20)))

    .addSubcommand(s => s
      .setName('list')
      .setDescription('List active giveaways')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    // ── start ─────────────────────────────────────────────────────────────────
    if (sub === 'start') {
      const prize        = interaction.options.getString('prize');
      const durationStr  = interaction.options.getString('duration');
      const winners      = interaction.options.getInteger('winners')  ?? 1;
      const description  = interaction.options.getString('description');
      const requiredRole = interaction.options.getRole('required_role');
      const channel      = interaction.options.getChannel('channel') ?? interaction.channel;

      const ms = parseDuration(durationStr);
      if (!ms) return interaction.editReply({ embeds: [err('Invalid duration. Examples: `30m`, `2h`, `1d`')] });

      const endsAt = new Date(Date.now() + ms);
      const endsTs = Math.floor(endsAt.getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(Colors.brand)
        .setTitle('🎉 GIVEAWAY 🎉')
        .setDescription(
          `**Prize: ${prize}**\n\n` +
          (description ? `${description}\n\n` : '') +
          `Click 🎉 below to enter!` +
          (requiredRole ? `\n\n🔒 Requires role: <@&${requiredRole.id}>` : '')
        )
        .addFields(
          { name: '⏰ Ends',       value: `<t:${endsTs}:R> (<t:${endsTs}:f>)`,  inline: true  },
          { name: '🏆 Winners',    value: String(winners),                        inline: true  },
          { name: '👤 Hosted by',  value: `<@${interaction.user.id}>`,            inline: true  },
        )
        .setFooter({ text: 'React with 🎉 to enter!' })
        .setTimestamp(endsAt);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_enter')
          .setLabel('Enter Giveaway')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎉')
      );

      const msg = await channel.send({ embeds: [embed], components: [row] });

      const gw = await Giveaway.create({
        guildId: interaction.guild.id,
        channelId: channel.id,
        messageId: msg.id,
        prize, description,
        winnersCount: winners,
        endsAt,
        hostedBy: interaction.user.id,
        requiredRole: requiredRole?.id,
        participants: [],
      });

      // Collect button clicks
      const collector = msg.createMessageComponentCollector({ time: ms });

      collector.on('collect', async (i) => {
        if (i.customId !== 'giveaway_enter') return;
        await i.deferUpdate();

        const gDoc = await Giveaway.findById(gw._id);
        if (!gDoc || gDoc.ended) return;

        // Check required role
        if (requiredRole && !i.member.roles.cache.has(requiredRole.id)) {
          return i.followUp({ embeds: [err(`You need the <@&${requiredRole.id}> role to enter.`)], ephemeral: true });
        }

        if (gDoc.participants.includes(i.user.id)) {
          // Toggle: remove entry
          await Giveaway.updateOne({ _id: gw._id }, { $pull: { participants: i.user.id } });
          return i.followUp({ embeds: [makeEmbed({ color: Colors.warn, description: '↩️ You withdrew your entry.' })], ephemeral: true });
        } else {
          await Giveaway.updateOne({ _id: gw._id }, { $addToSet: { participants: i.user.id } });
          return i.followUp({ embeds: [ok('🎉 You entered the giveaway! Good luck!')], ephemeral: true });
        }
      });

      collector.on('end', async () => {
        const gDoc = await Giveaway.findById(gw._id);
        if (!gDoc?.ended) await finalizeGiveaway(interaction.client, gDoc);
      });

      return interaction.editReply({ embeds: [ok(
        `🎉 Giveaway started in <#${channel.id}>!\nEnds <t:${endsTs}:R>`
      )] });
    }

    // ── end ───────────────────────────────────────────────────────────────────
    if (sub === 'end') {
      const msgId = interaction.options.getString('message_id');
      const gw = await Giveaway.findOne({ guildId: interaction.guild.id, messageId: msgId, ended: false });
      if (!gw) return interaction.editReply({ embeds: [err('Active giveaway not found with that message ID.')] });
      await finalizeGiveaway(interaction.client, gw);
      return interaction.editReply({ embeds: [ok('Giveaway ended!')] });
    }

    // ── reroll ────────────────────────────────────────────────────────────────
    if (sub === 'reroll') {
      const msgId = interaction.options.getString('message_id');
      const count = interaction.options.getInteger('count') ?? 1;
      const gw = await Giveaway.findOne({ guildId: interaction.guild.id, messageId: msgId, ended: true });
      if (!gw) return interaction.editReply({ embeds: [err('Finished giveaway not found.')] });
      if (gw.participants.length === 0) return interaction.editReply({ embeds: [err('No participants to pick from.')] });

      const shuffled = [...gw.participants].sort(() => Math.random() - 0.5);
      const newWinners = [...new Set(shuffled)].slice(0, count);

      const ch = interaction.guild.channels.cache.get(gw.channelId);
      if (ch) {
        await ch.send({
          embeds: [makeEmbed({
            color: Colors.brand,
            description: `🎲 **Reroll!** New winner(s): ${newWinners.map(w => `<@${w}>`).join(', ')}\nPrize: **${gw.prize}**`,
          })],
        });
      }
      return interaction.editReply({ embeds: [ok(`Rerolled! New winner(s): ${newWinners.map(w => `<@${w}>`).join(', ')}`)] });
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const active = await Giveaway.find({ guildId: interaction.guild.id, ended: false });
      if (active.length === 0) return interaction.editReply({ embeds: [makeEmbed({
        color: Colors.brand, description: 'No active giveaways.',
      })] });

      const fields = active.map(gw => ({
        name: gw.prize,
        value: `Channel: <#${gw.channelId}> | Ends: <t:${Math.floor(gw.endsAt.getTime() / 1000)}:R> | Winners: ${gw.winnersCount} | Entries: ${gw.participants.length}\nID: \`${gw.messageId}\``,
      }));

      return interaction.editReply({ embeds: [makeEmbed({
        color: Colors.brand, title: `🎉 Active Giveaways (${active.length})`, fields,
      })] });
    }
  },
};
