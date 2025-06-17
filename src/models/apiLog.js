const { admin } = require('../config/firebase');
const config = require('../config');
const logger = require('../utils/logger');

class ApiLogModel {
  constructor() {
    this.db = null;
    this.collection = 'apiLogs';
  }

  /**
   * Initialize Firestore connection
   * @param {Object} db - Firestore instance
   */
  initialize(db) {
    this.db = db;
  }

  /**
   * Log an API request and response
   * @param {Object} logData - Log data containing request and response
   * @returns {Promise<string>} Log document ID
   */
  async logApiCall(logData) {
    // Check if API logging is enabled
    if (!config.logging.enableApiLogging) {
      return null;
    }
    
    try {
      const {
        type,
        model,
        request,
        response,
        error,
        duration,
        tokenUsage,
        metadata
      } = logData;

      const logEntry = {
        type: type || 'evaluation',
        model: model || 'claude-3-haiku-20240307',
        request: {
          prompt: request.prompt || request.messages || request,
          systemPrompt: request.system || null,
          maxTokens: request.max_tokens || null,
          temperature: request.temperature || null,
        },
        response: response ? {
          content: response.content || response,
          stopReason: response.stop_reason || null,
          usage: response.usage || null,
        } : null,
        error: error ? {
          message: error.message,
          code: error.code || null,
          stack: error.stack || null,
        } : null,
        duration: duration || null,
        tokenUsage: tokenUsage || (response?.usage ? {
          inputTokens: response.usage.input_tokens || response.usage.promptTokens || 0,
          outputTokens: response.usage.output_tokens || response.usage.completionTokens || 0,
          totalTokens: response.usage.total_tokens || response.usage.totalTokens || 
                      ((response.usage.input_tokens || response.usage.promptTokens || 0) + 
                       (response.usage.output_tokens || response.usage.completionTokens || 0)),
        } : null),
        metadata: metadata || {},
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: new Date(),
      };

      const docRef = await this.db.collection(this.collection).add(logEntry);
      logger.debug(`API call logged with ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      logger.error('Failed to log API call:', error);
      // Don't throw error to avoid disrupting the main flow
      return null;
    }
  }

  /**
   * Get API logs for a specific time period
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} API logs
   */
  async getApiLogs(startDate, endDate, filters = {}) {
    try {
      let query = this.db.collection(this.collection)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .orderBy('createdAt', 'desc');

      // Apply additional filters
      if (filters.type) {
        query = query.where('type', '==', filters.type);
      }
      if (filters.model) {
        query = query.where('model', '==', filters.model);
      }
      if (filters.hasError !== undefined) {
        query = query.where('error', filters.hasError ? '!=' : '==', null);
      }

      const snapshot = await query.limit(filters.limit || 100).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error('Failed to get API logs:', error);
      throw error;
    }
  }

  /**
   * Get API usage statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Usage statistics
   */
  async getApiStatistics(startDate, endDate) {
    try {
      const logs = await this.getApiLogs(startDate, endDate);
      
      const stats = {
        totalCalls: logs.length,
        successfulCalls: logs.filter(log => !log.error).length,
        failedCalls: logs.filter(log => log.error).length,
        totalTokens: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        averageResponseTime: 0,
        byType: {},
        byModel: {},
        errors: [],
      };

      let totalDuration = 0;
      let durationCount = 0;

      for (const log of logs) {
        // Token usage
        if (log.tokenUsage) {
          stats.totalTokens += log.tokenUsage.totalTokens || 0;
          stats.totalInputTokens += log.tokenUsage.inputTokens || 0;
          stats.totalOutputTokens += log.tokenUsage.outputTokens || 0;
        }

        // Response time
        if (log.duration) {
          totalDuration += log.duration;
          durationCount++;
        }

        // By type
        const type = log.type || 'unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;

        // By model
        const model = log.model || 'unknown';
        stats.byModel[model] = (stats.byModel[model] || 0) + 1;

        // Errors
        if (log.error) {
          stats.errors.push({
            timestamp: log.createdAt,
            message: log.error.message,
            type: log.type,
          });
        }
      }

      stats.averageResponseTime = durationCount > 0 ? totalDuration / durationCount : 0;

      return stats;
    } catch (error) {
      logger.error('Failed to get API statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up old logs
   * @param {number} daysToKeep - Number of days to keep logs
   * @returns {Promise<number>} Number of deleted logs
   */
  async cleanupOldLogs(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const snapshot = await this.db.collection(this.collection)
        .where('createdAt', '<', cutoffDate)
        .get();

      const batch = this.db.batch();
      let deleteCount = 0;

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      await batch.commit();
      logger.info(`Cleaned up ${deleteCount} old API logs`);
      return deleteCount;
    } catch (error) {
      logger.error('Failed to clean up old logs:', error);
      throw error;
    }
  }
}

module.exports = new ApiLogModel();