const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const evaluationService = require('../services/evaluationService');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('export-nft')
    .setDescription('NFT発行用のデータをエクスポートします')
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('エクスポートする過去の日数（デフォルト: 90日）')
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

      const days = interaction.options.getInteger('days') || 90;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      logger.info(`NFT export requested by ${interaction.user.tag} for ${days} days`);

      // Export data
      const exportData = await evaluationService.exportForNFT(startDate, endDate);

      // Create JSON file
      const jsonContent = JSON.stringify(exportData, null, 2);
      const buffer = Buffer.from(jsonContent, 'utf-8');
      const fileName = `nft_export_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.json`;
      
      const attachment = new AttachmentBuilder(buffer, { name: fileName });

      // Create summary
      const summary = exportData.data.slice(0, 5).map((user, index) => 
        `${index + 1}. User ${user.userId}: ${user.score}点 (${user.contributions.threadCount}スレッド)`
      ).join('\n');

      await interaction.editReply({
        content: `✅ NFTデータのエクスポートが完了しました！\n\n` +
          `**期間:** ${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')}\n` +
          `**ユーザー数:** ${exportData.data.length}\n\n` +
          `**トップ5:**\n${summary}`,
        files: [attachment],
      });

    } catch (error) {
      logger.error('Error in export-nft command:', error);
      
      const errorMessage = 'データのエクスポート中にエラーが発生しました。';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};