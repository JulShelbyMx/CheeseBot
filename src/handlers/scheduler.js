// src/handlers/scheduler.js
import { TempAction, Giveaway } from '../models/index.js';
import { brand, makeEmbed, Colors } from '../utils/index.js';

// ─── Temp Bans / Mutes ─────────────────────────────────────────────────────────
export async function checkTempActions(client) {
  try {
    const expired = await TempAction.find({ expiresAt: { $lte: new Date() } });
    for (const action of expired) {
      try {
        const guild = client.guilds.cache.get(action.guildId);
        if (!guild) { await action.deleteOne(); continue; }

        if (action.type === 'ban') {
          await guild.bans.remove(action.userId, 'Temp-ban expired').catch(() => {});
        } else if (action.type === 'mute') {
          const member = await guild.members.fetch(action.userId).catch(() => null);
          if (member) await member.timeout(null, 'Temp-mute expired').catch(() => {});
        }
        await action.deleteOne();
      } catch (e) {
        console.error('[Scheduler] TempAction error:', e.message);
      }
    }
  } catch (e) {
    console.error('[Scheduler] checkTempActions:', e.message);
  }
}

// ─── Giveaways ─────────────────────────────────────────────────────────────────
export async function checkGiveaways(client) {
  try {
    const ended = await Giveaway.find({ endsAt: { $lte: new Date() }, ended: false });
    for (const gw of ended) {
      await finalizeGiveaway(client, gw);
    }
  } catch (e) {
    console.error('[Scheduler] checkGiveaways:', e.message);
  }
}

export async function finalizeGiveaway(client, gw) {
  try {
    gw.ended = true;
    const channel = client.channels.cache.get(gw.channelId);
    const message = channel ? await channel.messages.fetch(gw.messageId).catch(() => null) : null;

    // Pick winners (with bonus entries support)
    let pool = [...gw.participants];

    // Apply bonus entries (multiply entries for certain roles)
    if (gw.bonusEntries?.length > 0 && channel) {
      const expandedPool = [];
      for (const userId of pool) {
        const member = await channel.guild.members.fetch(userId).catch(() => null);
        let entries = 1;
        if (member) {
          for (const bonus of gw.bonusEntries) {
            if (member.roles.cache.has(bonus.roleId)) {
              entries = Math.max(entries, bonus.multiplier);
            }
          }
        }
        for (let i = 0; i < entries; i++) expandedPool.push(userId);
      }
      pool = expandedPool;
    }

    const winners = [];
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const seen = new Set();
    for (const id of shuffled) {
      if (!seen.has(id)) { seen.add(id); winners.push(id); }
      if (winners.length >= gw.winnersCount) break;
    }

    gw.winners = winners;
    await gw.save();

    const winText = winners.length > 0
      ? winners.map(w => `<@${w}>`).join(', ')
      : 'Nobody participated — no winner.';

    const resultEmbed = makeEmbed({
      color: Colors.brand,
      title: '🎊 Giveaway Ended!',
      fields: [
        { name: '🎁 Prize', value: gw.prize, inline: true },
        { name: `🏆 Winner(s) (${winners.length})`, value: winText, inline: true },
        { name: '👤 Hosted by', value: `<@${gw.hostedBy}>`, inline: true },
        { name: '👥 Participants', value: `${gw.participants.length}`, inline: true },
      ],
    });

    if (message) await message.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});

    if (winners.length > 0 && channel) {
      await channel.send({
        content: winners.map(w => `<@${w}>`).join(' '),
        embeds: [makeEmbed({
          color: Colors.brand,
          description: `🎊 Congratulations ${winners.map(w => `<@${w}>`).join(', ')}!\nYou won **${gw.prize}**!`,
        })],
      }).catch(() => {});
    }
  } catch (e) {
    console.error('[Scheduler] finalizeGiveaway:', e.message);
  }
}
