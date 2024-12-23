import { writable, get } from 'svelte/store';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

function createGoalStore() {
  const { subscribe, set, update } = writable({
    dailyPrayers: 5,
    dailyQuranReading: 30,
    dailyDhikr: 100
  });

  return {
    subscribe,
    
    loadGoals: async () => {
      if (!auth.currentUser) return;
      
      const docRef = doc(db, 'userGoals', auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({
          dailyPrayers: data.dailyPrayers ?? 5,
          dailyQuranReading: data.dailyQuranReading ?? 30,
          dailyDhikr: data.dailyDhikr ?? 100
        });
      }
    },
    
    updateGoal: async (goalType, value) => {
      if (!auth.currentUser) return;
      
      update(goals => ({
        ...goals,
        [goalType]: value
      }));
      
      const docRef = doc(db, 'userGoals', auth.currentUser.uid);
      await setDoc(docRef, get(goalStore), { merge: true });
    }
  };
}

export const goalStore = createGoalStore(); 