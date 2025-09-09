const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config');
const messageService = require('./messageService');

class UserScoreService {
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
   * 環境変数のチャンネルで30日集計してCSV保存
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
      return { filePath, startDate, endDate, channel };
    } catch (e) {
      logger.error('Failed to export user score CSV:', e);
      throw e;
    }
  }
}

module.exports = new UserScoreService();


