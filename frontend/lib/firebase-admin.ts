import * as admin from 'firebase-admin';

// Initialize Firebase Admin
let db: admin.firestore.Firestore;

if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
      throw new Error('Missing Firebase configuration. Please check your .env.local file.');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    
    db = admin.firestore();
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    throw error;
  }
} else {
  db = admin.firestore();
}

export { db, admin };