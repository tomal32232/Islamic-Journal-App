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
      
      // Load cache from localStorage first
      loadCacheFromStorage();
      
      // If we have cached data, show it immediately while we fetch fresh data
      if (gridCache.data && gridCache.data.grid && gridCache.data.grid.length > 0) {
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
        if (gridCache.data) {
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
    console.log('Tapped prayer:', prayer);
    console.log('Tapped day:', day);
    
    if (!day.date || day.status === 'none' || day.status === 'excused') return;
    
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    
    // Only allow tracking for today and past prayers
    if (day.date > todayStr) return;

    // Determine the new status based on single or double tap
    const newStatus = lastTappedCell === `${day.date}-${prayer.name}` ? 'late' : 'ontime';
    
    const prayerData = {
      prayerName: prayer.name,
      date: day.date,
      status: newStatus
    };
    console.log('Saving prayer data:', prayerData);

    // Update UI immediately
    updateUIForPrayer(prayer.name, day.date, newStatus);

    if (lastTappedCell === `${day.date}-${prayer.name}`) {
      // Double tap detected - mark as late
      clearTimeout(tapTimeout);
      lastTappedCell = null;
      // Save to database in the background
      savePrayerStatus(prayerData).catch(error => {
        console.error('Error saving prayer status:', error);
        // Revert UI if save fails
        updateUIForPrayer(prayer.name, day.date, day.status);
      });
    } else {
      // First tap - set timeout for potential double tap
      lastTappedCell = `${day.date}-${prayer.name}`;
      clearTimeout(tapTimeout);
      tapTimeout = setTimeout(async () => {
        // Single tap - mark as on time
        // Save to database in the background
        savePrayerStatus(prayerData).catch(error => {
          console.error('Error saving prayer status:', error);
          // Revert UI if save fails
          updateUIForPrayer(prayer.name, day.date, day.status);
        });
        lastTappedCell = null;
      }, 300); // 300ms window for double tap
    }
  }

  // Helper function to update UI immediately
  function updateUIForPrayer(prayerName, date, newStatus) {
    // Update the grid data in memory - use direct mutation for better performance
    for (let i = 0; i < weeklyGrid.length; i++) {
      if (weeklyGrid[i].name === prayerName) {
        for (let j = 0; j < weeklyGrid[i].days.length; j++) {
          if (weeklyGrid[i].days[j].date === date) {
            // Get the old status before updating
            const oldStatus = weeklyGrid[i].days[j].status;
            
            // Update the status
            weeklyGrid[i].days[j].status = newStatus;
            
            // Update weekly stats if needed
            if (oldStatus && weeklyStats[oldStatus] !== undefined) {
              weeklyStats[oldStatus]--;
            }
            
            if (weeklyStats[newStatus] !== undefined) {
              weeklyStats[newStatus]++;
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
        const parsedCache = JSON.parse(storedCache);
        // Extend cache validity to 2 hours for initial loads
        if (parsedCache && Date.now() - parsedCache.timestamp < 2 * 60 * 60 * 1000) {
          console.log('Loading grid cache from localStorage');
          gridCache = parsedCache;
          
          // Immediately populate the grid with cached data for faster rendering
          if (gridCache.data) {
            weeklyGrid = gridCache.data.grid || [];
            weeklyStats = gridCache.data.weeklyStats || { ontime: 0, late: 0, missed: 0, excused: 0 };
            // Still mark as loading until we verify the data
            isLoading = true;
          }
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
      if (gridCache.data && gridCache.data.grid && gridCache.data.grid.length > 0) {
        localStorage.setItem('weeklyGridCache', JSON.stringify(gridCache));
        console.log('Saved grid cache to localStorage');
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

  // Add a more robust function to check if a prayer is in the future
  function isPrayerInFuture(dateStr, timeStr, timezoneOffset = null) {
    try {
      if (!dateStr || !timeStr) {
        console.error('Missing date or time in isPrayerInFuture:', { dateStr, timeStr });
        return false;
      }
      
      const now = new Date();
      
      try {
        const prayerDateTime = getPrayerDateTime(dateStr, timeStr, timezoneOffset);
        
        // Add debug logging
        console.log(`isPrayerInFuture: Date=${dateStr}, Time=${timeStr}, TZ Offset=${timezoneOffset}`);
        console.log(`Comparing prayer time: ${prayerDateTime.toISOString()} with current time: ${now.toISOString()}`);
        console.log(`Is prayer in future: ${prayerDateTime > now}`);
        
        return prayerDateTime > now;
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

      // Get user's account creation date
      const user = auth.currentUser;
      const accountCreationDateTime = user ? new Date(user.metadata.creationTime) : new Date();

      for (const prayer of prayers) {
        try {
          const row = {
            name: prayer,
            icon: $prayerTimesStore.find(p => p.name === prayer)?.icon || 'Sun',
            weight: $prayerTimesStore.find(p => p.name === prayer)?.weight || 'regular',
            days: []
          };

          for (const day of days) {
            try {
              let status = 'none'; // Default status
              const prayerDate = new Date(day.date);
              prayerDate.setHours(0, 0, 0, 0);
              const now = new Date();
              const todayStr = new Date().toLocaleDateString('en-CA');
              const prayerTime = $prayerTimesStore.find(p => p.name === prayer)?.time || '00:00 AM';
              
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
                if (prayerDate >= sevenDaysAgo && prayerDate <= today) {
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
                  if (prayerDate >= sevenDaysAgo && prayerDate <= today) {
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
                    isPrayerFuture = isPrayerInFuture(day.date, prayerTime, timezoneOffset);
                  } catch (futureError) {
                    console.error(`Error checking if prayer is in future for ${prayer} on ${day.date}:`, futureError);
                    // Default to false if there's an error
                    isPrayerFuture = false;
                  }
                  
                  if (isPrayerFuture) {
                    status = 'none';
                    console.log(`Today's upcoming prayer: ${prayer} at ${prayerTime} marked as ${status}`);
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
                // Past days' prayers
                else {
                  // Only mark as missed if the prayer was after account creation
                  if (prayerDateTime >= accountCreationDateTime) {
                    status = 'missed';
                    console.log(`Past prayer: ${prayer} on ${day.date} marked as ${status}`);
                    if (prayerDate >= sevenDaysAgo) {
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
                isToday: day.isToday
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

  onMount(async () => {
    console.log('WeeklyPrayerHistory Mounted');
    
    // Wait for preload to complete
    try {
      await preloadPromise;
    } catch (error) {
      console.error('Error in preload promise:', error);
      // Error is already handled in preloadData
    }
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
        if (gridCache.data && 
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
          if (gridCache.data) {
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
      if (gridCache.data) {
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
    <p>Tap once to mark prayer as on time, double tap to mark as late</p>
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
              <div 
                class="status-cell"
                on:click={() => handleTap({ name: row.name }, day)}
              >
                <div class="status-dot {day.status} {day.status === 'pending' && isPending ? 'has-notification' : ''}"></div>
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

  .status-cell:active {
    transform: scale(0.95);
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
