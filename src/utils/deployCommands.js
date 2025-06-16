const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('./logger');

async function deployCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      logger.info(`Loaded command: ${command.data.name}`);
    } else {
      logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commands },
    );

    logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    logger.error('Error deploying commands:', error);
    throw error;
  }
}

// Deploy commands if this file is run directly
if (require.main === module) {
  deployCommands()
    .then(() => {
      logger.info('Commands deployed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Failed to deploy commands:', error);
      process.exit(1);
    });
}

module.exports = deployCommands;