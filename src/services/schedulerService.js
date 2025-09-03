const cron = require('node-cron');
const evaluationService = require('./evaluationService');
const logExportService = require('./logExportService');
const config = require('../config');
const logger = require('../utils/logger');

class SchedulerService {
  constructor() {
    this.client = null;
    this.scheduledTask = null;
    this.logsTask = null;
  }

  /**
   * Initialize the scheduler with Discord client
   * @param {Client} client - Discord client instance
   */
  initialize(client) {
    this.client = client;
    this.setupScheduledEvaluation();
    this.setupScheduledLogExport();
    logger.info(`Scheduler initialized with cron pattern: ${config.cron.schedule}`);
  }

  /**
   * Setup scheduled daily evaluation
   */
  setupScheduledEvaluation() {
    // Cancel existing task if any
    if (this.scheduledTask) {
      this.scheduledTask.stop();
    }

    // Schedule daily evaluation
    this.scheduledTask = cron.schedule(config.cron.schedule, async () => {
      logger.info('Starting scheduled daily evaluation...');
      await this.runDailyEvaluation();
    }, {
      scheduled: true,
      timezone: 'Asia/Tokyo'
    });

    logger.info('Daily evaluation scheduled at 18:00 JST');
  }

  /**
   * Setup scheduled daily log export at 18:00 JST
   */
  setupScheduledLogExport() {
    // Cancel existing task if any
    if (this.logsTask) {
      this.logsTask.stop();
    }

    // Schedule daily log export at 18:00 JST
    this.logsTask = cron.schedule(config.cron.schedule, async () => {
      logger.info('Starting scheduled daily log export...');
      await this.runDailyLogExport();
    }, {
      scheduled: true,
      timezone: 'Asia/Tokyo'
    });

    logger.info('Daily log export scheduled at 18:00 JST');
  }

  /**
   * Run daily evaluation for all guilds
   */
  async runDailyEvaluation() {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      // Process each guild
      for (const guild of this.client.guilds.cache.values()) {
        try {
          logger.info(`Running scheduled evaluation for guild: ${guild.name}`);

          // Run evaluation
          const results = await evaluationService.evaluateGuild(guild, startDate, endDate);

          // Post results to notification channel
          await this.postEvaluationNotification(guild, results);

          // Post detailed results to result channel
          await this.postDetailedResults(guild, results);

        } catch (error) {
          logger.error(`Error evaluating guild ${guild.name}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in daily evaluation:', error);
    }
  }

  /**
   * Post evaluation completion notification
   * @param {Guild} guild - Discord guild
   * @param {Object} results - Evaluation results
   */
  async postEvaluationNotification(guild, results) {
    try {
      if (!config.channels.summaryNotificationChannelId) {
        logger.warn('Summary notification channel not configured');
        return;
      }

      const channel = guild.channels.cache.get(config.channels.summaryNotificationChannelId);
      if (!channel) {
        logger.warn(`Summary notification channel ${config.channels.summaryNotificationChannelId} not found`);
        return;
      }

      await channel.send({
        embeds: [{
          title: '📊 定期評価完了',
          description: '本日の貢献度評価が完了しました。',
          color: 0x00ff00,
          fields: [
            {
              name: '評価期間',
              value: `${results.startDate.toLocaleDateString('ja-JP')} - ${results.endDate.toLocaleDateString('ja-JP')}`,
              inline: true,
            },
            {
              name: '評価スレッド数',
              value: `${results.threadsEvaluated}`,
              inline: true,
            },
            {
              name: 'トップ貢献者',
              value: results.summary.statistics.topContributors.length > 0
                ? `<@${results.summary.statistics.topContributors[0].userId}> (${results.summary.statistics.topContributors[0].totalScore}点)`
                : 'なし',
              inline: true,
            },
          ],
          footer: {
            text: '詳細は評価結果チャンネルをご確認ください',
          },
          timestamp: new Date(),
        }],
      });

      logger.info('Evaluation notification posted successfully');
    } catch (error) {
      logger.error('Error posting evaluation notification:', error);
    }
  }

  /**
   * Post detailed evaluation results
   * @param {Guild} guild - Discord guild
   * @param {Object} results - Evaluation results
   */
  async postDetailedResults(guild, results) {
    try {
      if (!config.channels.evaluationResultChannelId) {
        logger.warn('Evaluation result channel not configured');
        return;
      }

      const channel = guild.channels.cache.get(config.channels.evaluationResultChannelId);
      if (!channel) {
        logger.warn(`Evaluation result channel ${config.channels.evaluationResultChannelId} not found`);
        return;
      }

      // Post main summary
      await channel.send({
        embeds: [{
          title: '📊 貢献度評価結果',
          description: results.summary.aiSummary.substring(0, 4096),
          color: 0x00ff00,
          fields: [
            {
              name: '評価期間',
              value: `${results.startDate.toLocaleDateString('ja-JP')} - ${results.endDate.toLocaleDateString('ja-JP')}`,
              inline: true,
            },
            {
              name: 'スレッド数',
              value: `${results.threadsEvaluated}/${results.threadsFound}`,
              inline: true,
            },
            {
              name: '総スコア',
              value: `${results.summary.statistics.totalScore}点`,
              inline: true,
            },
          ],
          timestamp: new Date(),
        }],
      });

      // Post top contributors
      if (results.summary.statistics.topContributors.length > 0) {
        let topContributorsText = '**🏆 トップ貢献者**\n\n';
        results.summary.statistics.topContributors.forEach((user, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          topContributorsText += `${medal} <@${user.userId}> - ${user.totalScore}点 (評価数: ${user.evaluationCount})\n`;
        });

        await channel.send(topContributorsText);
      }

      // Post notable contributions (top 5 evaluations)
      const topEvaluations = results.evaluations
        .sort((a, b) => {
          const aMaxScore = Math.max(...Object.values(a.evaluation.participants).map(p => p.score));
          const bMaxScore = Math.max(...Object.values(b.evaluation.participants).map(p => p.score));
          return bMaxScore - aMaxScore;
        })
        .slice(0, 5);

      if (topEvaluations.length > 0) {
        let notableText = '**📌 注目の貢献**\n\n';
        for (const evaluation of topEvaluations) {
          const topParticipant = Object.entries(evaluation.evaluation.participants)
            .sort(([, a], [, b]) => b.score - a.score)[0];

          if (topParticipant) {
            notableText += `• <@${topParticipant[0]}>: ${topParticipant[1].score}点\n`;
            if (evaluation.evaluation.summary) {
              notableText += `  └ ${evaluation.evaluation.summary.substring(0, 100)}...\n`;
            }
          }
        }

        await channel.send(notableText.substring(0, 2000));
      }

      logger.info('Detailed results posted successfully');
    } catch (error) {
      logger.error('Error posting detailed results:', error);
    }
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      logger.info('Scheduler stopped');
    }
    if (this.logsTask) {
      this.logsTask.stop();
      logger.info('Log export scheduler stopped');
    }
  }

  /**
   * Manually trigger daily evaluation (for testing)
   */
  async triggerManualEvaluation() {
    logger.info('Manual evaluation triggered');
    await this.runDailyEvaluation();
  }

  /**
   * Run daily log export job
   */
  async runDailyLogExport() {
    try {
      await logExportService.exportPreviousDayAndSend(this.client);
    } catch (error) {
      logger.error('Error in daily log export:', error);
    }
  }
}

module.exports = new SchedulerService();
