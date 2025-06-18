require('dotenv').config();
const { initializeFirebase } = require('../src/config/firebase');
const userEvaluationModel = require('../src/models/userEvaluation');

async function main() {
  try {
    console.log('Initializing Firebase...');
    const db = initializeFirebase();
    userEvaluationModel.initialize(db);
    
    console.log('Starting user evaluations migration...');
    const count = await userEvaluationModel.migrateExistingEvaluations();
    
    console.log(`Migration completed successfully! Migrated ${count} user evaluation records.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();