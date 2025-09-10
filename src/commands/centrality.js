const { SlashCommandBuilder } = require('discord.js');
const centralityRankingService = require('../services/centralityRankingService');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('centrality')
    .setDescription('過去N日の中心性ランキングを生成し、AI混合スコアを算出します（USER_SCORE_CHANNEL_ID対象）')
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('集計日数 (既定: 30)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(120)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const days = interaction.options.getInteger('days') || 30;
      const client = interaction.client;

      const { filePath, startDate, endDate, channel } = await centralityRankingService.exportForEnvChannel(client, days);

      await interaction.editReply({
        content: `✅ ユーザースコアCSVを生成しました\n対象チャンネル: <#${channel.id}>\n期間: ${startDate.toLocaleDateString('ja-JP')} - ${endDate.toLocaleDateString('ja-JP')}\n出力: ${filePath}`,
      });
    } catch (error) {
      logger.error('Error in /user-score command:', error);
      const msg = error?.message || 'CSV生成に失敗しました。設定と権限を確認してください。';
      if (interaction.deferred) {
        await interaction.editReply({ content: `❌ ${msg}` });
      } else {
        await interaction.reply({ content: `❌ ${msg}`, ephemeral: true });
      }
    }
  },
};


