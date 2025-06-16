const { admin } = require('../config/firebase');

class EvaluationModel {
  constructor() {
    this.db = null;
    this.collections = {
      evaluations: 'evaluations',
      userScores: 'userScores',
      threads: 'threads',
      summaries: 'summaries',
    };
  }

  /**
   * Initialize Firestore connection
   * @param {Object} db - Firestore instance
   */
  initialize(db) {
    this.db = db;
  }

  /**
   * Check if thread has already been evaluated
   * @param {string} threadId - Thread ID (usually the first message ID)
   * @returns {Promise<Object|null>} Existing thread document or null
   */
  async checkThreadExists(threadId) {
    try {
      const snapshot = await this.db.collection(this.collections.threads)
        .where('id', '==', threadId)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return {
        docId: doc.id,
        data: doc.data(),
        isEvaluated: doc.data().evaluatedAt !== null
      };
    } catch (error) {
      throw new Error(`Failed to check thread existence: ${error.message}`);
    }
  }

  /**
   * Save thread data
   * @param {Object} thread - Thread data
   * @returns {Promise<string>} Thread document ID
   */
  async saveThread(thread) {
    try {
      // Check if thread already exists
      const existingThread = await this.checkThreadExists(thread.id);
      
      if (existingThread) {
        // Thread already exists, return the existing document ID
        return existingThread.docId;
      }
      
      const threadData = {
        ...thread,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        evaluatedAt: null,
      };

      const docRef = await this.db.collection(this.collections.threads).add(threadData);
      return docRef.id;
    } catch (error) {
      throw new Error(`Failed to save thread: ${error.message}`);
    }
  }

  /**
   * Save evaluation result
   * @param {string} threadId - Thread document ID
   * @param {Object} evaluation - Evaluation result
   * @returns {Promise<string>} Evaluation document ID
   */
  async saveEvaluation(threadId, evaluation) {
    try {
      const evaluationData = {
        threadId,
        evaluation,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await this.db.collection(this.collections.evaluations).add(evaluationData);

      // Update thread with evaluation status
      await this.db.collection(this.collections.threads).doc(threadId).update({
        evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
        evaluationId: docRef.id,
      });

      // Update user scores
      await this.updateUserScores(evaluation.participants);

      return docRef.id;
    } catch (error) {
      throw new Error(`Failed to save evaluation: ${error.message}`);
    }
  }

  /**
   * Update user scores based on evaluation
   * @param {Object} participants - Participant scores from evaluation
   */
  async updateUserScores(participants) {
    const batch = this.db.batch();

    for (const [userId, data] of Object.entries(participants)) {
      const userRef = this.db.collection(this.collections.userScores).doc(userId);
      
      batch.set(
        userRef,
        {
          userId,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          totalScore: admin.firestore.FieldValue.increment(data.score),
          evaluationCount: admin.firestore.FieldValue.increment(1),
          breakdown: {
            technicalAdvice: admin.firestore.FieldValue.increment(data.technicalAdvice || 0),
            problemSolving: admin.firestore.FieldValue.increment(data.problemSolving || 0),
            feasibility: admin.firestore.FieldValue.increment(data.feasibility || 0),
            communication: admin.firestore.FieldValue.increment(data.communication || 0),
            deliverables: admin.firestore.FieldValue.increment(data.deliverables || 0),
            penalties: admin.firestore.FieldValue.increment(data.penalties || 0),
          },
        },
        { merge: true }
      );
    }

    await batch.commit();
  }

  /**
   * Get user scores
   * @param {string} userId - User ID (optional, returns all if not provided)
   * @returns {Promise<Object>} User scores
   */
  async getUserScores(userId = null) {
    try {
      if (userId) {
        const doc = await this.db.collection(this.collections.userScores).doc(userId).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
      } else {
        const snapshot = await this.db.collection(this.collections.userScores)
          .orderBy('totalScore', 'desc')
          .get();
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    } catch (error) {
      throw new Error(`Failed to get user scores: ${error.message}`);
    }
  }

  /**
   * Get evaluations for a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Evaluations
   */
  async getEvaluations(startDate, endDate) {
    try {
      const snapshot = await this.db.collection(this.collections.evaluations)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Failed to get evaluations: ${error.message}`);
    }
  }

  /**
   * Save summary report
   * @param {Object} summary - Summary data
   * @param {Date} startDate - Evaluation period start
   * @param {Date} endDate - Evaluation period end
   * @returns {Promise<string>} Summary document ID
   */
  async saveSummary(summary, startDate, endDate) {
    try {
      const summaryData = {
        ...summary,
        periodStart: startDate,
        periodEnd: endDate,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await this.db.collection(this.collections.summaries).add(summaryData);
      return docRef.id;
    } catch (error) {
      throw new Error(`Failed to save summary: ${error.message}`);
    }
  }

  /**
   * Get threads that haven't been evaluated
   * @param {number} limit - Maximum number of threads to return
   * @returns {Promise<Array>} Unevaluated threads
   */
  async getUnevaluatedThreads(limit = 100) {
    try {
      const snapshot = await this.db.collection(this.collections.threads)
        .where('evaluatedAt', '==', null)
        .orderBy('createdAt', 'asc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Failed to get unevaluated threads: ${error.message}`);
    }
  }

  /**
   * Get evaluation statistics for a period
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics(startDate, endDate) {
    try {
      const evaluations = await this.getEvaluations(startDate, endDate);
      const userScores = await this.getUserScores();

      const stats = {
        totalEvaluations: evaluations.length,
        totalUsers: userScores.length,
        topContributors: userScores.slice(0, 5),
        periodStart: startDate,
        periodEnd: endDate,
        averageScore: 0,
        totalScore: 0,
      };

      if (userScores.length > 0) {
        stats.totalScore = userScores.reduce((sum, user) => sum + user.totalScore, 0);
        stats.averageScore = stats.totalScore / userScores.length;
      }

      return stats;
    } catch (error) {
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }

  /**
   * Export data for NFT minting
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} NFT data
   */
  async exportNFTData(startDate, endDate) {
    try {
      const userScores = await this.getUserScores();
      const evaluations = await this.getEvaluations(startDate, endDate);

      // Create a map of user contributions
      const userContributions = new Map();

      for (const evaluation of evaluations) {
        for (const [userId, data] of Object.entries(evaluation.evaluation.participants)) {
          if (!userContributions.has(userId)) {
            userContributions.set(userId, {
              highlights: [],
              threadCount: 0,
            });
          }
          
          const contrib = userContributions.get(userId);
          contrib.threadCount += 1;
          if (data.comments && data.comments.length > 0) {
            contrib.highlights.push(...data.comments);
          }
        }
      }

      // Format NFT data
      const nftData = userScores.map(user => ({
        userId: user.userId,
        address: null, // To be filled by user
        score: user.totalScore,
        rank: userScores.findIndex(u => u.userId === user.userId) + 1,
        evaluationPeriod: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        contributions: {
          threadCount: userContributions.get(user.userId)?.threadCount || 0,
          highlights: userContributions.get(user.userId)?.highlights || [],
        },
        breakdown: user.breakdown,
        metadata: {
          evaluationCount: user.evaluationCount,
          averageScore: user.totalScore / user.evaluationCount,
        },
      }));

      return nftData;
    } catch (error) {
      throw new Error(`Failed to export NFT data: ${error.message}`);
    }
  }
}

module.exports = new EvaluationModel();