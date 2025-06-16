const { SlashCommandBuilder } = require('discord.js');
const schedulerService = require('../services/schedulerService');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trigger-evaluation')
    .setDescription('定期評価を手動で実行します（管理者のみ）'),

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

      logger.info(`Manual evaluation triggered by ${interaction.user.tag}`);

      // Send initial message
      await interaction.editReply({
        content: '⏳ 定期評価を手動で開始しています...\n\n' +
          '評価には時間がかかる場合があります。',
      });

      // Trigger manual evaluation
      await schedulerService.triggerManualEvaluation();

      try {
        await interaction.editReply({
          content: '✅ 定期評価を手動で開始しました。\n\n' +
            '評価には時間がかかる場合があります。\n' +
            '完了後、指定されたチャンネルに結果が投稿されます。',
        });
      } catch (error) {
        // If the interaction token expired, send a follow-up message
        if (error.code === 50027) {
          logger.warn('Interaction token expired, evaluation likely completed');
          // The scheduled task will post results to the designated channels
        } else {
          throw error;
        }
      }

    } catch (error) {
      logger.error('Error in trigger-evaluation command:', error);
      
      const errorMessage = '評価の実行中にエラーが発生しました。';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};