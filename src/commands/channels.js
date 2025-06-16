const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channels')
    .setDescription('評価対象のチャンネル情報を表示します'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const excludedChannelIds = config.channels.excludedChannelIds;
      const guild = interaction.guild;
      
      // Get all text channels
      const allTextChannels = guild.channels.cache.filter(
        channel => channel.type === 0 && channel.viewable
      );

      // Get excluded channels
      const excludedChannels = allTextChannels.filter(
        channel => excludedChannelIds.includes(channel.id)
      );

      // Get included channels
      const includedChannels = allTextChannels.filter(
        channel => !excludedChannelIds.includes(channel.id)
      );

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('📊 チャンネル評価設定')
        .setColor(0x0099ff)
        .setTimestamp();

      // Add included channels field
      const includedList = includedChannels.size > 0 
        ? includedChannels.map(ch => `• #${ch.name}`).slice(0, 20).join('\n')
        : '評価対象のチャンネルがありません';
      
      embed.addFields({
        name: `✅ 評価対象チャンネル (${includedChannels.size}個)`,
        value: includedList + (includedChannels.size > 20 ? '\n...' : ''),
        inline: false,
      });

      // Add excluded channels field
      if (excludedChannels.size > 0) {
        const excludedList = excludedChannels.map(ch => `• #${ch.name}`).join('\n');
        embed.addFields({
          name: `❌ 除外チャンネル (${excludedChannels.size}個)`,
          value: excludedList,
          inline: false,
        });
      }

      // Add configuration info
      embed.addFields({
        name: '⚙️ 設定情報',
        value: `除外チャンネルは環境変数 \`EXCLUDED_CHANNEL_IDS\` で設定されています。`,
        inline: false,
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in channels command:', error);
      
      const errorMessage = 'チャンネル情報の取得中にエラーが発生しました。';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};