import { writable } from 'svelte/store';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { auth } from '../services/firebase';

export const moodHistoryStore = writable([]);

export async function saveMood(mood) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const moodData = {
      userId: user.uid,
      mood: mood.value,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString()
    };

    console.log('Saving mood data:', moodData);
    const docRef = await addDoc(collection(db, 'moods'), moodData);
    console.log('Mood saved with ID:', docRef.id);
    await getMoodHistory();
    return docRef;
  } catch (error) {
    console.error('Error saving mood:', error);
    throw error;
  }
}

export async function getMoodHistory(days = 30) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const moodsRef = collection(db, 'moods');
    const q = query(
      moodsRef,
      where('userId', '==', user.uid),
      where('timestamp', '>=', startDate.toISOString()),
      orderBy('timestamp', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const moods = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log('Retrieved moods from database:', moods);
    moodHistoryStore.set(moods);
    return moods;
  } catch (error) {
    console.error('Error getting mood history:', error);
    throw error;
  }
}

export async function getMoodForDate(date) {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    const moodsRef = collection(db, 'moods');
    const q = query(
      moodsRef,
      where('userId', '==', user.uid),
      where('date', '==', date),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;

    return {
      id: querySnapshot.docs[0].id,
      ...querySnapshot.docs[0].data()
    };
  } catch (error) {
    console.error('Error getting mood for date:', error);
    return null;
  }
} 