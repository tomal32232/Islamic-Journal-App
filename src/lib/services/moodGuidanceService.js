import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Helper function to sync Google Sheets with Firestore
async function syncWithFirestore(sheetGuidance) {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    // Only admins can sync data
    const idTokenResult = user ? await user.getIdTokenResult() : null;
    if (!idTokenResult?.claims?.admin) {
      console.log('User is not an admin, skipping sync');
      return;
    }

    const guidanceRef = collection(db, 'moodGuidance');
    const guidanceSnapshot = await getDocs(guidanceRef);
    
    // Create a map of existing guidance for easy comparison
    const existingGuidance = new Map();
    guidanceSnapshot.forEach(doc => {
      const guidance = doc.data();
      const key = `${guidance.mood}-${guidance.arabicVerse}-${guidance.translation}`;
      existingGuidance.set(key, doc.id);
    });

    // Add new guidance and track which ones exist in the sheet
    const processedKeys = new Set();
    for (const guidance of sheetGuidance) {
      const key = `${guidance.mood}-${guidance.arabicVerse}-${guidance.translation}`;
      processedKeys.add(key);

      if (!existingGuidance.has(key)) {
        console.log('Adding new guidance to Firestore:', guidance);
        await addDoc(guidanceRef, guidance);
      }
    }

    // Delete guidance that is in Firestore but not in the sheet
    for (const [key, docId] of existingGuidance.entries()) {
      if (!processedKeys.has(key)) {
        console.log('Deleting guidance from Firestore:', docId);
        await deleteDoc(doc(db, 'moodGuidance', docId));
      }
    }
  } catch (error) {
    console.error('Error syncing with Firestore:', error);
    throw error;
  }
}

export async function fetchRandomGuidanceForMood(mood) {
  try {
    const guidanceRef = collection(db, 'moodGuidance');
    const moodQuery = query(guidanceRef, where('mood', '==', mood.toLowerCase()));
    const guidanceSnapshot = await getDocs(moodQuery);
    
    if (guidanceSnapshot.empty) {
      console.log('No guidance found for mood:', mood);
      return null;
    }

    // Convert to array and get a random entry
    const guidanceArray = [];
    guidanceSnapshot.forEach(doc => {
      guidanceArray.push(doc.data());
    });

    const randomIndex = Math.floor(Math.random() * guidanceArray.length);
    return guidanceArray[randomIndex];
  } catch (error) {
    console.error('Error fetching random guidance:', error);
    return null;
  }
}

export async function fetchMoodGuidance() {
  try {
    // First try to get guidance from Google Sheet
    const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
    const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
    
    // Use Sheet2 for mood guidance
    const sheetName = 'Sheet2';
    const range = `${sheetName}!A2:D`;
    
    console.log('Fetching mood guidance from sheet:', SHEET_ID);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Sheets API Error:', errorData);
      throw new Error(`Google Sheets API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Received data from Google Sheets:', data);

    if (data.values && data.values.length > 0) {
      // Convert rows to guidance objects
      const sheetGuidance = data.values.map(([mood, arabicVerse, translation, guidance]) => ({
        mood: mood?.trim().toLowerCase() || '',
        arabicVerse: arabicVerse?.trim() || '',
        translation: translation?.trim() || '',
        guidance: guidance?.trim() || ''
      })).filter(g => g.mood && g.arabicVerse && g.translation && g.guidance);

      console.log('Parsed guidance:', sheetGuidance);

      // Try to sync with Firestore if user is admin
      try {
        await syncWithFirestore(sheetGuidance);
      } catch (error) {
        console.log('Failed to sync with Firestore (user might not be admin):', error);
      }

      return true;
    } else {
      console.log('No values found in Google Sheet');
      return false;
    }
  } catch (error) {
    console.error('Error fetching from Google Sheets:', error);
    return false;
  }
} 