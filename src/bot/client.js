const { Client, GatewayIntentBits, Partials } = require('discord.js');
const logger = require('../utils/logger');

function createDiscordClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  // Error handling
  client.on('error', (error) => {
    logger.error('Discord client error:', error);
  });

  client.on('warn', (warning) => {
    logger.warn('Discord client warning:', warning);
  });

  return client;
}

module.exports = createDiscordClient;