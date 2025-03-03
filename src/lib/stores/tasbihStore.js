import { writable } from 'svelte/store';
import { auth } from '../firebase';
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp,
  getDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { updateDhikrProgress, updateDhikrStreak } from '../services/badgeProgressService';

/** @type {import('svelte/store').Writable<{
  dailyCounts: Array<{day: string, date: number, count: number, isToday: boolean}>,
  streak: number,
  todayCompleted: number,
  totalDays: number
}>} */
export const weeklyStatsStore = writable({
  dailyCounts: [],
  streak: 0,
  todayCompleted: 0,
  totalDays: 1  // Initialize with 1 for the first day
});

// Helper function to check if we need to reset daily count
async function checkAndResetDailyCount(userId) {
  const lastResetKey = `last_dhikr_reset_${userId}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastReset = localStorage.getItem(lastResetKey);
  const lastResetDate = lastReset ? new Date(lastReset) : null;
  
  // If we haven't reset today, reset the count
  if (!lastResetDate || lastResetDate < today) {
    console.log('Resetting daily dhikr count');
    updateDhikrProgress(0);
    localStorage.setItem(lastResetKey, today.toISOString());
    return true; // Indicates we did a reset
  }
  return false; // Indicates no reset was needed
}

// Add this function after checkAndResetDailyCount
async function recalculateTodayCount(userId) {
  console.log('Recalculating today count to ensure accuracy');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const sessionsQuery = query(
    collection(db, 'tasbih_sessions'),
    where('userId', '==', userId),
  );

  const querySnapshot = await getDocs(sessionsQuery);
  const sessions = [];
  querySnapshot.forEach(doc => {
    sessions.push({ id: doc.id, ...doc.data() });
  });
  
  // Get all sessions for today
  const todaySessions = sessions.filter(session => {
    const sessionDate = session.timestamp.toDate();
    sessionDate.setHours(0, 0, 0, 0);
    return sessionDate.getTime() === today.getTime();
  });
  
  // Group sessions by timestamp to identify multi-dhikr sessions
  const sessionsByTimestamp = {};
  todaySessions.forEach(session => {
    const timestamp = session.timestamp.seconds;
    if (!sessionsByTimestamp[timestamp]) {
      sessionsByTimestamp[timestamp] = [];
    }
    sessionsByTimestamp[timestamp].push(session);
  });
  
  // Calculate the correct count
  let todayCount = 0;
  
  // For each group of sessions with the same timestamp
  Object.values(sessionsByTimestamp).forEach(sessionsGroup => {
    // Check if this is a multi-dhikr session
    const isMultiDhikrSession = sessionsGroup.some(s => s.isMultiDhikr === true);
    
    if (isMultiDhikrSession) {
      // This is a multi-dhikr session - only count the first dhikr
      // First try to find a session explicitly marked as the first dhikr
      const firstDhikr = sessionsGroup.find(s => s.isFirstDhikr === true);
      if (firstDhikr) {
        todayCount += firstDhikr.totalCount;
        console.log(`Found first dhikr in group: ${firstDhikr.dhikr.latin}, count=${firstDhikr.totalCount}`);
      } else {
        // If no session is explicitly marked as first, find one that's not marked as part of a multi-dhikr session
        const singleDhikr = sessionsGroup.find(s => !s.isMultiDhikr);
        if (singleDhikr) {
          todayCount += singleDhikr.totalCount;
          console.log(`Found single dhikr in group: ${singleDhikr.dhikr.latin}, count=${singleDhikr.totalCount}`);
        } else if (sessionsGroup.length > 0) {
          // Fallback: just use the first session in the group
          todayCount += sessionsGroup[0].totalCount;
          console.log(`Using fallback first dhikr in group: ${sessionsGroup[0].dhikr.latin}, count=${sessionsGroup[0].totalCount}`);
        }
      }
    } else if (sessionsGroup.length === 1) {
      // Single dhikr session
      todayCount += sessionsGroup[0].totalCount;
      console.log(`Single session: ${sessionsGroup[0].dhikr.latin}, count=${sessionsGroup[0].totalCount}`);
    } else {
      // Multiple sessions with same timestamp but not marked as multi-dhikr
      // This is likely an error case, but we'll handle it by just taking the first one
      todayCount += sessionsGroup[0].totalCount;
      console.log(`Warning: Multiple sessions with same timestamp but not marked as multi-dhikr. Using first: ${sessionsGroup[0].dhikr.latin}, count=${sessionsGroup[0].totalCount}`);
    }
  });
  
  console.log(`Recalculated today's count: ${todayCount}`);
  return todayCount;
}

export async function saveTasbihSession(sessionData) {
  const user = auth.currentUser;
  if (!user) return;

  // Only check for reset if it's not a manual entry
  if (!sessionData.isManualEntry) {
    // Check if we need to reset daily count
    const wasReset = await checkAndResetDailyCount(user.uid);
  }

  console.log(`DB Save: dhikr=${sessionData.dhikr.latin}, totalCount=${sessionData.totalCount}, sets=${sessionData.sets}, isMultiDhikr=${sessionData.isMultiDhikr}, isFirstDhikr=${sessionData.isFirstDhikr}`);

  // Save the individual session
  const sessionRef = doc(collection(db, 'tasbih_sessions'));
  await setDoc(sessionRef, {
    userId: user.uid,
    dhikr: sessionData.dhikr,
    count: sessionData.count,
    sets: sessionData.sets,
    totalCount: sessionData.totalCount,
    isManualEntry: sessionData.isManualEntry || false,
    isMultiDhikr: sessionData.isMultiDhikr || false,
    isFirstDhikr: sessionData.isFirstDhikr || false,
    timestamp: Timestamp.now()
  });

  // Only update the daily count if this is not part of a multi-dhikr session
  // or if it is the first dhikr in a multi-dhikr session
  if (!sessionData.isMultiDhikr || sessionData.isFirstDhikr) {
    console.log(`Processing first dhikr in session: ${sessionData.dhikr.latin}`);
    
    // Instead of adding to the previous count, just recalculate immediately
    // to ensure we have the correct count
    const recalculatedCount = await recalculateTodayCount(user.uid);
    console.log(`Immediately recalculated count: ${recalculatedCount}`);
    
    // Update badge progress with the recalculated count
    updateDhikrProgress(recalculatedCount);
    updateDhikrStreak(0); // We'll get the streak from getWeeklyStats
    
    // Get weekly stats to update the streak
    const stats = await getWeeklyStats();
    
    // Update store with the recalculated counts
    weeklyStatsStore.set({
      dailyCounts: stats.dailyCounts,
      streak: stats.streak,
      todayCompleted: stats.todayCompleted,
      totalDays: stats.totalDays
    });
  } else {
    console.log(`Skipping daily count update for non-first dhikr in multi-dhikr session: ${sessionData.dhikr.latin}`);
  }
}

export async function getWeeklyStats() {
  const user = auth.currentUser;
  if (!user) return null;

  // Initialize stats object with our new properties
  const stats = {
    dailyCounts: [],
    streak: 0,
    todayCompleted: 0,
    totalDays: 1
  };

  try {
    // Check if we need to reset daily count
    await checkAndResetDailyCount(user.uid);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6); // Go back 6 days to get last 7 days including today

    // Calculate total days since account creation, capped at 7 days for weekly view
    const userCreationTime = new Date(user.metadata.creationTime);
    userCreationTime.setHours(0, 0, 0, 0);
    const daysSinceCreation = Math.floor((today.getTime() - userCreationTime.getTime()) / (24 * 60 * 60 * 1000)) + 1; // +1 to include today
    stats.totalDays = Math.min(daysSinceCreation, 7); // Cap at 7 days for weekly view

    const sessionsQuery = query(
      collection(db, 'tasbih_sessions'),
      where('userId', '==', user.uid),
    );

    const querySnapshot = await getDocs(sessionsQuery);
    const sessions = [];
    querySnapshot.forEach(doc => {
      sessions.push({ id: doc.id, ...doc.data() });
    });

    // Get today's count using the recalculate function
    const todayCount = await recalculateTodayCount(user.uid);
    stats.todayCompleted = todayCount > 0 ? 1 : 0;

    // Process daily counts
    let daysWithDhikr = 0;
    stats.dailyCounts = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = date.getDate();
      
      // For today, use the recalculated count
      if (i === 0) {
        if (todayCount > 0) {
          daysWithDhikr++;
        }
        
        stats.dailyCounts.push({
          day: dayStr,
          date: dateStr,
          count: todayCount,
          isToday: true
        });
        
        continue;
      }
      
      // For other days, calculate as before
      const daySessionsAll = sessions.filter(session => {
        const sessionDate = session.timestamp.toDate();
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === date.getTime();
      });
      
      let dayCount = 0;
      const sessionsByTimestamp = {};
      
      daySessionsAll.forEach(session => {
        const timestamp = session.timestamp.seconds;
        if (!sessionsByTimestamp[timestamp]) {
          sessionsByTimestamp[timestamp] = [];
        }
        sessionsByTimestamp[timestamp].push(session);
      });
      
      Object.values(sessionsByTimestamp).forEach(sessionsGroup => {
        if (sessionsGroup.length > 1) {
          const firstDhikr = sessionsGroup.find(s => s.isFirstDhikr === true);
          if (firstDhikr) {
            dayCount += firstDhikr.totalCount;
          } else {
            const singleDhikr = sessionsGroup.find(s => !s.isMultiDhikr);
            if (singleDhikr) {
              dayCount += singleDhikr.totalCount;
            } else if (sessionsGroup.length > 0) {
              dayCount += sessionsGroup[0].totalCount;
            }
          }
        } else if (sessionsGroup.length === 1) {
          dayCount += sessionsGroup[0].totalCount;
        }
      });

      if (dayCount > 0) {
        daysWithDhikr++;
      }

      stats.dailyCounts.push({
        day: dayStr,
        date: dateStr,
        count: dayCount,
        isToday: false
      });
    }

    stats.streak = daysWithDhikr;
    
    // Update badge progress with today's count
    updateDhikrProgress(todayCount);
    updateDhikrStreak(daysWithDhikr);
    
    // Update the store
    weeklyStatsStore.set(stats);
    console.log('Updated weeklyStatsStore with new stats:', stats);

    return stats;
  } catch (error) {
    console.error('Error getting weekly stats:', error);
    weeklyStatsStore.set(stats);
    return stats;
  }
}

// Add this function to ensure the daily count is always accurate
export async function ensureAccurateDailyCount() {
  const user = auth.currentUser;
  if (!user) {
    console.log('Cannot ensure accurate daily count: No user logged in');
    return 0;
  }
  
  console.log('Ensuring accurate daily count');
  const recalculatedCount = await recalculateTodayCount(user.uid);
  console.log(`ensureAccurateDailyCount: Recalculated count is ${recalculatedCount}`);
  
  // Update badge progress with the recalculated count
  updateDhikrProgress(recalculatedCount);
  
  // Update the store with the recalculated count
  weeklyStatsStore.update(store => {
    if (!store || !store.dailyCounts) {
      console.log('weeklyStatsStore is not initialized yet');
      return store;
    }
    
    const updatedCounts = store.dailyCounts.map(day => 
      day.isToday ? { ...day, count: recalculatedCount } : day
    );
    
    console.log(`Updated weeklyStatsStore with recalculated count: ${recalculatedCount}`);
    return {
      ...store,
      dailyCounts: updatedCounts
    };
  });
  
  return recalculatedCount;
}

// Call this function when the app starts to ensure the count is accurate
export async function initializeTasbihStore() {
  const user = auth.currentUser;
  if (!user) return;
  
  // Get weekly stats to initialize the store
  await getWeeklyStats();
  
  // Ensure the daily count is accurate
  await ensureAccurateDailyCount();
} 