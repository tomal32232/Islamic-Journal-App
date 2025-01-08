import { writable } from 'svelte/store';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export const quranHistoryStore = writable([]);

export async function getQuranHistory() {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const quranRef = collection(db, 'quran_history');
    const q = query(
      quranRef,
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const history = [];
    querySnapshot.forEach((doc) => {
      history.push({ id: doc.id, ...doc.data() });
    });

    quranHistoryStore.set(history);
  } catch (error) {
    console.error('Error getting Quran history:', error);
  }
} 