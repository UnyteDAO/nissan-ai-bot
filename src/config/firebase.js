const admin = require('firebase-admin');
const config = require('./index');
const logger = require('../utils/logger');

function initializeFirebase() {
  try {
    const serviceAccount = {
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    logger.info('Firebase initialized successfully');
    return admin.firestore();
  } catch (error) {
    logger.error('Failed to initialize Firebase:', error);
    throw error;
  }
}

module.exports = {
  initializeFirebase,
  admin,
};