const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');
const logger = require('../utils/logger');
const apiLogModel = require('../models/apiLog');
const aiInstructionLogger = require('./aiInstructionLogger');

class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: config.claude.apiKey,
    });
    this.model = 'claude-3-opus-20240229';
    this.maxTokens = 4096;
  }

  /**
   * Evaluate a conversation thread
   * @param {Object} thread - Thread object with messages
   * @returns {Promise<Object>} Evaluation result
   */
  async evaluateThread(thread) {
    const startTime = Date.now();
    let apiLogId = null;
    
    try {
      const prompt = this.buildEvaluationPrompt(thread);
      const systemPrompt = this.getSystemPrompt();
      
      const request = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: 0.2,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      const response = await this.client.messages.create(request);
      const duration = Date.now() - startTime;

      // Log the API call
      apiLogId = await apiLogModel.logApiCall({
        type: 'thread_evaluation',
        model: this.model,
        request: {
          system: systemPrompt,
          prompt: prompt,
          max_tokens: this.maxTokens,
          temperature: 0.2,
        },
        response: {
          content: response.content[0].text,
          stop_reason: response.stop_reason,
          usage: response.usage,
        },
        duration: duration,
        metadata: {
          threadId: thread.id,
          channelName: thread.channelName,
          messageCount: thread.messageCount,
          participantCount: thread.participantCount,
        },
      });

      const evaluation = this.parseEvaluationResponse(response.content[0].text);
      
      // AI指示をログに記録（設定で有効な場合のみ）
      if (config.logging.enableAiInstructionLogging) {
        try {
          await aiInstructionLogger.logInstruction({
            userId: thread.startedBy || 'system',
            instruction: prompt,
            response: response.content[0].text,
            category: 'code',
            baseScore: evaluation.totalScore || 100,
            notes: `Thread evaluation for channel: ${thread.channelName}, participants: ${thread.participantCount}`
          });
        } catch (logError) {
          logger.error('Failed to log AI instruction:', logError);
          // ログエラーでも評価は続行
        }
      }
      
      logger.info(`Thread ${thread.id} evaluated successfully`);
      return evaluation;
    } catch (error) {
      logger.error(`Error evaluating thread ${thread.id}:`, error);
      
      // Log the failed API call
      if (!apiLogId) {
        await apiLogModel.logApiCall({
          type: 'thread_evaluation',
          model: this.model,
          request: {
            threadId: thread.id,
          },
          error: error,
          duration: Date.now() - startTime,
          metadata: {
            threadId: thread.id,
            channelName: thread.channelName,
          },
        });
      }
      
      throw error;
    }
  }

  /**
   * Get system prompt for Claude
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `あなたはDAO構築支援コミュニティの貢献度を評価する専門家です。
以下の会話スreadを分析し、各参加者の貢献度を評価してください。
評価結果はJSONオブジェクトのみを返し、他のテキストは含めないでください。

評価観点：
1.  技術的アドバイスの的確性（0-25点）
2.  問題解決への貢献度（0-25点）
3.  提案の実現可能性（0-20点）
4.  コミュニケーションの建設性（0-20点）
5.  成果物の作成（0-10点）

ネガティブな行動がある場合は減点してください：
*   非建設的な批判（-5〜-10点）
*   議論の妨害（-5〜-15点）
*   不適切な言動（-10〜-20点）

出力するJSONの構造は以下のようにしてください:
{
  "participants": {
    "xxxxxxxx": {
      "score": 0,
      "technicalAdvice": 0,
      "problemSolving": 0,
      "feasibility": 0,
      "communication": 0,
      "deliverables": 0,
      "penalties": 0,
      "comments": ["具体的な貢献内容や評価理由"]
    }
  },
  "summary": "スレッド全体の貢献度の要約",
  "highlights": ["特筆すべき貢献内容"],
  "concerns": ["改善点や懸念事項"]
}
`;
  }

  /**
   * Build evaluation prompt from thread
   * @param {Object} thread - Thread object
   * @returns {string} Evaluation prompt
   */
  buildEvaluationPrompt(thread) {
    let prompt = `以下の会話スレッドを評価してください。\n\n`;
    prompt += `チャンネル: ${thread.channelName}\n`;
    prompt += `期間: ${thread.startTime.toLocaleString('ja-JP')} - ${thread.endTime.toLocaleString('ja-JP')}\n`;
    prompt += `参加者数: ${thread.participantCount}\n\n`;
    prompt += `会話内容:\n`;

    for (const msg of thread.messages) {
      prompt += `\n[${msg.timestamp.toLocaleString('ja-JP')}] ${msg.authorName}: ${msg.content}`;
      if (msg.isReply) {
        prompt += ` (返信)`;
      }
      if (msg.mentions.length > 0) {
        prompt += ` (@メンション: ${msg.mentions.length}人)`;
      }
    }

    prompt += `\n\n各参加者の貢献度を評価し、JSON形式で結果を返してください。`;

    return prompt;
  }

  /**
   * Parse evaluation response from Claude
   * @param {string} response - Claude's response
   * @returns {Object} Parsed evaluation
   */
  parseEvaluationResponse(response) {
    try {
      // Extract JSON from response, allowing for markdown code blocks
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```|(\{[\s\S]*\})/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      // Use the first captured group that is not null
      const jsonString = jsonMatch[1] || jsonMatch[2];
      const parsed = JSON.parse(jsonString);
      
      // Ensure required fields exist
      const evaluation = {
        participants: {},
        summary: parsed.summary || '',
        totalScore: 0,
        breakdown: parsed.breakdown || {},
        highlights: parsed.highlights || [],
        concerns: parsed.concerns || [],
      };

      // Process participant scores
      if (parsed.participants) {
        for (const [userId, data] of Object.entries(parsed.participants)) {
          evaluation.participants[userId] = {
            score: data.score || 0,
            technicalAdvice: data.technicalAdvice || 0,
            problemSolving: data.problemSolving || 0,
            feasibility: data.feasibility || 0,
            communication: data.communication || 0,
            deliverables: data.deliverables || 0,
            penalties: data.penalties || 0,
            comments: data.comments || [],
          };
          evaluation.totalScore += evaluation.participants[userId].score;
        }
      }

      return evaluation;
    } catch (error) {
      logger.error('Error parsing Claude response:', error);
      logger.debug('Raw response:', response);
      
      // Return a default structure if parsing fails
      return {
        participants: {},
        summary: 'Failed to parse evaluation',
        totalScore: 0,
        breakdown: {},
        highlights: [],
        concerns: [],
        error: error.message,
      };
    }
  }

  /**
   * Generate evaluation summary
   * @param {Array} evaluations - Array of evaluation results
   * @returns {Promise<Object>} Summary report
   */
  async generateSummary(evaluations) {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildSummaryPrompt(evaluations);
      const systemPrompt = 'あなたはDAO貢献度レポートを作成する専門家です。評価結果を分析し、わかりやすい要約を作成してください。';
      
      const request = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      const response = await this.client.messages.create(request);
      const duration = Date.now() - startTime;

      // Log the API call
      await apiLogModel.logApiCall({
        type: 'summary_generation',
        model: this.model,
        request: {
          system: systemPrompt,
          prompt: prompt,
          max_tokens: this.maxTokens,
          temperature: 0.3,
        },
        response: {
          content: response.content[0].text,
          stop_reason: response.stop_reason,
          usage: response.usage,
        },
        duration: duration,
        metadata: {
          evaluationCount: evaluations.length,
        },
      });

      // AI指示をログに記録（設定で有効な場合のみ）
      if (config.logging.enableAiInstructionLogging) {
        try {
          await aiInstructionLogger.logInstruction({
            userId: 'system',
            instruction: prompt,
            response: response.content[0].text,
            category: 'documentation',
            baseScore: 100,
            notes: `Summary generation for ${evaluations.length} evaluations`
          });
        } catch (logError) {
          logger.error('Failed to log AI instruction:', logError);
          // ログエラーでも処理は続行
        }
      }

      return {
        summary: response.content[0].text,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Error generating summary:', error);
      
      // Log the failed API call
      await apiLogModel.logApiCall({
        type: 'summary_generation',
        model: this.model,
        request: {
          evaluationCount: evaluations.length,
        },
        error: error,
        duration: Date.now() - startTime,
      });
      
      throw error;
    }
  }

  /**
   * Build summary prompt from evaluations
   * @param {Array} evaluations - Array of evaluations
   * @returns {string} Summary prompt
   */
  buildSummaryPrompt(evaluations) {
    let prompt = `以下の評価結果から、全体的な貢献度サマリーを作成してください。\n\n`;
    prompt += `評価期間: ${evaluations.length}件のスレッド\n\n`;

    const userScores = {};
    let totalThreads = evaluations.length;
    let totalMessages = 0;

    for (const evalResult of evaluations) {
      totalMessages += evalResult.thread.messageCount;
      
      for (const [userId, data] of Object.entries(evalResult.evaluation.participants)) {
        if (!userScores[userId]) {
          userScores[userId] = {
            totalScore: 0,
            threadCount: 0,
            highlights: [],
          };
        }
        userScores[userId].totalScore += data.score;
        userScores[userId].threadCount += 1;
        if (data.comments && data.comments.length > 0) {
          userScores[userId].highlights.push(...data.comments);
        }
      }
    }

    prompt += `統計情報:\n`;
    prompt += `- 総スレッド数: ${totalThreads}\n`;
    prompt += `- 総メッセージ数: ${totalMessages}\n`;
    prompt += `- アクティブユーザー数: ${Object.keys(userScores).length}\n\n`;

    prompt += `ユーザー別スコア:\n`;
    for (const [userId, data] of Object.entries(userScores)) {
      prompt += `- User ${userId}: ${data.totalScore}点 (${data.threadCount}スレッド参加)\n`;
    }

    prompt += `\n以下の形式でサマリーを作成してください：\n`;
    prompt += `1. 全体的な活動状況\n`;
    prompt += `2. 特に貢献度の高かったメンバー（トップ3）\n`;
    prompt += `3. 注目すべき貢献内容\n`;
    prompt += `4. 改善点や課題\n`;
    prompt += `5. 次回に向けての提案`;

    return prompt;
  }
}

module.exports = new ClaudeService();