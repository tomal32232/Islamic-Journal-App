import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const serviceAccount = require('../serviceAccountKey.json');

// Initialize admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// The user ID to make admin
const uid = process.argv[2];

if (!uid) {
  console.error('Please provide a user ID as an argument');
  process.exit(1);
}

async function makeUserAdmin(uid) {
  try {
    // Set admin claim
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`Successfully made user ${uid} an admin`);
    
    // Verify the claim was set
    const user = await admin.auth().getUser(uid);
    console.log('User claims:', user.customClaims);
    
    process.exit(0);
  } catch (error) {
    console.error('Error making user admin:', error);
    process.exit(1);
  }
}

makeUserAdmin(uid); 