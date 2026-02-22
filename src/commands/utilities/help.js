// src/commands/utilities/help.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Colors, makeEmbed } from '../../utils/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all CheeseBot commands')
    .addStringOption(o => o
      .setName('category')
      .setDescription('Get detailed help for a category')
      .addChoices(
        { name: '🛡️ Moderation',     value: 'moderation'    },
        { name: '👋 Welcome',         value: 'welcome'       },
        { name: '🎭 Reaction Roles',  value: 'roles'         },
        { name: '📊 Polls & Suggest', value: 'polls'         },
        { name: '🎉 Giveaways',       value: 'giveaways'     },
        { name: '🎨 Embeds',          value: 'embeds'        },
        { name: '⚙️ Configuration',   value: 'config'        },
      )),

  async execute(interaction) {
    const cat = interaction.options.getString('category');

    const pages = {
      moderation: {
        emoji: '🛡️', title: 'Moderation',
        desc: [
          '### AutoMod',
          '`/automod setup` — Enable automod, set log channel & punishment',
          '`/automod rules` — Toggle anti-spam, anti-links, anti-invites, anti-caps, bad words',
          '`/automod badwords add/remove/list` — Manage forbidden words',
          '`/automod whitelist` — Allow specific domains when anti-links is on',
          '`/automod immune` — Exempt roles or channels from automod',
          '`/automod disable` — Turn off automod',
          '`/automod status` — View current automod settings',
          '',
          '### Anti-Raid',
          '`/antiraid setup` — Enable + configure threshold, interval, action',
          '`/antiraid lockdown lock:True/False` — Manually lock/unlock all channels',
          '`/antiraid disable` — Turn off anti-raid',
          '`/antiraid status` — View settings',
          '',
          '### Clear',
          '`/clear amount [user] [filter]` — Delete up to 1000 messages',
          '`!clear 50` — Same via text prefix (prefix set with `/config prefix`)',
        ].join('\n'),
      },
      welcome: {
        emoji: '👋', title: 'Welcome & Goodbye',
        desc: [
          '### Welcome Messages',
          '`/welcome join setup channel:#channel` — Set up welcome message',
          '`/welcome join setup message:"Hello {user}!"` — Custom message text',
          '`/welcome join setup embed:True color:#F5C542` — Embed style',
          '`/welcome join setup banner:URL` — Add banner image to embed',
          '`/welcome join setup dm_message:"Hey!"` — DM new members',
          '`/welcome join test` — Preview the welcome message now',
          '`/welcome join disable` — Turn off welcome',
          '',
          '### Goodbye Messages',
          '`/welcome leave setup channel:#channel` — Set up goodbye message',
          '`/welcome leave disable` — Turn off goodbye',
          '',
          '### Auto-Roles',
          '`/welcome autoroles add role:@Role` — Auto-assign this role on join',
          '`/welcome autoroles add role:@Role delay_seconds:5` — With a delay',
          '`/welcome autoroles remove role:@Role` — Remove auto-role',
          '`/welcome autoroles list` — List all auto-roles',
          '',
          '### Variables',
          '`{user}` → @mention | `{username}` → name | `{server}` → server name | `{memberCount}` → member count',
        ].join('\n'),
      },
      roles: {
        emoji: '🎭', title: 'Reaction Roles',
        desc: [
          '**Step 1:** Create the message',
          '`/rr create title:"Pick a role" description:"Choose below" mode:multiple`',
          '',
          '**Step 2:** Add role options',
          '`/rr addoption message_id:123 role:@Gamer label:"Gamer" emoji:🎮`',
          '`/rr addoption message_id:123 role:@Art label:"Artist" emoji:🎨`',
          '*(repeat for each role)*',
          '',
          '**Modes:**',
          '`multiple` — Pick as many roles as you want (default)',
          '`unique` — Only one role at a time (others get removed)',
          '`toggle` — Click to add, click again to remove',
          '`temp` — Role expires after a set number of minutes',
          '',
          '**Other commands:**',
          '`/rr addoption` — Add a role option to an existing RR',
          '`/rr removeoption` — Remove a role option',
          '`/rr restrict` — Require or block certain roles from using a menu',
          '`/rr delete` — Delete an RR message',
          '`/rr list` — List all RR messages',
          '',
          '**Interface:**',
          'Use `use_dropdown:True` in `/rr create` for a dropdown menu instead of buttons.',
        ].join('\n'),
      },
      polls: {
        emoji: '📊', title: 'Polls & Suggestions',
        desc: [
          '### Polls',
          '`/poll question:"Best color?" options:"Red|Blue|Green"`',
          '`/poll question:"Yes or no?"` — Simple yes/no poll (no options needed)',
          '`/poll ... duration_minutes:60` — Auto-close and show results after 60 min',
          '',
          '### Suggestions',
          '`/suggest suggestion:"Add a music bot!"` — Submit a suggestion',
          '',
          '**Setup required:** Run `/config suggestions channel:#channel` first.',
          'Each suggestion gets 👍 and 👎 reactions, and optionally a thread for discussion.',
        ].join('\n'),
      },
      giveaways: {
        emoji: '🎉', title: 'Giveaways',
        desc: [
          '`/giveaway start prize:"Nitro" duration:1d` — Start a 1-day giveaway',
          '`/giveaway start prize:"Gift" duration:2h winners:3` — 3 winners',
          '`/giveaway start ... required_role:@Member` — Only members with role can enter',
          '`/giveaway start ... description:"Must be in server for 30 days"` — Add rules',
          '`/giveaway start ... channel:#giveaways` — Post in specific channel',
          '',
          '`/giveaway end message_id:123` — End a giveaway early',
          '`/giveaway reroll message_id:123` — Pick a new winner',
          '`/giveaway reroll message_id:123 count:2` — Pick 2 new winners',
          '`/giveaway list` — List all active giveaways',
          '',
          '**How it works:**',
          'Members click the "Enter Giveaway" button. Click again to withdraw. Winners are picked randomly when the giveaway ends.',
        ].join('\n'),
      },
      embeds: {
        emoji: '🎨', title: 'Embed Creator',
        desc: [
          '### Create',
          '`/embed create description:"Hello!"` — Simple embed',
          '`/embed create description:"..." title:"My Title" color:#FF5733`',
          '`/embed create ... image:URL thumbnail:URL footer:"Footer text"`',
          '`/embed create ... fields:"Name:Value|Name2:Value2:inline"`',
          '`/embed create ... channel:#announcements` — Send to another channel',
          '',
          '### JSON Mode',
          '`/embed json json:{...}` — Paste raw Discord embed JSON',
          '→ Build embeds visually at https://discohook.org then paste the JSON',
          '',
          '### Edit',
          '`/embed edit message_id:123 description:"New text"` — Edit an existing embed',
          '',
          '### Templates',
          '`/embed template save name:"welcome" message_id:123` — Save as template',
          '`/embed template load name:"welcome"` — Send a saved template',
          '`/embed template list` — View all templates',
          '`/embed template delete name:"welcome"` — Delete a template',
        ].join('\n'),
      },
      config: {
        emoji: '⚙️', title: 'Configuration',
        desc: [
          '`/config status` — View all current settings',
          '',
          '### Logs',
          '`/config logs channel:#logs` — Enable logging',
          '`/config logs channel:#logs message_delete:True bans:True` — Toggle specific events',
          '`/config logs_disable` — Turn off logging',
          '',
          '### Suggestions',
          '`/config suggestions channel:#suggest` — Set suggestions channel',
          '`/config suggestions_disable` — Disable suggestions',
          '',
          '### Auto Voice Channels',
          '`/config autochannel trigger:#Join-to-Create` — Set a trigger channel',
          "`/config autochannel trigger:#JtC name_template:\"{user}'s Room\"` — Custom name",
          '`/config autochannel_remove trigger:#JtC` — Remove trigger',
          '',
          '### Other',
          '`/config prefix prefix:!` — Set text command prefix (default: `!`)',
        ].join('\n'),
      },
    };

    // Specific category
    if (cat && pages[cat]) {
      const page = pages[cat];
      return interaction.reply({
        embeds: [makeEmbed({
          color: Colors.brand,
          title: `${page.emoji} ${page.title}`,
          description: page.desc,
        })],
        ephemeral: true,
      });
    }

    // Main overview
    const e = new EmbedBuilder()
      .setColor(Colors.brand)
      .setTitle('🧀 CheeseBot — Command Overview')
      .setDescription('A fully-featured Discord bot. Use `/help category:...` to see detailed commands for each section.')
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .addFields(
        { name: '🛡️ Moderation',    value: 'AutoMod, Anti-Raid, Clear',               inline: true },
        { name: '👋 Welcome',        value: 'Join/Leave messages, DMs, Auto-roles',    inline: true },
        { name: '🎭 Reaction Roles', value: 'Buttons or dropdowns, 4 modes',           inline: true },
        { name: '📊 Polls',          value: 'Up to 10 options, auto-close',            inline: true },
        { name: '💡 Suggestions',    value: 'Upvote/downvote, threads',                inline: true },
        { name: '🎉 Giveaways',      value: 'Button-based, reroll, role requirement',  inline: true },
        { name: '🎨 Embeds',         value: 'Full embed creator, JSON, templates',     inline: true },
        { name: '🔊 Auto-Channels',  value: 'Temp voice channels on demand',           inline: true },
        { name: '⚙️ Config',         value: 'Logs, prefix, auto-channels, and more', inline: true },
      )
      .setFooter({ text: 'CheeseBot 🧀' })
      .setTimestamp();

    return interaction.reply({ embeds: [e], ephemeral: true });
  },
};
