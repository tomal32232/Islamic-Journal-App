const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { google } = require('googleapis');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const SHEET_ID = 'YOUR_SHEET_ID'; // You'll need to replace this with your actual sheet ID
const RANGE = 'Sheet1!A2:D'; // Starting from A2 to skip header row

async function getAuthToken() {
  const auth = new google.auth.GoogleAuth({
    scopes: SCOPES,
    keyFile: 'path/to/your/credentials.json' // You'll need to set up service account credentials
  });
  return await auth.getClient();
}

async function getSpreadsheetData(auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });
  return response.data.values;
}

exports.syncMoodGuidance = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    try {
      const auth = await getAuthToken();
      const rows = await getSpreadsheetData(auth);
      
      if (!rows || rows.length === 0) {
        console.log('No data found in spreadsheet');
        return null;
      }

      const batch = admin.firestore().batch();
      const guidanceRef = admin.firestore().collection('moodGuidance');

      // First, delete all existing documents
      const existingDocs = await guidanceRef.get();
      existingDocs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Then add new documents
      for (const row of rows) {
        if (row.length < 4) continue; // Skip incomplete rows
        
        const [mood, arabicVerse, translation, guidance] = row;
        if (!mood || !arabicVerse || !translation || !guidance) continue;

        const docRef = guidanceRef.doc(); // Auto-generate ID
        batch.set(docRef, {
          mood: mood.toLowerCase().trim(),
          arabicVerse,
          translation,
          guidance,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      await batch.commit();
      console.log('Successfully synced mood guidance data');
      return null;
    } catch (error) {
      console.error('Error syncing mood guidance:', error);
      throw error;
    }
  });

// Optional: Add an HTTP endpoint to trigger sync manually
exports.syncMoodGuidanceManual = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const auth = await getAuthToken();
    const rows = await getSpreadsheetData(auth);
    
    if (!rows || rows.length === 0) {
      res.status(404).send('No data found in spreadsheet');
      return;
    }

    const batch = admin.firestore().batch();
    const guidanceRef = admin.firestore().collection('moodGuidance');

    // Delete existing documents
    const existingDocs = await guidanceRef.get();
    existingDocs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add new documents
    for (const row of rows) {
      if (row.length < 4) continue;
      
      const [mood, arabicVerse, translation, guidance] = row;
      if (!mood || !arabicVerse || !translation || !guidance) continue;

      const docRef = guidanceRef.doc();
      batch.set(docRef, {
        mood: mood.toLowerCase().trim(),
        arabicVerse,
        translation,
        guidance,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();
    res.status(200).send('Successfully synced mood guidance data');
  } catch (error) {
    console.error('Error syncing mood guidance:', error);
    res.status(500).send('Error syncing mood guidance data');
  }
}); 