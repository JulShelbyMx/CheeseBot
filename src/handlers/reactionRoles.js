// src/handlers/reactionRoles.js
import { ReactionRole, getGuild } from '../models/index.js';
import { err, makeEmbed, Colors } from '../utils/index.js';
import { t, getLang } from '../locales/index.js';

export async function handleRRInteraction(interaction) {
  const id = interaction.customId;

  let messageId, selectedRoles;

  if (interaction.isButton() && id.startsWith('rr_btn_')) {
    const afterPrefix = id.slice('rr_btn_'.length);
    const sepIdx = afterPrefix.indexOf('_');
    messageId = afterPrefix.slice(0, sepIdx);
    selectedRoles = [afterPrefix.slice(sepIdx + 1)];
  } else if (interaction.isStringSelectMenu() && id.startsWith('rr_sel_')) {
    messageId = id.slice('rr_sel_'.length);
    selectedRoles = interaction.values;
  } else {
    return;
  }

  const cfg  = await ReactionRole.findOne({ guildId: interaction.guild.id, messageId });
  const gcfg = await getGuild(interaction.guild.id);
  const lang = getLang(gcfg);

  if (!cfg) return interaction.reply({ embeds: [err('Reaction role config not found.')], ephemeral: true });

  if (cfg.requiredRoles?.length > 0) {
    const has = cfg.requiredRoles.some(r => interaction.member.roles.cache.has(r));
    if (!has) return interaction.reply({ embeds: [err(t('rr_no_access', lang))], ephemeral: true });
  }

  if (cfg.blacklistRoles?.length > 0) {
    const blocked = cfg.blacklistRoles.some(r => interaction.member.roles.cache.has(r));
    if (blocked) return interaction.reply({ embeds: [err(t('rr_blocked', lang))], ephemeral: true });
  }

  const added = [], removed = [];

  for (const roleId of selectedRoles) {
    const opt = cfg.options.find(o => o.roleId === roleId);
    if (!opt) continue;
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) continue;
    const has = interaction.member.roles.cache.has(roleId);

    switch (cfg.mode) {
      case 'unique': {
        for (const o of cfg.options) {
          if (o.roleId !== roleId && interaction.member.roles.cache.has(o.roleId)) {
            await interaction.member.roles.remove(o.roleId).catch(() => {});
            removed.push(o.roleId);
          }
        }
        if (!has) { await interaction.member.roles.add(roleId).catch(() => {}); added.push(roleId); }
        break;
      }
      case 'toggle':
      case 'multiple': {
        if (has) { await interaction.member.roles.remove(roleId).catch(() => {}); removed.push(roleId); }
        else     { await interaction.member.roles.add(roleId).catch(() => {}); added.push(roleId); }
        break;
      }
      case 'temp': {
        await interaction.member.roles.add(roleId).catch(() => {});
        added.push(roleId);
        if (cfg.tempDuration) setTimeout(async () => { await interaction.member.roles.remove(roleId).catch(() => {}); }, cfg.tempDuration * 60 * 1000);
        break;
      }
    }
  }

  const lines = [];
  if (added.length)   lines.push(t('rr_added',    lang, { roles: added.map(r   => `<@&${r}>`).join(', ') }));
  if (removed.length) lines.push(t('rr_removed',   lang, { roles: removed.map(r => `<@&${r}>`).join(', ') }));
  const desc = lines.length > 0 ? lines.join('\n') : t('rr_no_changes', lang);

  await interaction.reply({ embeds: [makeEmbed({ color: Colors.success, description: desc, timestamp: false })], ephemeral: true });
}
