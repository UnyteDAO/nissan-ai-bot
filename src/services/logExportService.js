const { AttachmentBuilder } = require('discord.js');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config');
const messageService = require('./messageService');

class LogExportService {
  constructor() { }

  /**
   * 前日(JST) 00:00:00.000 〜 23:59:59.999 のUTC範囲を取得
   * @returns {{ startUtc: Date, endUtc: Date, jstDateLabel: string }}
   */
  getPreviousDayJstRange() {
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jstNow.getUTCFullYear();
    const m = jstNow.getUTCMonth();
    const d = jstNow.getUTCDate();

    // 00:00 JST は UTC の 15:00 前日、23:59:59.999 JST は UTC の 14:59:59.999 当日
    const startUtc = new Date(Date.UTC(y, m, d - 1, 15, 0, 0, 0));
    const endUtc = new Date(Date.UTC(y, m, d, 14, 59, 59, 999));

    // ラベル用（JST基準の日付 YYYYMMDD）
    const jstPrev = new Date(Date.UTC(y, m, d - 1, 0, 0, 0, 0));
    const yyyy = jstPrev.getUTCFullYear();
    const mm = String(jstPrev.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jstPrev.getUTCDate()).padStart(2, '0');
    const jstDateLabel = `${yyyy}${mm}${dd}`;

    return { startUtc, endUtc, jstDateLabel };
  }

  /**
   * JSTの日時文字列に整形
   * @param {Date} date
   * @returns {string}
   */
  formatJst(date) {
    return new Date(date).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
  }

  /**
   * CSV行用に値をエスケープ
   * @param {string|number|boolean|null|undefined} value
   * @returns {string}
   */
  csvEscape(value) {
    if (value === null || value === undefined) return '""';
    let str = String(value);
    // 2重引用符のエスケープ
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }

  /**
   * スレッド（アクティブ/アーカイブ）を取得
   * @param {import('discord.js').TextChannel} channel
   * @returns {Promise<Array<import('discord.js').ThreadChannel>>}
   */
  async fetchAllThreads(channel) {
    const threads = [];
    try {
      const active = await channel.threads.fetchActive();
      if (active && active.threads) {
        active.threads.forEach(t => threads.push(t));
      }
    } catch (e) {
      logger.warn(`Failed to fetch active threads for #${channel.name}:`, e.message || e);
    }
    try {
      // 公開アーカイブ
      const archivedPublic = await channel.threads.fetchArchived({ type: 'public' });
      if (archivedPublic && archivedPublic.threads) {
        archivedPublic.threads.forEach(t => threads.push(t));
      }
    } catch (e) {
      logger.warn(`Failed to fetch archived public threads for #${channel.name}:`, e.message || e);
    }
    return threads;
  }

  /**
   * 指定チャンネル（および配下スレッド）から期間内のメッセージを収集
   * @param {import('discord.js').Client} client
   * @param {string} channelId
   * @param {Date} startUtc
   * @param {Date} endUtc
   * @returns {Promise<{ channelName: string, rows: string[] }>} rows はヘッダ除くデータ行
   */
  async collectChannelLogs(client, channelId, startUtc, endUtc) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      logger.warn(`Source channel not found: ${channelId}`);
      return { channelName: `channel_${channelId}`, rows: [] };
    }

    // Text系のみ対象
    if (!('messages' in channel)) {
      logger.warn(`Channel is not text-based: ${channelId}`);
      return { channelName: channel.name || `channel_${channelId}`, rows: [] };
    }

    const header = [
      'timestamp_jst',
      'message_id',
      'channel_id',
      'channel_name',
      'author_id',
      'author_name',
      'content',
      'mentions_user_ids',
      'attachments_count',
      'attachments_urls',
      'is_reply',
      'reply_to_message_id',
    ].map(h => this.csvEscape(h)).join(',');

    const rows = [header];

    // 親チャンネルのメッセージ
    const channelMessages = await messageService.fetchChannelMessages(channel, startUtc, endUtc);
    for (const msg of channelMessages) {
      rows.push(this.buildCsvRow(msg, channel.id, channel.name));
    }

    // スレッドも対象
    const threads = await this.fetchAllThreads(channel);
    for (const thread of threads) {
      const threadMessages = await messageService.fetchChannelMessages(thread, startUtc, endUtc);
      for (const msg of threadMessages) {
        // channel_id / channel_name はスレッドを指す
        rows.push(this.buildCsvRow(msg, thread.id, thread.name));
      }
    }

    return { channelName: channel.name || `channel_${channelId}`, rows };
  }

  /**
   * 1メッセージをCSV行に整形
   * @param {import('discord.js').Message} msg
   * @param {string} outChannelId
   * @param {string} outChannelName
   * @returns {string}
   */
  buildCsvRow(msg, outChannelId, outChannelName) {
    const timestampJst = this.formatJst(new Date(msg.createdTimestamp));
    const mentions = Array.from(msg.mentions?.users?.keys?.() || []);
    const attachments = Array.from(msg.attachments?.values?.() || []);
    const attachmentUrls = attachments.map(a => a.url).join(';');
    const isReply = !!msg.reference;
    const replyTo = msg.reference?.messageId || '';

    const columns = [
      timestampJst,
      msg.id,
      outChannelId,
      outChannelName || '',
      msg.author?.id || '',
      msg.author?.username || '',
      msg.content || '',
      mentions.join('|'),
      attachments.length,
      attachmentUrls,
      isReply,
      replyTo,
    ];

    return columns.map(v => this.csvEscape(v)).join(',');
  }

  /**
   * 1つのCSV添付を作成
   * @param {string[]} rows
   * @param {string} fileName
   * @returns {AttachmentBuilder}
   */
  buildSingleAttachment(rows, fileName) {
    const csv = rows.join('\n');
    const buf = Buffer.from(csv, 'utf-8');
    return new AttachmentBuilder(buf, { name: `${fileName}.csv` });
  }

  /**
   * 前日分のメッセージを収集してCSV化し、送信先に投稿
   * @param {import('discord.js').Client} client
   */
  async exportPreviousDayAndSend(client) {
    try {
      const { startUtc, endUtc, jstDateLabel } = this.getPreviousDayJstRange();

      if (!config.logsExport.exportChannelId) {
        logger.warn('LOG_EXPORT_CHANNEL_ID is not configured');
        return;
      }
      if (!config.logsExport.sourceChannelIds || config.logsExport.sourceChannelIds.length === 0) {
        logger.warn('LOG_SOURCE_CHANNEL_IDS is not configured');
        return;
      }

      const exportChannel = await client.channels.fetch(config.logsExport.exportChannelId).catch(() => null);
      if (!exportChannel) {
        logger.warn(`Export channel not found: ${config.logsExport.exportChannelId}`);
        return;
      }

      let totalCount = 0;
      const allAttachments = [];
      const detailLines = [];

      for (const sourceId of config.logsExport.sourceChannelIds) {
        const { channelName, rows } = await this.collectChannelLogs(client, sourceId, startUtc, endUtc);
        const count = Math.max(0, rows.length - 1); // ヘッダ除く
        totalCount += count;
        detailLines.push(`• #${channelName || sourceId}: ${count}件`);

        const safeName = (channelName || `channel_${sourceId}`).replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `messages_${safeName}_${jstDateLabel}`;
        const attachment = this.buildSingleAttachment(rows, fileName);
        allAttachments.push(attachment);
      }

      const headerText = `【日次チャットログ収集レポート】 \n` +
        `[期間]: ${this.formatJst(startUtc)} 〜 ${this.formatJst(endUtc)}\n` +
        `[件数]: ${totalCount}件\n [対象チャンネル]:\n` +
        (detailLines.length ? detailLines.join('\n') : '');

      if (allAttachments.length === 0) {
        await exportChannel.send({ content: headerText + '\n\n対象期間のメッセージはありませんでした。' });
        logger.info('No messages found for export. Sent notification.');
        return;
      }

      await exportChannel.send({ content: headerText, files: allAttachments });
      logger.info(`Exported ${allAttachments.length} CSV file(s) for ${jstDateLabel}`);
    } catch (error) {
      logger.error('Error exporting daily logs:', error);
    }
  }
}

module.exports = new LogExportService();


