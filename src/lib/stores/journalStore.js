import { writable } from 'svelte/store';
import { auth, db } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { updateJournalProgress, updateJournalStreak } from '../services/badgeProgressService';

function createJournalStore() {
  const { subscribe, set, update } = writable({
    todayMorningReflection: null,
    todayEveningReflection: null,
    streak: {
      current: 0,
      morning: false,
      evening: false
    },
    completedDays: 0,
    dailyProgress: Array(7).fill(null).map(() => ({ morning: false, evening: false })),
    totalEntries: 0
  });

  async function calculateProgress() {
    if (!auth.currentUser) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const reflectionsQuery = query(
      collection(db, 'reflections'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(reflectionsQuery);
    let streak = 0;
    let completedDays = 0;
    let dailyProgress = Array(7).fill(null).map(() => ({ morning: false, evening: false }));

    // Sort reflections by date
    const reflectionsByDate = new Map();
    snapshot.docs.forEach(doc => {
      const reflection = doc.data();
      const date = new Date(reflection.date.toDate());
      date.setHours(0, 0, 0, 0);
      reflectionsByDate.set(date.getTime(), {
        morning: !!reflection.morning,
        evening: !!reflection.evening
      });
    });

    // Count completed days and update progress
    const dates = Array.from(reflectionsByDate.entries())
      .sort(([dateA], [dateB]) => dateB - dateA); // Sort by date descending

    dates.forEach(([timestamp, reflections]) => {
      if (reflections.morning && reflections.evening && completedDays < 7) {
        // Mark the next available day as completed
        dailyProgress[completedDays] = {
          morning: true,
          evening: true
        };
        completedDays++;

        // Calculate streak
        const date = new Date(timestamp);
        if (date.getTime() === today.getTime()) {
          streak += 1;
        } else {
          const prevDay = new Date(today);
          prevDay.setDate(prevDay.getDate() - 1);
          if (date.getTime() === prevDay.getTime()) {
            streak += 1;
          }
        }
      }
    });

    // Update streak in store and badge progress
    update(store => ({
      ...store,
      streak: {
        ...store.streak,
        current: streak
      },
      completedDays,
      dailyProgress
    }));
    
    updateJournalStreak(Math.floor(streak));
    return streak;
  }

  return {
    subscribe,
    
    saveMorningReflection: async (reflection) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const docRef = doc(db, 'reflections', `${auth.currentUser.uid}_${today.toISOString().split('T')[0]}`);
      const existingDoc = await getDoc(docRef);

      if (existingDoc.exists()) {
        await setDoc(docRef, {
          ...existingDoc.data(),
          morning: {
            ...reflection,
            timestamp: new Date()
          }
        }, { merge: true });
      } else {
        await setDoc(docRef, {
          userId: auth.currentUser.uid,
          date: today,
          morning: {
            ...reflection,
            timestamp: new Date()
          }
        });
      }

      update(store => ({
        ...store,
        todayMorningReflection: reflection,
        streak: {
          ...store.streak,
          morning: true
        }
      }));

      await calculateProgress();
    },

    saveEveningReflection: async (reflection) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const docRef = doc(db, 'reflections', `${auth.currentUser.uid}_${today.toISOString().split('T')[0]}`);
      const existingDoc = await getDoc(docRef);

      if (existingDoc.exists()) {
        await setDoc(docRef, {
          ...existingDoc.data(),
          evening: {
            ...reflection,
            timestamp: new Date()
          }
        }, { merge: true });
      } else {
        await setDoc(docRef, {
          userId: auth.currentUser.uid,
          date: today,
          evening: {
            ...reflection,
            timestamp: new Date()
          }
        });
      }

      update(store => ({
        ...store,
        todayEveningReflection: reflection,
        streak: {
          ...store.streak,
          evening: true
        }
      }));

      await calculateProgress();
    },

    loadTodayReflections: async () => {
      if (!auth.currentUser) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const docRef = doc(db, 'reflections', `${auth.currentUser.uid}_${today.toISOString().split('T')[0]}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        update(store => ({
          ...store,
          todayMorningReflection: data.morning || null,
          todayEveningReflection: data.evening || null,
          streak: {
            ...store.streak,
            morning: !!data.morning,
            evening: !!data.evening
          }
        }));
      }

      await calculateProgress();
    }
  };
}

export const journalStore = createJournalStore(); 