const fs = require('fs').promises;
const path = require('path');
const geminiService = require('./geminiService');
const config = require('../config');
const logger = require('../utils/logger');

class LogSummaryService {
  constructor() {
    this.chatDir = path.join(__dirname, '../../logs/chat');
    this.userNameCache = new Map();
  }

  /**
   * 前日JSTのYYYYMMDDラベルを取得（エクスポートと同一基準）
   */
  getPreviousDayJstLabel() {
    const offsetMs = 9 * 60 * 60 * 1000;
    const now = new Date();
    const jstNow = new Date(now.getTime() + offsetMs);
    const y = jstNow.getUTCFullYear();
    const m = jstNow.getUTCMonth();
    const d = jstNow.getUTCDate();
    // エクスポートと同様に前日JST 00:00(=UTC前々日15:00)の+9hでラベル化
    const prevStartUtc = new Date(Date.UTC(y, m, d - 2, 15, 0, 0, 0));
    const jstLabelDate = new Date(prevStartUtc.getTime() + offsetMs);
    const yyyy = jstLabelDate.getUTCFullYear();
    const mm = String(jstLabelDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jstLabelDate.getUTCDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }

  /**
   * 1行CSVパーサ（ダブルクオート対応）
   */
  parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          out.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
    }
    out.push(cur);
    return out;
  }

  /**
   * CSVからメッセージ配列を抽出（末尾からmax件）
   */
  async extractMessagesFromCsv(filePath, max) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(l => l.length > 0);
      if (lines.length <= 1) return { channelId: null, channelName: null, messages: [] };

      const header = this.parseCsvLine(lines[0]);
      const idx = {
        ts: header.indexOf('timestamp_jst'),
        channelId: header.indexOf('channel_id'),
        channelName: header.indexOf('channel_name'),
        messageId: header.indexOf('message_id'),
        threadId: header.indexOf('thread_id'),
        threadName: header.indexOf('thread_name'),
        authorName: header.indexOf('author_name'),
        content: header.indexOf('content'),
      };

      const dataLines = lines.slice(1);
      const take = Math.max(0, Math.min(max, dataLines.length));
      const start = dataLines.length - take;
      const slice = dataLines.slice(start);

      let channelId = null;
      let channelName = null;
      const messages = [];
      for (const line of slice) {
        const cols = this.parseCsvLine(line);
        if (!channelId && idx.channelId >= 0) channelId = cols[idx.channelId];
        if (!channelName && idx.channelName >= 0) channelName = cols[idx.channelName];
        messages.push({
          timestamp: idx.ts >= 0 ? cols[idx.ts] : '',
          authorName: idx.authorName >= 0 ? cols[idx.authorName] : '',
          content: idx.content >= 0 ? cols[idx.content] : '',
          messageId: idx.messageId >= 0 ? cols[idx.messageId] : '',
          channelId: idx.channelId >= 0 ? cols[idx.channelId] : channelId,
          threadId: idx.threadId >= 0 ? cols[idx.threadId] : '',
          threadName: idx.threadName >= 0 ? cols[idx.threadName] : '',
        });
      }

      return { channelId, channelName, messages };
    } catch (e) {
      logger.error('Failed to extract messages from CSV:', e);
      return { channelId: null, channelName: null, messages: [] };
    }
  }

  /**
   * 前日分をチャンネルごとに要約し、指定のチャンネルに投稿
   * @param {import('discord.js').Client} client
   */
  async summarizePreviousDayAndPost(client) {
    try {
      const label = this.getPreviousDayJstLabel();
      let files;
      try {
        files = await fs.readdir(this.chatDir);
      } catch (e) {
        logger.warn('No chat directory found for channel summary');
        return;
      }

      const targetFiles = files.filter(f => f.endsWith(`_${label}.csv`) && f.startsWith('messages_'));
      if (targetFiles.length === 0) {
        logger.info(`No CSV found for summary: label=${label}`);
        return;
      }

      // 投稿先チャンネル（.envのLOG_EXPORT_CHANNEL_ID）
      if (!config.logsExport.exportChannelId) {
        logger.warn('LOG_EXPORT_CHANNEL_ID is not configured for summary posting');
        return;
      }
      const exportChannel = await client.channels.fetch(config.logsExport.exportChannelId).catch(() => null);
      if (!exportChannel || !('send' in exportChannel)) {
        logger.warn(`Export channel not available: ${config.logsExport.exportChannelId}`);
        return;
      }

      const maxTotal = 400;
      const perChannel = Math.max(50, Math.floor(maxTotal / targetFiles.length));

      for (const file of targetFiles) {
        const filePath = path.join(this.chatDir, file);
        const { channelId, channelName, messages } = await this.extractMessagesFromCsv(filePath, perChannel);
        if (!channelId || messages.length === 0) {
          logger.info(`Skip summary for ${file} - no messages or channel id`);
          continue;
        }

        // メンション(<@id>)をusername(@name)に置換
        const preprocessedMessages = await this.replaceUserMentionsWithNames(messages, client, exportChannel.guildId);

        const summary = await geminiService.generateChannelSummary({
          channelName: channelName || `channel_${channelId}`,
          jstDateLabel: label,
          guildId: exportChannel.guildId,
          messages: preprocessedMessages,
        });

        const dateStr = `${label.substring(0, 4)}/${label.substring(4, 6)}/${label.substring(6, 8)}`;
        const header = `📝 前日サマリー（${dateStr} JST）\n対象: <#${channelId}>`;
        const content = `${header}\n${summary}`;
        await exportChannel.send({ content: content.substring(0, 2000) });
      }
    } catch (error) {
      logger.error('Error in summarizePreviousDayAndPost:', error);
    }
  }
}

/**
 * ユーザーメンション(<@id>, <@!id>)を@usernameに置換
 * @param {Array<{content:string}>} messages
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 */
LogSummaryService.prototype.replaceUserMentionsWithNames = async function (messages, client, guildId) {
  try {
    if (!guildId || !Array.isArray(messages) || messages.length === 0) return messages;

    const userMentionRegex = /<@!?(\d{15,20})>/g;
    const userIds = new Set();
    for (const message of messages) {
      if (!message || typeof message.content !== 'string') continue;
      const iterator = message.content.matchAll(userMentionRegex);
      for (const match of iterator) {
        if (match && match[1]) userIds.add(match[1]);
      }
    }

    if (userIds.size === 0) return messages;

    const idToName = new Map();
    const unresolved = [];
    for (const id of userIds) {
      if (this.userNameCache.has(id)) {
        idToName.set(id, this.userNameCache.get(id));
      } else {
        unresolved.push(id);
      }
    }

    // Guildメンバーをまとめて取得（上限に合わせてチャンク）
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    const chunkSize = 100;
    if (guild && unresolved.length > 0) {
      for (let start = 0; start < unresolved.length; start += chunkSize) {
        const chunk = unresolved.slice(start, start + chunkSize);
        const members = await guild.members.fetch({ user: chunk }).catch(() => null);
        if (members && typeof members.forEach === 'function') {
          members.forEach(member => {
            const username = member?.user?.username;
            if (member?.id && username) {
              idToName.set(member.id, username);
              this.userNameCache.set(member.id, username);
            }
          });
        }
      }
    }

    // 未解決IDは users.fetch でフォールバック
    for (const id of unresolved) {
      if (idToName.has(id)) continue;
      const user = await client.users.fetch(id).catch(() => null);
      const name = user?.username || null;
      if (name) {
        idToName.set(id, name);
        this.userNameCache.set(id, name);
      }
    }

    // 実置換
    for (const message of messages) {
      if (!message || typeof message.content !== 'string') continue;
      message.content = message.content.replace(userMentionRegex, (_all, id) => {
        const name = idToName.get(id) || this.userNameCache.get(id);
        return name ? `@${name}` : '@unknown';
      });
    }

    return messages;
  } catch (e) {
    logger.warn('Failed to replace mentions with usernames', e);
    return messages;
  }
};

module.exports = new LogSummaryService();


