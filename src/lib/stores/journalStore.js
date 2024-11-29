import { writable } from 'svelte/store';
import { auth, db } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';

function createJournalStore() {
  const { subscribe, set, update } = writable({
    entries: []
  });

  return {
    subscribe,
    addEntry: async (entry) => {
      const docRef = await addDoc(collection(db, 'journal'), {
        ...entry,
        userId: auth.currentUser.uid,
        createdAt: new Date()
      });

      update(store => ({
        entries: [...store.entries, { ...entry, id: docRef.id }]
      }));
    }
  };
}

export const journalStore = createJournalStore(); 