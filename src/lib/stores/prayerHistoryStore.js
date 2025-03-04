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
  orderBy,
  writeBatch,
  serverTimestamp,
  updateDoc,
  getFirestore
} from 'firebase/firestore';
import { prayerTimesStore, fetchPrayerTimes } from './prayerTimes';
import { updatePrayerProgress } from '../services/badgeProgressService';
import { onMount } from 'svelte';
import { getCurrentLocation } from '../services/prayerTimes';
import { PRAYER_NAMES } from '../utils/constants';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration
const UPDATE_THROTTLE = 2000; // 2 seconds throttle for updates
let lastUpdateTime = 0;

// Add last known data hash to detect actual changes
let lastKnownDataHash = null;

// Add a variable to track the last time getPrayerHistory was called
let lastPrayerHistoryFetch = 0;
// Minimum time between fetches (10 seconds)
const MIN_FETCH_INTERVAL = 10000;

// Add a variable to track the last time updatePrayerStatuses was called
let lastPrayerStatusesUpdate = 0;
// Minimum time between updates (3 seconds)
const MIN_STATUS_UPDATE_INTERVAL = 3000;

function getDataHash(data) {
  return JSON.stringify({
    history: data.history.map(h => ({
      date: h.date,
      prayerName: h.prayerName,
      status: h.status
    })),
    pendingByDate: data.pendingByDate,
    missedByDate: data.missedByDate
  });
}

export const cache = {
  prayerHistory: null,
  lastFetched: null
};

// Cache stores
const locationCache = {
  coords: null,
  timestamp: null
};

const prayerTimesCache = {
  data: {},  // Store prayer times by date
  timestamp: null
};

// Cache expiry time (24 hours for prayer times)
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

// Get cached location or fetch new one
async function getLocation() {
  const now = Date.now();
  
  // Use cached location if available and not expired
  if (locationCache.coords && locationCache.timestamp && 
      now - locationCache.timestamp < CACHE_EXPIRY) {
    // console.log('Using cached location');
    return locationCache.coords;
  }

  // Fetch new location
  // console.log('Fetching new location');
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

// Add throttling to prayer history updates
async function throttledUpdate(updateFn) {
  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_THROTTLE) {
    return;
  }
  lastUpdateTime = now;
  await updateFn();
}

// Add this function to ensure prayers are initialized
export async function ensurePrayerData() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('No authenticated user, skipping prayer data initialization');
      return false;
    }

    // Get the last check timestamp from localStorage
    const lastCheck = localStorage.getItem('lastPrayerDataCheck');
    const today = new Date().toLocaleDateString('en-CA');
    
    // If we haven't checked today, initialize prayers
    if (lastCheck !== today) {
      console.log('Initializing prayer data for the next 7 days');
      
      // First ensure we have prayer times
      let prayerTimes = get(prayerTimesStore);
      if (!prayerTimes || prayerTimes.length === 0) {
        console.log('No prayer times available, fetching them first');
        try {
          // Try to fetch prayer times with retries
          let retryCount = 0;
          const MAX_RETRIES = 3;
          
          while ((!prayerTimes || prayerTimes.length === 0) && retryCount < MAX_RETRIES) {
            try {
              await fetchPrayerTimes();
              prayerTimes = get(prayerTimesStore);
              if (prayerTimes && prayerTimes.length > 0) {
                console.log('Successfully fetched prayer times');
                break;
              }
            } catch (error) {
              console.error(`Error fetching prayer times (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
              retryCount++;
              if (retryCount < MAX_RETRIES) {
                // Wait before retrying with exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
              }
            }
          }
          
          if (!prayerTimes || prayerTimes.length === 0) {
            throw new Error('Failed to fetch prayer times after multiple attempts');
          }
        } catch (error) {
          console.error('Failed to fetch prayer times:', error);
          // Continue with initialization even if prayer times fetch fails
          // We'll use empty times and update them later when available
        }
      }
      
      const prayers = [
        { name: 'Fajr', time: '', icon: 'SunDim', weight: 'regular' },
        { name: 'Dhuhr', time: '', icon: 'Sun', weight: 'fill' },
        { name: 'Asr', time: '', icon: 'CloudSun', weight: 'regular' },
        { name: 'Maghrib', time: '', icon: 'SunHorizon', weight: 'regular' },
        { name: 'Isha', time: '', icon: 'MoonStars', weight: 'regular' }
      ];

      // Get current prayer times
      if (prayerTimes && prayerTimes.length > 0) {
        prayers.forEach((prayer, index) => {
          prayer.time = prayerTimes[index]?.time || '';
        });
      }

      try {
        await initializeTodaysPrayers();
        localStorage.setItem('lastPrayerDataCheck', today);
        return true;
      } catch (error) {
        console.error('Error initializing today\'s prayers:', error);
        // Don't update lastPrayerDataCheck so we'll try again next time
        return false;
      }
    }
    
    return true; // Already checked today
  } catch (error) {
    console.error('Error in ensurePrayerData:', error);
    return false;
  }
}

// Initialize today's prayers in Firestore
export async function initializeTodaysPrayers() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const today = new Date();
        const userTimezoneOffset = today.getTimezoneOffset();
        console.log(`User's timezone offset for initializing prayers: ${userTimezoneOffset} minutes`);
        
        // Initialize prayers for today and the next 7 days
        const promises = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dateStr = date.toLocaleDateString('en-CA');
            
            // Get prayer times for this date
            const prayerTimes = await getPrayerTimes(date);
            if (!prayerTimes) continue;
            
            const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            
            for (const prayer of prayers) {
                const prayerTime = prayerTimes[prayer.toLowerCase()];
                if (!prayerTime) continue;
                
                // Check if prayer already exists
                const prayerId = `${dateStr}_${prayer}`;
                const docRef = doc(db, 'prayer_history', `${user.uid}_${prayerId}`);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) {
                    // Create new prayer document
                    const prayerDateTime = getPrayerDateTime(dateStr, prayerTime);
                    const now = new Date();
                    
                    // Determine initial status
                    let status = 'none';
                    if (dateStr === today.toLocaleDateString('en-CA')) {
                        if (prayerDateTime < now) {
                            status = 'missed'; // Past prayers today are missed by default
                        }
                    }
                    
                    const prayerData = {
                        userId: user.uid,
                        prayerId,
                        prayerName: prayer,
                        time: prayerTime,
                        status,
                        date: dateStr,
                        timestamp: Timestamp.now(),
                        timezoneOffset: userTimezoneOffset
                    };
                    
                    promises.push(setDoc(docRef, prayerData));
                }
            }
        }
        
        if (promises.length > 0) {
            await Promise.all(promises);
            console.log(`Initialized ${promises.length} prayers`);
            
            // Refresh the prayer history
            await getPrayerHistory();
        }
    } catch (error) {
        console.error('Error initializing prayers:', error);
    }
}

export async function initializeMonthlyPrayers() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const today = new Date();
        const userTimezoneOffset = today.getTimezoneOffset();
        console.log(`User's timezone offset for initializing monthly prayers: ${userTimezoneOffset} minutes`);
        
        // Initialize prayers for the next 30 days
        const dates = [];
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            dates.push(date.toLocaleDateString('en-CA'));
        }
        
        // Check existing prayers for these dates
        const existingPrayers = new Set();
        
        // Query all existing prayers for these dates in batches (Firestore has a limit of 10 'in' clauses)
        for (let i = 0; i < dates.length; i += 10) {
            const batchDates = dates.slice(i, i + 10);
            if (batchDates.length === 0) continue;
            
            const historyQuery = query(
                collection(db, 'prayer_history'),
                where('userId', '==', user.uid),
                where('date', 'in', batchDates)
            );
            
            const snapshot = await getDocs(historyQuery);
            snapshot.forEach(doc => {
                existingPrayers.add(`${doc.data().date}_${doc.data().prayerName}`);
            });
        }
        
        // Use Firestore batch for efficiency
        let batch = writeBatch(db);
        let batchCount = 0;
        let totalCreated = 0;
        
        const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const now = new Date();
        
        // Initialize prayers for each date
        for (const dateStr of dates) {
            // Get prayer times for this date
            const date = new Date(dateStr);
            const prayerTimes = await getPrayerTimes(date);
            if (!prayerTimes) continue;
            
            for (const prayer of prayers) {
                const prayerTime = prayerTimes[prayer.toLowerCase()];
                if (!prayerTime) continue;
                
                const prayerId = `${dateStr}_${prayer}`;
                
                // Skip if prayer already exists
                if (existingPrayers.has(prayerId)) {
                    continue;
                }
                
                const docRef = doc(db, 'prayer_history', `${user.uid}_${prayerId}`);
                const prayerDateTime = getPrayerDateTime(dateStr, prayerTime);
                
                // Determine initial status
                let status = 'none';
                if (dateStr === today.toLocaleDateString('en-CA')) {
                    if (prayerDateTime < now) {
                        status = 'missed'; // Past prayers today are missed by default
                    }
                }
                
                batch.set(docRef, {
                    userId: user.uid,
                    prayerId,
                    prayerName: prayer,
                    time: prayerTime,
                    status,
                    date: dateStr,
                    timestamp: Timestamp.now(),
                    timezoneOffset: userTimezoneOffset
                });
                
                batchCount++;
                totalCreated++;
                
                // Firestore batches are limited to 500 operations
                if (batchCount >= 450) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }
        }
        
        // Commit any remaining operations
        if (batchCount > 0) {
            await batch.commit();
        }
        
        if (totalCreated > 0) {
            console.log(`Initialized ${totalCreated} monthly prayers`);
            
            // Refresh the prayer history
            await getPrayerHistory();
        }
    } catch (error) {
        console.error('Error initializing monthly prayers:', error);
    }
}

export async function updatePrayerStatuses() {
    // Check if it's too soon for another update
    const now = Date.now();
    if (now - lastPrayerStatusesUpdate < MIN_STATUS_UPDATE_INTERVAL) {
        console.log('Skipping prayer statuses update - too soon since last update');
        return;
    }
    
    // Update the last update timestamp
    lastPrayerStatusesUpdate = now;
    
    try {
        const user = auth.currentUser;
        if (!user) return;

        const today = new Date().toLocaleDateString('en-CA');
        const now = new Date();
        const userTimezoneOffset = now.getTimezoneOffset();
        console.log(`User's timezone offset for updating prayer statuses: ${userTimezoneOffset} minutes`);

        // Get all prayers for today and past days that don't have a status
        const q = query(
            collection(db, 'prayer_history'),
            where('userId', '==', user.uid),
            where('status', '==', 'none')
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return;

        const batch = writeBatch(db);
        let updatedPrayers = [];

        // Check for excused periods
        const excusedPeriods = await getExcusedPeriods();

        querySnapshot.forEach(doc => {
            const prayer = doc.data();
            const prayerDate = prayer.date;
            const prayerTime = prayer.time;
            const prayerTimezoneOffset = prayer.timezoneOffset || userTimezoneOffset;
            
            // Adjust for timezone differences
            let adjustedPrayerDateTime;
            if (prayerTimezoneOffset !== null && prayerTimezoneOffset !== userTimezoneOffset) {
                adjustedPrayerDateTime = getPrayerDateTime(prayerDate, prayerTime, prayerTimezoneOffset);
                console.log(`Adjusted prayer time for ${prayer.prayerName} on ${prayerDate} by ${userTimezoneOffset - prayerTimezoneOffset} minutes`);
            } else {
                adjustedPrayerDateTime = getPrayerDateTime(prayerDate, prayerTime);
            }

            // Check if prayer is in the past
            if (adjustedPrayerDateTime < now) {
                // Check if prayer is excused
                const isExcused = excusedPeriods.some(period => {
                    const startDate = new Date(period.startDate);
                    const endDate = new Date(period.endDate);
                    const prayerDateTime = new Date(prayerDate + 'T' + prayerTime);
                    return prayerDateTime >= startDate && prayerDateTime <= endDate;
                });

                if (isExcused) {
                    batch.update(doc.ref, { status: 'excused' });
                    updatedPrayers.push({ ...prayer, status: 'excused' });
                } else {
                    batch.update(doc.ref, { status: 'missed' });
                    updatedPrayers.push({ ...prayer, status: 'missed' });
                }
            }
        });

        if (updatedPrayers.length > 0) {
            await batch.commit();
            
            // Update the local store
            prayerHistoryStore.update(store => {
                const history = store.history || [];
                updatedPrayers.forEach(updatedPrayer => {
                    const index = history.findIndex(
                        p => p.date === updatedPrayer.date && p.prayerName === updatedPrayer.prayerName
                    );
                    if (index !== -1) {
                        history[index] = updatedPrayer;
                    } else {
                        history.push(updatedPrayer);
                    }
                });
                return { ...store, history };
            });
        }
    } catch (error) {
        console.error('Error updating prayer statuses:', error);
    }
}

// Helper function for normal prayer status updates
async function updateNormalPrayerStatus(prayer, todayStr, prayerTimes) {
  const prayerTime = prayerTimes[prayer.toLowerCase()];
  if (!prayerTime) return;

  // Get existing prayer record to check for timezone information
  const existingPrayer = await getPrayerRecord(prayer, todayStr);
  const timezoneOffset = existingPrayer?.timezoneOffset || null;
  
  // Use timezone-adjusted prayer time for comparison
  const prayerDateTime = getPrayerDateTime(todayStr, prayerTime, timezoneOffset);
  const now = new Date();
  const existingStatus = existingPrayer?.status || null;

  console.log(`Checking ${prayer} for ${todayStr}: Time=${prayerTime}, Status=${existingStatus}, Current time=${now.toISOString()}, Prayer time=${prayerDateTime.toISOString()}`);

  if (now < prayerDateTime) {
    // Prayer time hasn't come yet
    console.log(`${prayer} time hasn't come yet, marking as upcoming`);
    await savePrayerStatus({
      name: prayer,
      date: todayStr,
      time: prayerTime,
      status: 'upcoming'
    });
  } else {
    // Prayer time has passed without being marked
    if (!existingStatus || existingStatus === 'upcoming') {
      console.log(`${prayer} time has passed, marking as pending`);
      await savePrayerStatus({
        name: prayer,
        date: todayStr,
        time: prayerTime,
        status: 'pending'
      });
    }
  }
}

// Add a helper function to get the full prayer record
async function getPrayerRecord(prayerName, date) {
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

  return querySnapshot.docs[0].data();
}

export async function savePrayerStatus(prayerData) {
  const user = auth.currentUser;
  if (!user) return;

  if (!prayerData?.name && !prayerData?.prayerName) {
    console.error('Prayer name is undefined:', prayerData);
    return;
  }

  const prayerName = prayerData.prayerName || prayerData.name;

  try {
    // Check if the prayer date is before account creation
    const db = getFirestore();
    const trialRef = doc(db, 'trials', user.uid);
    const trialDoc = await getDoc(trialRef);
    
    if (trialDoc.exists()) {
      const trialData = trialDoc.data();
      const accountCreationDate = trialData.startDate.toDate();
      const prayerDate = new Date(prayerData.date);
      
      // Set time to midnight for accurate date comparison
      accountCreationDate.setHours(0, 0, 0, 0);
      prayerDate.setHours(0, 0, 0, 0);
      
      if (prayerDate < accountCreationDate) {
        alert('You cannot mark prayers for dates before your account was created.');
        return;
      }
    }

    const prayerId = `${prayerData.date}_${prayerName}`;
    
    // Get current timezone offset in minutes
    const timezoneOffset = new Date().getTimezoneOffset();
    
    // Create a document reference with a predictable ID
    const prayerRef = doc(db, 'prayer_history', `${user.uid}_${prayerId}`);
    
    // Save to Firestore with timezone information
    await setDoc(prayerRef, {
      userId: user.uid,
      prayerId,
      prayerName: prayerName,
      time: prayerData.time || '',
      status: prayerData.status,
      date: prayerData.date,
      timezoneOffset: timezoneOffset,
      timestamp: Timestamp.now()
    }, { merge: true });

    // Invalidate cache after updating
    invalidatePrayerHistoryCache();
    
    // Update badges if needed - do this in the background
    Promise.resolve().then(() => updatePrayerProgress()).catch(error => {
      console.error('Error updating prayer progress:', error);
    });
    
    return true;
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
  // Check if it's too soon for another fetch
  const now = Date.now();
  if (now - lastPrayerHistoryFetch < MIN_FETCH_INTERVAL) {
    console.log('Skipping prayer history fetch - too soon since last fetch');
    // Return the cached data if available
    if (cache.prayerHistory) {
      return cache.prayerHistory;
    }
  }
  
  // Update the last fetch timestamp
  lastPrayerHistoryFetch = now;
  
  return throttledUpdate(async () => {
    const user = auth.currentUser;
    if (!user) {
      console.log('No authenticated user, skipping prayer history fetch');
      return { history: [], pendingByDate: {}, missedByDate: {} };
    }

    // Use cache if available and not expired
    if (cache.prayerHistory && cache.lastFetched && 
        Date.now() - cache.lastFetched < CACHE_DURATION) {
      console.log('Using cached prayer history data');
      const currentHash = getDataHash(cache.prayerHistory);
      if (currentHash === lastKnownDataHash) {
        // Return cached data without updating the store to prevent unnecessary re-renders
        return cache.prayerHistory;
      }
      lastKnownDataHash = currentHash;
      prayerHistoryStore.set(cache.prayerHistory);
      return cache.prayerHistory;
    }

    // Try to load from localStorage first if we don't have memory cache
    if (!cache.prayerHistory) {
      try {
        const storedCache = localStorage.getItem('prayerHistoryCache');
        if (storedCache) {
          const parsedCache = JSON.parse(storedCache);
          if (parsedCache && parsedCache.data && 
              Date.now() - parsedCache.timestamp < CACHE_DURATION * 2) { // Double duration for localStorage
            console.log('Using prayer history from localStorage');
            cache.prayerHistory = parsedCache.data;
            cache.lastFetched = parsedCache.timestamp;
            
            // Update the store with localStorage data
            const currentHash = getDataHash(cache.prayerHistory);
            if (currentHash !== lastKnownDataHash) {
              lastKnownDataHash = currentHash;
              prayerHistoryStore.set(cache.prayerHistory);
            }
            
            // Return the data but continue with fetch in background
            const result = cache.prayerHistory;
            
            // Fetch fresh data in the background after a short delay
            setTimeout(() => {
              fetchFreshPrayerHistory(user).catch(error => {
                console.error('Background fetch error:', error);
              });
            }, 1000);
            
            return result;
          }
        }
      } catch (storageError) {
        console.error('Error loading prayer history from localStorage:', storageError);
      }
    }

    return fetchFreshPrayerHistory(user);
  });
}

// Separate function to fetch fresh data from Firestore
async function fetchFreshPrayerHistory(user) {
  // Implement retry logic
  let retryCount = 0;
  const MAX_RETRIES = 3;
  let lastError = null;

  while (retryCount < MAX_RETRIES) {
    try {
      console.log(`Fetching prayer history (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('en-CA');
      
      // Get today's date for filtering out future dates
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day
      const todayStr = today.toLocaleDateString('en-CA');
      
      // Query prayer_history collection
      const prayerHistoryRef = collection(db, 'prayer_history');
      
      let querySnapshot;
      
      // Try the indexed query first
      try {
        const q = query(
          prayerHistoryRef,
          where('userId', '==', user.uid),
          where('date', '>=', sevenDaysAgoStr),
          where('date', '<=', todayStr), // Only include dates up to today
          orderBy('date', 'desc')
        );
        
        querySnapshot = await getDocs(q);
        console.log(`Retrieved ${querySnapshot.docs.length} prayer records`);
      } catch (indexError) {
        console.warn('Indexed query failed, falling back to client-side filtering:', indexError);
        const q = query(
          prayerHistoryRef,
          where('userId', '==', user.uid)
        );
        
        const snapshot = await getDocs(q);
        console.log(`Retrieved ${snapshot.docs.length} total prayer records, filtering for last 7 days`);
        
        const filteredDocs = snapshot.docs.filter(doc => {
          const data = doc.data();
          // Filter by date range - only include dates from 7 days ago up to today
          return data.date >= sevenDaysAgoStr && data.date <= todayStr;
        }).sort((a, b) => b.data().date.localeCompare(a.data().date));
        
        querySnapshot = { docs: filteredDocs };
        console.log(`Filtered to ${filteredDocs.length} prayer records within date range`);
      }

      const result = processQueryResults(querySnapshot);
      
      // Check if data has actually changed
      const newHash = getDataHash(result);
      if (newHash === lastKnownDataHash) {
        console.log('Prayer history data unchanged');
        return cache.prayerHistory || result; // Return existing cache or new result
      }
      
      // Update cache and store only if there are actual changes
      console.log('Prayer history data changed, updating store');
      lastKnownDataHash = newHash;
      cache.prayerHistory = result;
      cache.lastFetched = Date.now();
      
      // Save to localStorage for offline access
      try {
        localStorage.setItem('prayerHistoryCache', JSON.stringify({
          data: result,
          timestamp: cache.lastFetched
        }));
      } catch (storageError) {
        console.warn('Failed to save prayer history to localStorage:', storageError);
      }
      
      prayerHistoryStore.set(result);
      return result;
    } catch (error) {
      console.error(`Error fetching prayer history (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
      lastError = error;
      retryCount++;
      
      if (retryCount < MAX_RETRIES) {
        // Wait before retrying with exponential backoff
        const delay = 1000 * Math.pow(2, retryCount);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('Failed to fetch prayer history after multiple attempts');
  
  // Try to load from localStorage as a last resort
  try {
    const storedCache = localStorage.getItem('prayerHistoryCache');
    if (storedCache) {
      const parsedCache = JSON.parse(storedCache);
      if (parsedCache && parsedCache.data) {
        console.log('Using prayer history from localStorage after failed fetch');
        cache.prayerHistory = parsedCache.data;
        cache.lastFetched = parsedCache.timestamp || Date.now();
        prayerHistoryStore.set(parsedCache.data);
        return parsedCache.data;
      }
    }
  } catch (storageError) {
    console.error('Error loading prayer history from localStorage:', storageError);
  }
  
  // If all else fails, return empty result
  const emptyResult = { history: [], pendingByDate: {}, missedByDate: {} };
  prayerHistoryStore.set(emptyResult);
  return emptyResult;
}

// Helper function to process query results
function processQueryResults(querySnapshot) {
  const history = [];
  const pendingByDate = {};
  const missedByDate = {};
  
  // Get today's date for filtering out future dates
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day
  const todayStr = today.toLocaleDateString('en-CA');
  
  if (querySnapshot && querySnapshot.docs) {
    querySnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!data) return;
      
      // Skip future dates - only include dates up to today
      if (data.date > todayStr) return;
      
      history.push({ id: doc.id, ...data });
      
      // Organize pending and missed prayers by date
      if (data.status === 'pending') {
        if (!pendingByDate[data.date]) {
          pendingByDate[data.date] = { prayers: [] };
        }
        pendingByDate[data.date].prayers.push({
          prayerName: data.prayerName,
          time: data.time || ''  // Handle missing time
        });
      } else if (data.status === 'missed') {
        if (!missedByDate[data.date]) {
          missedByDate[data.date] = { prayers: [] };
        }
        missedByDate[data.date].prayers.push({
          prayerName: data.prayerName,
          time: data.time || ''  // Handle missing time
        });
      }
    });
  }

  return { history, pendingByDate, missedByDate };
}

export function getPrayerDateTime(dateStr, timeStr, timezoneOffset = null) {
  if (!dateStr || !timeStr) return new Date();
  
  // Handle 12-hour format (e.g., "6:30 AM" or "7:45 PM")
  let hours = 0;
  let minutes = 0;
  
  if (timeStr.includes('AM') || timeStr.includes('PM')) {
    // Parse 12-hour format
    const [timePart, period] = timeStr.split(' ');
    const [hourStr, minuteStr] = timePart.split(':');
    
    hours = parseInt(hourStr, 10);
    minutes = parseInt(minuteStr, 10);
    
    // Convert to 24-hour format
    if (period === 'PM' && hours < 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
  } else {
    // Parse 24-hour format
    const [hourStr, minuteStr] = timeStr.split(':');
    hours = parseInt(hourStr, 10);
    minutes = parseInt(minuteStr, 10);
  }
  
  // Validate hours and minutes to prevent invalid time values
  if (isNaN(hours) || hours < 0 || hours > 23) {
    console.error(`Invalid hours value in time string: "${timeStr}"`);
    hours = 0;
  }
  
  if (isNaN(minutes) || minutes < 0 || minutes > 59) {
    console.error(`Invalid minutes value in time string: "${timeStr}"`);
    minutes = 0;
  }
  
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Validate date components
  if (isNaN(year) || isNaN(month) || isNaN(day) || 
      year < 2000 || year > 2100 || 
      month < 1 || month > 12 || 
      day < 1 || day > 31) {
    console.error(`Invalid date string: "${dateStr}"`);
    return new Date(); // Return current date/time as fallback
  }
  
  try {
    const date = new Date(year, month - 1, day, hours, minutes);
    
    // If we have timezone offset information, adjust the date
    if (timezoneOffset !== null) {
      const currentOffset = new Date().getTimezoneOffset();
      const offsetDiff = currentOffset - timezoneOffset; // Difference in minutes
      
      if (offsetDiff !== 0) {
        date.setMinutes(date.getMinutes() + offsetDiff);
        console.log(`Adjusted prayer time by ${offsetDiff} minutes for timezone difference`);
      }
    }
    
    return date;
  } catch (error) {
    console.error(`Error creating date from: ${dateStr} ${timeStr}`, error);
    return new Date(); // Return current date/time as fallback
  }
}

// Update function to save excused period with prayer-specific timing
export async function saveExcusedPeriod(startDate, endDate, startPrayer, endPrayer) {
  // console.log('=== Saving Excused Period ===');
  // console.log('Start Date:', startDate);
  // console.log('End Date:', endDate);
  // console.log('Start Prayer:', startPrayer);
  // console.log('End Prayer:', endPrayer);

  const user = auth.currentUser;
  if (!user) {
    // console.log('No user logged in');
    return;
  }

  // Create a unique ID for the period using timestamp
  const periodId = `${user.uid}-${Date.now()}`;
  const excusedPeriodRef = doc(db, 'excused_periods', periodId);
  // console.log('Saving to Firestore ref:', excusedPeriodRef.path);

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
    // console.log('Successfully saved excused period to Firestore');

    // If end date is provided, mark prayers as excused for the period
    if (endDate && endPrayer) {
      // console.log('Marking prayers as excused for date range');
      const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      const start = new Date(startDate);
      const end = new Date(endDate);
      const startPrayerIndex = prayers.indexOf(startPrayer);
      const endPrayerIndex = prayers.indexOf(endPrayer);

      for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toLocaleDateString('en-CA');
        const isStartDate = dateStr === startDate;
        const isEndDate = dateStr === endDate;
        // console.log('Processing date:', dateStr);

        for (let i = 0; i < prayers.length; i++) {
          // Skip prayers before startPrayer on start date
          if (isStartDate && i < startPrayerIndex) {
            // console.log(`Skipping ${prayers[i]} on start date`);
            continue;
          }
          // Skip prayers after endPrayer on end date
          if (isEndDate && i > endPrayerIndex) {
            // console.log(`Skipping ${prayers[i]} on end date`);
            continue;
          }

          // Check existing prayer status
          const existingStatus = await getPrayerStatus(prayers[i], dateStr);
          // console.log(`Existing status for ${prayers[i]} on ${dateStr}:`, existingStatus);

          // Only mark as excused if it's not already marked as ontime or late
          if (existingStatus !== 'ontime' && existingStatus !== 'late') {
            // console.log(`Marking ${prayers[i]} as excused for ${dateStr}`);
            await savePrayerStatus({
              name: prayers[i],
              date: dateStr,
              status: 'excused'
            });
          } else {
            // console.log(`Keeping existing status (${existingStatus}) for ${prayers[i]} on ${dateStr}`);
          }
        }
      }
    } else {
      // If no end date, just mark prayers from start date and prayer
      // console.log('Marking prayers as excused from start time (ongoing period)');
      const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      const startPrayerIndex = prayers.indexOf(startPrayer);
      const today = new Date().toLocaleDateString('en-CA');

      if (startDate === today) {
        // console.log('Marking today\'s remaining prayers as excused');
        for (let i = startPrayerIndex; i < prayers.length; i++) {
          // Check existing prayer status
          const existingStatus = await getPrayerStatus(prayers[i], startDate);
          // console.log(`Existing status for ${prayers[i]} on ${startDate}:`, existingStatus);

          // Only mark as excused if it's not already marked as ontime or late
          if (existingStatus !== 'ontime' && existingStatus !== 'late') {
            // console.log(`Marking ${prayers[i]} as excused for ${startDate}`);
            await savePrayerStatus({
              name: prayers[i],
              date: startDate,
              status: 'excused'
            });
          } else {
            // console.log(`Keeping existing status (${existingStatus}) for ${prayers[i]} on ${startDate}`);
          }
        }
      }
    }
  } catch (error) {
    // console.error('Error saving excused period:', error);
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
  // console.log('=== Checking if prayer should be excused ===');
  // console.log('Date:', date);
  // console.log('Prayer:', prayerName);

  const user = auth.currentUser;
  if (!user) {
    // console.log('No user logged in');
    return false;
  }

  // Get prayer time for the given prayer
  const prayerTimes = await getPrayerTimes(new Date(date));
  if (!prayerTimes) {
    // console.log('No prayer times available');
    return false;
  }

  const prayerTime = prayerTimes[prayerName.toLowerCase()];
  if (!prayerTime) {
    // console.log('No time found for prayer:', prayerName);
    return false;
  }

  // Convert prayer time to Date object
  const prayerDateTime = getPrayerDateTime(date, prayerTime);
  const now = new Date();

  // If prayer time hasn't come yet, it shouldn't be excused
  if (prayerDateTime > now) {
    // console.log('Prayer time has not come yet, should not be excused');
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
    // console.log('Found excused periods:', querySnapshot.size);

    for (const doc of querySnapshot.docs) {
      const period = doc.data();
      // console.log('Checking period:', period);

      // For ongoing periods
      if (period.status === 'ongoing') {
        const periodStart = new Date(period.startDate);
        const prayerDate = new Date(date);
        
        // Set both to midnight for date comparison
        periodStart.setHours(0, 0, 0, 0);
        prayerDate.setHours(0, 0, 0, 0);

        // If prayer date is after or equal to period start date
        if (prayerDate >= periodStart) {
          // console.log('Prayer is within ongoing period');
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
    
    // console.log('No matching excused period found');
    return false;
  } catch (error) {
    // console.error('Error checking excused status:', error);
    return false;
  }
}

// Add this function to get all active excused periods
async function getActiveExcusedPeriods() {
  // console.log('=== Getting Active Excused Periods ===');
  const user = auth.currentUser;
  if (!user) {
    // console.log('No user logged in');
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
    
    // console.log('Found active periods:', periods);
    return periods;
  } catch (error) {
    // console.error('Error getting active excused periods:', error);
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
      // console.log(`Using cached prayer times for ${dateStr}`);
      return prayerTimesCache.data[dateStr];
    }

    const coords = await getLocation();
    if (!coords) return null;

    // Calculate timestamp for the given date
    const timestamp = Math.floor(date.getTime() / 1000);
    
    // console.log(`Fetching prayer times for ${dateStr}`);
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
    // console.error('Error fetching prayer times:', error);
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

// Add cache invalidation function
export function invalidatePrayerHistoryCache() {
  console.log('Invalidating prayer history cache');
  cache.prayerHistory = null;
  cache.lastFetched = null;
  lastKnownDataHash = null;
  
  // Also clear localStorage cache
  try {
    localStorage.removeItem('prayerHistoryCache');
    localStorage.removeItem('weeklyGridCache');
  } catch (error) {
    console.error('Error clearing localStorage cache:', error);
  }
  
  // Force a fresh fetch
  return getPrayerHistory();
} 

export async function updatePastPrayerStatuses() {
  const user = auth.currentUser;
  if (!user) return;

  const today = new Date();
  const todayStr = formatDate(today);
  
  // Get prayers from the last 7 days that are not marked as ontime, late, or excused
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = formatDate(sevenDaysAgo);
  
  const prayerQuery = query(
    collection(db, 'prayer_history'),
    where('userId', '==', user.uid),
    where('date', '>=', sevenDaysAgoStr),
    where('date', '<', todayStr),
    where('status', 'not-in', ['ontime', 'late', 'excused'])
  );
  
  const querySnapshot = await getDocs(prayerQuery);
  
  // Check for excused periods
  const excusedPeriods = await getExcusedPeriods();
  
  // Batch update for efficiency
  let batch = writeBatch(db);
  let count = 0;
  
  for (const doc of querySnapshot.docs) {
    const prayer = doc.data();
    const isExcused = isDateInExcusedPeriod(prayer.date, excusedPeriods);
    
    // Get prayer time for the date
    const dateParts = prayer.date.split('-');
    const prayerDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const prayerDateStr = formatDate(prayerDate);
    
    // Use the prayer's stored timezone offset if available
    const timezoneOffset = prayer.timezoneOffset || null;
    
    // Get the prayer time and create a datetime object
    const prayerTime = prayer.time;
    const prayerDateTime = getPrayerDateTime(prayerDateStr, prayerTime, timezoneOffset);
    
    // If the prayer time has passed and it's not excused, mark as missed
    if (today > prayerDateTime && !isExcused) {
      console.log(`Marking past prayer ${prayer.prayerName} on ${prayer.date} as missed. Time: ${prayerTime}, Current time: ${today.toISOString()}`);
      
      const prayerRef = doc.ref;
      batch.update(prayerRef, { 
        status: 'missed',
        lastUpdated: serverTimestamp()
      });
      
      count++;
      
      // Firestore has a limit of 500 operations per batch
      if (count >= 450) {
        await batch.commit();
        batch = writeBatch(db); // Create new batch
        count = 0;
      }
    }
  }
  
  if (count > 0) {
    await batch.commit();
  }
  
  // After updating, refresh the prayer history
  await getPrayerHistory();
  
  console.log(`Updated ${count} past prayers`);
} 

// Helper function to format date as YYYY-MM-DD
function formatDate(date) {
  return date.toLocaleDateString('en-CA'); // Returns in YYYY-MM-DD format
} 

// Helper function to get excused periods
async function getExcusedPeriods() {
  const user = auth.currentUser;
  if (!user) return [];

  const excusedQuery = query(
    collection(db, 'excused_periods'),
    where('userId', '==', user.uid)
  );

  const querySnapshot = await getDocs(excusedQuery);
  return querySnapshot.docs.map(doc => doc.data());
}

// Helper function to check if a date is within an excused period
function isDateInExcusedPeriod(dateStr, excusedPeriods) {
  if (!excusedPeriods || excusedPeriods.length === 0) return false;
  
  const date = new Date(dateStr);
  
  return excusedPeriods.some(period => {
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);
    return date >= startDate && date <= endDate;
  });
} 