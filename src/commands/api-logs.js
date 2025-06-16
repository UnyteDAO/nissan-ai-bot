const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const apiLogModel = require('../models/apiLog');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('api-logs')
    .setDescription('Claude APIの使用状況を確認します（管理者のみ）')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('実行するアクション')
        .setRequired(true)
        .addChoices(
          { name: '統計情報を表示', value: 'stats' },
          { name: 'ログをエクスポート', value: 'export' },
          { name: '古いログを削除', value: 'cleanup' }
        )
    )
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('対象期間（日数）')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(365)
    ),

  async execute(interaction) {
    try {
      // Check if user has admin permissions
      if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        await interaction.reply({
          content: 'このコマンドは管理者のみ使用できます。',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const action = interaction.options.getString('action');
      const days = interaction.options.getInteger('days') || 30;

      switch (action) {
        case 'stats':
          await this.showStatistics(interaction, days);
          break;
        case 'export':
          await this.exportLogs(interaction, days);
          break;
        case 'cleanup':
          await this.cleanupLogs(interaction, days);
          break;
      }

    } catch (error) {
      logger.error('Error in api-logs command:', error);
      
      const errorMessage = 'APIログの処理中にエラーが発生しました。';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },

  /**
   * Show API usage statistics
   */
  async showStatistics(interaction, days) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await apiLogModel.getApiStatistics(startDate, endDate);

      let content = `**Claude API使用統計（過去${days}日間）**\n\n`;
      
      content += `**概要:**\n`;
      content += `• 総APIコール数: ${stats.totalCalls}\n`;
      content += `• 成功: ${stats.successfulCalls}\n`;
      content += `• 失敗: ${stats.failedCalls}\n`;
      content += `• 平均応答時間: ${(stats.averageResponseTime / 1000).toFixed(2)}秒\n\n`;

      content += `**トークン使用量:**\n`;
      content += `• 入力トークン: ${stats.totalInputTokens.toLocaleString()}\n`;
      content += `• 出力トークン: ${stats.totalOutputTokens.toLocaleString()}\n`;
      content += `• 合計トークン: ${stats.totalTokens.toLocaleString()}\n\n`;

      // Cost estimation (rough estimates)
      const inputCost = (stats.totalInputTokens / 1000000) * 15; // $15 per million input tokens
      const outputCost = (stats.totalOutputTokens / 1000000) * 75; // $75 per million output tokens
      const totalCost = inputCost + outputCost;

      content += `**推定コスト (Opus):**\n`;
      content += `• 入力: $${inputCost.toFixed(2)}\n`;
      content += `• 出力: $${outputCost.toFixed(2)}\n`;
      content += `• 合計: $${totalCost.toFixed(2)}\n\n`;

      content += `**タイプ別:**\n`;
      for (const [type, count] of Object.entries(stats.byType)) {
        content += `• ${type}: ${count}回\n`;
      }

      if (stats.errors.length > 0) {
        content += `\n**最近のエラー (最新5件):**\n`;
        stats.errors.slice(0, 5).forEach(error => {
          content += `• ${new Date(error.timestamp).toLocaleString('ja-JP')}: ${error.message}\n`;
        });
      }

      await interaction.editReply({
        content: content.substring(0, 2000),
      });

    } catch (error) {
      logger.error('Error showing statistics:', error);
      await interaction.editReply({
        content: '統計情報の取得中にエラーが発生しました。',
      });
    }
  },

  /**
   * Export API logs
   */
  async exportLogs(interaction, days) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const logs = await apiLogModel.getApiLogs(startDate, endDate);

      // Create CSV content
      let csvContent = 'Timestamp,Type,Model,Duration(ms),Input Tokens,Output Tokens,Error,Metadata\n';
      
      for (const log of logs) {
        const timestamp = new Date(log.createdAt).toISOString();
        const type = log.type || '';
        const model = log.model || '';
        const duration = log.duration || 0;
        const inputTokens = log.tokenUsage?.inputTokens || 0;
        const outputTokens = log.tokenUsage?.outputTokens || 0;
        const error = log.error ? log.error.message : '';
        const metadata = JSON.stringify(log.metadata || {});
        
        csvContent += `"${timestamp}","${type}","${model}",${duration},${inputTokens},${outputTokens},"${error}","${metadata}"\n`;
      }

      const buffer = Buffer.from(csvContent, 'utf-8');
      const fileName = `api_logs_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`;
      
      const attachment = new AttachmentBuilder(buffer, { name: fileName });

      await interaction.editReply({
        content: `✅ APIログのエクスポートが完了しました！\n\n` +
          `**期間:** ${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')}\n` +
          `**ログ数:** ${logs.length}`,
        files: [attachment],
      });

    } catch (error) {
      logger.error('Error exporting logs:', error);
      await interaction.editReply({
        content: 'ログのエクスポート中にエラーが発生しました。',
      });
    }
  },

  /**
   * Cleanup old logs
   */
  async cleanupLogs(interaction, days) {
    try {
      const deleteCount = await apiLogModel.cleanupOldLogs(days);

      await interaction.editReply({
        content: `✅ 古いAPIログの削除が完了しました！\n\n` +
          `**削除されたログ数:** ${deleteCount}\n` +
          `**保持期間:** ${days}日`,
      });

    } catch (error) {
      logger.error('Error cleaning up logs:', error);
      await interaction.editReply({
        content: 'ログの削除中にエラーが発生しました。',
      });
    }
  },
};