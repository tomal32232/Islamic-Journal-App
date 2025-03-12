<script>
  import { onMount, onDestroy } from 'svelte';
  import { 
    prayerHistoryStore, 
    getPrayerHistory, 
    getPrayerDateTime,
    shouldMarkPrayerExcused,
    savePrayerStatus,
    invalidatePrayerHistoryCache,
    initializeTodaysPrayers
  } from '../stores/prayerHistoryStore';
  import { prayerTimesStore, fetchPrayerTimes } from '../stores/prayerTimes';
  import { iconMap } from '../utils/icons';
  import { auth } from '../firebase';
  import { ArrowClockwise } from 'phosphor-svelte';
  import { getFirestore, doc, getDoc } from 'firebase/firestore';

  // Add loading and error states
  let isLoading = true;
  let loadingError = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  // Add a flag to track if data has been loaded at least once
  let dataInitialized = false;
  
  // Add a flag to track if we're showing cached data while loading fresh data
  let showingCachedData = false;

  // Preload data as soon as the component is created
  let preloadPromise = preloadData();

  async function preloadData() {
    try {
      // Set loading state, but don't show loading indicator if we have cached data
      isLoading = true;
      loadingError = null;
      
      try {
        // Load cache from localStorage first
        loadCacheFromStorage();
      } catch (cacheError) {
        console.error('Error loading cache:', cacheError);
        // Continue with initialization even if cache loading fails
      }
      
      // If we have cached data, show it immediately and don't show loading indicator
      if (gridCache && gridCache.data && gridCache.data.grid && gridCache.data.grid.length > 0) {
        weeklyGrid = gridCache.data.grid;
        weeklyStats = gridCache.data.weeklyStats || { ontime: 0, late: 0, missed: 0, excused: 0 };
        // Don't show loading state if we have cached data
        showingCachedData = true;
        isLoading = false;
      }
      
      // Check if we already have data in the store and it's recent enough
      const storeHasData = $prayerHistoryStore.history && $prayerHistoryStore.history.length > 0;
      const cacheIsRecent = gridCache && gridCache.timestamp && (Date.now() - gridCache.timestamp < 5 * 60 * 1000); // 5 minutes
      
      // Only fetch from database if we don't have recent data
      if (!storeHasData || !cacheIsRecent || !dataInitialized) {
        // If we're showing cached data, don't show loading indicator while fetching fresh data
        if (!showingCachedData) {
          isLoading = true;
        }
        
        // Fetch prayer history and times in parallel if needed
        await Promise.allSettled([
          getPrayerHistory().catch(error => {
            console.error('Error fetching prayer history:', error);
            throw new Error('Failed to load prayer history');
          }),
          fetchPrayerTimes().catch(error => {
            console.error('Error fetching prayer times:', error);
            throw new Error('Failed to load prayer times');
          })
        ]).then(results => {
          // Check if any promises were rejected
          const errors = results
            .filter(r => r.status === 'rejected')
            .map(r => r.reason.message);
          
          if (errors.length > 0) {
            throw new Error(errors.join(', '));
          }
          
          // Mark data as initialized
          dataInitialized = true;
        });
        
        // Check if we need to initialize future prayer records
        await ensureFuturePrayerRecords();
      } else {
        console.log('Using existing data from store, skipping fetch');
        // If we have recent data, we can skip loading state
        isLoading = false;
      }
      
      // Generate grid with available data
      await updateGrid();
      
      // Reset flags
      isLoading = false;
      showingCachedData = false;
    } catch (error) {
      console.error('Error preloading data:', error);
      loadingError = error.message || 'Failed to load prayer data';
      
      // Implement retry logic
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`Retrying data load (${retryCount}/${MAX_RETRIES})...`);
        setTimeout(() => {
          preloadPromise = preloadData();
        }, 2000 * retryCount); // Exponential backoff
      } else {
        isLoading = false;
        // Try to use cached data even if there was an error
        if (gridCache && gridCache.data) {
          console.log('Using cached data after failed retries');
          weeklyGrid = gridCache.data.grid || [];
          weeklyStats = gridCache.data.weeklyStats || { ontime: 0, late: 0, missed: 0, excused: 0 };
        }
      }
    }
  }

  // Function to manually retry loading
  async function retryLoading() {
    retryCount = 0;
    preloadPromise = preloadData();
  }

  let weeklyGrid = [];
  let weeklyStats = {
    ontime: 0,
    late: 0,
    missed: 0,
    excused: 0
  };

  let tapTimeout;
  let lastTappedCell = null;

  // Handle tap on prayer cell
  async function handleTap(prayer, day) {
    try {
      console.log('Tapped prayer:', prayer);
      console.log('Tapped day:', day);
      
      // Get user's account creation date
      const user = auth.currentUser;
      if (!user) {
        console.error('No authenticated user found');
        return;
      }
      
      const db = getFirestore();
      const trialRef = doc(db, 'trials', user.uid);
      const trialDoc = await getDoc(trialRef);
      let accountCreationDate = trialDoc.exists() ? trialDoc.data().startDate.toDate() : new Date();
      accountCreationDate = new Date(accountCreationDate.toLocaleDateString()); // Reset to midnight in local timezone

      // Create a date object for one day before account creation
      const oneDayBeforeCreation = new Date(accountCreationDate);
      oneDayBeforeCreation.setDate(accountCreationDate.getDate() - 1);

      // Convert prayer date to local date for comparison
      const prayerDate = new Date(day.date);
      const prayerDateLocal = new Date(prayerDate.toLocaleDateString());

      // Check if prayer is before one day before account creation
      if (prayerDateLocal.getTime() < oneDayBeforeCreation.getTime()) {
        console.log(`Cannot mark prayer before one day prior to account creation date (${oneDayBeforeCreation.toLocaleDateString('en-CA')})`);
        return;
      }
      
      // Get the actual prayer time from the store
      const prayerTimeFromStore = $prayerTimesStore.find(p => p.name === prayer.name)?.time || '00:00 AM';
      const prayerTime = prayer.time || prayerTimeFromStore;
      
      // Check if prayer is in the future
      const isFuture = await isPrayerInFuture(day.date, prayerTime, prayer.timezoneOffset);
      console.log(`Checking if ${prayer.name} is in future:`, isFuture);
      
      // Don't allow marking future prayers
      if (isFuture) {
        console.log(`Cannot mark future prayer: ${prayer.name} on ${day.date} - Only past prayers can be marked.`);
        return;
      }
      
      // Check if prayer is excused
      const isExcused = await shouldMarkPrayerExcused(day.date, prayer.name);
      if (isExcused) {
        console.log(`Prayer ${prayer.name} on ${day.date} is excused`);
        return;
      }
      
      // Create a unique identifier for this cell
      const cellId = `${prayer.name}-${day.date}`;
      
      // Check if the prayer record exists in the database
      const prayerId = `${day.date}_${prayer.name}`;
      const prayerDocRef = doc(db, 'prayer_history', `${user.uid}_${prayerId}`);
      
      let existingPrayerData = null;
      try {
        const prayerDocSnap = await getDoc(prayerDocRef);
        if (prayerDocSnap.exists()) {
          existingPrayerData = prayerDocSnap.data();
          console.log(`Found existing prayer record for ${prayer.name} on ${day.date}:`, existingPrayerData);
        } else {
          console.log(`No existing prayer record found for ${prayer.name} on ${day.date}, will create new record`);
        }
      } catch (error) {
        console.log(`Error checking for existing prayer record: ${error.message}, will create new record`);
      }
      
      // Handle double tap logic
      if (lastTappedCell === cellId && tapTimeout) {
        // This is a double tap
        clearTimeout(tapTimeout);
        tapTimeout = null;
        lastTappedCell = null;
        
        // Immediately update UI to show 'late' status
        updateUIForPrayer(prayer.name, day.date, 'late');
        
        // Mark as late on double tap (in the background)
        const prayerData = {
          prayerName: prayer.name,
          date: day.date,
          status: 'late',
          time: prayerTime,
          timezoneOffset: prayer.timezoneOffset || new Date().getTimezoneOffset()
        };
        
        console.log('Double tap - Saving prayer data as late:', prayerData);
        // Don't await this - let it happen in the background
        savePrayerStatus(prayerData).then(() => {
          console.log(`Successfully saved prayer ${prayer.name} on ${day.date} as late`);
          // Refresh prayer history after saving
          getPrayerHistory().catch(error => {
            console.error('Error refreshing prayer history after save:', error);
          });
        }).catch(error => {
          console.error('Error saving prayer status:', error);
          // Revert UI update if save fails
          updateUIForPrayer(prayer.name, day.date, day.status);
        });
      } else {
        // This is a single tap - set a timeout to detect if a double tap follows
        lastTappedCell = cellId;
        
        // Show visual feedback immediately that something was tapped
        // We'll use a temporary "pending" visual state
        const tempCell = weeklyGrid.find(row => row.name === prayer.name)?.days.find(d => d.date === day.date);
        if (tempCell) {
          const oldStatus = tempCell.status;
          // Only update the visual if it's not already marked
          if (oldStatus !== 'ontime' && oldStatus !== 'late') {
            tempCell.status = 'pending';
            // Force a UI update
            weeklyGrid = [...weeklyGrid];
          }
        }
        
        clearTimeout(tapTimeout);
        tapTimeout = setTimeout(async () => {
          // Immediately update UI to show 'ontime' status
          updateUIForPrayer(prayer.name, day.date, 'ontime');
          
          // Single tap confirmed - mark as on time (in the background)
          const prayerData = {
            prayerName: prayer.name,
            date: day.date,
            status: 'ontime',
            time: prayerTime,
            timezoneOffset: prayer.timezoneOffset || new Date().getTimezoneOffset()
          };
          
          console.log('Single tap - Saving prayer data as on time:', prayerData);
          // Don't await this - let it happen in the background
          savePrayerStatus(prayerData).then(() => {
            console.log(`Successfully saved prayer ${prayer.name} on ${day.date} as on time`);
            // Refresh prayer history after saving
            getPrayerHistory().catch(error => {
              console.error('Error refreshing prayer history after save:', error);
            });
          }).catch(error => {
            console.error('Error saving prayer status:', error);
            // Revert UI update if save fails
            updateUIForPrayer(prayer.name, day.date, day.status);
          });
          
          // Reset for next tap
          tapTimeout = null;
          lastTappedCell = null;
        }, 300); // 300ms is a common double-tap detection threshold
      }
      
    } catch (error) {
      console.error('Error handling prayer tap:', error);
    }
  }

  // Helper function to update UI immediately
  function updateUIForPrayer(prayerName, date, newStatus) {
    // Check if the prayer is within the current week for stats
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    
    const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('en-CA');
    const todayStr = today.toLocaleDateString('en-CA');
    const isInCurrentWeek = date >= sevenDaysAgoStr && date <= todayStr;
    
    console.log(`Updating UI for prayer: ${prayerName} on ${date} to ${newStatus}, in current week: ${isInCurrentWeek}`);
    
    // Update the grid data in memory - use direct mutation for better performance
    let updated = false;
    for (let i = 0; i < weeklyGrid.length; i++) {
      if (weeklyGrid[i].name === prayerName) {
        for (let j = 0; j < weeklyGrid[i].days.length; j++) {
          if (weeklyGrid[i].days[j].date === date) {
            // Get the old status before updating
            const oldStatus = weeklyGrid[i].days[j].status;
            
            // Update the status
            weeklyGrid[i].days[j].status = newStatus;
            updated = true;
            
            // Update weekly stats if needed and if the prayer is within the current week
            if (isInCurrentWeek) {
              // Decrement old status count if it was a countable status
              if (oldStatus && ['ontime', 'late', 'missed', 'excused'].includes(oldStatus)) {
                if (weeklyStats[oldStatus] !== undefined) {
                  weeklyStats[oldStatus]--;
                }
              }
              
              // Increment new status count if it's a countable status
              if (['ontime', 'late', 'missed', 'excused'].includes(newStatus)) {
                if (weeklyStats[newStatus] !== undefined) {
                  weeklyStats[newStatus]++;
                }
              }
            }
            
            // Force Svelte to recognize the change by creating new references
            weeklyGrid = [...weeklyGrid];
            weeklyStats = {...weeklyStats};
            
            break;
          }
        }
        if (updated) break;
      }
    }

    // Also update the local store for immediate consistency
    prayerHistoryStore.update(store => {
      const history = store.history || [];
      const index = history.findIndex(
        p => p.date === date && p.prayerName === prayerName
      );
      
      if (index !== -1) {
        history[index] = { ...history[index], status: newStatus };
      } else {
        history.push({
          date,
          prayerName,
          status: newStatus,
          time: $prayerTimesStore.find(p => p.name === prayerName)?.time || '00:00'
        });
      }
      
      // Remove from pendingByDate if status is final
      if (['ontime', 'late', 'missed', 'excused'].includes(newStatus)) {
        if (store.pendingByDate[date]) {
          store.pendingByDate[date].prayers = 
            store.pendingByDate[date].prayers.filter(
              p => p.prayerName !== prayerName
            );
          
          // Remove the date if no prayers left
          if (store.pendingByDate[date].prayers.length === 0) {
            delete store.pendingByDate[date];
          }
        }
      }
      
      return { ...store, history };
    });
    
    // Force a UI update by triggering a tick
    Promise.resolve().then(() => {
      // This creates a microtask that will run after the current task,
      // ensuring the UI updates immediately
      weeklyGrid = [...weeklyGrid];
      weeklyStats = {...weeklyStats};
      
      // Add a second update after a short delay to ensure the UI is updated
      setTimeout(() => {
        weeklyGrid = [...weeklyGrid];
        weeklyStats = {...weeklyStats};
      }, 100);
    });
    
    // Invalidate the cache to ensure fresh data on next load
    if (gridCache) {
      gridCache.historyHash = getPrayerHistoryHash($prayerHistoryStore.history);
      saveCacheToStorage();
    }
  }

  // Add cache for grid data
  let gridCache = {
    data: null,
    timestamp: null,
    historyHash: null,
    weekStartDate: null // Add this to track week changes
  };

  // Function to generate a simple hash of prayer history
  function getPrayerHistoryHash(history) {
    if (!history) return '';
    return history.map(p => `${p.date}-${p.prayerName}-${p.status}`).join('|');
  }

  // Improve cache loading from localStorage
  function loadCacheFromStorage() {
    try {
      const storedCache = localStorage.getItem('weeklyGridCache');
      if (storedCache) {
        try {
          const parsedCache = JSON.parse(storedCache);
          // Extend cache validity to 2 hours for initial loads
          if (parsedCache && Date.now() - parsedCache.timestamp < 2 * 60 * 60 * 1000) {
            console.log('Loading grid cache from localStorage');
            
            // Ensure all required properties exist in the cache before assigning
            if (parsedCache.data && 
                parsedCache.timestamp && 
                parsedCache.historyHash !== undefined && 
                parsedCache.weekStartDate !== undefined) {
              
              // Make sure grid data structure is valid
              if (parsedCache.data.grid && 
                  parsedCache.data.weeklyStats && 
                  parsedCache.data.days) {
                
                gridCache = parsedCache;
                
                // Immediately populate the grid with cached data for faster rendering
                weeklyGrid = gridCache.data.grid || [];
                weeklyStats = gridCache.data.weeklyStats || { ontime: 0, late: 0, missed: 0, excused: 0 };
                // Still mark as loading until we verify the data
                isLoading = true;
              } else {
                console.log('Invalid grid data structure in cache');
              }
            } else {
              console.log('Missing required properties in cache');
            }
          } else {
            console.log('Cache expired or invalid timestamp');
          }
        } catch (parseError) {
          console.error('Error parsing cache JSON:', parseError);
        }
      }
    } catch (error) {
      console.error('Error loading cache from localStorage:', error);
      // Don't set an error state here, just log it
    }
  }

  // Save cache to localStorage with improved error handling
  function saveCacheToStorage() {
    try {
      // Only save valid cache data
      if (gridCache && 
          gridCache.data && 
          gridCache.data.grid && 
          gridCache.data.grid.length > 0 &&
          gridCache.timestamp &&
          gridCache.historyHash !== undefined &&
          gridCache.weekStartDate !== undefined) {
        
        // Create a clean copy of the data to avoid circular references
        const cacheToSave = {
          data: {
            grid: gridCache.data.grid,
            days: gridCache.data.days,
            weeklyStats: gridCache.data.weeklyStats
          },
          timestamp: gridCache.timestamp,
          historyHash: gridCache.historyHash,
          weekStartDate: gridCache.weekStartDate
        };
        
        localStorage.setItem('weeklyGridCache', JSON.stringify(cacheToSave));
        console.log('Saved grid cache to localStorage');
      } else {
        console.log('Invalid cache data, not saving to localStorage');
      }
    } catch (error) {
      console.error('Error saving cache to localStorage:', error);
    }
  }

  function getWeekStartDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - dayOfWeek);
    return startDate.toISOString();
  }

  function getCurrentWeekDays() {
    const today = new Date();
    const days = [];
    
    // Generate last 7 days ending with today
    for (let i = 6; i >= 0; i--) {
      const current = new Date(today);
      current.setDate(today.getDate() - i);
      days.push({
        date: current.toLocaleDateString('en-CA'), // YYYY-MM-DD format
        dayName: current.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: current.getDate(),
        isToday: i === 0
      });
    }
    console.log('Generated week days:', JSON.stringify(days));
    return days;
  }

  // Add a function to check if a date is within the current week
  function isCurrentWeek(dateStr) {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    
    const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('en-CA');
    const todayStr = today.toLocaleDateString('en-CA');
    
    return dateStr >= sevenDaysAgoStr && dateStr <= todayStr;
  }

  // Add a more robust function to check if a prayer is in the future
  function isPrayerInFuture(dateStr, timeStr, timezoneOffset = null) {
    try {
      if (!dateStr || !timeStr) {
        console.error('Missing date or time in isPrayerInFuture:', { dateStr, timeStr });
        return false;
      }
      
      // Get current time with milliseconds for more precise comparison
      const now = new Date();
      
      // Log the raw inputs for debugging
      console.log(`isPrayerInFuture raw inputs: Date=${dateStr}, Time=${timeStr}, TZ Offset=${timezoneOffset}`);
      
      try {
        // Parse the prayer time
        const prayerDateTime = getPrayerDateTime(dateStr, timeStr, timezoneOffset);
        
        // Add debug logging
        console.log(`isPrayerInFuture: Date=${dateStr}, Time=${timeStr}, TZ Offset=${timezoneOffset}`);
        console.log(`Comparing prayer time: ${prayerDateTime.toISOString()} with current time: ${now.toISOString()}`);
        console.log(`Prayer time hours: ${prayerDateTime.getHours()}, minutes: ${prayerDateTime.getMinutes()}`);
        console.log(`Current time hours: ${now.getHours()}, minutes: ${now.getMinutes()}`);
        
        // Add a small buffer (1 minute) to account for slight time differences
        const isInFuture = prayerDateTime.getTime() > (now.getTime() + 60000);
        console.log(`Is prayer in future (with 1-minute buffer): ${isInFuture}`);
        
        return isInFuture;
      } catch (dateError) {
        console.error('Error creating prayer date/time:', dateError, { dateStr, timeStr });
        return false;
      }
    } catch (error) {
      console.error('Error in isPrayerInFuture:', error, { dateStr, timeStr });
      return false;
    }
  }

  // Add a more robust function to check if a date is today
  function isToday(dateStr) {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    return dateStr === todayStr;
  }

  // Add a more robust function to check if a date is in the future
  function isFutureDate(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date > today;
  }

  async function generatePrayerGrid() {
    try {
      console.log('=== GENERATE PRAYER GRID DEBUG ===');
      // Get current week start date
      const currentWeekStart = getWeekStartDate();
      console.log('Current week start date:', currentWeekStart);
      
      // Check if we can use cached data
      const currentHistoryHash = getPrayerHistoryHash($prayerHistoryStore.history);
      console.log('Current history hash:', currentHistoryHash);
      console.log('Cache status:', {
        hasCache: !!gridCache.data,
        cacheHistoryHash: gridCache.historyHash,
        cacheWeekStartDate: gridCache.weekStartDate,
        cacheTimestamp: gridCache.timestamp,
        cacheAge: gridCache.timestamp ? Date.now() - gridCache.timestamp : 'N/A'
      });
      
      // Improved caching: Check cache first before generating days
      if (gridCache.data && 
          gridCache.historyHash === currentHistoryHash && 
          gridCache.weekStartDate === currentWeekStart &&
          Date.now() - gridCache.timestamp < 30 * 60 * 1000) { // Cache valid for 30 minutes
        console.log('Using cached grid data');
        return gridCache.data;
      }
      
      console.log('Generating new grid data...');
      const days = getCurrentWeekDays();
      console.log('Generated week days:', JSON.stringify(days));
      
      const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      const grid = [];
      
      // Get the date range for the last 7 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);
      
      // Convert to string format for easier comparison
      const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('en-CA');
      const todayStr = today.toLocaleDateString('en-CA');
      console.log('Date range for grid:', {
        today: today.toISOString(),
        todayStr,
        sevenDaysAgo: sevenDaysAgo.toISOString(),
        sevenDaysAgoStr
      });
      
      // Get user's account creation date from trial data
      const user = auth.currentUser;
      console.log('Current user:', user?.uid);
      
      if (!user) {
        console.error('No authenticated user found');
        throw new Error('User not authenticated');
      }
      
      const db = getFirestore();
      const trialRef = doc(db, 'trials', user.uid);
      console.log('Fetching trial document:', trialRef.path);
      
      const trialDoc = await getDoc(trialRef);
      console.log('Trial document exists:', trialDoc.exists());
      
      // Get account creation date and convert to user's local timezone
      let accountCreationDate = trialDoc.exists() ? trialDoc.data().startDate.toDate() : new Date();
      accountCreationDate = new Date(accountCreationDate.toLocaleDateString()); // Reset to midnight in local timezone
      
      // Create a date object for one day before account creation
      const oneDayBeforeCreation = new Date(accountCreationDate);
      oneDayBeforeCreation.setDate(accountCreationDate.getDate() - 1);
      
      console.log('=== Prayer History Account Check ===');
      console.log('Raw Account Creation Date:', trialDoc.exists() ? trialDoc.data().startDate.toDate().toISOString() : 'N/A');
      console.log('Adjusted Account Creation Date:', accountCreationDate.toISOString());
      console.log('One Day Before Creation Date:', oneDayBeforeCreation.toISOString());
      console.log('Account Creation Local Date:', accountCreationDate.toLocaleDateString('en-CA'));
      console.log('Today:', todayStr);
      console.log('Seven Days Ago:', sevenDaysAgoStr);

      // Track prayers that need to be saved to the database
      const prayersToSave = [];
      
      // First, let's ensure we have the most up-to-date prayer history from the database
      // This helps prevent race conditions where the store might not be fully populated
      console.log('Fetching prayer history before generating grid...');
      try {
        await getPrayerHistory();
        console.log('Prayer history fetched successfully');
        console.log('Prayer history store data:', {
          historyCount: $prayerHistoryStore.history?.length || 0,
          pendingDatesCount: Object.keys($prayerHistoryStore.pendingByDate || {}).length,
          missedDatesCount: Object.keys($prayerHistoryStore.missedByDate || {}).length
        });
      } catch (historyError) {
        console.error('Error fetching prayer history:', historyError);
        console.error('Will attempt to continue with existing data');
      }

      // Process each prayer
      console.log('Processing prayers...');
      for (const prayer of prayers) {
        const row = {
          name: prayer,
          icon: 'Sun',
          weight: 'regular',
          days: []
        };

        // Process each day
        for (const day of days) {
          let status = 'none';
          const prayerRecord = $prayerHistoryStore.history.find(
            h => h.date === day.date && h.prayerName === prayer
          );

          if (prayerRecord) {
            status = prayerRecord.status;
          } else if (day.date < todayStr) {
            // Past days without a record should be marked as missed
            // Only if on or after one day before account creation
            const prayerDate = new Date(day.date);
            const prayerDateLocal = new Date(prayerDate.toLocaleDateString()); // Reset to midnight in local timezone
            
            // Compare using local dates - use >= to include one day before account creation date
            if (prayerDateLocal.getTime() >= oneDayBeforeCreation.getTime()) {
              // Before marking as missed, check if this prayer exists in the database
              // with a status other than 'none' or 'pending'
              const prayerId = `${day.date}_${prayer}`;
              const prayerDocRef = doc(db, 'prayer_history', `${user.uid}_${prayerId}`);
              console.log(`Checking prayer document: ${prayerDocRef.path}`);
              
              try {
                const prayerDocSnap = await getDoc(prayerDocRef);
                console.log(`Prayer document exists: ${prayerDocSnap.exists()}`);
                
                if (prayerDocSnap.exists()) {
                  const dbPrayerData = prayerDocSnap.data();
                  console.log(`Prayer data:`, dbPrayerData);
                  
                  // If the prayer exists in the database with a final status, use that status
                  if (['ontime', 'late', 'excused'].includes(dbPrayerData.status)) {
                    console.log(`Found existing prayer ${prayer} for ${day.date} with status ${dbPrayerData.status}, using that instead of marking as missed`);
                    status = dbPrayerData.status;
                  } else {
                    console.log(`Marking ${prayer} as missed for ${day.date} (existing record with non-final status: ${dbPrayerData.status})`);
                    status = 'missed';
                    
                    // Add this prayer to the list to save to the database
                    const prayerTime = $prayerTimesStore.find(p => p.name === prayer)?.time || '00:00';
                    prayersToSave.push({
                      prayerName: prayer,
                      date: day.date,
                      status: 'missed',
                      time: prayerTime
                    });
                  }
                } else {
                  console.log(`Marking ${prayer} as missed for ${day.date} (no existing record found)`);
                  status = 'missed';
                  
                  // Add this prayer to the list to save to the database
                  const prayerTime = $prayerTimesStore.find(p => p.name === prayer)?.time || '00:00';
                  prayersToSave.push({
                    prayerName: prayer,
                    date: day.date,
                    status: 'missed',
                    time: prayerTime
                  });
                }
              } catch (prayerDocError) {
                console.error(`Error checking prayer document for ${prayer} on ${day.date}:`, prayerDocError);
                
                // Handle permission errors by creating a new prayer record
                if (prayerDocError.code === 'permission-denied') {
                  console.log(`Permission denied when checking ${prayer} on ${day.date}, marking as missed and will create new record`);
                  status = 'missed';
                  
                  // Add this prayer to the list to save to the database
                  const prayerTime = $prayerTimesStore.find(p => p.name === prayer)?.time || '00:00';
                  prayersToSave.push({
                    prayerName: prayer,
                    date: day.date,
                    status: 'missed',
                    time: prayerTime
                  });
                  
                  // Also trigger initialization of future prayer records
                  ensureFuturePrayerRecords().catch(error => {
                    console.error('Error ensuring future prayer records:', error);
                  });
                } else {
                  // Default to missed if we can't check the document for other reasons
                  status = 'missed';
                }
              }
            } else {
              console.log(`Skipping ${prayer} for ${day.date} (before one day prior to account creation: ${oneDayBeforeCreation.toLocaleDateString('en-CA')})`);
            }
          } else if (day.date === todayStr) {
            // For today, check if prayer time has passed
            const prayerTime = $prayerTimesStore.find(p => p.name === prayer)?.time;
            if (prayerTime) {
              const prayerDateTime = getPrayerDateTime(day.date, prayerTime);
              if (new Date() > prayerDateTime) {
                status = 'pending';
              }
            }
          }

          row.days.push({
            date: day.date,
            status,
            isToday: day.isToday,
            time: $prayerTimesStore.find(p => p.name === prayer)?.time || '00:00'
          });
        }
        grid.push(row);
      }

      // Save missed prayers to the database
      if (prayersToSave.length > 0) {
        console.log(`Saving ${prayersToSave.length} missed prayers to the database`);
        // Use Promise.all to save all prayers in parallel
        await Promise.all(prayersToSave.map(prayer => savePrayerStatus(prayer)));
        
        // After saving, refresh the prayer history to update the store
        await getPrayerHistory();
        
        // Update weekly stats after saving prayers
        updateWeeklyStats();
      }

      // Update cache with new data
      gridCache = {
        data: { days, grid, weeklyStats },
        timestamp: Date.now(),
        historyHash: currentHistoryHash,
        weekStartDate: currentWeekStart
      };
      
      // Save to localStorage for persistence
      saveCacheToStorage();

      return { days, grid, weeklyStats };
    } catch (error) {
      console.error('Error generating prayer grid:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      return {
        days: getCurrentWeekDays(),
        grid: [],
        weeklyStats: { ontime: 0, late: 0, missed: 0, excused: 0 }
      };
    }
  }

  onMount(() => {
    console.log('WeeklyPrayerHistory Mounted');
    
    // Wait for preload to complete
    preloadPromise.catch(error => {
      console.error('Error in preload promise:', error);
      // Error is already handled in preloadData
    });
    
    // Set up a timer to refresh the grid every minute to update future prayer status
    const refreshInterval = setInterval(() => {
      console.log('Periodic grid refresh to update future prayer status');
      updateGrid();
    }, 60000); // Check every minute
    
    return () => {
      clearInterval(refreshInterval);
    };
  });

  let isUpdating = false;
  async function updateGrid() {
    try {
      console.log('Updating prayer grid...');
      
      // Don't show loading indicator if we already have grid data
      const hasExistingData = weeklyGrid.length > 0;
      if (!hasExistingData) {
        isLoading = true;
        showingCachedData = false;
      }
      
      // Force a fresh fetch of prayer history if it's been more than 5 minutes
      const needsFreshData = !gridCache.timestamp || (Date.now() - gridCache.timestamp > 5 * 60 * 1000);
      
      if (needsFreshData) {
        console.log('Fetching fresh prayer history data');
        await getPrayerHistory();
        
        // Update weekly stats after refreshing prayer history
        updateWeeklyStats();
      }
      
      // Generate the grid
      const gridData = await generatePrayerGrid();
      
      // Update the grid and stats
      weeklyGrid = gridData.grid;
      weeklyStats = gridData.weeklyStats;
      
      // Save to cache
      gridCache = {
        data: gridData,
        timestamp: Date.now(),
        historyHash: getPrayerHistoryHash($prayerHistoryStore.history),
        weekStartDate: getWeekStartDate()
      };
      
      // Save cache to localStorage
      saveCacheToStorage();
      
      // Reset loading state
      isLoading = false;
      
      return gridData;
    } catch (error) {
      console.error('Error updating grid:', error);
      isLoading = false;
      throw error;
    }
  }

  // Add a function to force refresh the grid
  async function forceRefreshGrid() {
    try {
      console.log('Forcing grid refresh...');
      
      // Only show loading indicator if we don't have existing data
      if (weeklyGrid.length === 0) {
        isLoading = true;
        showingCachedData = false;
      }
      
      // Clear cache timestamp to force fresh data fetch
      if (gridCache) {
        gridCache.timestamp = null;
      }
      
      // Invalidate the prayer history cache to force a fresh fetch
      await invalidatePrayerHistoryCache();
      
      // Check if we need to initialize future prayer records
      await ensureFuturePrayerRecords();
      
      // Force fetch fresh prayer history
      await getPrayerHistory();
      
      // Update weekly stats after refreshing prayer history
      updateWeeklyStats();
      
      // Update the grid
      const result = await updateGrid();
      
      // Reset loading state
      isLoading = false;
      
      return result;
    } catch (error) {
      console.error('Error forcing grid refresh:', error);
      isLoading = false;
      throw error;
    }
  }

  // Add a reactive statement to update the grid when prayer history changes
  $: if ($prayerHistoryStore && $prayerHistoryStore.history) {
    const currentHash = getPrayerHistoryHash($prayerHistoryStore.history);
    if (gridCache && gridCache.historyHash !== currentHash) {
      console.log('Prayer history changed, updating grid');
      updateGrid().catch(error => {
        console.error('Error updating grid after history change:', error);
      });
    }
  }

  let updateTimeout;
  let lastUpdateTime = 0;
  const UPDATE_THROTTLE = 10000; // Increase throttle to 10 seconds for better performance

  $: if ($prayerHistoryStore.history) {
    const now = Date.now();
    if (now - lastUpdateTime >= UPDATE_THROTTLE) {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        updateGrid();
        lastUpdateTime = now;
      }, 100);
    }
  }

  onDestroy(() => {
    clearTimeout(updateTimeout);
    clearTimeout(tapTimeout); // Clear tap timeout to prevent memory leaks
  });

  // Add a function to handle manual refresh
  async function handleManualRefresh() {
    try {
      isLoading = true;
      showingCachedData = false; // Force showing loading indicator during manual refresh
      loadingError = null;
      
      // Invalidate cache and force refresh
      await invalidatePrayerHistoryCache();
      await forceRefreshGrid();
      
      isLoading = false;
    } catch (error) {
      console.error('Error during manual refresh:', error);
      loadingError = error.message || 'Failed to refresh prayer data';
      isLoading = false;
    }
  }

  // Function to update weekly stats
  function updateWeeklyStats() {
    // Reset stats
    weeklyStats = {
      ontime: 0,
      late: 0,
      missed: 0,
      excused: 0
    };

    // Get date range for current week
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    
    const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('en-CA');
    const todayStr = today.toLocaleDateString('en-CA');

    // Only count prayers that have been explicitly marked
    if ($prayerHistoryStore?.history) {
      $prayerHistoryStore.history.forEach(prayer => {
        if (prayer.date >= sevenDaysAgoStr && prayer.date <= todayStr) {
          if (prayer.status === 'ontime') weeklyStats.ontime++;
          else if (prayer.status === 'late') weeklyStats.late++;
          else if (prayer.status === 'missed') weeklyStats.missed++;
          else if (prayer.status === 'excused') weeklyStats.excused++;
        }
      });
    }
  }

  // Update stats whenever prayer history changes
  $: if ($prayerHistoryStore?.history) {
    updateWeeklyStats();
  }

  // Add this function after the preloadData function
  async function ensureFuturePrayerRecords() {
    try {
      console.log('Checking if future prayer records need to be initialized...');
      
      // Get the date range for the next 7 days
      const today = new Date();
      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(today.getDate() + 7);
      
      // Convert to string format for easier comparison
      const todayStr = today.toLocaleDateString('en-CA');
      const sevenDaysLaterStr = sevenDaysLater.toLocaleDateString('en-CA');
      
      console.log(`Checking prayer records from ${todayStr} to ${sevenDaysLaterStr}`);
      
      // Check if we have any prayer records for today
      const hasTodayRecords = $prayerHistoryStore.history.some(p => p.date === todayStr);
      
      if (!hasTodayRecords) {
        console.log('No prayer records found for today, initializing future prayers...');
        await initializeTodaysPrayers();
        
        // Refresh prayer history after initialization
        await invalidatePrayerHistoryCache();
        await getPrayerHistory();
        
        console.log('Future prayer records initialized successfully');
      } else {
        console.log('Prayer records for today already exist, no initialization needed');
      }
    } catch (error) {
      console.error('Error ensuring future prayer records:', error);
    }
  }
</script>

<div class="prayer-history">
  <div class="header">
    <h2>Weekly Prayer History</h2>
    <button class="refresh-button" on:click={handleManualRefresh} aria-label="Refresh prayer history">
      <ArrowClockwise size={18} weight="bold" />
    </button>
  </div>
  
  <div class="instructions">
    <p>Tap once to mark prayer as on time, double tap to mark as late. Only past prayers can be marked.</p>
  </div>
  
  <!-- Only show grid when not loading and no errors, or if we have cached data -->
  {#if (!isLoading && !loadingError) || (weeklyGrid.length > 0)}
    <div class="history-grid-container">
      <!-- Add loading overlay - only show when loading and not showing cached data -->
      {#if isLoading && !showingCachedData && weeklyGrid.length === 0}
        <div class="loading-overlay">
          <div class="loading-spinner"></div>
          <p>Loading prayer history...</p>
        </div>
      {/if}
      
      <div class="history-grid">
        <div class="header-row">
          <div class="prayer-label"></div>
          {#each weeklyGrid.length > 0 ? getCurrentWeekDays() : getCurrentWeekDays() as day}
            <div class="day-column {day.isToday ? 'today' : ''}">
              <span class="day-name">{day.dayName}</span>
              <span class="day-number">{day.dayNumber}</span>
            </div>
          {/each}
        </div>

        {#each weeklyGrid as row}
          <div class="prayer-row">
            <div class="prayer-label">
              <svelte:component this={iconMap[row.icon]} size={16} weight={row.weight} />
              <span>{row.name}</span>
            </div>
            {#each row.days as day}
              {@const isPending = $prayerHistoryStore.pendingByDate[day.date]?.prayers.some(p => p.prayerName === row.name)}
              {@const isDisabled = day.status === 'none' || day.status === 'excused'}
              {@const isToday = day.date === new Date().toLocaleDateString('en-CA')}
              {@const prayerTime = day.time || $prayerTimesStore.find(p => p.name === row.name)?.time || '00:00 AM'}
              {@const isFuturePrayer = isToday && isPrayerInFuture(day.date, prayerTime)}
              
              <!-- Force refresh of isFuturePrayer calculation on each render -->
              {@const now = new Date().getTime()}
              {@const canMark = (!isDisabled || (isToday && day.status === 'pending')) && !isFuturePrayer}
              
              <div 
                class="status-cell {!canMark ? 'disabled' : ''} {isFuturePrayer ? 'future-prayer' : ''}"
                on:click={() => handleTap({ name: row.name, time: prayerTime, status: day.status, timezoneOffset: new Date().getTimezoneOffset() }, day)}
                title={isFuturePrayer ? `${row.name} prayer hasn't occurred yet` : ''}
              >
                <div class="status-dot {day.status} {day.status === 'pending' && isPending ? 'has-notification' : ''} {isFuturePrayer ? 'future' : ''}"></div>
              </div>
            {/each}
          </div>
        {/each}
      </div>

      <div class="weekly-stats">
        <div class="stat">
          <span class="label">On Time</span>
          <span class="value ontime">{weeklyStats.ontime}</span>
        </div>
        <div class="stat">
          <span class="label">Late</span>
          <span class="value late">{weeklyStats.late}</span>
        </div>
        <div class="stat">
          <span class="label">Missed</span>
          <span class="value missed">{weeklyStats.missed}</span>
        </div>
        <div class="stat">
          <span class="label">Excused</span>
          <span class="value excused">{weeklyStats.excused}</span>
        </div>
      </div>
    </div>
  {/if}

  <!-- Add error state -->
  {#if loadingError && !isLoading && weeklyGrid.length === 0}
    <div class="error-container">
      <p class="error-message">{loadingError}</p>
      <button class="retry-button" on:click={retryLoading}>Retry</button>
    </div>
  {/if}
</div>

<style>
  .prayer-history {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    min-height: 300px; /* Ensure consistent height even when loading */
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #216974;
  }

  .refresh-button {
    background: transparent;
    border: none;
    color: #216974;
    padding: 8px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
  }
  
  .refresh-button:hover {
    background: rgba(33, 105, 116, 0.1);
  }
  
  .refresh-button:active {
    background: rgba(33, 105, 116, 0.2);
  }

  /* Add loading overlay styles */
  .history-grid-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 0.5rem;
    backdrop-filter: blur(2px);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #216974;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Add error styles */
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 1rem;
    text-align: center;
  }

  .error-message {
    color: #ef4444;
    font-weight: 500;
  }

  .retry-button {
    background-color: #216974;
    color: white;
    border: none;
    border-radius: 0.25rem;
    padding: 0.5rem 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .retry-button:hover {
    background-color: #184f57;
  }

  .history-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .header-row {
    display: grid;
    grid-template-columns: 100px repeat(7, 1fr);
    gap: 0.5rem;
  }

  .prayer-row {
    display: grid;
    grid-template-columns: 100px repeat(7, 1fr);
    gap: 0.5rem;
    align-items: center;
  }

  .prayer-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .day-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .day-column.today {
    color: #216974;
    font-weight: 600;
  }

  .day-name {
    font-size: 0.75rem;
    color: #666;
  }

  .day-number {
    font-size: 0.875rem;
  }

  .status-cell {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 2rem;
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .status-cell.disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .status-cell.future-prayer {
    cursor: not-allowed;
    background-color: rgba(240, 240, 240, 0.5);
    border-radius: 4px;
  }

  .status-cell:active {
    transform: scale(0.95);
  }

  .status-cell.disabled:active,
  .status-cell.future-prayer:active {
    transform: none;
  }

  .status-dot {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: #e0e0e0;
  }

  .status-dot.ontime {
    background: #216974;
  }

  .status-dot.late {
    background: #f59e0b;
  }

  .status-dot.missed {
    background: #ef4444;
  }

  .status-dot.excused {
    background: #94a3b8;
  }

  .status-dot.pending {
    background: #e0e0e0;
    border: 2px solid #216974;
    animation: blink 1.5s infinite;
  }

  .status-dot.has-notification {
    animation: pulse 2s infinite;
  }

  .status-dot.future {
    background: #f0f0f0;
    border: 1px dashed #a0a0a0;
    position: relative;
  }

  .status-dot.future::after {
    content: '⏱️';
    font-size: 0.5rem;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .weekly-stats {
    display: flex;
    justify-content: space-around;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 0.5rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .label {
    font-size: 0.875rem;
    color: #666;
  }

  .value {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .value.ontime {
    color: #216974;
  }

  .value.late {
    color: #f59e0b;
  }

  .value.missed {
    color: #ef4444;
  }

  .value.excused {
    color: #94a3b8;
  }

  .instructions {
    text-align: center;
    margin-bottom: 1rem;
    color: #666;
    font-size: 0.9rem;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes blink {
    0% { opacity: 1; }
    50% { opacity: 0.4; }
    100% { opacity: 1; }
  }

  @media (max-width: 640px) {
    .prayer-history {
      padding: 0.5rem;
    }

    .header-row,
    .prayer-row {
      grid-template-columns: 80px repeat(7, 1fr);
      gap: 0.25rem;
    }

    .prayer-label {
      font-size: 0.875rem;
    }

    .day-name {
      font-size: 0.75rem;
    }

    .day-number {
      font-size: 0.75rem;
    }

    .status-cell {
      height: 1.75rem;
    }

    .status-dot {
      width: 0.875rem;
      height: 0.875rem;
    }
  }
</style>
