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
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay()); // Go back to last Sunday
  sunday.setHours(0, 0, 0, 0);

  const sessionsQuery = query(
    collection(db, 'tasbih_sessions'),
    where('userId', '==', user.uid),
    where('timestamp', '>=', Timestamp.fromDate(sunday))
  );

  const querySnapshot = await getDocs(sessionsQuery);
  const sessions = [];
  querySnapshot.forEach(doc => {
    sessions.push({ id: doc.id, ...doc.data() });
  });

  // Process daily counts
  const dailyCounts = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(sunday);
    date.setDate(date.getDate() + i);
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
      isToday: today.getDate() === date.getDate() &&
               today.getMonth() === date.getMonth()
    });
  }

  const stats = calculateStreakStats(dailyCounts);
  weeklyStatsStore.set(stats);
  return stats;
}

function calculateStreakStats(dailyCounts) {
  let currentStreak = 0;
  let totalDays = 0;

  // Count days up to today
  for (let i = 0; i < dailyCounts.length; i++) {
    if (dailyCounts[i].isToday) {
      totalDays = i + 1;
      break;
    }
  }

  // Calculate current streak
  for (let i = totalDays - 1; i >= 0; i--) {
    if (dailyCounts[i].count > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    currentStreak,
    totalDays,
    dailyCounts
  };
} 