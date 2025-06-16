const { SlashCommandBuilder } = require('discord.js');
const evaluationService = require('../services/evaluationService');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('evaluate')
    .setDescription('過去の会話を評価します')
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('評価する過去の日数（デフォルト: 30日）')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(90)
    )
    .addBooleanOption(option =>
      option.setName('quick')
        .setDescription('クイックモード（最大10スレッドまで評価）')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      // Defer reply as this will take time
      await interaction.deferReply({ ephemeral: true });

      const days = interaction.options.getInteger('days') || 30;
      const quickMode = interaction.options.getBoolean('quick') || false;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      logger.info(`Evaluation requested by ${interaction.user.tag} for ${days} days (quick mode: ${quickMode})`);

      // Send initial status message
      await interaction.editReply({
        content: `⏳ 評価を開始しました...\n` +
          `**評価期間:** ${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')}\n` +
          `**モード:** ${quickMode ? 'クイックモード（最大10スレッド）' : '通常モード'}\n` +
          `処理には時間がかかる場合があります。完了後にお知らせします。`,
      });

      // Start evaluation
      const results = await evaluationService.evaluateGuild(
        interaction.guild,
        startDate,
        endDate,
        { quickMode }
      );

      // Send results
      const config = require('../config');
      const excludedCount = config.channels.excludedChannelIds.length;
      
      try {
        await interaction.editReply({
          content: `✅ 評価が完了しました！\n\n` +
            `**評価期間:** ${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')}\n` +
            `**検出されたスレッド:** ${results.threadsFound}\n` +
            `**評価されたスレッド:** ${results.threadsEvaluated}\n` +
            `**除外チャンネル数:** ${excludedCount}\n\n` +
            `詳細な結果は指定されたチャンネルに投稿されました。`,
        });
      } catch (error) {
        // If the interaction token expired, send a follow-up message instead
        if (error.code === 50027) {
          logger.warn('Interaction token expired, sending follow-up message');
          const channel = interaction.channel;
          await channel.send({
            content: `<@${interaction.user.id}> ✅ 評価が完了しました！\n\n` +
              `**評価期間:** ${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')}\n` +
              `**検出されたスレッド:** ${results.threadsFound}\n` +
              `**評価されたスレッド:** ${results.threadsEvaluated}\n` +
              `**除外チャンネル数:** ${excludedCount}\n\n` +
              `詳細な結果は指定されたチャンネルに投稿されました。`,
          });
        } else {
          throw error;
        }
      }

      // Post detailed results to designated channel
      if (process.env.EVALUATION_RESULT_CHANNEL_ID) {
        const channel = interaction.guild.channels.cache.get(process.env.EVALUATION_RESULT_CHANNEL_ID);
        if (channel) {
          await this.postDetailedResults(channel, results);
        }
      }

    } catch (error) {
      logger.error('Error in evaluate command:', error);
      
      const errorMessage = '評価中にエラーが発生しました。ログを確認してください。';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },

  async postDetailedResults(channel, results) {
    try {
      // Post summary
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
          topContributorsText += `${medal} <@${user.userId}> - ${user.totalScore}点\n`;
        });

        await channel.send(topContributorsText);
      }

    } catch (error) {
      logger.error('Error posting detailed results:', error);
    }
  },
};