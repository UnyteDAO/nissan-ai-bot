const logger = require('../../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    logger.info(`Bot logged in as ${client.user.tag}`);
    logger.info(`Connected to ${client.guilds.cache.size} guilds`);
    
    // Set bot activity
    client.user.setActivity('DAO contributions', { type: 'WATCHING' });
  },
};