import { writable } from 'svelte/store';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, orderBy, addDoc, Timestamp } from 'firebase/firestore';

export const quranHistoryStore = writable([]);

export async function getQuranHistory() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('No user logged in');
      return;
    }
    console.log('Getting Quran history for user:', user.uid);

    const readingSessionsRef = collection(db, 'readingSessions');
    console.log('Collection reference created');

    const q = query(
      readingSessionsRef,
      where('userId', '==', user.uid),
      orderBy('startTime', 'desc')
    );
    console.log('Query created:', q);

    const querySnapshot = await getDocs(q);
    console.log('Query snapshot size:', querySnapshot.size);
    
    const history = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('Document data:', {
        id: doc.id,
        ...data,
        startTime: data.startTime,
        endTime: data.endTime
      });
      history.push({ 
        id: doc.id, 
        ...data,
        startTime: data.startTime,
        endTime: data.endTime
      });
    });
    console.log('Full processed history:', history);

    quranHistoryStore.set(history);
    return history;
  } catch (error) {
    console.error('Error getting Quran history:', error);
    // Log the full error details
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
}

export async function addTestQuranReading() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('No user logged in for test reading');
      return;
    }
    console.log('Adding test reading for user:', user.uid);

    const readingSessionsRef = collection(db, 'readingSessions');
    console.log('Created collection reference');

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 15 * 60 * 1000); // 15 minutes later

    const data = {
      userId: user.uid,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: 15 * 60, // 15 minutes in seconds
      surahNumber: 1,
      surahName: 'Al-Fatiha'
    };
    console.log('Prepared test reading data:', data);

    try {
      const docRef = await addDoc(readingSessionsRef, data);
      console.log('Successfully added test reading with ID:', docRef.id);

      // Verify the data was saved by fetching it
      const savedData = await getQuranHistory();
      console.log('Updated Quran history after test:', savedData);
      
      if (savedData && savedData.length > 0) {
        console.log('Successfully verified saved data');
        return docRef.id;
      } else {
        console.log('Warning: Data was saved but not retrieved');
      }
    } catch (writeError) {
      console.error('Error writing to Firestore:', writeError);
      console.error('Write error details:', {
        code: writeError.code,
        message: writeError.message,
        stack: writeError.stack
      });
      throw writeError;
    }
  } catch (error) {
    console.error('Error in addTestQuranReading:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
} 