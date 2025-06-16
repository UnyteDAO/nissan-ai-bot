const messageService = require('./messageService');
const claudeService = require('./claudeService');
const evaluationModel = require('../models/evaluation');
const apiLogModel = require('../models/apiLog');
const logger = require('../utils/logger');

class EvaluationService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the evaluation service
   * @param {Object} db - Firestore instance
   */
  initialize(db) {
    evaluationModel.initialize(db);
    apiLogModel.initialize(db);
    this.initialized = true;
  }

  /**
   * Evaluate all messages in a guild for a specific period
   * @param {Guild} guild - Discord guild
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Evaluation results
   */
  async evaluateGuild(guild, startDate, endDate, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Evaluation service not initialized');
      }

      logger.info(`Starting evaluation for guild ${guild.name} from ${startDate} to ${endDate}`);

      const config = require('../config');
      const excludedChannelIds = config.channels.excludedChannelIds;
      
      const channels = guild.channels.cache.filter(
        channel => channel.type === 0 && 
                   channel.viewable && 
                   !excludedChannelIds.includes(channel.id) // Exclude specified channels
      );
      
      logger.info(`Processing ${channels.size} channels (${excludedChannelIds.length} channels excluded)`);

      const allThreads = [];
      const evaluationResults = [];

      // Fetch messages from all channels
      for (const channel of channels.values()) {
        try {
          const messages = await messageService.fetchChannelMessages(channel, startDate, endDate);
          
          if (messages.length === 0) {
            continue;
          }

          const threads = messageService.detectThreads(messages);
          
          for (const thread of threads) {
            const formattedThread = messageService.formatThread(thread);
            allThreads.push(formattedThread);
          }
        } catch (error) {
          logger.error(`Error processing channel ${channel.name}:`, error);
        }
      }

      logger.info(`Found ${allThreads.length} conversation threads to evaluate`);

      // Apply thread limits
      let threadsToEvaluate = allThreads;
      
      if (options.quickMode) {
        threadsToEvaluate = allThreads.slice(0, 10);
        logger.info(`Quick mode enabled: evaluating only ${threadsToEvaluate.length} threads`);
      } else if (config.evaluation.maxThreadsPerRun && allThreads.length > config.evaluation.maxThreadsPerRun) {
        threadsToEvaluate = allThreads.slice(0, config.evaluation.maxThreadsPerRun);
        logger.info(`Limiting evaluation to ${config.evaluation.maxThreadsPerRun} threads (found ${allThreads.length})`);
      }

      // Evaluate each thread
      for (const thread of threadsToEvaluate) {
        try {
          // Check if thread has already been evaluated
          const existingThread = await evaluationModel.checkThreadExists(thread.id);
          
          if (existingThread && existingThread.isEvaluated) {
            logger.info(`Skipping already evaluated thread ${thread.id} (doc: ${existingThread.docId})`);
            continue;
          }
          
          // Save thread to Firestore (will return existing ID if already saved)
          const threadId = await evaluationModel.saveThread(thread);

          // Skip threads with too few messages
          const minMessages = config.evaluation.minThreadMessages || 2;
          if (thread.messageCount < minMessages) {
            logger.debug(`Skipping thread ${threadId} with only ${thread.messageCount} messages (min: ${minMessages})`);
            continue;
          }

          // Double-check if thread was evaluated (in case it was saved but not evaluated)
          if (existingThread && !existingThread.isEvaluated) {
            logger.info(`Evaluating previously saved but unevaluated thread ${thread.id}`);
          }

          // Evaluate thread with Claude
          const evaluation = await claudeService.evaluateThread(thread);

          // Save evaluation
          const evaluationId = await evaluationModel.saveEvaluation(threadId, evaluation);

          evaluationResults.push({
            threadId,
            evaluationId,
            thread,
            evaluation,
          });

          logger.info(`Successfully evaluated thread ${thread.id} (doc: ${threadId})`);

          // Add delay to avoid rate limiting
          await this.delay(1000);
        } catch (error) {
          logger.error(`Error evaluating thread ${thread.id}:`, error);
        }
      }

      // Generate summary
      const summary = await this.generateEvaluationSummary(evaluationResults, startDate, endDate);

      return {
        threadsFound: allThreads.length,
        threadsEvaluated: evaluationResults.length,
        startDate,
        endDate,
        summary,
        evaluations: evaluationResults,
      };
    } catch (error) {
      logger.error('Error in guild evaluation:', error);
      throw error;
    }
  }

  /**
   * Generate evaluation summary
   * @param {Array} evaluationResults - Evaluation results
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Summary
   */
  async generateEvaluationSummary(evaluationResults, startDate, endDate) {
    try {
      // Get statistics
      const stats = await evaluationModel.getStatistics(startDate, endDate);

      // Generate AI summary
      const aiSummary = await claudeService.generateSummary(evaluationResults);

      // Save summary
      const summaryData = {
        statistics: stats,
        aiSummary: aiSummary.summary,
        evaluationCount: evaluationResults.length,
      };

      const summaryId = await evaluationModel.saveSummary(summaryData, startDate, endDate);

      return {
        summaryId,
        ...summaryData,
      };
    } catch (error) {
      logger.error('Error generating summary:', error);
      throw error;
    }
  }

  /**
   * Get evaluation results for display
   * @param {string} evaluationId - Evaluation ID
   * @returns {Promise<Object>} Formatted evaluation result
   */
  async getEvaluationDetails(evaluationId) {
    try {
      const evaluations = await evaluationModel.getEvaluations(new Date(0), new Date());
      const evaluation = evaluations.find(e => e.id === evaluationId);

      if (!evaluation) {
        throw new Error('Evaluation not found');
      }

      return this.formatEvaluationForDisplay(evaluation);
    } catch (error) {
      logger.error('Error getting evaluation details:', error);
      throw error;
    }
  }

  /**
   * Format evaluation for Discord display
   * @param {Object} evaluation - Evaluation data
   * @returns {Object} Formatted data
   */
  formatEvaluationForDisplay(evaluation) {
    const { evaluation: evalData, threadId, createdAt } = evaluation;
    
    let content = `**評価結果** (Thread: ${threadId})\n`;
    content += `評価日時: ${new Date(createdAt._seconds * 1000).toLocaleString('ja-JP')}\n\n`;

    // Participant scores
    content += `**参加者スコア:**\n`;
    for (const [userId, data] of Object.entries(evalData.participants)) {
      content += `<@${userId}>: ${data.score}点\n`;
      
      if (data.comments && data.comments.length > 0) {
        content += `  コメント: ${data.comments.join(', ')}\n`;
      }
    }

    content += `\n**内訳:**\n`;
    content += `- 技術的アドバイス: ${this.sumScores(evalData.participants, 'technicalAdvice')}点\n`;
    content += `- 問題解決: ${this.sumScores(evalData.participants, 'problemSolving')}点\n`;
    content += `- 実現可能性: ${this.sumScores(evalData.participants, 'feasibility')}点\n`;
    content += `- コミュニケーション: ${this.sumScores(evalData.participants, 'communication')}点\n`;
    content += `- 成果物: ${this.sumScores(evalData.participants, 'deliverables')}点\n`;

    if (evalData.summary) {
      content += `\n**サマリー:** ${evalData.summary}\n`;
    }

    if (evalData.highlights && evalData.highlights.length > 0) {
      content += `\n**ハイライト:**\n`;
      evalData.highlights.forEach(h => content += `- ${h}\n`);
    }

    if (evalData.concerns && evalData.concerns.length > 0) {
      content += `\n**改善点:**\n`;
      evalData.concerns.forEach(c => content += `- ${c}\n`);
    }

    return {
      content: content.substring(0, 2000), // Discord message limit
      embeds: this.createEvaluationEmbeds(evalData),
    };
  }

  /**
   * Create Discord embeds for evaluation
   * @param {Object} evalData - Evaluation data
   * @returns {Array} Discord embeds
   */
  createEvaluationEmbeds(evalData) {
    const embeds = [];

    // Score breakdown embed
    const scoreEmbed = {
      title: 'スコア詳細',
      color: 0x00ff00,
      fields: [],
    };

    for (const [userId, data] of Object.entries(evalData.participants)) {
      scoreEmbed.fields.push({
        name: `User ${userId}`,
        value: `総合: ${data.score}点`,
        inline: true,
      });
    }

    embeds.push(scoreEmbed);

    return embeds;
  }

  /**
   * Sum scores across participants
   * @param {Object} participants - Participant data
   * @param {string} field - Field to sum
   * @returns {number} Total
   */
  sumScores(participants, field) {
    return Object.values(participants).reduce((sum, data) => sum + (data[field] || 0), 0);
  }

  /**
   * Get leaderboard
   * @param {number} limit - Number of users to show
   * @returns {Promise<Object>} Leaderboard data
   */
  async getLeaderboard(limit = 10) {
    try {
      const userScores = await evaluationModel.getUserScores();
      const topUsers = userScores.slice(0, limit);

      let content = '**貢献度ランキング**\n\n';
      
      topUsers.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        content += `${medal} <@${user.userId}> - ${user.totalScore}点\n`;
        content += `   評価回数: ${user.evaluationCount}, 平均: ${(user.totalScore / user.evaluationCount).toFixed(1)}点\n`;
      });

      return {
        content,
        topUsers,
      };
    } catch (error) {
      logger.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Export data for NFT minting
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} NFT data export
   */
  async exportForNFT(startDate, endDate) {
    try {
      const nftData = await evaluationModel.exportNFTData(startDate, endDate);
      
      return {
        exportDate: new Date(),
        period: { start: startDate, end: endDate },
        data: nftData,
      };
    } catch (error) {
      logger.error('Error exporting NFT data:', error);
      throw error;
    }
  }

  /**
   * Utility function to add delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new EvaluationService();