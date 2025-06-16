const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const config = require('./config');
const createDiscordClient = require('./bot/client');
const { initializeFirebase } = require('./config/firebase');
const evaluationService = require('./services/evaluationService');
const schedulerService = require('./services/schedulerService');
const logger = require('./utils/logger');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

async function startBot() {
  try {
    logger.info('Starting DAO Contribution Bot...');

    // Initialize Firebase
    const db = initializeFirebase();
    logger.info('Firebase connected successfully');

    // Initialize evaluation service
    evaluationService.initialize(db);
    logger.info('Evaluation service initialized');

    // Create Discord client
    const client = createDiscordClient();

    // Load commands
    client.commands = new Collection();
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        logger.info(`Loaded command: ${command.data.name}`);
      } else {
        logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
      }
    }

    // Load event handlers
    const eventsPath = path.join(__dirname, 'bot', 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = require(filePath);
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }
      logger.info(`Loaded event: ${event.name}`);
    }

    // Login to Discord
    await client.login(config.discord.token);

    // Initialize scheduler after login
    schedulerService.initialize(client);
    logger.info('Scheduler service initialized');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down bot...');
      schedulerService.stop();
      client.destroy();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Start the bot
startBot();