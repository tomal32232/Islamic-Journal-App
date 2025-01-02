import { writable, get } from 'svelte/store';
import { auth, db } from '../firebase';
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
import { prayerTimesStore } from './prayerTimes';
import { updatePrayerProgress } from '../services/badgeProgressService';
import { onMount } from 'svelte';
import { getCurrentLocation } from '../services/prayerTimes';

// Cache stores
const locationCache = {
  coords: null,
  timestamp: null
};

const prayerTimesCache = {
  data: {},  // Store prayer times by date
  timestamp: null
};

// Cache expiry time (12 hours)
const CACHE_EXPIRY = 12 * 60 * 60 * 1000;

// Get cached location or fetch new one
async function getLocation() {
  const now = Date.now();
  
  // Use cached location if available and not expired
  if (locationCache.coords && locationCache.timestamp && 
      now - locationCache.timestamp < CACHE_EXPIRY) {
    console.log('Using cached location');
    return locationCache.coords;
  }

  // Fetch new location
  console.log('Fetching new location');
  const coords = await getCurrentLocation();
  if (coords) {
    locationCache.coords = coords;
    locationCache.timestamp = now;
  }
  return coords;
}

export const prayerHistoryStore = writable({
  pendingByDate: {},
  missedByDate: {},
  history: []
});

// Add this function to ensure prayers are initialized
export async function ensurePrayerData() {
  const user = auth.currentUser;
  if (!user) return;

  // Get the last check timestamp from localStorage
  const lastCheck = localStorage.getItem('lastPrayerDataCheck');
  const today = new Date().toLocaleDateString('en-CA');
  
  // If we haven't checked today, initialize prayers
  if (lastCheck !== today) {
    console.log('Initializing prayer data for the next 7 days');
    const prayers = [
      { name: 'Fajr', time: '', icon: 'SunDim', weight: 'regular' },
      { name: 'Dhuhr', time: '', icon: 'Sun', weight: 'fill' },
      { name: 'Asr', time: '', icon: 'CloudSun', weight: 'regular' },
      { name: 'Maghrib', time: '', icon: 'SunHorizon', weight: 'regular' },
      { name: 'Isha', time: '', icon: 'MoonStars', weight: 'regular' }
    ];

    // Get current prayer times
    const prayerTimes = get(prayerTimesStore);
    if (prayerTimes && prayerTimes.length > 0) {
      prayers.forEach((prayer, index) => {
        prayer.time = prayerTimes[index]?.time || '';
      });
    }

    await initializeTodaysPrayers(prayers);
    localStorage.setItem('lastPrayerDataCheck', today);
  }
}

// Initialize today's prayers in Firestore
export async function initializeTodaysPrayers(prayers) {
  const user = auth.currentUser;
  if (!user) return;

  const today = new Date().toLocaleDateString('en-CA');
  
  // Initialize next 7 days of prayers
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    dates.push(date.toLocaleDateString('en-CA'));
  }

  console.log('Initializing prayers for dates:', dates);

  // Check existing prayers for these dates
  const existingPrayers = new Set();
  const batch = [];

  // Query all existing prayers for these dates at once
  const historyQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('date', 'in', dates)
  );

  const snapshot = await getDocs(historyQuery);
  snapshot.forEach(doc => {
    existingPrayers.add(`${doc.data().date}-${doc.data().prayerName.toLowerCase()}`);
  });

  const now = new Date();

  // Initialize prayers for each date
  for (const date of dates) {
    for (const prayer of prayers) {
      const prayerId = `${date}-${prayer.name.toLowerCase()}`;
      
      // Skip if prayer already exists
      if (existingPrayers.has(prayerId)) {
        console.log(`Prayer already exists: ${prayerId}`);
        continue;
      }

      const prayerRef = doc(collection(db, 'prayer_history'));
      const prayerDateTime = getPrayerDateTime(date, prayer.time);
      
      // For today's prayers, set status based on current time
      // For future days, set as upcoming
      const status = date === today && prayerDateTime < now ? 'pending' : 'upcoming';
      
      console.log(`Creating new prayer: ${prayerId} with status: ${status}`);
      batch.push(
        setDoc(prayerRef, {
          userId: user.uid,
          prayerId,
          prayerName: prayer.name,
          time: prayer.time,
          status,
          date,
          timestamp: Timestamp.now()
        })
      );
    }
  }

  // Execute all updates
  if (batch.length > 0) {
    console.log(`Executing batch update for ${batch.length} prayers`);
    await Promise.all(batch);
    await getPrayerHistory();
  } else {
    console.log('No new prayers to initialize');
  }
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
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toLocaleDateString('en-CA');
  
  const prayerTimes = await getPrayerTimes(today);
  if (!prayerTimes) return;

  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  // Check all past prayers first (any date before today)
  const pastPrayersQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('status', 'in', ['pending', 'upcoming'])
  );

  const pastPrayersSnapshot = await getDocs(pastPrayersQuery);
  const batch = [];

  // Mark all pending/upcoming prayers from past dates as missed
  pastPrayersSnapshot.forEach((doc) => {
    const prayer = doc.data();
    const prayerDate = new Date(prayer.date);
    prayerDate.setHours(0, 0, 0, 0);

    if (prayerDate < today) {
      console.log(`Marking past prayer as missed: ${prayer.prayerName} on ${prayer.date}`);
      batch.push(
        setDoc(doc.ref, {
          ...prayer,
          status: 'missed',
          timestamp: Timestamp.now()
        }, { merge: true })
      );
    }
  });

  if (batch.length > 0) {
    console.log(`Marking ${batch.length} past prayers as missed`);
    await Promise.all(batch);
    await getPrayerHistory(); // Refresh the store
  }

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

  // Process today's prayers with active excused period
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
        if (now > prayerDateTime && ['pending', 'upcoming'].includes(existingStatus)) {
          // Automatically mark as excused if prayer time has passed and status is pending or upcoming
          console.log(`Automatically marking ${prayer} as excused (start date, past prayer)`);
          await savePrayerStatus({
            name: prayer,
            date: todayStr,
            time: prayerTime,
            status: 'excused'
          });
        } else if (now < prayerDateTime) {
          // Keep upcoming status for future prayers
          console.log(`Keeping ${prayer} as upcoming (future prayer)`);
          await savePrayerStatus({
            name: prayer,
            date: todayStr,
            time: prayerTime,
            status: 'upcoming'
          });
        }
      } else {
        // For prayers before start prayer, use normal status update
        await updateNormalPrayerStatus(prayer, todayStr, prayerTimes);
      }
    } else {
      // For other days during the period, mark all past prayers as excused
      if (now > prayerDateTime && ['pending', 'upcoming'].includes(existingStatus)) {
        console.log(`Automatically marking ${prayer} as excused (during period, past prayer)`);
        await savePrayerStatus({
          name: prayer,
          date: todayStr,
          time: prayerTime,
          status: 'excused'
        });
      } else if (now < prayerDateTime) {
        console.log(`Keeping ${prayer} as upcoming (future prayer)`);
        await savePrayerStatus({
          name: prayer,
          date: todayStr,
          time: prayerTime,
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
        status: 'pending'
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

  try {
    const prayerId = `${prayerData.date}-${prayerData.name.toLowerCase()}`;
    
    // Query to find the existing prayer document
    const prayerQuery = query(
      collection(db, 'prayer_history'),
      where('userId', '==', user.uid),
      where('prayerId', '==', prayerId)
    );

    const querySnapshot = await getDocs(prayerQuery);
    let prayerRef;

    if (!querySnapshot.empty) {
      // Update existing document
      prayerRef = querySnapshot.docs[0].ref;
      console.log('Updating existing prayer document:', prayerId);
    } else {
      // Create new document only if it doesn't exist
      prayerRef = doc(collection(db, 'prayer_history'));
      console.log('Creating new prayer document:', prayerId);
    }

    // Save to Firestore
    await setDoc(prayerRef, {
      userId: user.uid,
      prayerId,
      prayerName: prayerData.name,
      time: prayerData.time || '',
      status: prayerData.status,
      date: prayerData.date,
      timestamp: Timestamp.now()
    }, { merge: true });

    // Update local store
    const store = get(prayerHistoryStore);
    
    // Update history
    const historyIndex = store.history.findIndex(
      p => p.date === prayerData.date && p.prayerName === prayerData.name
    );
    
    if (historyIndex >= 0) {
      store.history[historyIndex] = {
        ...store.history[historyIndex],
        ...prayerData
      };
    } else {
      store.history.push(prayerData);
    }

    // Remove from pendingByDate if status is final
    if (['ontime', 'late', 'missed', 'excused'].includes(prayerData.status)) {
      if (store.pendingByDate[prayerData.date]) {
        store.pendingByDate[prayerData.date].prayers = 
          store.pendingByDate[prayerData.date].prayers.filter(
            p => p.prayerName !== prayerData.name
          );
        
        // Remove the date if no prayers left
        if (store.pendingByDate[prayerData.date].prayers.length === 0) {
          delete store.pendingByDate[prayerData.date];
        }
      }
    }

    prayerHistoryStore.set(store);
    
    // Update badges if needed
    await updatePrayerProgress();
    
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

  console.log('=== Getting Prayer History ===');
  console.log('User ID:', user.uid);

  // Update prayer statuses first
  await updatePrayerStatuses();

  const today = new Date().toLocaleDateString('en-CA');
  console.log('Today:', today);

  const historyQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('status', 'in', ['pending', 'missed', 'ontime', 'late', 'excused', 'upcoming'])
  );

  const querySnapshot = await getDocs(historyQuery);
  console.log('Total prayer records found:', querySnapshot.size);

  // Get unique dates from the prayer history
  const uniqueDates = new Set();
  querySnapshot.forEach(doc => {
    const prayer = doc.data();
    uniqueDates.add(prayer.date);
  });
  console.log('Unique dates found:', Array.from(uniqueDates));

  // Fetch prayer times for all unique dates
  const prayerTimesByDate = {};
  for (const date of uniqueDates) {
    const [year, month, day] = date.split('-').map(Number);
    const prayerTimes = await getPrayerTimes(new Date(year, month - 1, day));
    if (prayerTimes) {
      prayerTimesByDate[date] = prayerTimes;
      console.log(`Got prayer times for ${date}:`, prayerTimes);
    }
  }

  const history = [];
  const pendingByDate = {};
  const missedByDate = {};

  // Get active excused period first
  const activeExcusedPeriod = await getActiveExcusedPeriod();
  console.log('Active excused period:', activeExcusedPeriod);

  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  querySnapshot.forEach(doc => {
    const prayer = doc.data();
    history.push(prayer);
    
    console.log(`\nProcessing prayer: ${prayer.prayerName} for date ${prayer.date}`);
    console.log('Prayer details:', {
      id: doc.id,
      ...prayer
    });
    
    let prayerDateTime = prayer.time ? getPrayerDateTime(prayer.date, prayer.time) : null;
    if (!prayerDateTime && prayerTimesByDate[prayer.date]) {
      // If we don't have the prayer time in the record, get it from prayer times
      const prayerTime = prayerTimesByDate[prayer.date][prayer.prayerName.toLowerCase()];
      if (prayerTime) {
        prayer.time = prayerTime;
        console.log(`Using prayer time from service for ${prayer.prayerName}: ${prayerTime}`);
        prayerDateTime = getPrayerDateTime(prayer.date, prayerTime);
      }
    }
    
    if (!prayerDateTime) {
      console.error(`No prayer time available for ${prayer.prayerName} on ${prayer.date}`);
      return;
    }

    const now = new Date();

    console.log(`\nChecking prayer ${prayer.prayerName} for pending status:`, {
      status: prayer.status,
      prayerTime: prayerDateTime.toLocaleString(),
      currentTime: now.toLocaleString(),
      hasPassed: prayerDateTime < now
    });

    // Skip if prayer is already marked as ontime, late, or excused
    if (['ontime', 'late', 'excused'].includes(prayer.status)) {
      console.log(`Prayer ${prayer.prayerName} is already marked as ${prayer.status}, skipping`);
      return;
    }

    // Add to pending if:
    // 1. Status is 'pending' OR
    // 2. Status is 'upcoming' and prayer time has passed
    if ((prayer.status === 'pending' || prayer.status === 'upcoming') && 
        prayerDateTime < now) {
      // Check if this prayer should be excused
      const shouldExcuse = activeExcusedPeriod && 
        prayer.date >= activeExcusedPeriod.startDate &&
        (prayer.date !== activeExcusedPeriod.startDate || 
         prayers.indexOf(prayer.prayerName) >= prayers.indexOf(activeExcusedPeriod.startPrayer));

      console.log('Should excuse prayer:', shouldExcuse);

      if (!shouldExcuse) {
        const date = prayer.date;
        if (!pendingByDate[date]) {
          pendingByDate[date] = {
            isToday: date === today,
            prayers: []
          };
        }
        
        // Add prayer to pending if not already there
        if (!pendingByDate[date].prayers.some(p => p.prayerId === prayer.prayerId)) {
          pendingByDate[date].prayers.push({
            ...prayer,
            prayerId: prayer.prayerId || `${prayer.date}-${prayer.prayerName.toLowerCase()}`
          });
          console.log('Added to pending prayers');
        }
      } else {
        console.log('Prayer will be marked as excused');
        // If prayer should be excused, update its status
        savePrayerStatus({
          name: prayer.prayerName,
          date: prayer.date,
          time: prayer.time,
          status: 'excused'
        });
      }
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
      console.log('Added to missed prayers');
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

  console.log('\n=== Prayer History Summary ===');
  console.log('Total prayers:', history.length);
  console.log('Pending prayers by date:', pendingByDate);
  console.log('Missed prayers by date:', missedByDate);
  console.log('Full history:', history);

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
  try {
    const dateStr = date.toLocaleDateString('en-CA');
    const now = Date.now();

    // Use cached prayer times if available and not expired
    if (prayerTimesCache.data[dateStr] && prayerTimesCache.timestamp && 
        now - prayerTimesCache.timestamp < CACHE_EXPIRY) {
      console.log(`Using cached prayer times for ${dateStr}`);
      return prayerTimesCache.data[dateStr];
    }

    const coords = await getLocation();
    if (!coords) return null;

    // Calculate timestamp for the given date
    const timestamp = Math.floor(date.getTime() / 1000);
    
    console.log(`Fetching prayer times for ${dateStr}`);
    const response = await fetch(
      `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${coords.latitude}&longitude=${coords.longitude}&method=2`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch prayer times');
    }
    
    const data = await response.json();
    const timings = data.data.timings;
    
    const prayerTimes = {
      fajr: formatTo12Hour(timings.Fajr),
      dhuhr: formatTo12Hour(timings.Dhuhr),
      asr: formatTo12Hour(timings.Asr),
      maghrib: formatTo12Hour(timings.Maghrib),
      isha: formatTo12Hour(timings.Isha)
    };

    // Cache the prayer times
    prayerTimesCache.data[dateStr] = prayerTimes;
    prayerTimesCache.timestamp = now;

    return prayerTimes;
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    return null;
  }
}

function formatTo12Hour(time24) {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
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