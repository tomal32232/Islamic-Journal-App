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
    dailyProgress: Array(7).fill(null).map(() => ({ 
      morning: false, 
      evening: false,
      date: null 
    })),
    totalEntries: 0
  });

  async function calculateProgress() {
    if (!auth.currentUser) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('Calculating progress for today:', today.toISOString().split('T')[0]);
    
    const reflectionsQuery = query(
      collection(db, 'reflections'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(reflectionsQuery);
    let streak = 0;
    let completedDays = 0;
    let dailyProgress = Array(7).fill(null).map(() => ({ 
      morning: false, 
      evening: false,
      date: null 
    }));

    // Sort reflections by date
    const reflectionsByDate = new Map();
    snapshot.docs.forEach(doc => {
      const reflection = doc.data();
      const date = new Date(reflection.date.toDate());
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      console.log('Processing reflection for date:', dateStr, {
        morning: !!reflection.morning,
        evening: !!reflection.evening
      });
      reflectionsByDate.set(dateStr, {
        morning: !!reflection.morning,
        evening: !!reflection.evening,
        date: dateStr
      });
    });

    // Get the last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }

    // Fill in the progress for each day
    days.forEach((dateStr, index) => {
      const reflection = reflectionsByDate.get(dateStr);
      if (reflection) {
        dailyProgress[index] = {
          morning: reflection.morning,
          evening: reflection.evening,
          date: dateStr
        };
        // Only count as completed if both morning and evening are done
        if (reflection.morning && reflection.evening) {
          completedDays++;
          // Calculate streak only for consecutive days up to today
          if (index === days.length - 1 || // Today
              (index === days.length - 2 && completedDays > 0)) { // Yesterday if we have a streak
            streak += 1;
          }
        }
      } else {
        dailyProgress[index] = {
          morning: false,
          evening: false,
          date: dateStr
        };
      }
    });

    // Sort completed days to be consecutive in the progress display
    let sortedProgress = Array(7).fill(null).map(() => ({ 
      morning: false, 
      evening: false,
      date: null 
    }));

    // First, add completed days in sequence
    let progressIndex = 0;
    dailyProgress.forEach((day) => {
      if (day.morning && day.evening) {
        sortedProgress[progressIndex] = {
          morning: true,
          evening: true,
          date: day.date
        };
        progressIndex++;
      }
    });

    // Add today's progress if it's morning-only
    const todayProgress = dailyProgress[dailyProgress.length - 1];
    if (todayProgress.morning && !todayProgress.evening) {
      sortedProgress[progressIndex] = {
        morning: true,
        evening: false,
        date: todayProgress.date
      };
    }

    console.log('Days being tracked:', days);
    console.log('Final dailyProgress:', sortedProgress);
    console.log('Completed days:', completedDays);
    console.log('Streak:', streak);

    // Update streak in store and badge progress
    update(store => ({
      ...store,
      streak: {
        ...store.streak,
        current: streak,
        morning: !!reflectionsByDate.get(today.toISOString().split('T')[0])?.morning,
        evening: !!reflectionsByDate.get(today.toISOString().split('T')[0])?.evening
      },
      completedDays,
      dailyProgress: sortedProgress
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