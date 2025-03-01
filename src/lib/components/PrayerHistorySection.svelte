<script>
  import { prayerHistoryStore, getPrayerHistory, updatePrayerStatuses } from '../stores/prayerHistoryStore';
  import { iconMap } from '../utils/icons';
  import { onMount } from 'svelte';
  import { ArrowClockwise } from 'phosphor-svelte';
  
  let selectedFilter = '7'; // Default to 7 days
  let isRefreshing = false;
  let previousFilter = '7';
  
  $: {
    // If the filter changes, refresh the prayer history
    if (selectedFilter !== previousFilter) {
      console.log(`Filter changed from ${previousFilter} to ${selectedFilter}, refreshing prayer history`);
      previousFilter = selectedFilter;
      refreshPrayerHistory();
    }
  }
  
  $: filteredHistory = filterPrayerHistory($prayerHistoryStore.history, selectedFilter);
  $: groupedHistory = groupHistoryByDate(filteredHistory);
  $: summary = calculateSummary(filteredHistory);
  $: prayerPatterns = analyzePrayerPatterns(filteredHistory);

  // Refresh prayer history data when the component is mounted
  onMount(async () => {
    console.log('PrayerHistorySection mounted, refreshing prayer history data');
    await refreshPrayerHistory();
    
    // After refreshing, check today's prayers directly from the store
    checkTodaysPrayers();
  });
  
  async function refreshPrayerHistory() {
    if (isRefreshing) return;
    
    isRefreshing = true;
    try {
      console.log('Starting prayer history refresh...');
      
      // First update prayer statuses to ensure today's prayers are properly marked
      console.log('Updating prayer statuses...');
      await updatePrayerStatuses();
      
      // Clear the cache to force a fresh fetch
      console.log('Clearing prayer history cache...');
      prayerHistoryStore.update(store => {
        console.log('Forcing prayer history refresh');
        // Force a complete refresh by clearing the history
        return { 
          ...store,
          history: [] // Clear the history to force a complete refresh
        };
      });
      
      // Then fetch fresh data
      console.log('Fetching fresh prayer history data...');
      await getPrayerHistory();
      
      // After fetching, check today's prayers directly
      checkTodaysPrayers();
      
      console.log('Prayer history refresh complete');
    } catch (error) {
      console.error('Error refreshing prayer history:', error);
    } finally {
      isRefreshing = false;
    }
  }

  // Function to check today's prayers directly from the store
  function checkTodaysPrayers() {
    const today = new Date().toISOString().split('T')[0];
    const todaysPrayers = $prayerHistoryStore.history.filter(prayer => prayer.date === today);
    
    console.log('DIRECT CHECK - Today\'s prayers from store:', 
      todaysPrayers.map(p => `${p.prayerName}: ${p.status} (${p.time || 'no time'})`));
    
    // Check if we have any non-upcoming prayers for today
    const nonUpcomingPrayers = todaysPrayers.filter(p => p.status !== 'upcoming' && p.status !== 'none');
    console.log('DIRECT CHECK - Non-upcoming prayers for today:', 
      nonUpcomingPrayers.map(p => `${p.prayerName}: ${p.status}`));
    
    // If we have non-upcoming prayers but they're not showing correctly, force a refresh
    if (nonUpcomingPrayers.length > 0) {
      console.log('Found non-upcoming prayers for today, checking if they\'re displayed correctly');
      
      // Check the grouped history to see if today's prayers are displayed correctly
      const todayInGrouped = groupedHistory.find(day => day.date === today);
      if (todayInGrouped) {
        console.log('Today\'s prayers in grouped history:', todayInGrouped.prayers);
        
        // Check if any non-upcoming prayers are not displayed correctly
        let needsRefresh = false;
        nonUpcomingPrayers.forEach(prayer => {
          const displayedStatus = todayInGrouped.prayers[prayer.prayerName];
          if (displayedStatus !== prayer.status) {
            console.log(`Prayer ${prayer.prayerName} has status ${prayer.status} but is displayed as ${displayedStatus}`);
            needsRefresh = true;
          }
        });
        
        if (needsRefresh) {
          console.log('Detected inconsistency in displayed prayer statuses, forcing UI update');
          // Force a UI update by updating the store
          prayerHistoryStore.update(store => ({ ...store }));
        }
      }
    }
    
    // Also check for prayers with status 'none' that should be updated
    const nonePrayers = todaysPrayers.filter(p => p.status === 'none');
    if (nonePrayers.length > 0) {
      console.log('Found prayers with status "none" for today, these should be updated:', 
        nonePrayers.map(p => `${p.prayerName}: ${p.time || 'no time'}`));
      
      // Force an update of prayer statuses
      updatePrayerStatuses().then(() => {
        console.log('Forced update of prayer statuses for prayers with status "none"');
        // Refresh the UI after updating
        prayerHistoryStore.update(store => ({ ...store }));
      });
    }
  }

  function filterPrayerHistory(history, days) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const filterDate = new Date(today);
    filterDate.setDate(filterDate.getDate() - parseInt(days));
    filterDate.setHours(0, 0, 0, 0);
    
    // Format today's date in the same format as prayer.date (YYYY-MM-DD)
    const todayFormatted = today.toISOString().split('T')[0];
    
    // First, get all prayers within the date range
    return history
      .filter(prayer => {
        const prayerDate = new Date(prayer.date);
        return prayerDate >= filterDate && prayerDate <= today;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
  }

  function groupHistoryByDate(history) {
    const groups = {};
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    console.log('Today\'s date:', today);
    console.log('Current time:', now.toISOString());
    console.log('All prayers in history:', history.map(p => `${p.date} ${p.prayerName}: ${p.status} (${p.time || 'no time'})`));
    
    // Get today's prayers for debugging
    const todaysPrayers = history.filter(prayer => prayer.date === today);
    console.log('Today\'s prayers from history:', todaysPrayers.map(p => `${p.prayerName}: ${p.status} (${p.time || 'no time'})`));
    
    // First, process all prayers from history to ensure we capture all statuses
    history.forEach(prayer => {
      if (!groups[prayer.date]) {
        groups[prayer.date] = {
          date: prayer.date,
          prayers: {
            Fajr: null,
            Dhuhr: null,
            Asr: null,
            Maghrib: null,
            Isha: null
          }
        };
      }
      
      // Always update the prayer status regardless of whether it's null
      // This ensures we capture all statuses
      groups[prayer.date].prayers[prayer.prayerName] = prayer.status;
    });
    
    // Make sure today exists in the groups
    if (!groups[today]) {
      groups[today] = {
        date: today,
        prayers: {
          Fajr: null,
          Dhuhr: null,
          Asr: null,
          Maghrib: null,
          Isha: null
        }
      };
    }
    
    // Log the prayer statuses for today
    console.log('Today\'s prayer statuses after initial processing:', groups[today].prayers);
    
    // For today's prayers, make sure we're showing the correct status
    // Look for any prayers with today's date in the original history
    if (groups[today]) {
      // Update the status for each prayer found
      todaysPrayers.forEach(prayer => {
        console.log(`Processing today's prayer: ${prayer.prayerName}, status: ${prayer.status}, time: ${prayer.time || 'no time'}`);
        
        // Always update the status, even if it's null
        groups[today].prayers[prayer.prayerName] = prayer.status;
        
        // Special handling for upcoming prayers
        if (prayer.status === 'upcoming' || prayer.status === 'none') {
          const prayerTime = prayer.time;
          if (prayerTime) {
            try {
              const prayerDateTime = getPrayerDateTime(prayer.date, prayerTime);
              console.log(`Prayer ${prayer.prayerName} time: ${prayerTime}, datetime: ${prayerDateTime.toISOString()}, now: ${now.toISOString()}`);
              
              if (prayerDateTime < now) {
                // Prayer time has passed, show as pending
                console.log(`Prayer ${prayer.prayerName} time has passed, marking as pending`);
                groups[today].prayers[prayer.prayerName] = 'pending';
              } else {
                // Prayer time is still in the future
                console.log(`Prayer ${prayer.prayerName} time is in the future, keeping as upcoming`);
                groups[today].prayers[prayer.prayerName] = 'upcoming';
              }
            } catch (error) {
              console.error(`Error processing prayer time for ${prayer.prayerName}:`, error);
              // Default to pending if we can't determine the time
              groups[today].prayers[prayer.prayerName] = 'pending';
            }
          } else {
            // No time available, default to pending for today's prayers
            console.log(`No time available for ${prayer.prayerName}, defaulting to pending`);
            groups[today].prayers[prayer.prayerName] = 'pending';
          }
        }
      });
      
      // Log today's prayers for debugging
      console.log('Final today\'s prayer statuses:', groups[today].prayers);
    }
    
    return Object.values(groups);
  }
  
  // Helper function to convert prayer time to Date object
  function getPrayerDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return new Date();
    
    // Handle invalid time "00:00 AM" which appears in the logs
    if (timeStr === "00:00 AM") {
      console.log(`Detected invalid prayer time: ${timeStr}, using default time`);
      // For invalid times, use a reasonable default time for each prayer
      const date = new Date(dateStr);
      // Return the date at noon as a reasonable default
      date.setHours(12, 0, 0, 0);
      return date;
    }
    
    // Handle 12-hour format (e.g., "6:30 AM" or "7:45 PM")
    let hours = 0;
    let minutes = 0;
    
    const timeParts = timeStr.split(' ');
    if (timeParts.length === 2) {
      const [time, period] = timeParts;
      const [h, m] = time.split(':');
      
      hours = parseInt(h);
      minutes = parseInt(m);
      
      // Convert to 24-hour format
      if (period === 'PM' && hours < 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }
    } else {
      // Handle 24-hour format
      const [h, m] = timeStr.split(':');
      hours = parseInt(h);
      minutes = parseInt(m);
    }
    
    // Validate hours and minutes
    if (isNaN(hours) || hours < 0 || hours > 23) {
      console.error(`Invalid hours in time: ${timeStr}`);
      hours = 12; // Default to noon
    }
    
    if (isNaN(minutes) || minutes < 0 || minutes > 59) {
      console.error(`Invalid minutes in time: ${timeStr}`);
      minutes = 0;
    }
    
    const date = new Date(dateStr);
    date.setHours(hours, minutes, 0, 0);
    
    return date;
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric'
    });
  }

  function calculateSummary(history) {
    // Filter out upcoming prayers for the summary calculation
    const completedHistory = history.filter(p => p.status !== 'upcoming');
    
    const total = completedHistory.length;
    const ontime = completedHistory.filter(p => p.status === 'ontime').length;
    const late = completedHistory.filter(p => p.status === 'late').length;
    const missed = completedHistory.filter(p => p.status === 'missed').length;
    const pending = completedHistory.filter(p => p.status === 'pending').length;

    return {
      total,
      ontime,
      late,
      missed,
      pending,
      ontimePercentage: total ? Math.round((ontime / total) * 100) : 0,
      latePercentage: total ? Math.round((late / total) * 100) : 0,
      missedPercentage: total ? Math.round((missed / total) * 100) : 0
    };
  }

  function analyzePrayerPatterns(history) {
    // Filter out upcoming prayers for pattern analysis
    const completedHistory = history.filter(p => p.status !== 'upcoming');
    
    const patterns = {
      missed: {},
      late: {}
    };

    // Initialize counters
    prayers.forEach(prayer => {
      patterns.missed[prayer] = 0;
      patterns.late[prayer] = 0;
    });

    // Count missed and late prayers
    completedHistory.forEach(prayer => {
      if (prayer.status === 'missed') {
        patterns.missed[prayer.prayerName]++;
      } else if (prayer.status === 'late') {
        patterns.late[prayer.prayerName]++;
      }
    });

    // Sort prayers by frequency
    const missedSorted = Object.entries(patterns.missed)
      .sort(([,a], [,b]) => b - a)
      .filter(([,count]) => count > 0)
      .slice(0, 2);
    
    const lateSorted = Object.entries(patterns.late)
      .sort(([,a], [,b]) => b - a)
      .filter(([,count]) => count > 0)
      .slice(0, 2);

    return {
      mostMissed: missedSorted,
      mostLate: lateSorted
    };
  }

  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
</script>

<div class="prayer-history-section">
  <div class="header">
    <h2>Prayer History</h2>
    <div class="header-actions">
      <select 
        bind:value={selectedFilter}
        class="filter-select"
      >
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
      </select>
      <button 
        on:click={refreshPrayerHistory}
        class="refresh-button"
        disabled={isRefreshing}
        title="Refresh prayer history"
      >
        <ArrowClockwise size={18} class={isRefreshing ? 'spinning' : ''} />
      </button>
      <button 
        on:click={checkTodaysPrayers}
        class="check-button"
        title="Check today's prayers"
      >
        Check Today
      </button>
    </div>
  </div>

  {#if filteredHistory.length === 0}
    <div class="empty-state">
      <p>No prayer records found for the selected period</p>
    </div>
  {:else}
    <div class="history-grid">
      <div class="grid-header">
        <div class="date-cell">Date</div>
        {#each prayers as prayer}
          <div class="prayer-header">{prayer}</div>
        {/each}
      </div>
      
      {#each groupedHistory as day}
        <div class="grid-row">
          <div class="date-cell">{formatDate(day.date)}</div>
          {#each prayers as prayer}
            {@const status = day.prayers[prayer]}
            <div 
              class="status-cell {status || 'pending'}"
              title="{prayer}: {status || 'pending'}"
            >
              <div class="status-dot"></div>
            </div>
          {/each}
        </div>
      {/each}
    </div>

    <div class="legend">
      <div class="legend-item">
        <div class="legend-dot ontime"></div>
        <span>On Time</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot late"></div>
        <span>Late</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot missed"></div>
        <span>Missed</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot upcoming"></div>
        <span>Upcoming</span>
      </div>
    </div>

    <div class="summary-section">
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-value">{summary.total}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat-item ontime">
          <span class="stat-value">{summary.ontime}</span>
          <span class="stat-label">On Time</span>
          <span class="stat-percentage">({summary.ontimePercentage}%)</span>
        </div>
        <div class="stat-item late">
          <span class="stat-value">{summary.late}</span>
          <span class="stat-label">Late</span>
          <span class="stat-percentage">({summary.latePercentage}%)</span>
        </div>
        <div class="stat-item missed">
          <span class="stat-value">{summary.missed}</span>
          <span class="stat-label">Missed</span>
          <span class="stat-percentage">({summary.missedPercentage}%)</span>
        </div>
      </div>

      <div class="patterns-section">
        {#if prayerPatterns.mostMissed.length > 0}
          <div class="pattern-item">
            <span class="pattern-label">Most Missed:</span>
            <div class="pattern-prayers">
              {#each prayerPatterns.mostMissed as [prayer, count]}
                <span class="prayer-stat missed">
                  {prayer} ({count} times)
                </span>
              {/each}
            </div>
          </div>
        {/if}

        {#if prayerPatterns.mostLate.length > 0}
          <div class="pattern-item">
            <span class="pattern-label">Most Late:</span>
            <div class="pattern-prayers">
              {#each prayerPatterns.mostLate as [prayer, count]}
                <span class="prayer-stat late">
                  {prayer} ({count} times)
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .prayer-history-section {
    margin-top: 1rem;
    padding: 1rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  h2 {
    font-size: 1.125rem;
    color: #216974;
    font-weight: 500;
  }

  .filter-select {
    padding: 0.375rem;
    border: 1px solid #eee;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #216974;
    background: white;
    cursor: pointer;
  }

  .history-grid {
    border: 1px solid #eee;
    border-radius: 8px;
    overflow: hidden;
  }

  .grid-header {
    display: grid;
    grid-template-columns: 80px repeat(5, 1fr);
    background: #f8f8f8;
    border-bottom: 1px solid #eee;
  }

  .grid-row {
    display: grid;
    grid-template-columns: 80px repeat(5, 1fr);
    border-bottom: 1px solid #eee;
  }

  .grid-row:last-child {
    border-bottom: none;
  }

  .date-cell {
    padding: 0.75rem 0.5rem;
    font-size: 0.75rem;
    color: #666;
    display: flex;
    align-items: center;
    border-right: 1px solid #eee;
  }

  .prayer-header {
    padding: 0.75rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #216974;
    text-align: center;
    border-right: 1px solid #eee;
  }

  .prayer-header:last-child,
  .status-cell:last-child {
    border-right: none;
  }

  .status-cell {
    padding: 0.75rem 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid #eee;
  }

  .status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }

  .status-cell.ontime .status-dot {
    background: #216974;
  }

  .status-cell.late .status-dot {
    background: #E09453;
  }

  .status-cell.missed .status-dot {
    background: #EF4444;
  }

  .status-cell.pending .status-dot {
    background: #eee;
  }

  .status-cell.upcoming .status-dot {
    background: #90CAF9; /* Light blue color for upcoming prayers */
  }

  .legend {
    display: flex;
    gap: 1rem;
    padding-top: 0.75rem;
    justify-content: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #666;
  }

  .legend-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }

  .legend-dot.ontime {
    background: #216974;
  }

  .legend-dot.late {
    background: #E09453;
  }

  .legend-dot.missed {
    background: #EF4444;
  }

  .legend-dot.upcoming {
    background: #90CAF9;
  }

  .empty-state {
    text-align: center;
    padding: 1rem;
    color: #666;
    background: #f8f8f8;
    border-radius: 8px;
    font-size: 0.875rem;
  }

  .summary-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }

  .summary-stats {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    padding: 0.5rem;
    background: #f8f8f8;
    border-radius: 8px;
  }

  .stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem;
    border-radius: 6px;
    background: white;
  }

  .stat-item.ontime {
    color: #216974;
  }

  .stat-item.late {
    color: #E09453;
  }

  .stat-item.missed {
    color: #EF4444;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #666;
    white-space: nowrap;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .stat-percentage {
    font-size: 0.625rem;
    color: #666;
  }

  .patterns-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .pattern-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .pattern-label {
    font-size: 0.875rem;
    color: #666;
    font-weight: 500;
  }

  .pattern-prayers {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .prayer-stat {
    font-size: 0.875rem;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-weight: 500;
  }

  .prayer-stat.missed {
    background: rgba(239, 68, 68, 0.1);
    color: #EF4444;
  }

  .prayer-stat.late {
    background: rgba(224, 148, 83, 0.1);
    color: #E09453;
  }

  .prayer-stat.upcoming {
    background: rgba(144, 202, 249, 0.1);
    color: #1976D2;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .refresh-button {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #216974;
    border-radius: 4px;
  }

  .refresh-button:hover {
    background: rgba(33, 105, 116, 0.1);
  }

  .refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 640px) {
    .prayer-history-section {
      padding: 0.75rem;
    }

    h2 {
      font-size: 1rem;
    }

    .grid-header,
    .grid-row {
      grid-template-columns: 60px repeat(5, 1fr);
    }

    .date-cell,
    .prayer-header {
      padding: 0.5rem 0.25rem;
      font-size: 0.625rem;
    }

    .status-cell {
      padding: 0.5rem 0.25rem;
    }

    .status-dot,
    .legend-dot {
      width: 0.375rem;
      height: 0.375rem;
    }

    .summary-stats {
      padding: 0.25rem;
      gap: 0.25rem;
      margin-bottom: 1rem;
    }

    .stat-item {
      padding: 0.25rem;
    }

    .stat-value {
      font-size: 0.875rem;
    }

    .stat-label {
      font-size: 0.625rem;
    }

    .stat-percentage {
      font-size: 0.5rem;
    }

    .pattern-item {
      font-size: 0.75rem;
    }

    .prayer-stat {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
    }
  }

  .check-button {
    background: #f0f9fa;
    border: 1px solid #216974;
    color: #216974;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .check-button:hover {
    background: #e0f2f4;
  }
</style> 