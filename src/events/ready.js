// src/events/ready.js
import { ActivityType } from 'discord.js';

export default {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`\n🧀 CheeseBot is online as ${client.user.tag}`);
    console.log(`   ${client.guilds.cache.size} server(s) | ${client.users.cache.size} user(s)`);
    console.log(`   Origin: United Kingdom 🇬🇧\n`);

    const updatePresence = () => {
      client.user.setPresence({
        status: 'online',
        activities: [{ name: `/help | ${client.guilds.cache.size} servers`, type: ActivityType.Watching }],
      });
    };
    updatePresence();
    setInterval(updatePresence, 30 * 60 * 1000);
  },
};
