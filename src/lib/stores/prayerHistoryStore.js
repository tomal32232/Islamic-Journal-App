import { writable, get } from 'svelte/store';
import { auth } from '../firebase';
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  getDoc,
  Timestamp,
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { prayerTimesStore } from './prayerTimes';
import { updatePrayerProgress } from '../services/badgeProgressService';

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

  const today = new Date();
  const prayerTimes = await getPrayerTimes(today);
  if (!prayerTimes) return;

  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const todayStr = today.toLocaleDateString('en-CA');

  // Check if there's an active excused period
  const activeExcusedPeriod = await getActiveExcusedPeriod();
  console.log('Active excused period:', activeExcusedPeriod);

  // If no active period or invalid data, proceed with normal updates
  if (!activeExcusedPeriod?.startPrayer || !activeExcusedPeriod?.startDate) {
    console.log('No valid active excused period found');
    for (const prayer of prayers) {
      await updateNormalPrayerStatus(prayer, todayStr, prayerTimes);
    }
    return;
  }

  // Process prayers with active excused period
  for (const prayer of prayers) {
    const prayerTime = prayerTimes[prayer.toLowerCase()];
    if (!prayerTime) continue;

    const prayerDateTime = getPrayerDateTime(todayStr, prayerTime);
    const now = new Date();

    // Get existing status
    const existingStatus = await getPrayerStatus(prayer, todayStr);
    console.log(`Existing status for ${prayer}:`, existingStatus);

    // If prayer already has a final status (ontime, late), keep it
    if (existingStatus === 'ontime' || existingStatus === 'late') {
      console.log(`Keeping existing status for ${prayer}: ${existingStatus}`);
      continue;
    }

    const startPrayerIndex = prayers.indexOf(activeExcusedPeriod.startPrayer);
    const currentPrayerIndex = prayers.indexOf(prayer);
    
    // If today is the start date, only excuse prayers after the start prayer
    if (todayStr === activeExcusedPeriod.startDate) {
      if (currentPrayerIndex >= startPrayerIndex) {
        if (now > prayerDateTime) {
          // Only mark as excused if prayer time has passed
          console.log(`Marking ${prayer} as excused (start date, past prayer)`);
          await savePrayerStatus({
            name: prayer,
            date: todayStr,
            status: 'excused'
          });
        } else {
          // Keep upcoming status for future prayers
          console.log(`Keeping ${prayer} as upcoming (future prayer)`);
          await savePrayerStatus({
            name: prayer,
            date: todayStr,
            status: 'upcoming'
          });
        }
      } else if (now < prayerDateTime) {
        // Keep upcoming status for prayers before start prayer
        console.log(`Keeping ${prayer} as upcoming (before start prayer)`);
        await savePrayerStatus({
          name: prayer,
          date: todayStr,
          status: 'upcoming'
        });
      }
    } else {
      // For other days during the period, mark all past prayers as excused
      if (now > prayerDateTime) {
        console.log(`Marking ${prayer} as excused (during period, past prayer)`);
        await savePrayerStatus({
          name: prayer,
          date: todayStr,
          status: 'excused'
        });
      } else {
        console.log(`Keeping ${prayer} as upcoming (future prayer)`);
        await savePrayerStatus({
          name: prayer,
          date: todayStr,
          status: 'upcoming'
        });
      }
    }
  }
}

// Helper function for normal prayer status updates
async function updateNormalPrayerStatus(prayer, todayStr, prayerTimes) {
  const prayerTime = prayerTimes[prayer.toLowerCase()];
  if (!prayerTime) return;

  const prayerDateTime = getPrayerDateTime(todayStr, prayerTime);
  const now = new Date();
  const existingStatus = await getPrayerStatus(prayer, todayStr);

  if (now < prayerDateTime) {
    // Prayer time hasn't come yet
    await savePrayerStatus({
      name: prayer,
      date: todayStr,
      status: 'upcoming'
    });
  } else {
    // Prayer time has passed without being marked
    if (!existingStatus || existingStatus === 'upcoming') {
      await savePrayerStatus({
        name: prayer,
        date: todayStr,
        status: 'missed'
      });
    }
  }
}

export async function savePrayerStatus(prayerData) {
  const user = auth.currentUser;
  if (!user) return;

  if (!prayerData?.name) {
    console.error('Prayer name is undefined:', prayerData);
    return;
  }

  console.log('=== Saving Prayer Status ===');
  console.log('Prayer Data:', prayerData);
  
  const today = new Date().toLocaleDateString('en-CA');
  const prayerDate = prayerData.date || today;
  const prayerId = `${prayerDate}-${prayerData.name.toLowerCase()}`;
  
  console.log('Generated prayerId:', prayerId);
  console.log('Date:', prayerDate);

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
      console.log('Current store state:', currentStore);
      
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

      // Update badge progress after saving prayer status
      console.log('Updating badge progress');
      updatePrayerProgress();
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
        date: prayerDate,
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
    where('status', 'in', ['pending', 'missed', 'ontime', 'late', 'excused'])
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

// Update function to save excused period with prayer-specific timing
export async function saveExcusedPeriod(startDate, endDate, startPrayer, endPrayer) {
  console.log('=== Saving Excused Period ===');
  console.log('Start Date:', startDate);
  console.log('End Date:', endDate);
  console.log('Start Prayer:', startPrayer);
  console.log('End Prayer:', endPrayer);

  const user = auth.currentUser;
  if (!user) {
    console.log('No user logged in');
    return;
  }

  // Create a unique ID for the period using timestamp
  const periodId = `${user.uid}-${Date.now()}`;
  const excusedPeriodRef = doc(db, 'excused_periods', periodId);
  console.log('Saving to Firestore ref:', excusedPeriodRef.path);

  try {
    await setDoc(excusedPeriodRef, {
      userId: user.uid,
      startDate,
      endDate,
      startPrayer,
      endPrayer,
      status: 'ongoing', // Add status field
      timestamp: Timestamp.now()
    });
    console.log('Successfully saved excused period to Firestore');

    // If end date is provided, mark prayers as excused for the period
    if (endDate && endPrayer) {
      console.log('Marking prayers as excused for date range');
      const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      const start = new Date(startDate);
      const end = new Date(endDate);
      const startPrayerIndex = prayers.indexOf(startPrayer);
      const endPrayerIndex = prayers.indexOf(endPrayer);

      for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toLocaleDateString('en-CA');
        const isStartDate = dateStr === startDate;
        const isEndDate = dateStr === endDate;
        console.log('Processing date:', dateStr);

        for (let i = 0; i < prayers.length; i++) {
          // Skip prayers before startPrayer on start date
          if (isStartDate && i < startPrayerIndex) {
            console.log(`Skipping ${prayers[i]} on start date`);
            continue;
          }
          // Skip prayers after endPrayer on end date
          if (isEndDate && i > endPrayerIndex) {
            console.log(`Skipping ${prayers[i]} on end date`);
            continue;
          }

          // Check existing prayer status
          const existingStatus = await getPrayerStatus(prayers[i], dateStr);
          console.log(`Existing status for ${prayers[i]} on ${dateStr}:`, existingStatus);

          // Only mark as excused if it's not already marked as ontime or late
          if (existingStatus !== 'ontime' && existingStatus !== 'late') {
            console.log(`Marking ${prayers[i]} as excused for ${dateStr}`);
            await savePrayerStatus({
              name: prayers[i],
              date: dateStr,
              status: 'excused'
            });
          } else {
            console.log(`Keeping existing status (${existingStatus}) for ${prayers[i]} on ${dateStr}`);
          }
        }
      }
    } else {
      // If no end date, just mark prayers from start date and prayer
      console.log('Marking prayers as excused from start time (ongoing period)');
      const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      const startPrayerIndex = prayers.indexOf(startPrayer);
      const today = new Date().toLocaleDateString('en-CA');

      if (startDate === today) {
        console.log('Marking today\'s remaining prayers as excused');
        for (let i = startPrayerIndex; i < prayers.length; i++) {
          // Check existing prayer status
          const existingStatus = await getPrayerStatus(prayers[i], startDate);
          console.log(`Existing status for ${prayers[i]} on ${startDate}:`, existingStatus);

          // Only mark as excused if it's not already marked as ontime or late
          if (existingStatus !== 'ontime' && existingStatus !== 'late') {
            console.log(`Marking ${prayers[i]} as excused for ${startDate}`);
            await savePrayerStatus({
              name: prayers[i],
              date: startDate,
              status: 'excused'
            });
          } else {
            console.log(`Keeping existing status (${existingStatus}) for ${prayers[i]} on ${startDate}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error saving excused period:', error);
    throw error;
  }
}

// Add function to check if a date is within an excused period
export async function isDateExcused(date) {
  const user = auth.currentUser;
  if (!user) return false;

  const excusedPeriodsRef = collection(db, 'excused_periods');
  const q = query(
    excusedPeriodsRef,
    where('userId', '==', user.uid),
    where('startDate', '<=', date)
  );

  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return false;

  // Check each period
  for (const doc of querySnapshot.docs) {
    const period = doc.data();
    
    // If period has no end date, it's active and date is after start
    if (!period.endDate) return true;
    
    // If date is between start and end dates
    if (date >= period.startDate && date <= period.endDate) {
      return true;
    }
  }

  return false;
}

// Get active excused period
export async function getActiveExcusedPeriod() {
  const user = auth.currentUser;
  if (!user) return null;

  const excusedPeriodsRef = collection(db, 'excused_periods');
  const q = query(
    excusedPeriodsRef,
    where('userId', '==', user.uid),
    where('status', '==', 'ongoing')
  );

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      userId: data.userId,
      startDate: data.startDate,
      endDate: data.endDate || null,
      startPrayer: data.startPrayer,
      endPrayer: data.endPrayer || null,
      status: data.status,
      timestamp: data.timestamp
    };
  } catch (error) {
    console.error('Error getting active excused period:', error);
    return null;
  }
}

// End an active excused period
export async function endExcusedPeriod(periodId, endDate, endPrayer) {
  console.log('=== Ending Excused Period ===');
  console.log('Period ID:', periodId);
  console.log('End Date:', endDate);
  console.log('End Prayer:', endPrayer);

  const user = auth.currentUser;
  if (!user) {
    console.log('No user logged in');
    return;
  }

  const excusedPeriodRef = doc(db, 'excused_periods', periodId);
  console.log('Updating Firestore ref:', excusedPeriodRef.path);

  try {
    await setDoc(excusedPeriodRef, {
      endDate,
      endPrayer,
      status: 'completed', // Update status to completed
      timestamp: Timestamp.now()
    }, { merge: true });
    console.log('Successfully updated excused period in Firestore');

    // Mark prayers as excused up to the end time
    const docSnap = await getDoc(excusedPeriodRef);
    if (!docSnap.exists()) {
      console.error('Period document not found');
      return;
    }

    const period = docSnap.data();
    if (!period.startDate || !period.startPrayer) {
      console.error('Invalid period data:', period);
      return;
    }
    console.log('Retrieved period data:', period);

    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const start = new Date(period.startDate);
    const end = new Date(endDate);
    const startPrayerIndex = prayers.indexOf(period.startPrayer);
    const endPrayerIndex = prayers.indexOf(endPrayer);

    console.log('Marking prayers as excused from', start, 'to', end);

    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toLocaleDateString('en-CA');
      const isStartDate = dateStr === period.startDate;
      const isEndDate = dateStr === endDate;
      console.log('Processing date:', dateStr);

      for (let i = 0; i < prayers.length; i++) {
        // Skip prayers before startPrayer on start date
        if (isStartDate && i < startPrayerIndex) {
          console.log(`Skipping ${prayers[i]} on start date`);
          continue;
        }
        // Skip prayers after endPrayer on end date
        if (isEndDate && i > endPrayerIndex) {
          console.log(`Skipping ${prayers[i]} on end date`);
          continue;
        }

        console.log(`Marking ${prayers[i]} as excused for ${dateStr}`);
        await savePrayerStatus({
          name: prayers[i],
          date: dateStr,
          status: 'excused'
        });
      }
    }
  } catch (error) {
    console.error('Error ending excused period:', error);
    throw error;
  }
}

// Add function to check if a prayer should be marked as excused
export async function shouldMarkPrayerExcused(date, prayerName) {
  console.log('=== Checking if prayer should be excused ===');
  console.log('Date:', date);
  console.log('Prayer:', prayerName);

  const user = auth.currentUser;
  if (!user) {
    console.log('No user logged in');
    return false;
  }

  // Get prayer time for the given prayer
  const prayerTimes = await getPrayerTimes(new Date(date));
  if (!prayerTimes) {
    console.log('No prayer times available');
    return false;
  }

  const prayerTime = prayerTimes[prayerName.toLowerCase()];
  if (!prayerTime) {
    console.log('No time found for prayer:', prayerName);
    return false;
  }

  // Convert prayer time to Date object
  const prayerDateTime = getPrayerDateTime(date, prayerTime);
  const now = new Date();

  // If prayer time hasn't come yet, it shouldn't be excused
  if (prayerDateTime > now) {
    console.log('Prayer time has not come yet, should not be excused');
    return false;
  }

  // Query excused periods that might contain this date
  const excusedPeriodsRef = collection(db, 'excused_periods');
  const q = query(
    excusedPeriodsRef,
    where('userId', '==', user.uid),
    where('status', '==', 'ongoing')
  );

  try {
    const querySnapshot = await getDocs(q);
    console.log('Found excused periods:', querySnapshot.size);

    for (const doc of querySnapshot.docs) {
      const period = doc.data();
      console.log('Checking period:', period);

      // For ongoing periods
      if (period.status === 'ongoing') {
        const periodStart = new Date(period.startDate);
        const prayerDate = new Date(date);
        
        // Set both to midnight for date comparison
        periodStart.setHours(0, 0, 0, 0);
        prayerDate.setHours(0, 0, 0, 0);

        // If prayer date is after or equal to period start date
        if (prayerDate >= periodStart) {
          console.log('Prayer is within ongoing period');
          // If it's the start date, check if prayer is after start prayer
          if (period.startDate === date) {
            const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            const startPrayerIndex = prayers.indexOf(period.startPrayer);
            const currentPrayerIndex = prayers.indexOf(prayerName);
            return currentPrayerIndex >= startPrayerIndex;
          }
          return true;
        }
      }
      // For completed periods
      else if (period.status === 'completed') {
        const periodStart = new Date(period.startDate);
        const periodEnd = new Date(period.endDate);
        const prayerDate = new Date(date);
        
        // Set all to midnight for date comparison
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setHours(0, 0, 0, 0);
        prayerDate.setHours(0, 0, 0, 0);

        // Check if prayer date is within period range
        if (prayerDate >= periodStart && prayerDate <= periodEnd) {
          // If it's the start date, check if prayer is after start prayer
          if (period.startDate === date) {
            const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            const startPrayerIndex = prayers.indexOf(period.startPrayer);
            const currentPrayerIndex = prayers.indexOf(prayerName);
            return currentPrayerIndex >= startPrayerIndex;
          }
          // If it's the end date, check if prayer is before end prayer
          if (period.endDate === date) {
            const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            const endPrayerIndex = prayers.indexOf(period.endPrayer);
            const currentPrayerIndex = prayers.indexOf(prayerName);
            return currentPrayerIndex <= endPrayerIndex;
          }
          return true;
        }
      }
    }
    
    console.log('No matching excused period found');
    return false;
  } catch (error) {
    console.error('Error checking excused status:', error);
    return false;
  }
}

// Add this function to get all active excused periods
async function getActiveExcusedPeriods() {
  console.log('=== Getting Active Excused Periods ===');
  const user = auth.currentUser;
  if (!user) {
    console.log('No user logged in');
    return [];
  }

  const excusedPeriodsRef = collection(db, 'excused_periods');
  const q = query(
    excusedPeriodsRef,
    where('userId', '==', user.uid),
    orderBy('startDate', 'desc')
  );

  try {
    const querySnapshot = await getDocs(q);
    const periods = querySnapshot.docs
      .map(doc => {
        const data = doc.data();
        // Ensure the object has the required properties
        return {
          id: doc.id,
          userId: data.userId,
          startDate: data.startDate,
          endDate: data.endDate || null,
          startPrayer: data.startPrayer,
          endPrayer: data.endPrayer || null,
          timestamp: data.timestamp
        };
      })
      .filter(period => !period.endDate); // Only return active periods
    
    console.log('Found active periods:', periods);
    return periods;
  } catch (error) {
    console.error('Error getting active excused periods:', error);
    return [];
  }
}

// Add these helper functions
async function getPrayerTimes(date) {
  return get(prayerTimesStore);
}

async function getPrayerStatus(prayerName, date) {
  const user = auth.currentUser;
  if (!user) return null;

  const prayerId = `${date}-${prayerName.toLowerCase()}`;
  const prayerQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('prayerId', '==', prayerId)
  );

  const querySnapshot = await getDocs(prayerQuery);
  if (querySnapshot.empty) return null;

  return querySnapshot.docs[0].data().status;
} 