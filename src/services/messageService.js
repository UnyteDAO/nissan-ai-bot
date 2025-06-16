const logger = require('../utils/logger');

class MessageService {
  constructor() {
    this.threadTimeoutMinutes = 30;
    this.nearMessageTimeMinutes = 5;
  }

  /**
   * Fetch messages from a channel within a date range
   * @param {Channel} channel - Discord channel
   * @param {Date} startDate - Start date for fetching messages
   * @param {Date} endDate - End date for fetching messages
   * @returns {Promise<Array>} Array of messages
   */
  async fetchChannelMessages(channel, startDate, endDate) {
    try {
      const messages = [];
      let lastId;

      while (true) {
        const options = { limit: 100 };
        if (lastId) {
          options.before = lastId;
        }

        const fetchedMessages = await channel.messages.fetch(options);
        
        if (fetchedMessages.size === 0) {
          break;
        }

        const filtered = fetchedMessages.filter(msg => {
          const msgDate = new Date(msg.createdTimestamp);
          return msgDate >= startDate && msgDate <= endDate && !msg.author.bot;
        });

        messages.push(...filtered.values());
        
        const oldestMessage = fetchedMessages.last();
        if (new Date(oldestMessage.createdTimestamp) < startDate) {
          break;
        }

        lastId = oldestMessage.id;
      }

      logger.info(`Fetched ${messages.length} messages from channel ${channel.name}`);
      return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    } catch (error) {
      logger.error(`Error fetching messages from channel ${channel.name}:`, error);
      throw error;
    }
  }

  /**
   * Detect conversation threads from messages
   * @param {Array} messages - Array of Discord messages
   * @returns {Array} Array of thread objects
   */
  detectThreads(messages) {
    const threads = [];
    const processedMessages = new Set();

    for (const message of messages) {
      if (processedMessages.has(message.id)) {
        continue;
      }

      const thread = this.buildThread(message, messages, processedMessages);
      if (thread.messages.length > 0) {
        threads.push(thread);
      }
    }

    logger.info(`Detected ${threads.length} conversation threads`);
    return threads;
  }

  /**
   * Build a single thread starting from a message
   * @param {Message} startMessage - Starting message
   * @param {Array} allMessages - All messages in the channel
   * @param {Set} processedMessages - Set of already processed message IDs
   * @returns {Object} Thread object
   */
  buildThread(startMessage, allMessages, processedMessages) {
    const thread = {
      id: `thread_${startMessage.id}`,
      messages: [],
      participants: new Set(),
      startTime: startMessage.createdTimestamp,
      endTime: startMessage.createdTimestamp,
      channelId: startMessage.channelId,
      channelName: startMessage.channel.name,
    };

    const messageQueue = [startMessage];
    const threadMessages = new Map();

    while (messageQueue.length > 0) {
      const currentMsg = messageQueue.shift();

      if (processedMessages.has(currentMsg.id) || threadMessages.has(currentMsg.id)) {
        continue;
      }

      threadMessages.set(currentMsg.id, currentMsg);
      processedMessages.add(currentMsg.id);
      thread.participants.add(currentMsg.author.id);

      // Find related messages
      const relatedMessages = this.findRelatedMessages(currentMsg, allMessages, threadMessages);
      messageQueue.push(...relatedMessages);
    }

    // Convert to array and sort by timestamp
    thread.messages = Array.from(threadMessages.values())
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    if (thread.messages.length > 0) {
      thread.startTime = thread.messages[0].createdTimestamp;
      thread.endTime = thread.messages[thread.messages.length - 1].createdTimestamp;
    }

    thread.participants = Array.from(thread.participants);

    return thread;
  }

  /**
   * Find messages related to the current message
   * @param {Message} message - Current message
   * @param {Array} allMessages - All messages
   * @param {Map} threadMessages - Messages already in the thread
   * @returns {Array} Related messages
   */
  findRelatedMessages(message, allMessages, threadMessages) {
    const related = [];
    const timeThreshold = this.nearMessageTimeMinutes * 60 * 1000;
    const threadTimeout = this.threadTimeoutMinutes * 60 * 1000;

    for (const msg of allMessages) {
      if (threadMessages.has(msg.id)) {
        continue;
      }

      // Check if it's a direct reply
      if (msg.reference && msg.reference.messageId === message.id) {
        related.push(msg);
        continue;
      }

      // Check if current message is replying to this message
      if (message.reference && message.reference.messageId === msg.id) {
        related.push(msg);
        continue;
      }

      // Check for mentions
      if (msg.mentions.has(message.author.id) || message.mentions.has(msg.author.id)) {
        const timeDiff = Math.abs(msg.createdTimestamp - message.createdTimestamp);
        if (timeDiff <= threadTimeout) {
          related.push(msg);
          continue;
        }
      }

      // Check for temporal proximity (within 5 minutes)
      const timeDiff = Math.abs(msg.createdTimestamp - message.createdTimestamp);
      if (timeDiff <= timeThreshold && msg.channelId === message.channelId) {
        // Additional check for conversation continuity
        if (this.isConversationContinuation(message, msg)) {
          related.push(msg);
        }
      }
    }

    return related;
  }

  /**
   * Check if two messages are part of the same conversation
   * @param {Message} msg1 - First message
   * @param {Message} msg2 - Second message
   * @returns {boolean} Whether they're part of the same conversation
   */
  isConversationContinuation(msg1, msg2) {
    // Simple heuristic: messages from same author or mentioning each other
    if (msg1.author.id === msg2.author.id) {
      return true;
    }

    // Check for common mentions or context
    const mentions1 = new Set(msg1.mentions.users.keys());
    const mentions2 = new Set(msg2.mentions.users.keys());
    
    // If they mention each other or have common mentions
    if (mentions1.has(msg2.author.id) || mentions2.has(msg1.author.id)) {
      return true;
    }

    // Check for shared mentions
    for (const mention of mentions1) {
      if (mentions2.has(mention)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Format thread for display or storage
   * @param {Object} thread - Thread object
   * @returns {Object} Formatted thread
   */
  formatThread(thread) {
    return {
      id: thread.id,
      channelId: thread.channelId,
      channelName: thread.channelName,
      messageCount: thread.messages.length,
      participantCount: thread.participants.length,
      participants: thread.participants,
      startTime: new Date(thread.startTime),
      endTime: new Date(thread.endTime),
      duration: thread.endTime - thread.startTime,
      messages: thread.messages.map(msg => ({
        id: msg.id,
        authorId: msg.author.id,
        authorName: msg.author.username,
        content: msg.content,
        timestamp: new Date(msg.createdTimestamp),
        attachments: msg.attachments.size,
        mentions: Array.from(msg.mentions.users.keys()),
        isReply: !!msg.reference,
      })),
    };
  }
}

module.exports = new MessageService();