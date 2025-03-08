import { writable } from 'svelte/store';
import { auth, db } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { updateJournalProgress, updateJournalStreak } from '../services/badgeProgressService';

function createJournalStore() {
  const CACHE_KEY = 'journal_progress';
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
    totalEntries: 0,
    todayFreeWrite: null,
    todayDeenReflection: null
  });

  // Load cached progress if available
  try {
    const cachedProgress = localStorage.getItem(CACHE_KEY);
    if (cachedProgress) {
      const parsed = JSON.parse(cachedProgress);
      set(parsed);
    }
  } catch (error) {
    console.error('Error loading cached progress:', error);
  }

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
      } else {
        dailyProgress[index] = {
          morning: false,
          evening: false,
          date: dateStr
        };
      }
    });

    // Count completed days from the last 7 days only
    let totalCompletedDays = 0;
    dailyProgress.forEach(day => {
      if (day.morning && day.evening) {
        totalCompletedDays++;
      }
    });

    // Sort completed days to be consecutive in the progress display
    let sortedProgress = Array(7).fill(null).map(() => ({ 
      morning: false, 
      evening: false,
      date: null 
    }));

    // First, add all completed days in sequence
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

    // Calculate streak from consecutive days up to today
    streak = 0;
    for (let i = dailyProgress.length - 1; i >= 0; i--) {
      if (dailyProgress[i].morning && dailyProgress[i].evening) {
        streak++;
      } else {
        break;
      }
    }

    console.log('Days being tracked:', days);
    console.log('Final dailyProgress:', sortedProgress);
    console.log('Total completed days:', totalCompletedDays);
    console.log('Streak:', streak);

    // Update streak in store and badge progress
    update(store => {
      const todayStr = today.toISOString().split('T')[0];
      const todayReflections = reflectionsByDate.get(todayStr) || { morning: false, evening: false };
      
      const newStore = {
        ...store,
        streak: {
          ...store.streak,
          current: streak,
          morning: todayReflections.morning,
          evening: todayReflections.evening
        },
        completedDays: totalCompletedDays,
        dailyProgress: sortedProgress,
        totalEntries: snapshot.docs.length,
        todayMorningReflection: todayReflections.morning ? store.todayMorningReflection : null,
        todayEveningReflection: todayReflections.evening ? store.todayEveningReflection : null,
        todayFreeWrite: store.todayFreeWrite,
        todayDeenReflection: store.todayDeenReflection
      };

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(newStore));
      } catch (error) {
        console.error('Error caching progress:', error);
      }

      return newStore;
    });

    updateJournalStreak(Math.floor(streak));
  }

  return {
    subscribe,
    calculateProgress,
    
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

    async loadTodayReflections() {
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
          },
          todayFreeWrite: data.freeWrite?.content || null,
          todayDeenReflection: data.deenReflections || null
        }));
      } else {
        update(store => ({
          ...store,
          streak: { 
            current: 0,
            morning: false, 
            evening: false 
          },
          todayMorningReflection: null,
          todayEveningReflection: null,
          todayFreeWrite: null,
          todayDeenReflection: null
        }));
      }

      await calculateProgress();
    },

    async saveFreeWrite(content) {
      if (!auth.currentUser) return;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const docRef = doc(db, 'reflections', `${auth.currentUser.uid}_${today.toISOString().split('T')[0]}`);
      const existingDoc = await getDoc(docRef);

      try {
        if (existingDoc.exists()) {
          await setDoc(docRef, {
            ...existingDoc.data(),
            freeWrite: {
              content,
              timestamp: new Date()
            }
          }, { merge: true });
        } else {
          await setDoc(docRef, {
            userId: auth.currentUser.uid,
            date: today,
            freeWrite: {
              content,
              timestamp: new Date()
            }
          });
        }

        // Update the store
        update(state => ({
          ...state,
          todayFreeWrite: content
        }));
      } catch (error) {
        console.error('Error saving free write:', error);
        throw error;
      }
    },

    async saveDeenReflection(reflections) {
      if (!auth.currentUser) return;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const docRef = doc(db, 'reflections', `${auth.currentUser.uid}_${today.toISOString().split('T')[0]}`);
      const existingDoc = await getDoc(docRef);

      try {
        if (existingDoc.exists()) {
          // Update existing document
          await setDoc(docRef, {
            ...existingDoc.data(),
            deenReflections: {
              ...reflections,
              timestamp: new Date()
            }
          }, { merge: true });
        } else {
          // Create new document
          await setDoc(docRef, {
            userId: auth.currentUser.uid,
            date: today,
            deenReflections: {
              ...reflections,
              timestamp: new Date()
            }
          });
        }

        // Update the store
        update(state => ({
          ...state,
          todayDeenReflection: reflections
        }));

        await calculateProgress();
        return true;
      } catch (error) {
        console.error('Error saving deen reflections:', error);
        throw error;
      }
    },

    async getJournalHistory() {
      if (!auth.currentUser) return [];
      
      try {
        // Query all reflections for the current user, ordered by date descending
        const reflectionsQuery = query(
          collection(db, 'reflections'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('date', 'desc')
        );
        
        const querySnapshot = await getDocs(reflectionsQuery);
        
        // Transform the data into a more usable format
        const historyEntries = [];
        querySnapshot.forEach(doc => {
          const data = doc.data();
          
          // Extract the date string if it's a Firestore timestamp
          let dateValue = data.date;
          if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
            try {
              // Keep the original Firestore timestamp for proper display
              dateValue = data.date;
            } catch (error) {
              console.error('Error processing date:', error);
              dateValue = 'Invalid Date';
            }
          }
          
          historyEntries.push({
            id: doc.id,
            date: dateValue,
            morning: data.morning || null,
            evening: data.evening || null,
            freeWrite: data.freeWrite?.content || null,
            deenReflections: data.deenReflections || null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          });
        });
        
        console.log('Loaded journal history:', historyEntries.length, 'entries');
        return historyEntries;
      } catch (error) {
        console.error('Error loading journal history:', error);
        return [];
      }
    }
  };
}

export const journalStore = createJournalStore(); 