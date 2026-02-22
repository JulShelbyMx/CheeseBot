// src/events/interactionCreate.js
import { err } from '../utils/index.js';
import { handleRRInteraction } from '../handlers/reactionRoles.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {

    // ─── Slash Commands ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.client.commands.get(interaction.commandName);
      if (!cmd) return;
      try {
        await cmd.execute(interaction);
      } catch (e) {
        console.error(`[CMD ERROR] /${interaction.commandName}:`, e);
        const payload = { embeds: [err('An internal error occurred.')], ephemeral: true };
        if (interaction.replied || interaction.deferred) interaction.followUp(payload).catch(() => {});
        else interaction.reply(payload).catch(() => {});
      }
      return;
    }

    // ─── Autocomplete ────────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const cmd = interaction.client.commands.get(interaction.commandName);
      if (cmd?.autocomplete) await cmd.autocomplete(interaction).catch(console.error);
      return;
    }

    // ─── Reaction Role Buttons & Selects ─────────────────────────────────────
    if (
      (interaction.isButton() && interaction.customId.startsWith('rr_')) ||
      (interaction.isStringSelectMenu() && interaction.customId.startsWith('rr_'))
    ) {
      await handleRRInteraction(interaction);
      return;
    }
  },
};
