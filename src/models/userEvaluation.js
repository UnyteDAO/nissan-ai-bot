const { admin } = require('../config/firebase');

class UserEvaluationModel {
  constructor() {
    this.db = null;
    this.collection = 'userEvaluations';
  }

  /**
   * Initialize Firestore connection
   * @param {Object} db - Firestore instance
   */
  initialize(db) {
    this.db = db;
  }

  /**
   * Save user evaluation reference
   * @param {string} userId - User ID
   * @param {string} evaluationId - Evaluation document ID
   * @param {Object} evaluationData - Evaluation data for this user
   */
  async saveUserEvaluation(userId, evaluationId, evaluationData) {
    try {
      const userEvalRef = {
        userId,
        evaluationId,
        threadId: evaluationData.threadId,
        score: evaluationData.score,
        breakdown: evaluationData.breakdown,
        comments: evaluationData.comments || [],
        createdAt: evaluationData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      };

      // Use composite key: userId_evaluationId
      const docId = `${userId}_${evaluationId}`;
      await this.db.collection(this.collection).doc(docId).set(userEvalRef);
      
      return docId;
    } catch (error) {
      throw new Error(`Failed to save user evaluation: ${error.message}`);
    }
  }

  /**
   * Get user evaluations with pagination
   * @param {string} userId - User ID
   * @param {number} limit - Number of results per page
   * @param {number} page - Page number (0-indexed)
   * @returns {Promise<Object>} Paginated evaluations
   */
  async getUserEvaluations(userId, limit = 20, page = 0) {
    try {
      const offset = page * limit;
      
      // Get total count for this user
      const countSnapshot = await this.db.collection(this.collection)
        .where('userId', '==', userId)
        .count()
        .get();
      
      const totalCount = countSnapshot.data().count;
      
      // Get paginated results
      const snapshot = await this.db.collection(this.collection)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      
      const evaluations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        evaluations,
        totalCount,
        hasMore: offset + evaluations.length < totalCount,
        page,
        limit
      };
    } catch (error) {
      throw new Error(`Failed to get user evaluations: ${error.message}`);
    }
  }

  /**
   * Migrate existing evaluations to user-centric collection
   * This is a one-time migration function
   */
  async migrateExistingEvaluations() {
    try {
      console.log('Starting migration of user evaluations...');
      
      const evaluationsSnapshot = await this.db.collection('evaluations')
        .orderBy('createdAt', 'desc')
        .get();
      
      console.log(`Found ${evaluationsSnapshot.size} evaluations to process`);
      
      let processed = 0;
      let batch = this.db.batch();
      let batchCount = 0;
      
      for (const doc of evaluationsSnapshot.docs) {
        const evalData = doc.data();
        const evalId = doc.id;
        
        if (evalData.evaluation && evalData.evaluation.participants) {
          for (const [userId, userData] of Object.entries(evalData.evaluation.participants)) {
            const docId = `${userId}_${evalId}`;
            const userEvalRef = this.db.collection(this.collection).doc(docId);
            
            batch.set(userEvalRef, {
              userId,
              evaluationId: evalId,
              threadId: evalData.threadId,
              score: userData.score,
              breakdown: {
                technicalAdvice: userData.technicalAdvice || 0,
                problemSolving: userData.problemSolving || 0,
                feasibility: userData.feasibility || 0,
                communication: userData.communication || 0,
                deliverables: userData.deliverables || 0,
                penalties: userData.penalties || 0,
              },
              comments: userData.comments || [],
              createdAt: evalData.createdAt,
            });
            
            batchCount++;
            
            // Commit batch every 400 operations (Firestore limit is 500)
            if (batchCount >= 400) {
              await batch.commit();
              processed += batchCount;
              console.log(`Processed ${processed} user evaluations`);
              // Create new batch for next operations
              batch = this.db.batch();
              batchCount = 0;
            }
          }
        }
      }
      
      // Commit remaining operations
      if (batchCount > 0) {
        await batch.commit();
        processed += batchCount;
      }
      
      console.log(`Migration completed. Processed ${processed} user evaluations`);
      return processed;
    } catch (error) {
      throw new Error(`Failed to migrate evaluations: ${error.message}`);
    }
  }
}

module.exports = new UserEvaluationModel();