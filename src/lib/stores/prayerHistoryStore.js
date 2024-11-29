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

export async function updatePrayerStatuses() {
  const user = auth.currentUser;
  if (!user) return;

  // Get current date in local timezone
  const now = new Date();
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format in local timezone

  console.log('Current Date Check:', {
    now: now.toISOString(),
    nowLocal: now.toString(),
    today,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: Timestamp.now()
  });

  // Query all pending prayers
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
    
    console.log('Checking prayer:', {
      name: prayer.prayerName,
      date: prayer.date,
      status: prayer.status,
      currentDate: today,
      isPastDate: prayerDate.toISOString().split('T')[0] < today
    });

    // If prayer date is before today, mark as missed
    if (prayerDate.toISOString().split('T')[0] < today) {
      console.log('Marking as missed:', {
        name: prayer.prayerName,
        date: prayer.date,
        previousStatus: prayer.status
      });
      
      updatePromises.push(
        setDoc(doc.ref, {
          ...prayer,
          status: 'missed',
          timestamp: Timestamp.now()
        }, { merge: true }).then(() => {
          console.log('Successfully updated prayer status:', {
            name: prayer.prayerName,
            date: prayer.date,
            newStatus: 'missed',
            timestamp: new Date().toISOString()
          });
        }).catch(error => {
          console.error('Error updating prayer status:', {
            name: prayer.prayerName,
            date: prayer.date,
            error: error.message
          });
        })
      );
    }
  });

  await Promise.all(updatePromises);
  await getPrayerHistory();
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
  if (!user) return { history: [] };

  // Get Sunday of current week
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  sunday.setHours(0, 0, 0, 0);
  
  const historyQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('timestamp', '>=', Timestamp.fromDate(sunday))
  );

  const querySnapshot = await getDocs(historyQuery);
  const history = [];
  const pendingPrayers = [];
  
  querySnapshot.forEach(doc => {
    const data = doc.data();
    history.push({ id: doc.id, ...data });
    
    if (data.status === 'pending') {
      pendingPrayers.push({ id: doc.id, ...data });
    }
  });

  const pendingByDate = {};
  pendingPrayers.forEach(prayer => {
    if (!pendingByDate[prayer.date]) {
      pendingByDate[prayer.date] = {
        date: prayer.date,
        isToday: prayer.date === today.toISOString().split('T')[0],
        prayers: []
      };
    }
    pendingByDate[prayer.date].prayers.push(prayer);
  });

  prayerHistoryStore.set({ pendingByDate, history });
  return { pendingByDate, history };
} 