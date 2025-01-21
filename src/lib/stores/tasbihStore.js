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

export const weeklyStatsStore = writable({
  dailyCounts: [],
  streak: 0
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

export async function saveTasbihSession(sessionData) {
  const user = auth.currentUser;
  if (!user) return;

  // Only check for reset if it's not a manual entry
  if (!sessionData.isManualEntry) {
    // Check if we need to reset daily count
    const wasReset = await checkAndResetDailyCount(user.uid);
  }

  // Save the individual session
  const sessionRef = doc(collection(db, 'tasbih_sessions'));
  await setDoc(sessionRef, {
    userId: user.uid,
    dhikr: sessionData.dhikr,
    count: sessionData.count,
    sets: sessionData.sets,
    totalCount: sessionData.totalCount,
    isManualEntry: sessionData.isManualEntry || false,
    timestamp: Timestamp.now()
  });

  // Get weekly stats first
  const stats = await getWeeklyStats();
  
  // Find today's count from stats and add the current session
  const todayStats = stats.dailyCounts.find(day => day.isToday);
  const previousCount = todayStats ? todayStats.count : 0;
  const newTotalCount = previousCount + sessionData.totalCount;

  // Update the dailyCounts with the new total
  const updatedDailyCounts = stats.dailyCounts.map(day => 
    day.isToday ? { ...day, count: newTotalCount } : day
  );

  // Update badge progress with the new total
  console.log('Updating daily dhikr progress with new total:', newTotalCount);
  updateDhikrProgress(newTotalCount);
  updateDhikrStreak(stats.currentStreak);

  // Update store with the new counts
  weeklyStatsStore.set({
    dailyCounts: updatedDailyCounts,
    streak: stats.currentStreak
  });
}

export async function getWeeklyStats() {
  const user = auth.currentUser;
  if (!user) return null;

  // Check if we need to reset daily count
  await checkAndResetDailyCount(user.uid);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 6); // Go back 6 days to get last 7 days including today

  const sessionsQuery = query(
    collection(db, 'tasbih_sessions'),
    where('userId', '==', user.uid),
  );

  const querySnapshot = await getDocs(sessionsQuery);
  const sessions = [];
  querySnapshot.forEach(doc => {
    sessions.push({ id: doc.id, ...doc.data() });
  });

  // Process daily counts
  const dailyCounts = [];
  let daysWithDhikr = 0;
  let todayCount = 0;

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = date.getDate();
    
    // Get all sessions for this day
    const dayCount = sessions
      .filter(session => {
        const sessionDate = session.timestamp.toDate();
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === date.getTime();
      })
      .reduce((sum, session) => sum + session.totalCount, 0);

    if (dayCount > 0) {
      daysWithDhikr++;
    }

    // Store today's count
    if (i === 0) {
      todayCount = dayCount;
    }

    dailyCounts.push({
      day: dayStr,
      date: dateStr,
      count: dayCount,
      isToday: i === 0
    });
  }

  // Update badge progress with today's count
  updateDhikrProgress(todayCount);

  return {
    dailyCounts,
    currentStreak: daysWithDhikr,
    totalDays: 7 // Always 7 days for weekly view
  };
} 