// src/events/voiceState.js
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { getGuild, TempChannel } from '../models/index.js';

export default {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guild = newState.guild ?? oldState.guild;
    const cfg = await getGuild(guild.id);

    // ─── User joined a trigger channel → create temp channel ────────────────
    if (newState.channelId && cfg.autoChannels?.length > 0) {
      const trigger = cfg.autoChannels.find(ac => ac.triggerId === newState.channelId);
      if (trigger) {
        const member = newState.member;
        const name = trigger.nameTemplate
          .replace('{user}', member.displayName)
          .replace('{username}', member.user.username);
        try {
          const created = await guild.channels.create({
            name,
            type: ChannelType.GuildVoice,
            parent: trigger.categoryId ?? newState.channel?.parentId,
            userLimit: trigger.userLimit ?? 0,
            permissionOverwrites: [{
              id: member.id,
              allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers],
            }],
          });
          await member.voice.setChannel(created).catch(() => {});
          await TempChannel.create({ guildId: guild.id, channelId: created.id, ownerId: member.id, triggerId: trigger.triggerId });
        } catch (e) {
          console.error('[AutoChannel] create error:', e.message);
        }
      }
    }

    // ─── User left a temp channel → delete if empty ───────────────────────────
    if (oldState.channelId) {
      const temp = await TempChannel.findOne({ guildId: guild.id, channelId: oldState.channelId });
      if (temp) {
        const ch = guild.channels.cache.get(oldState.channelId);
        if (ch && ch.members.size === 0) {
          await ch.delete('[CheeseBot] Temp channel empty').catch(() => {});
          await temp.deleteOne();
        }
      }
    }

    // ─── Voice logs ───────────────────────────────────────────────────────────
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;
    if (!cfg.logs?.enabled || !cfg.logs.events?.voiceUpdate || !cfg.logs.channelId) return;

    const { makeEmbed, Colors } = await import('../utils/index.js');
    const logCh = guild.channels.cache.get(cfg.logs.channelId);
    if (!logCh) return;

    let desc = '';
    if (!oldState.channelId && newState.channelId)
      desc = `🔊 **${member.user.tag}** joined <#${newState.channelId}>`;
    else if (oldState.channelId && !newState.channelId)
      desc = `🔇 **${member.user.tag}** left <#${oldState.channelId}>`;
    else if (oldState.channelId !== newState.channelId)
      desc = `🔀 **${member.user.tag}** moved from <#${oldState.channelId}> → <#${newState.channelId}>`;

    if (desc) await logCh.send({ embeds: [makeEmbed({ color: Colors.info, description: desc })] }).catch(() => {});
  },
};
