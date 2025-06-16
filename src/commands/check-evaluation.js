const { SlashCommandBuilder } = require('discord.js');
const evaluationModel = require('../models/evaluation');
const evaluationService = require('../services/evaluationService');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check-evaluation')
    .setDescription('評価結果の詳細を確認します')
    .addStringOption(option =>
      option.setName('evaluation_id')
        .setDescription('確認したい評価ID（省略時は最新の評価一覧を表示）')
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('特定ユーザーの評価結果を確認')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const evaluationId = interaction.options.getString('evaluation_id');
      const targetUser = interaction.options.getUser('user');

      if (evaluationId) {
        // Show specific evaluation details
        await this.showEvaluationDetails(interaction, evaluationId);
      } else if (targetUser) {
        // Show user's evaluations
        await this.showUserEvaluations(interaction, targetUser);
      } else {
        // Show recent evaluations list
        await this.showRecentEvaluations(interaction);
      }

    } catch (error) {
      logger.error('Error in check-evaluation command:', error);
      
      const errorMessage = '評価結果の取得中にエラーが発生しました。';
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },

  /**
   * Show details of a specific evaluation
   */
  async showEvaluationDetails(interaction, evaluationId) {
    try {
      const details = await evaluationService.getEvaluationDetails(evaluationId);
      
      await interaction.editReply({
        content: details.content,
        embeds: details.embeds,
      });
    } catch (error) {
      await interaction.editReply({
        content: '指定された評価IDが見つかりませんでした。',
      });
    }
  },

  /**
   * Show evaluations for a specific user
   */
  async showUserEvaluations(interaction, user) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const evaluations = await evaluationModel.getEvaluations(startDate, endDate);
      const userEvaluations = evaluations.filter(eval => 
        eval.evaluation.participants[user.id]
      );

      if (userEvaluations.length === 0) {
        await interaction.editReply({
          content: `${user.tag} の評価結果が見つかりませんでした。`,
        });
        return;
      }

      // Calculate total score
      let totalScore = 0;
      let breakdown = {
        technicalAdvice: 0,
        problemSolving: 0,
        feasibility: 0,
        communication: 0,
        deliverables: 0,
        penalties: 0,
      };

      const evaluationList = [];
      
      for (const eval of userEvaluations) {
        const userData = eval.evaluation.participants[user.id];
        totalScore += userData.score;
        
        // Add to breakdown
        Object.keys(breakdown).forEach(key => {
          breakdown[key] += userData[key] || 0;
        });

        evaluationList.push({
          date: new Date(eval.createdAt._seconds * 1000).toLocaleDateString('ja-JP'),
          score: userData.score,
          comments: userData.comments?.join(', ') || 'なし',
        });
      }

      // Create response
      let content = `**${user.tag} の評価結果（過去30日間）**\n\n`;
      content += `**総合スコア:** ${totalScore}点\n`;
      content += `**評価回数:** ${userEvaluations.length}回\n`;
      content += `**平均スコア:** ${(totalScore / userEvaluations.length).toFixed(1)}点\n\n`;
      
      content += `**スコア内訳:**\n`;
      content += `• 技術的アドバイス: ${breakdown.technicalAdvice}点\n`;
      content += `• 問題解決: ${breakdown.problemSolving}点\n`;
      content += `• 実現可能性: ${breakdown.feasibility}点\n`;
      content += `• コミュニケーション: ${breakdown.communication}点\n`;
      content += `• 成果物: ${breakdown.deliverables}点\n`;
      if (breakdown.penalties < 0) {
        content += `• ペナルティ: ${breakdown.penalties}点\n`;
      }

      // Add recent evaluations
      content += `\n**最近の評価（最新5件）:**\n`;
      evaluationList.slice(0, 5).forEach((eval, index) => {
        content += `${index + 1}. ${eval.date} - ${eval.score}点\n`;
        if (eval.comments !== 'なし') {
          content += `   └ ${eval.comments}\n`;
        }
      });

      await interaction.editReply({
        content: content.substring(0, 2000),
      });

    } catch (error) {
      logger.error('Error showing user evaluations:', error);
      await interaction.editReply({
        content: 'ユーザーの評価結果の取得中にエラーが発生しました。',
      });
    }
  },

  /**
   * Show recent evaluations list
   */
  async showRecentEvaluations(interaction) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days

      const evaluations = await evaluationModel.getEvaluations(startDate, endDate);
      
      if (evaluations.length === 0) {
        await interaction.editReply({
          content: '過去7日間の評価結果がありません。',
        });
        return;
      }

      let content = '**最近の評価結果（過去7日間）**\n\n';
      
      // Group by date
      const evaluationsByDate = {};
      evaluations.forEach(eval => {
        const date = new Date(eval.createdAt._seconds * 1000).toLocaleDateString('ja-JP');
        if (!evaluationsByDate[date]) {
          evaluationsByDate[date] = [];
        }
        evaluationsByDate[date].push(eval);
      });

      // Display evaluations by date
      for (const [date, evals] of Object.entries(evaluationsByDate)) {
        content += `**${date}**\n`;
        
        evals.slice(0, 3).forEach(eval => {
          const participants = Object.entries(eval.evaluation.participants);
          const topParticipant = participants.sort(([, a], [, b]) => b.score - a.score)[0];
          
          if (topParticipant) {
            content += `• 評価ID: \`${eval.id}\`\n`;
            content += `  トップ貢献者: <@${topParticipant[0]}> (${topParticipant[1].score}点)\n`;
            if (eval.evaluation.summary) {
              content += `  概要: ${eval.evaluation.summary.substring(0, 50)}...\n`;
            }
          }
        });
        
        if (evals.length > 3) {
          content += `  ...他${evals.length - 3}件\n`;
        }
        content += '\n';
      }

      content += '\n💡 特定の評価の詳細を見るには、`/check-evaluation evaluation_id:<ID>` を使用してください。';

      await interaction.editReply({
        content: content.substring(0, 2000),
      });

    } catch (error) {
      logger.error('Error showing recent evaluations:', error);
      await interaction.editReply({
        content: '最近の評価結果の取得中にエラーが発生しました。',
      });
    }
  },
};