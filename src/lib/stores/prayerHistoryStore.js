import { writable, get } from 'svelte/store';
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
import { prayerTimesStore } from './prayerTimes';

export const prayerHistoryStore = writable({
  pendingByDate: {},
  history: []
});

export async function savePrayerStatus(prayerData) {
  const user = auth.currentUser;
  if (!user) return;

  const prayerDate = new Date();
  const dateStr = prayerDate.toISOString().split('T')[0];

  const prayerRef = doc(collection(db, 'prayer_history'));
  await setDoc(prayerRef, {
    userId: user.uid,
    prayerName: prayerData.name,
    time: prayerData.time,
    status: prayerData.status,
    date: dateStr,
    timestamp: Timestamp.now()
  });

  await getPrayerHistory();
}

export async function getPrayerHistory() {
  const user = auth.currentUser;
  if (!user) return;

  const prayers = get(prayerTimesStore);
  if (!prayers || prayers.length === 0) {
    console.log('Waiting for prayer times to load...');
    return;
  }

  // Get the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const historyQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('timestamp', '>=', Timestamp.fromDate(sevenDaysAgo))
  );

  const querySnapshot = await getDocs(historyQuery);
  const history = [];
  querySnapshot.forEach(doc => {
    history.push({ id: doc.id, ...doc.data() });
  });

  console.log('Fetched history:', history);

  // Group pending prayers by date
  const pendingByDate = {};
  const today = new Date().toISOString().split('T')[0];
  
  // Only check today's prayers initially
  const prayersForToday = prayers.filter(prayer => {
    const isPrayed = history.some(h => 
      h.date === today && h.prayerName === prayer.name
    );
    return !isPrayed;
  });

  if (prayersForToday.length > 0) {
    pendingByDate[today] = {
      date: today,
      isToday: true,
      prayers: prayersForToday
    };
  }

  console.log('Pending prayers:', pendingByDate);

  prayerHistoryStore.set({ pendingByDate, history });
  return { pendingByDate, history };
} 