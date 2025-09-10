const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config');
const messageService = require('./messageService');
const geminiService = require('./geminiService');

class CentralityRankingService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../logs/user_score');
  }

  /**
   * 過去N日(デフォルト30日)のUTC範囲を取得
   * @param {number} days
   */
  getDateRange(days = 30) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    return { startDate, endDate };
  }

  /**
   * JSTのYYYY-MM-DDキー
   * @param {number} tsMs
   */
  jstDayKey(tsMs) {
    const offsetMs = 9 * 60 * 60 * 1000; // +9h
    const d = new Date(tsMs + offsetMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Snowflake -> ms
   * @param {string} id
   * @returns {number|null}
   */
  getTimestampFromSnowflake(id) {
    try {
      const snow = BigInt(id);
      return Number((snow >> 22n) + 1420070400000n);
    } catch {
      return null;
    }
  }

  /**
   * ファイル名のサニタイズ
   */
  sanitizeFileName(name) {
    if (!name) return 'file';
    return name
      .normalize('NFKC')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/[\x00-\x1F\x7F]/g, '_')
      .trim();
  }

  /**
   * スレッドが期間内のメッセージを持つ可能性があるか簡易判定
   * @param {import('discord.js').ThreadChannel} thread
   * @param {Date} startDate
   */
  threadLikelyHasMessagesInRange(thread, startDate) {
    if (!thread || !thread.lastMessageId) return true;
    const lastMs = this.getTimestampFromSnowflake(thread.lastMessageId);
    if (lastMs === null) return true;
    return lastMs >= startDate.getTime();
  }

  /**
   * チャンネルの全スレッド（アクティブ/公開アーカイブ）を取得
   * @param {import('discord.js').TextChannel} channel
   */
  async fetchAllThreads(channel) {
    const threads = [];
    try {
      const active = await channel.threads.fetchActive();
      if (active && active.threads) active.threads.forEach(t => threads.push(t));
    } catch (e) {
      logger.warn(`Failed to fetch active threads for #${channel.name}:`, e.message || e);
    }
    try {
      const archivedPublic = await channel.threads.fetchArchived({ type: 'public' });
      if (archivedPublic && archivedPublic.threads) archivedPublic.threads.forEach(t => threads.push(t));
    } catch (e) {
      logger.warn(`Failed to fetch archived public threads for #${channel.name}:`, e.message || e);
    }
    return threads;
  }

  /**
   * 1ユーザーのメトリクス入れ物
   */
  createEmptyMetrics(userId) {
    return {
      userId,
      userName: '',
      messagesSent: 0,
      activeDays: new Set(),
      threadsCreated: 0,
      reactionsReceived: 0,
      repliesReceived: 0,
      mentionsReceived: 0,
    };
  }

  /**
   * メッセージ1件からメトリクスを加算
   */
  async accumulateFromMessage(metricsMap, msg) {
    if (!msg || !msg.author || msg.author.bot) return;

    const userId = msg.author.id;
    if (!metricsMap.has(userId)) metricsMap.set(userId, this.createEmptyMetrics(userId));
    const m = metricsMap.get(userId);
    if (!m.userName && msg.author.username) m.userName = msg.author.username;

    m.messagesSent += 1;
    m.activeDays.add(this.jstDayKey(msg.createdTimestamp));

    // 受け取ったリアクション
    if (msg.reactions && msg.reactions.cache) {
      for (const [, reaction] of msg.reactions.cache) {
        const count = reaction?.count ?? 0;
        m.reactionsReceived += count;
      }
    }

    // 返信を受け取った側に加算
    const refId = msg.reference?.messageId;
    if (refId) {
      const replied = await msg.fetchReference().catch(() => null);
      if (replied && replied.author && !replied.author.bot) {
        const targetId = replied.author.id;
        if (!metricsMap.has(targetId)) metricsMap.set(targetId, this.createEmptyMetrics(targetId));
        const target = metricsMap.get(targetId);
        if (!target.userName && replied.author.username) target.userName = replied.author.username;
        target.repliesReceived += 1;
      }
    }

    // メンションを受け取った側に加算
    if (msg.mentions && msg.mentions.users) {
      msg.mentions.users.forEach(u => {
        if (!u || u.bot) return;
        if (!metricsMap.has(u.id)) metricsMap.set(u.id, this.createEmptyMetrics(u.id));
        const tm = metricsMap.get(u.id);
        if (!tm.userName && u.username) tm.userName = u.username;
        tm.mentionsReceived += 1;
      });
    }
  }

  /**
   * 指定Textチャンネルと配下スレッドのメッセージを走査してメトリクス集計
   * @param {import('discord.js').TextChannel} channel
   * @param {Date} startDate
   * @param {Date} endDate
   */
  async collectMetricsForChannel(channel, startDate, endDate) {
    const metricsMap = new Map();

    // 親チャンネル
    const parentMessages = await messageService.fetchChannelMessages(channel, startDate, endDate);
    for (const msg of parentMessages) {
      await this.accumulateFromMessage(metricsMap, msg);
    }

    // スレッド
    const allThreads = await this.fetchAllThreads(channel);
    for (const thread of allThreads) {
      // スレッド作成数（作成時刻はSnowflakeで近似）
      const createdMs = this.getTimestampFromSnowflake(thread.id);
      if (createdMs && createdMs >= startDate.getTime() && createdMs <= endDate.getTime()) {
        const ownerId = thread.ownerId;
        if (ownerId) {
          if (!metricsMap.has(ownerId)) metricsMap.set(ownerId, this.createEmptyMetrics(ownerId));
          const m = metricsMap.get(ownerId);
          m.threadsCreated += 1;
        }
      }

      // 期間対象っぽくなければスキップ最適化
      if (!this.threadLikelyHasMessagesInRange(thread, startDate)) continue;

      const threadMessages = await messageService.fetchChannelMessages(thread, startDate, endDate);
      for (const msg of threadMessages) {
        await this.accumulateFromMessage(metricsMap, msg);
      }
    }

    return metricsMap;
  }

  /**
   * CSVを生成・保存
   */
  async saveAsCsv(channel, metricsMap) {
    await fs.mkdir(this.outputDir, { recursive: true });

    const header = [
      'user_id',
      'user_name',
      'messages_sent',
      'active_days',
      'threads_created',
      'reactions_received',
      'replies_received',
      'mentions_received',
    ];

    const rows = [];
    rows.push(header.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const list = Array.from(metricsMap.values()).map(m => ({
      userId: m.userId,
      userName: m.userName || '',
      messagesSent: m.messagesSent,
      activeDays: m.activeDays.size,
      threadsCreated: m.threadsCreated,
      reactionsReceived: m.reactionsReceived,
      repliesReceived: m.repliesReceived,
      mentionsReceived: m.mentionsReceived,
    }));

    list.sort((a, b) => b.messagesSent - a.messagesSent);

    for (const r of list) {
      const cols = [
        r.userId,
        r.userName,
        r.messagesSent,
        r.activeDays,
        r.threadsCreated,
        r.reactionsReceived,
        r.repliesReceived,
        r.mentionsReceived,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      rows.push(cols.join(','));
    }

    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const stamp = `${jstNow.getUTCFullYear()}${String(jstNow.getUTCMonth() + 1).padStart(2, '0')}${String(jstNow.getUTCDate()).padStart(2, '0')}_${String(jstNow.getUTCHours()).padStart(2, '0')}${String(jstNow.getUTCMinutes()).padStart(2, '0')}`;
    const safeName = this.sanitizeFileName(channel?.name || `channel_${channel?.id || 'unknown'}`);
    const fileName = `user_score_${safeName}_${stamp}.csv`;
    const filePath = path.join(this.outputDir, fileName);

    await fs.writeFile(filePath, rows.join('\n'), 'utf-8');
    logger.info(`Saved user score CSV: ${filePath}`);
    return filePath;
  }

  /**
   * 定性AIスコアを算出（ユーザー別メッセージを整形してGeminiに投入）
   * @param {import('discord.js').TextChannel} channel
   * @param {Date} startDate
   * @param {Date} endDate
   * @param {Map<string, any>} metricsMap
   */
  async evaluateQualitativeScores(channel, startDate, endDate, metricsMap) {
    // ユーザー別にメッセージ抽出
    const userToMessages = new Map();

    // 親チャンネル
    const parentMessages = await messageService.fetchChannelMessages(channel, startDate, endDate);
    for (const msg of parentMessages) {
      const uid = msg.author?.id;
      if (!uid) continue;
      if (!userToMessages.has(uid)) userToMessages.set(uid, []);
      userToMessages.get(uid).push(msg);
    }

    // スレッド
    const allThreads = await this.fetchAllThreads(channel);
    for (const thread of allThreads) {
      const threadMessages = await messageService.fetchChannelMessages(thread, startDate, endDate);
      for (const msg of threadMessages) {
        const uid = msg.author?.id;
        if (!uid) continue;
        if (!userToMessages.has(uid)) userToMessages.set(uid, []);
        userToMessages.get(uid).push(msg);
      }
    }

    // メッセージ整形: [YYYY-MM-DD HH:mm #idx] content
    const toLine = (msg, idx) => {
      const d = new Date(msg.createdTimestamp);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const content = (msg.content || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
      return `[${yyyy}-${mm}-${dd} ${hh}:${m} #${idx}] ${content}`;
    };

    const qualitative = new Map();
    for (const [userId, msgs] of userToMessages) {
      // ユーザー名
      const userName = msgs[0]?.author?.username || '';
      // 自ユーザーのメッセージのみを使用
      const own = msgs.filter(m => m.author?.id === userId);
      // 上限（トークン節約）。直近から最大200件
      const take = own.slice(-200);
      const lines = take.map((m, i) => toLine(m, i));

      const result = await geminiService.evaluateUserCentralityFromLines({
        channelName: channel.name,
        user: { id: userId, name: userName },
        window: { start: startDate, end: endDate },
        messageLines: lines,
      });
      qualitative.set(userId, result);
    }

    return qualitative; // Map<userId, {scores, evidence, notes}>
  }

  /**
   * 定量と定性の混合スコアを計算
   * @param {Map<string, any>} metricsMap
   * @param {Map<string, {scores:Object}>} qualitativeMap
   * @param {Object} weights
   */
  computeMixedScores(metricsMap, qualitativeMap, weights = {}) {
    const defaultWeights = {
      // 定量
      q_messages: 0.18,
      q_reactions: 0.18,
      q_replies: 0.16,
      q_mentions: 0.10,
      q_active_days: 0.12,
      q_threads: 0.06,
      // 定性
      a_facilitation: 0.06,
      a_problem_solving: 0.06,
      a_broker: 0.03,
      a_engagement: 0.03,
      a_thread_mgmt: 0.03,
      a_knowledge: 0.03,
      a_tone: 0.03,
      a_execution: 0.03,
    };
    const w = { ...defaultWeights, ...weights };

    // 正規化用に配列化
    const arr = Array.from(metricsMap.values()).map(m => ({
      userId: m.userId,
      messages: m.messagesSent,
      reactions: m.reactionsReceived,
      replies: m.repliesReceived,
      mentions: m.mentionsReceived,
      activeDays: m.activeDays.size,
      threads: m.threadsCreated,
    }));
    const norm = (key) => {
      const vals = arr.map(x => x[key]);
      const min = Math.min(...vals, 0);
      const max = Math.max(...vals, 1);
      const denom = max - min;
      return (v) => denom === 0 ? 0 : (v - min) / denom;
    };
    const nMessages = norm('messages');
    const nReactions = norm('reactions');
    const nReplies = norm('replies');
    const nMentions = norm('mentions');
    const nDays = norm('activeDays');
    const nThreads = norm('threads');

    const results = new Map();
    for (const m of arr) {
      const a = qualitativeMap.get(m.userId)?.scores || {};
      const score =
        w.q_messages * nMessages(m.messages) +
        w.q_reactions * nReactions(m.reactions) +
        w.q_replies * nReplies(m.replies) +
        w.q_mentions * nMentions(m.mentions) +
        w.q_active_days * nDays(m.activeDays) +
        w.q_threads * nThreads(m.threads) +
        w.a_facilitation * (a.facilitation || 0) +
        w.a_problem_solving * (a.problem_solving || 0) +
        w.a_broker * (a.broker || 0) +
        w.a_engagement * (a.engagement || 0) +
        w.a_thread_mgmt * (a.thread_management || 0) +
        w.a_knowledge * (a.knowledge || 0) +
        w.a_tone * (a.tone || 0) +
        w.a_execution * (a.execution || 0);

      results.set(m.userId, {
        mixedScore: Number(score.toFixed(4)),
        quantitative: {
          messages: m.messages,
          reactions: m.reactions,
          replies: m.replies,
          mentions: m.mentions,
          activeDays: m.activeDays,
          threads: m.threads,
        },
        qualitative: qualitativeMap.get(m.userId) || { scores: {} },
      });
    }
    return results;
  }

  /**
   * ランキングメッセージを作成して送信
   * @param {import('discord.js').Client} client
   * @param {import('discord.js').TextChannel} channel
   * @param {{startDate: Date, endDate: Date}} range
   * @param {Map<string, {mixedScore:number, quantitative:Object, qualitative:Object}>} mixed
   * @param {Map<string, any>} metricsMap
   * @param {Map<string, {scores:Object}>} qualitativeMap
   * @param {Object} weights
   */
  async sendRankingMessage(client, channel, range, mixed, metricsMap, qualitativeMap, weights = {}) {
    try {
      const exportChannelId = config.logsExport.exportChannelId;
      if (!exportChannelId) {
        logger.warn('LOG_EXPORT_CHANNEL_ID is not configured for user-score ranking');
        return;
      }
      const exportChannel = await client.channels.fetch(exportChannelId).catch(() => null);
      if (!exportChannel || !('send' in exportChannel)) {
        logger.warn(`Export channel not available: ${exportChannelId}`);
        return;
      }

      const defaultWeights = {
        q_messages: 0.18,
        q_reactions: 0.18,
        q_replies: 0.16,
        q_mentions: 0.10,
        q_active_days: 0.12,
        q_threads: 0.06,
        a_facilitation: 0.06,
        a_problem_solving: 0.06,
        a_broker: 0.03,
        a_engagement: 0.03,
        a_thread_mgmt: 0.03,
        a_knowledge: 0.03,
        a_tone: 0.03,
        a_execution: 0.03,
      };
      const w = { ...defaultWeights, ...weights };
      const weightSum = Object.values(w).reduce((a, b) => a + b, 0);

      // 正規化を再計算（computeMixedScores と同一手順）
      const arr = Array.from(metricsMap.values()).map(m => ({
        userId: m.userId,
        messages: m.messagesSent,
        reactions: m.reactionsReceived,
        replies: m.repliesReceived,
        mentions: m.mentionsReceived,
        activeDays: m.activeDays.size,
        threads: m.threadsCreated,
        userName: m.userName || '',
      }));
      const norm = (key) => {
        const vals = arr.map(x => x[key]);
        const min = Math.min(...vals, 0);
        const max = Math.max(...vals, 1);
        const denom = max - min;
        return (v) => denom === 0 ? 0 : (v - min) / denom;
      };
      const nMessages = norm('messages');
      const nReactions = norm('reactions');
      const nReplies = norm('replies');
      const nMentions = norm('mentions');
      const nDays = norm('activeDays');
      const nThreads = norm('threads');

      const idToName = new Map(arr.map(x => [x.userId, x.userName]));

      const fmtDate = (d) => d.toLocaleDateString('ja-JP');
      const header = `【${channel.name}で中心的なユーザーランキング】\n対象期間: ${fmtDate(range.startDate)} - ${fmtDate(range.endDate)}\n`;

      // 上位10名
      const ranked = Array.from(mixed.entries()).sort((a, b) => b[1].mixedScore - a[1].mixedScore).slice(0, 10);

      const labelMap = {
        messages: 'メッセージ送信',
        reactions: 'リアクション',
        replies: '返信',
        mentions: 'メンション',
        activeDays: 'アクティブ日数',
        threads: 'スレッド作成',
        facilitation: '調整・ファシリテーション',
        problem_solving: '問題解決・方向付け',
        broker: '情報ハブ・仲介',
        engagement: '参加促進・巻き込み',
        thread_management: 'スレッド運営',
        knowledge: '知識貢献',
        tone: 'トーン/秩序維持',
        execution: '実行駆動',
      };

      const toPoints = (value, weight) => Math.round((value * weight / weightSum) * 100);

      const entryLines = [];
      ranked.forEach(([userId, data], idx) => {
        const quant = arr.find(x => x.userId === userId) || { messages: 0, reactions: 0, replies: 0, mentions: 0, activeDays: 0, threads: 0 };
        const qual = qualitativeMap.get(userId)?.scores || {};

        const parts = {
          messages: toPoints(nMessages(quant.messages), w.q_messages),
          reactions: toPoints(nReactions(quant.reactions), w.q_reactions),
          replies: toPoints(nReplies(quant.replies), w.q_replies),
          mentions: toPoints(nMentions(quant.mentions), w.q_mentions),
          activeDays: toPoints(nDays(quant.activeDays), w.q_active_days),
          threads: toPoints(nThreads(quant.threads), w.q_threads),
          facilitation: toPoints(qual.facilitation || 0, w.a_facilitation),
          problem_solving: toPoints(qual.problem_solving || 0, w.a_problem_solving),
          broker: toPoints(qual.broker || 0, w.a_broker),
          engagement: toPoints(qual.engagement || 0, w.a_engagement),
          thread_management: toPoints(qual.thread_management || 0, w.a_thread_mgmt),
          knowledge: toPoints(qual.knowledge || 0, w.a_knowledge),
          tone: toPoints(qual.tone || 0, w.a_tone),
          execution: toPoints(qual.execution || 0, w.a_execution),
        };
        const total = Object.values(parts).reduce((a, b) => a + b, 0);
        const userName = idToName.get(userId) || `<@${userId}>`;

        const lines = [];
        lines.push(`${idx + 1}. ${userName}: 総合${total}点`);
        lines.push(`    - ${labelMap.messages}: ${parts.messages}点`);
        lines.push(`    - ${labelMap.reactions}: ${parts.reactions}点`);
        lines.push(`    - ${labelMap.replies}: ${parts.replies}点`);
        lines.push(`    - ${labelMap.mentions}: ${parts.mentions}点`);
        lines.push(`    - ${labelMap.activeDays}: ${parts.activeDays}点`);
        lines.push(`    - ${labelMap.threads}: ${parts.threads}点`);
        lines.push(`    - ${labelMap.facilitation}: ${parts.facilitation}点`);
        lines.push(`    - ${labelMap.problem_solving}: ${parts.problem_solving}点`);
        lines.push(`    - ${labelMap.broker}: ${parts.broker}点`);
        lines.push(`    - ${labelMap.engagement}: ${parts.engagement}点`);
        lines.push(`    - ${labelMap.thread_management}: ${parts.thread_management}点`);
        lines.push(`    - ${labelMap.knowledge}: ${parts.knowledge}点`);
        lines.push(`    - ${labelMap.tone}: ${parts.tone}点`);
        lines.push(`    - ${labelMap.execution}: ${parts.execution}点`);
        entryLines.push(lines.join('\n'));
      });

      // 送信（Discordの2000文字制限に合わせて分割）
      const chunks = [];
      let cur = header;
      for (const entry of entryLines) {
        const candidate = cur.length === 0 ? entry : `${cur}\n\n${entry}`;
        if (candidate.length > 1900) { // 余裕を持って分割
          chunks.push(cur);
          cur = entry;
        } else {
          cur = candidate;
        }
      }
      if (cur.length > 0) chunks.push(cur);

      for (const chunk of chunks) {
        await exportChannel.send({ content: chunk });
      }
    } catch (e) {
      logger.error('Failed to send ranking message:', e);
    }
  }

  /**
   * 環境変数のチャンネルで30日集計してCSV保存し、AI混合スコアも算出してログ出力
   * @param {import('discord.js').Client} client
   * @param {number} days
   */
  async exportForEnvChannel(client, days = 30) {
    try {
      const channelId = config.channels.userScoreTargetChannelId;
      if (!channelId) {
        throw new Error('USER_SCORE_CHANNEL_ID is not configured');
      }

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !('messages' in channel)) {
        throw new Error(`Target channel not found or not text-based: ${channelId}`);
      }

      const { startDate, endDate } = this.getDateRange(days);
      const metricsMap = await this.collectMetricsForChannel(channel, startDate, endDate);
      const filePath = await this.saveAsCsv(channel, metricsMap);

      // 定性AIスコア
      const qualitative = await this.evaluateQualitativeScores(channel, startDate, endDate, metricsMap);
      // 混合スコア
      const mixed = this.computeMixedScores(metricsMap, qualitative);

      // ログ出力（上位を簡易表示）
      const ranked = Array.from(mixed.entries()).sort((a, b) => b[1].mixedScore - a[1].mixedScore);
      logger.info('User centrality mixed scores (top 10):');
      ranked.slice(0, 10).forEach(([uid, data], i) => {
        logger.info(`#${i + 1} ${uid} score=${data.mixedScore} q={msg:${data.quantitative.messages}, react:${data.quantitative.reactions}, repl:${data.quantitative.replies}, men:${data.quantitative.mentions}, days:${data.quantitative.activeDays}, th:${data.quantitative.threads}} a=${JSON.stringify(data.qualitative.scores || {})}`);
      });

      // Discordへランキング送信
      await this.sendRankingMessage(client, channel, { startDate, endDate }, mixed, metricsMap, qualitative);

      return { filePath, startDate, endDate, channel, mixedScores: mixed };
    } catch (e) {
      logger.error('Failed to export user score CSV:', e);
      throw e;
    }
  }
}

module.exports = new CentralityRankingService();


