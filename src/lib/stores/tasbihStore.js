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
  await getWeeklyStats();
}

export async function getWeeklyStats() {
  const user = auth.currentUser;
  if (!user) return;

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 6); // Go back 6 days to get last 7 days including today
  startDate.setHours(0, 0, 0, 0);

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
    const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = date.getDate();
    
    const dayCount = sessions
      .filter(session => {
        const sessionDate = session.timestamp.toDate();
        return sessionDate.getDate() === date.getDate() &&
               sessionDate.getMonth() === date.getMonth();
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
  weeklyStatsStore.set(stats);
  return stats;
}

function calculateStreakStats(dailyCounts) {
  // Calculate current streak up to today
  let currentStreak = 0;
  let totalDays = 7; // We always want to show 7 days
  let daysWithDhikr = 0;

  // Count days with dhikr in the last 7 days
  for (let i = 0; i < dailyCounts.length; i++) {
    if (dailyCounts[i].count > 0) {
      daysWithDhikr++;
    }
  }

  return {
    currentStreak: daysWithDhikr,
    totalDays,
    dailyCounts
  };
} 