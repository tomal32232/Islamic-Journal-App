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
  missedByDate: {},
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
  console.log('=== Checking Past Prayers ===');
  console.log('Current Date:', now);
  console.log('Today in en-CA format:', today);

  const historyQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('status', 'in', ['pending', 'upcoming'])
  );

  const querySnapshot = await getDocs(historyQuery);
  const updatePromises = [];
  
  console.log('\nFound prayers to check:', querySnapshot.size);
  
  querySnapshot.forEach((doc) => {
    const prayer = doc.data();
    const prayerDate = new Date(prayer.date);
    const prayerDateStr = prayerDate.toLocaleDateString('en-CA');
    
    console.log('\nPrayer Details:');
    console.log('- Name:', prayer.prayerName);
    console.log('- Date:', prayerDateStr);
    console.log('- Time:', prayer.time);
    console.log('- Status:', prayer.status);
    console.log('Is before today?', prayerDateStr < today);

    if (prayerDateStr < today) {
      console.log('→ Marking as missed:', prayer.prayerName);
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

  console.log('Saving prayer status:', prayerData);
  const today = new Date().toISOString().split('T')[0];
  const prayerId = `${today}-${prayerData.name.toLowerCase()}`;
  console.log('Generated prayerId:', prayerId);

  // Query to find existing prayer document
  const prayerQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('prayerId', '==', prayerId)
  );

  const querySnapshot = await getDocs(prayerQuery);
  console.log('Found existing prayer:', !querySnapshot.empty);
  
  try {
    if (!querySnapshot.empty) {
      // Update existing prayer document
      const docRef = querySnapshot.docs[0].ref;
      const updateData = {
        ...querySnapshot.docs[0].data(),
        status: prayerData.status,
        timestamp: Timestamp.now()
      };
      console.log('Updating prayer with data:', updateData);
      await setDoc(docRef, updateData, { merge: true });
      
      // Immediately update the store to reflect changes
      const currentStore = get(prayerHistoryStore);
      const updatedPendingByDate = { ...currentStore.pendingByDate };
      
      // Remove the prayer from pending if it exists
      Object.keys(updatedPendingByDate).forEach(date => {
        updatedPendingByDate[date].prayers = updatedPendingByDate[date].prayers.filter(
          p => p.prayerId !== prayerId
        );
        // Remove the date entry if no prayers left
        if (updatedPendingByDate[date].prayers.length === 0) {
          delete updatedPendingByDate[date];
        }
      });
      
      prayerHistoryStore.set({
        ...currentStore,
        pendingByDate: updatedPendingByDate
      });
    } else {
      // If not found (shouldn't happen normally), create new
      console.log('Creating new prayer record');
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

    console.log('Prayer status saved, updating history');
    await getPrayerHistory();
  } catch (error) {
    console.error('Error saving prayer status:', error);
    throw error;
  }
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

  await updatePrayerStatuses();

  const today = new Date().toLocaleDateString('en-CA');
  const historyQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('status', 'in', ['pending', 'missed', 'ontime', 'late'])
  );

  const querySnapshot = await getDocs(historyQuery);
  const history = [];
  const pendingByDate = {};
  const missedByDate = {};

  querySnapshot.forEach(doc => {
    const prayer = doc.data();
    history.push(prayer);
    
    const prayerDateTime = getPrayerDateTime(prayer.date, prayer.time);
    const now = new Date();

    // Only add to pending if status is 'pending' and prayer time has passed
    if (prayer.status === 'pending' && prayerDateTime < now) {
      const date = prayer.date;
      if (!pendingByDate[date]) {
        pendingByDate[date] = {
          isToday: date === today,
          prayers: []
        };
      }
      pendingByDate[date].prayers.push(prayer);
    }

    // Add to missed if status is 'missed'
    if (prayer.status === 'missed') {
      const date = prayer.date;
      if (!missedByDate[date]) {
        missedByDate[date] = {
          prayers: []
        };
      }
      missedByDate[date].prayers.push(prayer);
    }
  });

  // Sort prayers within each date
  Object.values(pendingByDate).forEach(dateGroup => {
    dateGroup.prayers.sort((a, b) => {
      const timeA = getPrayerDateTime(a.date, a.time);
      const timeB = getPrayerDateTime(b.date, b.time);
      return timeA.getTime() - timeB.getTime();
    });
  });

  Object.values(missedByDate).forEach(dateGroup => {
    dateGroup.prayers.sort((a, b) => {
      const timeA = getPrayerDateTime(a.date, a.time);
      const timeB = getPrayerDateTime(b.date, b.time);
      return timeB.getTime() - timeA.getTime(); // Reverse chronological for missed prayers
    });
  });

  console.log('Updated prayer history:', { history, pendingByDate, missedByDate });
  prayerHistoryStore.set({ history, pendingByDate, missedByDate });
  return { history, pendingByDate, missedByDate };
}

export function getPrayerDateTime(date, time) {
  const [timeStr, period] = time.split(' ');
  const [hours, minutes] = timeStr.split(':');
  const prayerDate = new Date(date);
  
  let hour = parseInt(hours);
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  
  prayerDate.setHours(hour, parseInt(minutes), 0);
  return prayerDate;
} 