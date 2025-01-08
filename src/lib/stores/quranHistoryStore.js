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

    const quranRef = collection(db, 'quran_history');
    console.log('Collection reference created');

    const q = query(
      quranRef,
      where('userId', '==', user.uid),
      where('status', 'in', ['completed', 'partial']),
      orderBy('timestamp', 'desc')
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
        timestamp: data.timestamp?.toDate()
      });
      history.push({ 
        id: doc.id, 
        ...data,
        timestamp: data.timestamp?.toDate() || new Date()
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

export async function saveQuranReading(readingData) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const quranRef = collection(db, 'quran_history');
    const data = {
      userId: user.uid,
      timestamp: Timestamp.now(),
      status: readingData.status,
      versesRead: readingData.versesRead || 0,
      timeSpent: readingData.timeSpent || 0,
      surah: readingData.surah,
      fromVerse: readingData.fromVerse,
      toVerse: readingData.toVerse,
      notes: readingData.notes || ''
    };

    await addDoc(quranRef, data);
    await getQuranHistory();
  } catch (error) {
    console.error('Error saving Quran reading:', error);
    throw error;
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

    const quranRef = collection(db, 'quran_history');
    const data = {
      userId: user.uid,
      timestamp: Timestamp.now(),
      status: 'completed',
      versesRead: 10,
      timeSpent: 15,
      surah: 1,
      fromVerse: 1,
      toVerse: 10,
      notes: 'Test reading'
    };
    console.log('Test reading data:', data);

    const docRef = await addDoc(quranRef, data);
    console.log('Test reading added with ID:', docRef.id);

    // Verify the data was saved by fetching it
    const savedData = await getQuranHistory();
    console.log('Updated Quran history after test:', savedData);
  } catch (error) {
    console.error('Error adding test reading:', error);
    // Log the full error details
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
} 