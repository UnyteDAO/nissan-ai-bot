const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const logger = require('../utils/logger');
const apiLogModel = require('../models/apiLog');
const aiInstructionLogger = require('./aiInstructionLogger');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.modelName = config.gemini.model || 'gemini-1.5-flash';
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
    this.maxTokens = 16384;
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

      // Combine system prompt and user prompt for Gemini
      const fullPrompt = `${systemPrompt}

${prompt}`;

      const generationConfig = {
        temperature: 0.2,
        maxOutputTokens: this.maxTokens,
      };

      const result = await this.model.generateContent({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig,
      });

      const response = result.response;
      const duration = Date.now() - startTime;

      // Log the API call
      apiLogId = await apiLogModel.logApiCall({
        type: 'thread_evaluation',
        model: this.modelName,
        request: {
          system: systemPrompt,
          prompt: prompt,
          max_tokens: this.maxTokens,
          temperature: 0.2,
        },
        response: {
          content: response.text(),
          stop_reason: 'stop',
          usage: {
            promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
            completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: result.response.usageMetadata?.totalTokenCount || 0,
          },
        },
        duration: duration,
        metadata: {
          threadId: thread.id,
          channelName: thread.channelName,
          messageCount: thread.messageCount,
          participantCount: thread.participantCount,
        },
      });

      const evaluation = this.parseEvaluationResponse(response.text());

      // AI指示をログに記録（設定で有効な場合のみ）
      if (config.logging.enableAiInstructionLogging) {
        try {
          await aiInstructionLogger.logInstruction({
            userId: thread.startedBy || 'system',
            instruction: prompt,
            response: response.text(),
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
          model: this.modelName,
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
 * Get system prompt for Channel Summary
 * @returns {string} System prompt
 */
  getChannelSummarySystemPrompt() {
    return `あなたはコミュニティのモデレーターです。与えられたチャンネルの会話ログを読み、以下の指示に従って日本語で簡潔にまとめてください。
    結果は以下の出力フォーマットに厳密に従ったJSONのみを出力してください。
      指示:
      - どのような会話や議論、話題があったかを整理すること
      - 主要な話題をピックアップして簡単に経緯をまとめること
      - 雑談などは特に反応が多く、盛り上がった話題をピックアップして簡単に経緯をまとめること
      - その日のチャンネルの様子をわかりやすくまとめて締めくくること
      - 文章はすべて日本語で英語を含めないこと
      - 文章は300字以内で記述すること
      - URLや長い引用は省略すること
      - 要約文はsummaryに記述すること
      - 会話ログは[timestamp #index] author: contentの形式になっている。#indexは0始まりである。
      - 要約文の中では、1文ごとに参照元のメッセージを明示すること。文末に"[0]"のようにindexを記述すること。複数件ある場合は"[0,1,2]"のように記述すること。
      - チャンネル全体の様子を表す文や締めくくりの文に対しては参照元を示さなくてよい
      - メッセージの参照は最大5件までとする

      JSONの構造は以下のようにしてください:
      {
        "summary": "要約内容"
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
   * Build channel summary prompt from thread
   * @param {Object} params
   * @param {string} params.channelName
   * @param {string} params.jstDateLabel
   * @param {Array<{timestamp:string, authorName:string, content:string, threadName?:string}>} params.messages
   * @returns {string} Channel summary prompt
   */
  buildChannelSummaryPrompt({ channelName, jstDateLabel, messages, guildId }) {
    let prompt = `対象チャンネル: ${channelName}\n対象日 (JST): ${jstDateLabel}\n\n`;
    prompt += '以下は会話の抜粋です。内容をまとめてください。\n';
    prompt += '会話ログ:\n';
    const toHHMM = (timestamp) => {
      const timestampString = String(timestamp || '');
      const timeMatch = timestampString.match(/\b(\d{1,2}):(\d{2})\b/);
      if (timeMatch) return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      const timestampDate = new Date(timestampString);
      if (!Number.isNaN(timestampDate.getTime())) {
        const hours = String(timestampDate.getHours()).padStart(2, '0');
        const minutes = String(timestampDate.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      }
      return '';
    };
    for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
      const message = messages[messageIndex];
      const threadSuffix = message.threadName ? ` [${message.threadName}]` : '';
      const timeLabel = toHHMM(message.timestamp);
      const head = timeLabel ? `[${timeLabel} #${messageIndex}]` : `[#${messageIndex}]`;
      const line = `${head} ${message.authorName}${threadSuffix}: ${message.content}`;
      prompt += `${line}\n`;
    }
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
   * チャンネル要約モデルの応答をJSONにパース
   * 仕様: { summary: string }
   * @param {string} responseText
   * @returns {{summary: string}|null}
   */
  parseChannelSummaryResponse(responseText) {
    try {
      const cleaned = responseText.replace(/^```json\n|^```\n|```$/g, '');
      const parsed = JSON.parse(cleaned);

      if (parsed && typeof parsed.summary === 'string') {
        return { summary: parsed.summary };
      }

      throw new Error('Invalid channel summary JSON structure');
    } catch (e) {
      logger.warn('Failed to parse channel summary JSON', e);
      return null;
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

      // Combine system prompt and user prompt for Gemini
      const fullPrompt = `${systemPrompt}

${prompt}`;

      const generationConfig = {
        temperature: 0.3,
        maxOutputTokens: this.maxTokens,
      };

      const result = await this.model.generateContent({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig,
      });

      const response = result.response;
      const duration = Date.now() - startTime;

      // Log the API call
      await apiLogModel.logApiCall({
        type: 'summary_generation',
        model: this.modelName,
        request: {
          system: systemPrompt,
          prompt: prompt,
          max_tokens: this.maxTokens,
          temperature: 0.3,
        },
        response: {
          content: response.text(),
          stop_reason: 'stop',
          usage: {
            promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
            completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: result.response.usageMetadata?.totalTokenCount || 0,
          },
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
            response: response.text(),
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
        summary: response.text(),
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Error generating summary:', error);

      // Log the failed API call
      await apiLogModel.logApiCall({
        type: 'summary_generation',
        model: this.modelName,
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

  /**
   * Generate a brief channel summary (<=3 lines) from raw messages
   * @param {Object} params
   * @param {string} params.channelName
   * @param {string} params.jstDateLabel - YYYYMMDD
   * @param {Array<{timestamp:string, authorName:string, content:string, threadName?:string}>} params.messages
   * @returns {Promise<string>} summary text (<=3 lines)
   */
  async generateChannelSummary({ channelName, jstDateLabel, messages, guildId }) {
    const startTime = Date.now();
    let apiLogId = null;

    try {
      const systemPrompt = this.getChannelSummarySystemPrompt();
      const prompt = this.buildChannelSummaryPrompt({ channelName, jstDateLabel, messages, guildId });
      const fullPrompt = `${systemPrompt}\n\n${prompt}`;
      logger.info(`💡Channel summary prompt: ${fullPrompt}`);

      const generationConfig = { temperature: 0.2, maxOutputTokens: this.maxTokens };

      const result = await this.model.generateContent({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig,
      });

      const response = result.response;
      const duration = Date.now() - startTime;
      logger.info(`💡Channel summary generated successfully for ${channelName} on ${jstDateLabel} in ${duration}ms`);

      // APIログ
      apiLogId = await apiLogModel.logApiCall({
        type: 'channel_summary',
        model: this.modelName,
        request: {
          system: systemPrompt,
          prompt: prompt,
          max_tokens: this.maxTokens,
          temperature: 0.2,
        },
        response: {
          content: response.text(),
          usage: {
            promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
            completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: result.response.usageMetadata?.totalTokenCount || 0,
          },
        },
        duration: duration,
        metadata: { channelName, jstDateLabel, messagesSampled: messages.length },
      });

      // AI指示をログに記録（設定で有効な場合のみ）
      if (config.logging.enableAiInstructionLogging) {
        try {
          await aiInstructionLogger.logInstruction({
            userId: 'system',
            instruction: fullPrompt,
            response: response.text(),
            category: 'channel_summary',
            baseScore: 100,
            notes: `Channel summary generation for ${channelName} on ${jstDateLabel}
            totalTokens: ${result.response.usageMetadata?.totalTokenCount || 0},
            finishReason: ${result.response.usageMetadata?.finishReason || 'stop'}`
          });
        } catch (logError) {
          logger.error('Failed to log AI instruction:', logError);
        }
      }

      // JSONを解析し、Discord向けの文+参照リンク形式を構築
      const raw = response.text();
      const parsed = this.parseChannelSummaryResponse(raw);

      let summaryText = '';
      if (parsed && typeof parsed.summary === 'string') {
        const idxToUrl = (idxStr) => {
          const idx = Number(idxStr.trim());
          if (!Number.isFinite(idx) || idx < 0) return null;
          // summary内のindexを messages[idx] から直接URL化
          const m = messages[idx];
          if (!m) return null;
          const channelForLink = (m.threadId && String(m.threadId).length > 0) ? m.threadId : m.channelId;
          if (guildId && channelForLink && m.messageId) {
            return `https://discord.com/channels/${guildId}/${channelForLink}/${m.messageId}`;
          }
          return null;
        };

        // [0] や [0, 2] のような参照をリンク群に置換
        const displayNumberMap = new Map();
        let nextDisplayNumber = 1;
        const replaced = parsed.summary.replace(/\[(\s*\d+(?:\s*,\s*\d+)*\s*)\]/g, (_m, group) => {
          const parts = group.split(',').map(p => p.trim()).filter(Boolean);
          const links = parts
            .map(p => {
              const n = Number(p);
              if (!Number.isFinite(n)) return null;
              const key = String(n);
              const url = idxToUrl(key);
              if (!url) return null;
              let label;
              if (displayNumberMap.has(key)) {
                label = displayNumberMap.get(key);
              } else {
                label = nextDisplayNumber;
                displayNumberMap.set(key, label);
                nextDisplayNumber++;
              }
              return `[[${label}]](${url})`;
            })
            .filter(Boolean);
          return links.length > 0 ? ` ${links.join(' ')}` : '';
        });
        summaryText = replaced.trim();
      }
      if (!summaryText) summaryText = raw; // フォールバック

      logger.info(`Channel summary generated successfully for ${channelName} on ${jstDateLabel}`);
      return summaryText;
    } catch (error) {
      logger.error('Error generating channel summary:', error);
      // 失敗ログ
      if (!apiLogId) {
        await apiLogModel.logApiCall({
          type: 'channel_summary',
          model: this.modelName,
          request: { channelName, jstDateLabel },
          error: error,
          duration: Date.now() - startTime,
          metadata: { channelName, jstDateLabel, messagesSampled: messages.length },
        });
      }
      return 'エラーが発生しました';
    }
  }

  /**
   * User Centrality: system prompt
   */
  getUserCentralitySystemPrompt() {
    return `あなたはコミュニティ運営の専門アナリストです。与えられたDiscordメッセージ群から、指定ユーザーがチャンネル内でどれだけ中心的な役割を果たしているかを評価してください。
定義: 「中心的役割」とは、会話と作業の流れを前進させ、人と情報をつなぎ、意思決定を促し、議論を適切に収束させる力です。単なる発話量は重視しません。具体的な貢献と他者への影響を構造化して評価します。
観点:
1) 調整・ファシリテーション (facilitation):
- 1.0: 議題を構造化、役割/期限を明確化、次アクション合意を形成
- 0.5: 部分的な整理や提案はあるが不十分
- 0.0: 促進行動が見られない
2) 問題解決・方向付け (problem_solving):
- 1.0: 問題の再定義、意思決定を具体化、阻害要因の解消
- 0.5: 有用だが決定や方向の明確化に未到達
- 0.0: 解決や方向付けへの寄与がない
3) 情報ハブ・仲介 (broker):
- 1.0: 関係者・情報源を適切に橋渡し、会話を接続
- 0.5: 限定的な紹介/メンション
- 0.0: 仲介がない
4) 参加促進・巻き込み (engagement):
- 1.0: 指名質問や問いかけで他者の参加を明確に促進
- 0.5: 一般的な呼びかけ
- 0.0: 促進なし
5) スレッド運営 (thread_management):
- 1.0: 適切な開始と収束（結論/決定/次手の明示）
- 0.5: 開始のみ、または収束が不十分
- 0.0: 運営貢献なし
6) 知識貢献・根拠提示 (knowledge):
- 1.0: 具体例/手順/出典で再現性ある知見を提供
- 0.5: 有用だが抽象的、根拠が弱い
- 0.0: 知的貢献なし
7) トーン/秩序維持 (tone):
- 1.0: 敬意・安全の維持、衝突の沈静化やガイド支援
- 0.5: 良好だが調停まではない
- 0.0: 中立/不明
8) 実行駆動 (execution):
- 1.0: タスク化・担当・期限が明確で前進
- 0.5: 提案のみで実行条件が曖昧
- 0.0: 実行への寄与なし

採点方法:
  - 0.0〜1.0、小数第2位までで採点する
  - 0/0.5/1のアンカーを意識する
  - 個々のメッセージに対して、各観点の該当度合いを点数化し、その合計点数を0~1に正規化したものを各観点の点数とする。

バイアス回避:
  - 発話量や絵文字/雑談の多さは加点しない
  - 役職・肩書を根拠にしない（内容ベース）
  - 推測ではなく、証拠となるメッセージ断片に基づく

出力は必ず以下のJSONのみを返してください。説明文やマークダウンは不要です。
{
  "scores": {
    "facilitation": 0.00,
    "problem_solving": 0.00,
    "broker": 0.00,
    "engagement": 0.00,
    "thread_management": 0.00,
    "knowledge": 0.00,
    "tone": 0.00,
    "execution": 0.00
  },
  "notes": "<判断の留保や前提>"
}`;
  }

  /**
   * Build user centrality prompt with inlined message list
   * @param {Object} params
   * @param {string} params.channelName
   * @param {{id:string,name:string}} params.user
   * @param {{start:Date,end:Date}} params.window
   * @param {string[]} params.messageLines - lines like "[YYYY-MM-DD HH:mm #0] content"
   */
  buildUserCentralityPrompt({ channelName, user, window, messageLines }) {
    let prompt = '';
    prompt += `対象チャンネル: ${channelName}\n`;
    prompt += `評価ユーザー: ${user.name} (${user.id})\n`;
    prompt += `評価期間: ${window.start.toLocaleString('ja-JP')} - ${window.end.toLocaleString('ja-JP')}\n\n`;
    prompt += '以下は当該ユーザーが投稿したメッセージの一覧です。各行は [タイムスタンプ #index] 形式です。#indexは0始まりです。\n';
    prompt += 'メッセージ一覧:\n';
    for (const line of messageLines) {
      prompt += `${line}\n`;
    }
    prompt += '\n上記のみを根拠として、指定されたJSONフォーマットで評価結果を返してください。';
    return prompt;
  }

  /**
   * Parse user centrality response
   * @param {string} responseText
   * @returns {{scores:Object,notes:string}}
   */
  parseUserCentralityResponse(responseText) {
    try {
      const extractJsonString = (text) => {
        if (!text || typeof text !== 'string') return null;
        // 1) フェンス付き ```json ... ``` or ``` ... ```
        let m = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
        if (m && m[1]) return m[1].trim();
        // 2) 最初の { から波括弧バランスが0になる位置まで抽出（文字列内の{}は無視）
        const start = text.indexOf('{');
        if (start === -1) return null;
        let depth = 0;
        let inStr = false;
        let esc = false;
        for (let i = start; i < text.length; i++) {
          const ch = text[i];
          if (inStr) {
            if (esc) {
              esc = false;
            } else if (ch === '\\') {
              esc = true;
            } else if (ch === '"') {
              inStr = false;
            }
          } else {
            if (ch === '"') {
              inStr = true;
            } else if (ch === '{') {
              depth++;
            } else if (ch === '}') {
              depth--;
              if (depth === 0) {
                return text.slice(start, i + 1).trim();
              }
            }
          }
        }
        return null;
      };

      let jsonStr = extractJsonString(String(responseText || '').trim());
      if (!jsonStr) throw new Error('No JSON found');
      // 末尾カンマの修復
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
      const parsed = JSON.parse(jsonStr);
      const scores = parsed.scores || {};
      const toNum = (v) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(1, n));
      };
      const result = {
        scores: {
          facilitation: toNum(scores.facilitation),
          problem_solving: toNum(scores.problem_solving),
          broker: toNum(scores.broker),
          engagement: toNum(scores.engagement),
          thread_management: toNum(scores.thread_management),
          knowledge: toNum(scores.knowledge),
          tone: toNum(scores.tone),
          execution: toNum(scores.execution),
        },
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      };
      return result;
    } catch (e) {
      logger.warn('Failed to parse user centrality JSON', e);
      return {
        scores: {
          facilitation: 0,
          problem_solving: 0,
          broker: 0,
          engagement: 0,
          thread_management: 0,
          knowledge: 0,
          tone: 0,
          execution: 0,
        },
        notes: 'parse_error',
      };
    }
  }

  /**
   * Evaluate user centrality from message lines
   * @param {Object} params
   * @param {string} params.channelName
   * @param {{id:string,name:string}} params.user
   * @param {{start:Date,end:Date}} params.window
   * @param {string[]} params.messageLines
   */
  async evaluateUserCentralityFromLines({ channelName, user, window, messageLines }) {
    const startTime = Date.now();
    let apiLogId = null;
    try {
      const systemPrompt = this.getUserCentralitySystemPrompt();
      const prompt = this.buildUserCentralityPrompt({ channelName, user, window, messageLines });
      const fullPrompt = `${systemPrompt}\n\n${prompt}`;

      const generationConfig = { temperature: 0.2, maxOutputTokens: this.maxTokens };
      const result = await this.model.generateContent({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig,
      });
      const response = result.response;
      const responseText = response ? response.text() : '';
      if (!responseText || responseText.trim().length === 0) {
        logger.warn('Gemini returned empty response for user centrality', {
          userId: user?.id,
          channelName,
          messageCount: messageLines.length,
        });
      }

      // APIログ
      apiLogId = await apiLogModel.logApiCall({
        type: 'user_centrality',
        model: this.modelName,
        request: { system: systemPrompt, prompt, max_tokens: this.maxTokens, temperature: 0.2 },
        response: {
          content: responseText,
          usage: {
            promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
            completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: result.response.usageMetadata?.totalTokenCount || 0,
          },
        },
        duration: Date.now() - startTime,
        metadata: { userId: user.id, channelName, messageCount: messageLines.length },
      });

      // ローカルAIログ（カテゴリ: centrality_ranking）
      if (config.logging.enableAiInstructionLogging) {
        try {
          await aiInstructionLogger.logInstruction({
            userId: user?.id || 'system',
            instruction: `${systemPrompt}\n\n${prompt}`,
            response: responseText,
            category: 'centrality_ranking',
            baseScore: 100,
            notes: `User centrality evaluation for user: ${user?.id} in channel: ${channelName}\nmessagesSampled: ${messageLines.length}, totalTokens: ${result.response.usageMetadata?.totalTokenCount || 0}`
          });
        } catch (logError) {
          logger.error('Failed to log AI instruction (centrality_ranking):', logError);
        }
      }

      const parsed = this.parseUserCentralityResponse(responseText);
      return parsed;
    } catch (error) {
      logger.error('Error evaluating user centrality:', error);
      if (!apiLogId) {
        await apiLogModel.logApiCall({
          type: 'user_centrality',
          model: this.modelName,
          request: { user: user?.id, channelName },
          error,
          duration: Date.now() - startTime,
          metadata: { userId: user?.id, channelName },
        });
      }
      return {
        scores: {
          facilitation: 0,
          problem_solving: 0,
          broker: 0,
          engagement: 0,
          thread_management: 0,
          knowledge: 0,
          tone: 0,
          execution: 0,
        },
        notes: 'api_error',
      };
    }
  }
}

module.exports = new GeminiService();
