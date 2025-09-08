require('dotenv').config();

const config = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
  },
  gemini: {
    apiKey: process.env.GOOGLE_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  channels: {
    evaluationResultChannelId: process.env.EVALUATION_RESULT_CHANNEL_ID,
    summaryNotificationChannelId: process.env.SUMMARY_NOTIFICATION_CHANNEL_ID,
    excludedChannelIds: process.env.EXCLUDED_CHANNEL_IDS ?
      process.env.EXCLUDED_CHANNEL_IDS.split(',').map(id => id.trim()) : [],
  },
  logsExport: {
    sourceChannelIds: process.env.LOG_SOURCE_CHANNEL_IDS
      ? process.env.LOG_SOURCE_CHANNEL_IDS.split(',').map(id => id.trim()).filter(Boolean)
      : [],
    exportChannelId: process.env.LOG_EXPORT_CHANNEL_ID || null,
  },
  cron: {
    schedule: process.env.CRON_SCHEDULE || '0 18 * * *',
  },
  evaluation: {
    maxThreadsPerRun: parseInt(process.env.MAX_THREADS_PER_EVALUATION) || 50,
    maxMessagesPerThread: parseInt(process.env.MAX_MESSAGES_PER_THREAD) || 20,
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH) || 500,
    minThreadMessages: parseInt(process.env.MIN_THREAD_MESSAGES) || 3,
  },
  logging: {
    enableApiLogging: process.env.ENABLE_API_LOGGING !== 'false', // Default to true
    apiLogRetentionDays: parseInt(process.env.API_LOG_RETENTION_DAYS) || 30,
    enableAiInstructionLogging: process.env.ENABLE_AI_INSTRUCTION_LOGGING !== 'false', // Default to true
    aiLogPath: process.env.AI_LOG_PATH || './docs/logs',
    aiLogRetentionDays: parseInt(process.env.AI_LOG_RETENTION_DAYS) || 180,
  },
  env: process.env.NODE_ENV || 'development',
};

// Validate required configuration
const requiredConfig = [
  'discord.token',
  'discord.clientId',
  'gemini.apiKey',
  'firebase.projectId',
  'firebase.clientEmail',
  'firebase.privateKey',
];

requiredConfig.forEach((key) => {
  const keys = key.split('.');
  let value = config;
  for (const k of keys) {
    value = value[k];
  }
  if (!value) {
    throw new Error(`Missing required configuration: ${key}`);
  }
});

module.exports = config;
