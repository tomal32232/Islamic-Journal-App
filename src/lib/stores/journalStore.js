import { writable } from 'svelte/store';
import { auth, db } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { updateJournalProgress, updateJournalStreak } from '../services/badgeProgressService';

function createJournalStore() {
  const { subscribe, set, update } = writable({
    entries: [],
    streak: 0,
    totalEntries: 0
  });

  return {
    subscribe,
    addEntry: async (entry) => {
      const docRef = await addDoc(collection(db, 'journal'), {
        ...entry,
        userId: auth.currentUser.uid,
        createdAt: new Date()
      });

      update(store => {
        const newEntries = [...store.entries, { ...entry, id: docRef.id }];
        const newTotal = newEntries.length;
        
        // Update badge progress
        updateJournalProgress(newTotal);
        
        return {
          ...store,
          entries: newEntries,
          totalEntries: newTotal
        };
      });

      // Calculate and update streak
      await calculateStreak();
    },

    loadEntries: async () => {
      if (!auth.currentUser) return;

      const entriesQuery = query(
        collection(db, 'journal'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(entriesQuery);
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      update(store => ({
        ...store,
        entries,
        totalEntries: entries.length
      }));

      // Update badge progress with total entries
      updateJournalProgress(entries.length);

      // Calculate and update streak
      await calculateStreak();
    }
  };
}

async function calculateStreak() {
  if (!auth.currentUser) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const entriesQuery = query(
    collection(db, 'journal'),
    where('userId', '==', auth.currentUser.uid),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(entriesQuery);
  let streak = 0;
  let currentDate = today;

  // Sort entries by date
  const entriesByDate = new Map();
  snapshot.docs.forEach(doc => {
    const entry = doc.data();
    const date = new Date(entry.createdAt.toDate());
    date.setHours(0, 0, 0, 0);
    entriesByDate.set(date.getTime(), true);
  });

  // Calculate streak
  while (entriesByDate.has(currentDate.getTime())) {
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  // Update streak in store and badge progress
  journalStore.update(store => ({ ...store, streak }));
  updateJournalStreak(streak);

  return streak;
}

export const journalStore = createJournalStore(); 