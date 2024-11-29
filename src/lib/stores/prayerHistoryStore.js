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

// Initialize today's prayers in Firestore
export async function initializeTodaysPrayers(prayers) {
  const user = auth.currentUser;
  if (!user) return;

  const today = new Date().toISOString().split('T')[0];
  const historyQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('date', '==', today)
  );

  // Check if prayers are already initialized for today
  const snapshot = await getDocs(historyQuery);
  if (!snapshot.empty) {
    console.log('Prayers already initialized for today');
    return;
  }
  
  // Initialize prayers with 'upcoming' status
  for (const prayer of prayers) {
    const prayerId = `${today}-${prayer.name.toLowerCase()}`;
    const prayerRef = doc(collection(db, 'prayer_history'));
    
    await setDoc(prayerRef, {
      userId: user.uid,
      prayerId,
      prayerName: prayer.name,
      time: prayer.time,
      status: 'upcoming',
      date: today,
      timestamp: Timestamp.now()
    });
  }

  await getPrayerHistory();
}

export async function initializeMonthlyPrayers(prayers) {
  const user = auth.currentUser;
  if (!user) return;

  // Get dates for next 30 days
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  // Check existing prayers
  const existingPrayers = new Set();
  for (const date of dates) {
    const historyQuery = query(
      collection(db, 'prayer_history'),
      where('userId', '==', user.uid),
      where('date', '==', date)
    );
    const snapshot = await getDocs(historyQuery);
    snapshot.forEach(doc => {
      existingPrayers.add(`${doc.data().date}-${doc.data().prayerName.toLowerCase()}`);
    });
  }

  // Initialize missing prayers
  const batch = [];
  for (const date of dates) {
    for (const prayer of prayers) {
      const prayerId = `${date}-${prayer.name.toLowerCase()}`;
      
      // Skip if prayer already exists
      if (existingPrayers.has(prayerId)) continue;

      const prayerRef = doc(collection(db, 'prayer_history'));
      batch.push(
        setDoc(prayerRef, {
          userId: user.uid,
          prayerId,
          prayerName: prayer.name,
          time: prayer.time,
          status: 'pending',
          date: date,
          timestamp: Timestamp.now()
        })
      );
    }
  }

  // Execute all updates
  await Promise.all(batch);
  await getPrayerHistory();
}

export async function updatePrayerStatuses() {
  const user = auth.currentUser;
  if (!user) return;

  const now = new Date();
  const today = new Date().toLocaleDateString('en-CA');

  // Only mark prayers as missed if they're from previous days
  const historyQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('status', '==', 'pending')
  );

  const querySnapshot = await getDocs(historyQuery);
  const updatePromises = [];
  
  querySnapshot.forEach((doc) => {
    const prayer = doc.data();
    const prayerDate = new Date(prayer.date);
    
    // Only mark as missed if it's from a previous day
    if (prayerDate.toLocaleDateString('en-CA') < today) {
      updatePromises.push(
        setDoc(doc.ref, {
          ...prayer,
          status: 'missed',
          timestamp: Timestamp.now()
        }, { merge: true })
      );
    }
  });

  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
    await getPrayerHistory();
  }
}

export async function savePrayerStatus(prayerData) {
  const user = auth.currentUser;
  if (!user) return;

  if (!prayerData?.name) {
    console.error('Prayer name is undefined:', prayerData);
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const prayerId = `${today}-${prayerData.name.toLowerCase()}`;

  // Query to find existing prayer document
  const prayerQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('prayerId', '==', prayerId)
  );

  const querySnapshot = await getDocs(prayerQuery);
  
  if (!querySnapshot.empty) {
    // Update existing prayer document
    const docRef = querySnapshot.docs[0].ref;
    await setDoc(docRef, {
      ...querySnapshot.docs[0].data(),
      status: prayerData.status,
      timestamp: Timestamp.now()
    }, { merge: true });
  } else {
    // If not found (shouldn't happen normally), create new
    const prayerRef = doc(collection(db, 'prayer_history'));
    await setDoc(prayerRef, {
      userId: user.uid,
      prayerId,
      prayerName: prayerData.name,
      time: prayerData.time,
      status: prayerData.status,
      date: today,
      timestamp: Timestamp.now()
    });
  }

  await getPrayerHistory();
}

export function convertPrayerTimeToDate(timeStr) {
  const [time, period] = timeStr.split(' ');
  const [hours, minutes] = time.split(':');
  const now = new Date();
  let hour = parseInt(hours);
  
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  
  now.setHours(hour, parseInt(minutes), 0, 0);
  return now;
}

export async function getPrayerHistory() {
  const user = auth.currentUser;
  if (!user) return { history: [], pendingByDate: {}, missedByDate: {} };

  const historyQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('status', 'in', ['pending', 'missed'])
  );

  const querySnapshot = await getDocs(historyQuery);
  const history = [];
  const pendingByDate = {};
  const missedByDate = {};

  querySnapshot.forEach(doc => {
    const prayer = doc.data();
    history.push(prayer);
    
    if (prayer.status === 'pending') {
      const prayerDateTime = getPrayerDateTime(prayer.date, prayer.time);
      if (prayerDateTime < new Date()) {
        if (!pendingByDate[prayer.date]) {
          pendingByDate[prayer.date] = {
            isToday: prayer.date === new Date().toLocaleDateString('en-CA'),
            prayers: []
          };
        }
        pendingByDate[prayer.date].prayers.push(prayer);
      }
    } else if (prayer.status === 'missed') {
      if (!missedByDate[prayer.date]) {
        missedByDate[prayer.date] = {
          prayers: []
        };
      }
      missedByDate[prayer.date].prayers.push(prayer);
    }
  });

  // Sort prayers within each date group
  Object.values(pendingByDate).forEach(dateGroup => {
    dateGroup.prayers.sort((a, b) => {
      const timeA = getPrayerDateTime(a.date, a.time);
      const timeB = getPrayerDateTime(b.date, b.time);
      return timeA - timeB;
    });
  });

  Object.values(missedByDate).forEach(dateGroup => {
    dateGroup.prayers.sort((a, b) => {
      const timeA = getPrayerDateTime(a.date, a.time);
      const timeB = getPrayerDateTime(b.date, b.time);
      return timeB - timeA; // Reverse chronological for missed prayers
    });
  });

  prayerHistoryStore.set({ history, pendingByDate, missedByDate });
  return { history, pendingByDate, missedByDate };
}

function getPrayerDateTime(date, time) {
  const [timeStr, period] = time.split(' ');
  const [hours, minutes] = timeStr.split(':');
  const prayerDate = new Date(date);
  
  let hour = parseInt(hours);
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  
  prayerDate.setHours(hour, parseInt(minutes), 0);
  return prayerDate;
} 