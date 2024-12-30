import { writable } from 'svelte/store';
import { auth } from '../firebase';
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { updateDhikrProgress, updateDhikrStreak } from '../services/badgeProgressService';

export const weeklyStatsStore = writable({
  dailyCounts: [],
  streak: 0
});

export async function saveTasbihSession(sessionData) {
  const user = auth.currentUser;
  if (!user) return;

  const sessionRef = doc(collection(db, 'tasbih_sessions'));
  await setDoc(sessionRef, {
    userId: user.uid,
    dhikr: sessionData.dhikr,
    count: sessionData.count,
    sets: sessionData.sets,
    totalCount: sessionData.totalCount,
    timestamp: Timestamp.now()
  });

  // Update weekly stats after saving
  const stats = await getWeeklyStats();
  
  // Get today's total count from the stats
  const todayCount = stats.dailyCounts.find(day => day.isToday)?.count || 0;
  
  // Update badge progress with today's total count
  updateDhikrProgress(todayCount);
  updateDhikrStreak(stats.currentStreak);

  // Update store
  weeklyStatsStore.set({
    dailyCounts: stats.dailyCounts,
    streak: stats.currentStreak
  });
}

export async function getWeeklyStats() {
  const user = auth.currentUser;
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 6); // Go back 6 days to get last 7 days including today

  const sessionsQuery = query(
    collection(db, 'tasbih_sessions'),
    where('userId', '==', user.uid),
    where('timestamp', '>=', Timestamp.fromDate(startDate))
  );

  const querySnapshot = await getDocs(sessionsQuery);
  const sessions = [];
  querySnapshot.forEach(doc => {
    sessions.push({ id: doc.id, ...doc.data() });
  });

  // Process daily counts
  const dailyCounts = [];
  for (let i = 6; i >= 0; i--) { // Count backwards from 6 to 0 to get last 7 days
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    date.setHours(0, 0, 0, 0); // Normalize to start of day
    const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = date.getDate();
    
    // Get all sessions for this day
    const dayCount = sessions
      .filter(session => {
        const sessionDate = session.timestamp.toDate();
        sessionDate.setHours(0, 0, 0, 0); // Normalize to start of day
        return sessionDate.getTime() === date.getTime();
      })
      .reduce((sum, session) => sum + session.totalCount, 0);

    dailyCounts.push({
      day: dayStr,
      date: dateStr,
      count: dayCount,
      isToday: i === 0
    });
  }

  const stats = calculateStreakStats(dailyCounts);
  return {
    dailyCounts,
    currentStreak: stats.currentStreak,
    totalDays: stats.totalDays
  };
}

function calculateStreakStats(dailyCounts) {
  // Calculate current streak up to today
  let currentStreak = 0;
  let daysWithDhikr = 0;
  let firstDhikrIndex = -1;

  // Find the first day with dhikr to establish start date
  for (let i = 0; i < dailyCounts.length; i++) {
    if (dailyCounts[i].count > 0) {
      if (firstDhikrIndex === -1) firstDhikrIndex = i;
      daysWithDhikr++;
    }
  }

  // For new users, only count days since their first dhikr
  let totalDays = firstDhikrIndex === -1 ? 0 : (dailyCounts.length - firstDhikrIndex);

  return {
    currentStreak: daysWithDhikr,
    totalDays
  };
} 