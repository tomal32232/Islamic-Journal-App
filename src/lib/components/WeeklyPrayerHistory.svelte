<script>
  import { onMount, onDestroy } from 'svelte';
  import { 
    prayerHistoryStore, 
    getPrayerHistory, 
    getPrayerDateTime,
    shouldMarkPrayerExcused,
    savePrayerStatus 
  } from '../stores/prayerHistoryStore';
  import { prayerTimesStore, fetchPrayerTimes } from '../stores/prayerTimes';
  import { iconMap } from '../utils/icons';
  import { auth } from '../firebase';

  // Add loading and error states
  let isLoading = true;
  let loadingError = null;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  // Preload data as soon as the component is created
  let preloadPromise = preloadData();

  async function preloadData() {
    try {
      isLoading = true;
      loadingError = null;
      
      try {
        // Load cache from localStorage first
        loadCacheFromStorage();
      } catch (cacheError) {
        console.error('Error loading cache:', cacheError);
        // Continue with initialization even if cache loading fails
      }
      
      // If we have cached data, show it immediately while we fetch fresh data
      if (gridCache && gridCache.data && gridCache.data.grid && gridCache.data.grid.length > 0) {
        weeklyGrid = gridCache.data.grid;
        weeklyStats = gridCache.data.weeklyStats || { ontime: 0, late: 0, missed: 0, excused: 0 };
        // Keep loading state true to show overlay while we fetch fresh data
      }
      
      // Fetch prayer history and times in parallel if needed
      if (!$prayerHistoryStore.history || $prayerHistoryStore.history.length === 0) {
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
        });
      }
      
      // Generate grid with available data
      await updateGrid();
      
      isLoading = false;
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
      
      // Get the actual prayer time from the store
      const prayerTimeFromStore = $prayerTimesStore.find(p => p.name === prayer.name)?.time || '00:00 AM';
      const prayerTime = prayer.time || prayerTimeFromStore;
      
      // Check if prayer is in the future
      const isFuture = await isPrayerInFuture(day.date, prayerTime, prayer.timezoneOffset);
      console.log(`Checking if ${prayer.name} is in future:`, isFuture);
      
      // Don't allow marking future prayers
      if (isFuture) {
        console.log(`Cannot mark future prayer: ${prayer.name} on ${day.date}`);
        return;
      }
      
      // Check if prayer is excused
      const isExcused = await shouldMarkPrayerExcused(day.date, prayer.name);
      if (isExcused) {
        console.log(`Prayer ${prayer.name} on ${day.date} is excused`);
        return;
      }
      
      // Get the current status
      const currentStatus = prayer.status || 'none';
      
      // Determine the next status
      let nextStatus;
      if (currentStatus === 'none') {
        nextStatus = 'ontime';
      } else if (currentStatus === 'ontime') {
        nextStatus = 'late';
      } else if (currentStatus === 'late') {
        nextStatus = 'missed';
      } else if (currentStatus === 'missed') {
        nextStatus = 'none';
      } else {
        nextStatus = 'none';
      }
      
      // Save the prayer data
      const prayerData = {
        prayerName: prayer.name,
        date: day.date,
        status: nextStatus,
        time: prayerTime,
        timezoneOffset: prayer.timezoneOffset || new Date().getTimezoneOffset()
      };
      
      console.log('Saving prayer data:', prayerData);
      await savePrayerStatus(prayerData);
      
      // Update UI
      console.log(`Updating UI for prayer: ${prayer.name} on ${day.date} to ${nextStatus}, in current week: ${isCurrentWeek(day.date)}`);
      
      // Update the grid
      updateGrid();
      
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
    for (let i = 0; i < weeklyGrid.length; i++) {
      if (weeklyGrid[i].name === prayerName) {
        for (let j = 0; j < weeklyGrid[i].days.length; j++) {
          if (weeklyGrid[i].days[j].date === date) {
            // Get the old status before updating
            const oldStatus = weeklyGrid[i].days[j].status;
            
            // Update the status
            weeklyGrid[i].days[j].status = newStatus;
            
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
            
            // Force Svelte to recognize the change
            weeklyGrid = [...weeklyGrid];
            weeklyStats = {...weeklyStats};
            
            break;
          }
        }
        break;
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
      // Get current week start date
      const currentWeekStart = getWeekStartDate();
      
      // Check if we can use cached data
      const currentHistoryHash = getPrayerHistoryHash($prayerHistoryStore.history);
      
      // Improved caching: Check cache first before generating days
      if (gridCache.data && 
          gridCache.historyHash === currentHistoryHash && 
          gridCache.weekStartDate === currentWeekStart &&
          Date.now() - gridCache.timestamp < 30 * 60 * 1000) { // Cache valid for 30 minutes
        console.log('Using cached grid data');
        return gridCache.data;
      }
      
      console.log('Generating new grid data');
      
      const days = getCurrentWeekDays();
      const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      const grid = [];
      
      // Reset weekly stats
      weeklyStats = {
        ontime: 0,
        late: 0,
        missed: 0,
        excused: 0
      };

      // Get the date range for the last 7 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);
      
      // Convert to string format for easier comparison
      const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('en-CA');
      const todayStr = today.toLocaleDateString('en-CA');
      
      console.log(`Date range for stats: ${sevenDaysAgoStr} to ${todayStr}`);

      // Get user's account creation date
      const user = auth.currentUser;
      const accountCreationDateTime = user ? new Date(user.metadata.creationTime) : new Date();

      // Make sure we have prayer times
      if ($prayerTimesStore.length === 0) {
        console.log('No prayer times available, fetching...');
        try {
          await fetchPrayerTimes();
        } catch (error) {
          console.error('Error fetching prayer times:', error);
        }
      }

      // Log available prayer times for debugging
      console.log('Available prayer times:', JSON.stringify($prayerTimesStore));

      for (const prayer of prayers) {
        try {
          // Get the prayer time from the store
          const prayerTimeObj = $prayerTimesStore.find(p => p.name === prayer);
          const prayerTime = prayerTimeObj ? prayerTimeObj.time : '00:00 AM';
          
          console.log(`Using prayer time for ${prayer}: ${prayerTime}`);
          
          const row = {
            name: prayer,
            icon: prayerTimeObj?.icon || 'Sun',
            weight: prayerTimeObj?.weight || 'regular',
            days: []
          };

          for (const day of days) {
            try {
              let status = 'none'; // Default status
              const prayerDate = new Date(day.date);
              prayerDate.setHours(0, 0, 0, 0);
              const now = new Date();
              const todayStr = new Date().toLocaleDateString('en-CA');
              
              // Log the prayer time for debugging
              console.log(`Prayer time for ${prayer} on ${day.date}: ${prayerTime}`);
              
              let prayerDateTime;
              try {
                prayerDateTime = getPrayerDateTime(day.date, prayerTime);
                console.log(`Created prayer date time: ${prayerDateTime.toISOString()}`);
              } catch (dateTimeError) {
                console.error(`Error creating prayer date time for ${prayer} on ${day.date}:`, dateTimeError);
                prayerDateTime = new Date(); // Fallback to current time
              }
              
              // First check if we already have a record for this prayer
              const prayerRecord = $prayerHistoryStore.history.find(
                h => h.date === day.date && h.prayerName === prayer
              );

              if (prayerRecord) {
                // If we have a record, use its status
                status = prayerRecord.status;
                
                // Update weekly stats if this prayer is within the last 7 days
                if (day.date >= sevenDaysAgoStr && day.date <= todayStr) {
                  if (status === 'ontime') weeklyStats.ontime++;
                  else if (status === 'late') weeklyStats.late++;
                  else if (status === 'missed') weeklyStats.missed++;
                  else if (status === 'excused') weeklyStats.excused++;
                }
              } else {
                // No record exists, determine status based on date/time
                
                // Check if prayer should be excused
                let isExcused = false;
                try {
                  isExcused = await shouldMarkPrayerExcused(day.date, prayer);
                } catch (excusedError) {
                  console.error(`Error checking if prayer should be excused for ${prayer} on ${day.date}:`, excusedError);
                }
                
                if (isExcused) {
                  status = 'excused';
                  if (day.date >= sevenDaysAgoStr && day.date <= todayStr) {
                    weeklyStats.excused++;
                  }
                } 
                // Future date - always 'none'
                else if (isFutureDate(day.date)) {
                  status = 'none';
                  console.log(`Future prayer: ${prayer} on ${day.date} marked as ${status}`);
                }
                // Today's prayers
                else if (isToday(day.date)) {
                  // If prayer time is in the future, mark as 'none'
                  // Get timezone offset if available
                  const timezoneOffset = prayerRecord?.timezoneOffset || null;
                  
                  let isPrayerFuture = false;
                  try {
                    // Force a fresh check each time
                    isPrayerFuture = isPrayerInFuture(day.date, prayerTime, timezoneOffset);
                    console.log(`Grid generation: Is ${prayer} in future: ${isPrayerFuture}`);
                  } catch (futureError) {
                    console.error(`Error checking if prayer is in future for ${prayer} on ${day.date}:`, futureError);
                    // Default to false if there's an error
                    isPrayerFuture = false;
                  }
                  
                  if (isPrayerFuture) {
                    status = 'none';
                    console.log(`Today's upcoming prayer: ${prayer} at ${prayerTime} marked as ${status}`);
                  } 
                  // Also check if any earlier prayer today is still in the future
                  // If so, this prayer should also be marked as 'none' to maintain order
                  else {
                    const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
                    const currentPrayerIndex = prayerOrder.indexOf(prayer);
                    let earlierPrayerInFuture = false;
                    
                    // Check all prayers that come before this one
                    for (let i = 0; i < currentPrayerIndex; i++) {
                      const earlierPrayer = prayerOrder[i];
                      const earlierPrayerObj = $prayerTimesStore.find(p => p.name === earlierPrayer);
                      const earlierPrayerTime = earlierPrayerObj ? earlierPrayerObj.time : '00:00 AM';
                      
                      // If an earlier prayer is in the future, this one should be too
                      if (isPrayerInFuture(day.date, earlierPrayerTime, timezoneOffset)) {
                        earlierPrayerInFuture = true;
                        break;
                      }
                      
                      // Also check if earlier prayer is unmarked
                      const earlierPrayerRecord = $prayerHistoryStore.history.find(
                        h => h.date === day.date && h.prayerName === earlierPrayer
                      );
                      
                      // If an earlier prayer hasn't been marked yet, this one should be 'none' too
                      if (!earlierPrayerRecord || !['ontime', 'late', 'missed', 'excused'].includes(earlierPrayerRecord.status)) {
                        earlierPrayerInFuture = true;
                        break;
                      }
                    }
                    
                    if (earlierPrayerInFuture) {
                      status = 'none';
                      console.log(`Prayer ${prayer} marked as 'none' because an earlier prayer is still in the future or unmarked`);
                    }
                    // Prayer time has passed but not marked - pending
                    else {
                      status = 'pending';
                      console.log(`Today's passed prayer: ${prayer} at ${prayerTime} marked as ${status}`);
                      // Add to pending prayers list
                      if (!$prayerHistoryStore.pendingByDate[day.date]) {
                        $prayerHistoryStore.pendingByDate[day.date] = { prayers: [] };
                      }
                      if (!$prayerHistoryStore.pendingByDate[day.date].prayers.some(p => p.prayerName === prayer)) {
                        $prayerHistoryStore.pendingByDate[day.date].prayers.push({
                          prayerName: prayer,
                          time: prayerTime
                        });
                      }
                    }
                  }
                }
                // Past days' prayers
                else {
                  // Only mark as missed if the prayer was after account creation
                  if (prayerDateTime >= accountCreationDateTime) {
                    status = 'missed';
                    console.log(`Past prayer: ${prayer} on ${day.date} marked as ${status}`);
                    if (day.date >= sevenDaysAgoStr && day.date <= todayStr) {
                      weeklyStats.missed++;
                    }
                  } else {
                    status = 'none';
                    console.log(`Prayer before account creation: ${prayer} on ${day.date} marked as ${status}`);
                  }
                }
              }

              row.days.push({
                date: day.date,
                status,
                isToday: day.isToday,
                time: prayerTime // Store the prayer time with the day
              });
            } catch (dayError) {
              console.error(`Error processing day ${day.date} for prayer ${prayer}:`, dayError);
              // Add a placeholder day with error status
              row.days.push({
                date: day.date,
                status: 'none',
                isToday: day.isToday,
                hasError: true
              });
            }
          }
          grid.push(row);
        } catch (prayerError) {
          console.error(`Error processing prayer ${prayer}:`, prayerError);
          // Add a placeholder row for this prayer
          grid.push({
            name: prayer,
            icon: 'Sun',
            weight: 'regular',
            days: days.map(day => ({
              date: day.date,
              status: 'none',
              isToday: day.isToday,
              hasError: true
            }))
          });
        }
      }

      // Update cache with new data and week start date
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
      // Return a minimal valid structure in case of error
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
    if (isUpdating) return;
    isUpdating = true;
    
    try {
      if ($prayerHistoryStore.history) {
        // Check if we already have valid cached data before generating
        const currentWeekStart = getWeekStartDate();
        const currentHistoryHash = getPrayerHistoryHash($prayerHistoryStore.history);
        
        // Skip update if we already have valid cached data
        if (gridCache && 
            gridCache.data && 
            gridCache.historyHash === currentHistoryHash && 
            gridCache.weekStartDate === currentWeekStart &&
            Date.now() - gridCache.timestamp < 30 * 60 * 1000) {
          console.log('Using existing cached data for grid update');
          weeklyGrid = gridCache.data.grid;
          weeklyStats = gridCache.data.weeklyStats;
          return;
        }
        
        // Otherwise generate new grid data
        console.log('Generating new grid data in updateGrid');
        try {
          const gridData = await generatePrayerGrid();
          weeklyGrid = gridData.grid;
          weeklyStats = gridData.weeklyStats;
          console.log('Grid data generated successfully');
        } catch (gridError) {
          console.error('Error generating prayer grid:', gridError);
          loadingError = 'Failed to generate prayer grid. Please try again.';
          
          // Try to use cached data as fallback
          if (gridCache && gridCache.data) {
            console.log('Using cached data as fallback after grid generation error');
            weeklyGrid = gridCache.data.grid || [];
            weeklyStats = gridCache.data.weeklyStats || { ontime: 0, late: 0, missed: 0, excused: 0 };
          }
        }
      } else {
        console.log('No prayer history data available for grid update');
        loadingError = 'No prayer history data available';
      }
    } catch (error) {
      console.error('Error updating grid:', error);
      loadingError = 'Failed to update prayer grid';
      
      // Try to use cached data as fallback
      if (gridCache && gridCache.data) {
        console.log('Using cached data as fallback after update error');
        weeklyGrid = gridCache.data.grid || [];
        weeklyStats = gridCache.data.weeklyStats || { ontime: 0, late: 0, missed: 0, excused: 0 };
      }
    } finally {
      isUpdating = false;
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
  });
</script>

<div class="prayer-history">
  <div class="instructions">
    <p>Tap once to mark prayer as on time, double tap to mark as late. Only past prayers can be marked.</p>
  </div>
  
  <!-- Only show grid when not loading and no errors, or if we have cached data -->
  {#if (!isLoading && !loadingError) || (weeklyGrid.length > 0)}
    <div class="history-grid-container">
      <!-- Add loading overlay -->
      {#if isLoading}
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
