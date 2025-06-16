const { SlashCommandBuilder } = require('discord.js');
const evaluationService = require('../services/evaluationService');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('貢献度ランキングを表示します')
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('表示する人数（デフォルト: 10人）')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const limit = interaction.options.getInteger('limit') || 10;
      
      const leaderboard = await evaluationService.getLeaderboard(limit);

      await interaction.editReply({
        content: leaderboard.content,
        embeds: [{
          title: '📈 詳細統計',
          color: 0x0099ff,
          fields: leaderboard.topUsers.slice(0, 5).map(user => ({
            name: `<@${user.userId}>`,
            value: `技術: ${user.breakdown.technicalAdvice}点\n` +
                   `解決: ${user.breakdown.problemSolving}点\n` +
                   `実現: ${user.breakdown.feasibility}点`,
            inline: true,
          })),
          timestamp: new Date(),
        }],
      });

    } catch (error) {
      logger.error('Error in leaderboard command:', error);
      
      const errorMessage = 'ランキングの取得中にエラーが発生しました。';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};