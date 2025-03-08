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
    
    console.log('Existing guidance documents in Firestore:', guidanceSnapshot.size);
    
    // Create a map of existing guidance for easy comparison
    const existingGuidance = new Map();
    guidanceSnapshot.forEach(doc => {
      const guidance = doc.data();
      const key = `${guidance.mood}-${guidance.arabicVerse}-${guidance.translation}`;
      existingGuidance.set(key, doc.id);
      console.log('Existing guidance mood:', guidance.mood);
      
      // Check specifically for seeking_peace entries
      if (guidance.mood === 'seeking_peace') {
        console.log('Found seeking_peace entry in Firestore:', doc.id);
        console.log('seeking_peace entry data:', guidance);
      }
    });

    console.log('Seeking peace entries in Firestore:', 
      Array.from(existingGuidance.keys()).filter(key => key.startsWith('seeking_peace')).length);

    // Add new guidance and track which ones exist in the sheet
    const processedKeys = new Set();
    for (const guidance of sheetGuidance) {
      const key = `${guidance.mood}-${guidance.arabicVerse}-${guidance.translation}`;
      processedKeys.add(key);

      if (guidance.mood === 'seeking_peace') {
        console.log('Processing seeking_peace guidance from sheet:', guidance);
        console.log('seeking_peace key:', key);
        console.log('Key exists in Firestore?', existingGuidance.has(key));
      }

      if (!existingGuidance.has(key)) {
        console.log('Adding new guidance to Firestore:', guidance.mood);
        const docRef = await addDoc(guidanceRef, guidance);
        console.log('Added guidance with ID:', docRef.id);
        
        if (guidance.mood === 'seeking_peace') {
          console.log('Added seeking_peace guidance to Firestore with ID:', docRef.id);
        }
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
    console.log('fetchRandomGuidanceForMood called with mood:', mood);
    console.log('Mood type:', typeof mood);
    
    // Check if mood is a string or an object
    let moodValue = typeof mood === 'string' ? mood.toLowerCase() : mood.value ? mood.value.toLowerCase() : '';
    
    // Normalize the mood value by replacing underscores with spaces
    moodValue = moodValue.replace('_', ' ');
    
    console.log('Normalized mood value:', moodValue);
    console.log('Mood value characters:', [...moodValue].map(c => `'${c}' (${c.charCodeAt(0)})`));
    
    const guidanceRef = collection(db, 'moodGuidance');
    const moodQuery = query(guidanceRef, where('mood', '==', moodValue));
    console.log('Querying for mood:', moodValue);
    
    // Let's also try to get all mood guidance entries to see what's available
    const allGuidanceQuery = await getDocs(collection(db, 'moodGuidance'));
    console.log('All available moods in database:', 
      allGuidanceQuery.docs.map(doc => doc.data().mood)
        .filter((value, index, self) => self.indexOf(value) === index));
    
    const guidanceSnapshot = await getDocs(moodQuery);
    
    console.log('Query result empty?', guidanceSnapshot.empty);
    console.log('Query result size:', guidanceSnapshot.size);
    
    if (guidanceSnapshot.empty) {
      console.log('No guidance found for mood:', moodValue);
      return null;
    }

    // Convert to array and get a random entry
    const guidanceArray = [];
    guidanceSnapshot.forEach(doc => {
      console.log('Guidance document data:', doc.data());
      guidanceArray.push(doc.data());
    });

    console.log('Found guidance array length:', guidanceArray.length);
    const randomIndex = Math.floor(Math.random() * guidanceArray.length);
    console.log('Selected random index:', randomIndex);
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
      const sheetGuidance = data.values.map(([mood, arabicVerse, translation, guidance]) => {
        const moodValue = mood?.trim().toLowerCase() || '';
        console.log('Processing mood from sheet:', moodValue);
        return {
          mood: moodValue,
          arabicVerse: arabicVerse?.trim() || '',
          translation: translation?.trim() || '',
          guidance: guidance?.trim() || ''
        };
      }).filter(g => g.mood && g.arabicVerse && g.translation && g.guidance);

      console.log('Parsed guidance:', sheetGuidance);
      console.log('Seeking peace entries:', sheetGuidance.filter(g => g.mood === 'seeking_peace').length);

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

// Add this function to manually add a seeking_peace guidance entry
export async function addSeekingPeaceGuidance() {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    // Only admins can add guidance
    const idTokenResult = user ? await user.getIdTokenResult() : null;
    if (!idTokenResult?.claims?.admin) {
      console.log('User is not an admin, cannot add guidance');
      return false;
    }

    console.log('Adding seeking peace guidance manually');
    
    const guidanceRef = collection(db, 'moodGuidance');
    
    // Check if we already have seeking peace entries
    const existingQuery = query(guidanceRef, where('mood', '==', 'seeking peace'));
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      console.log('seeking peace guidance already exists, count:', existingSnapshot.size);
      return true;
    }
    
    // Add a sample seeking peace guidance
    const sampleGuidance = {
      mood: 'seeking peace',
      arabicVerse: 'وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ وَإِنَّهَا لَكَبِيرَةٌ إِلَّا عَلَى الْخَاشِعِينَ',
      translation: 'And seek help through patience and prayer, and indeed, it is difficult except for the humbly submissive [to Allah]',
      guidance: '1. Take a deep breath and remember that Allah is with the patient.\n2. Engage in prayer with full concentration to find peace.\n3. Remember that every difficulty comes with ease.'
    };
    
    const docRef = await addDoc(guidanceRef, sampleGuidance);
    console.log('Added sample seeking peace guidance with ID:', docRef.id);
    
    return true;
  } catch (error) {
    console.error('Error adding seeking_peace guidance:', error);
    return false;
  }
} 