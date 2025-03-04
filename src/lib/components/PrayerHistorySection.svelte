<script>
  import { onMount } from 'svelte';
  import { prayerHistoryStore, getPrayerHistory, invalidatePrayerHistoryCache } from '../stores/prayerHistoryStore';
  import { Calendar, Clock, Check, ArrowClockwise } from 'phosphor-svelte';

  let filterDays = 7;
  let filteredHistory = [];
  let isLoading = true;
  let isRefreshing = false;
  let prayerStats = { onTime: 0, late: 0, missed: 0, total: 0 };

  // Filter prayers based on selected days
  function filterPrayers() {
    if (!$prayerHistoryStore?.history) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day
    
    const filterDate = new Date(today);
    filterDate.setDate(today.getDate() - filterDays);
    filterDate.setHours(0, 0, 0, 0); // Set to start of day
    
    return $prayerHistoryStore.history
      .filter(prayer => {
        // Create date object with the correct timezone handling
        const prayerDate = new Date(prayer.date + 'T00:00:00');
        // Only include prayers from the past up to today (exclude future dates)
        return prayerDate >= filterDate && prayerDate <= today;
      })
      .sort((a, b) => {
        // Sort by date (newest first) and then by prayer order
        const dateA = new Date(a.date + 'T00:00:00');
        const dateB = new Date(b.date + 'T00:00:00');
        
        if (dateB.getTime() !== dateA.getTime()) {
          return dateB.getTime() - dateA.getTime();
        }
        
        // Prayer order: Fajr, Dhuhr, Asr, Maghrib, Isha
        const prayerOrder = { 'Fajr': 0, 'Dhuhr': 1, 'Asr': 2, 'Maghrib': 3, 'Isha': 4 };
        return prayerOrder[a.prayerName] - prayerOrder[b.prayerName];
      });
  }

  // Calculate prayer statistics based on filtered history
  function calculatePrayerStats(prayers) {
    const stats = {
      onTime: 0,
      late: 0,
      missed: 0,
      total: 0,
      onTimePercent: 0,
      latePercent: 0,
      missedPercent: 0
    };

    prayers.forEach(prayer => {
      if (prayer.status === 'ontime') {
        stats.onTime++;
      } else if (prayer.status === 'late') {
        stats.late++;
      } else if (prayer.status === 'missed') {
        stats.missed++;
      }
    });

    stats.total = stats.onTime + stats.late + stats.missed;
    
    // Calculate percentages
    if (stats.total > 0) {
      stats.onTimePercent = Math.round((stats.onTime / stats.total) * 100);
      stats.latePercent = Math.round((stats.late / stats.total) * 100);
      stats.missedPercent = Math.round((stats.missed / stats.total) * 100);
    }
    
    return stats;
  }

  // Update filtered history when filter days or prayer history changes
  $: {
    if ($prayerHistoryStore?.history) {
      filteredHistory = filterPrayers();
      prayerStats = calculatePrayerStats(filteredHistory);
      isLoading = false;
      isRefreshing = false;
    }
  }

  // Format date to display in a readable format
  function formatDate(dateStr) {
    // Create date object with the correct timezone handling
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0); // Set to start of day for comparison
    
    // Compare dates by converting to date string to avoid time issues
    const dateString = date.toDateString();
    const todayString = today.toDateString();
    const yesterdayString = yesterday.toDateString();
    
    if (dateString === todayString) {
      return 'Today';
    } else if (dateString === yesterdayString) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  }

  // Group prayers by date
  function groupByDate(prayers) {
    const grouped = {};
    
    prayers.forEach(prayer => {
      if (!grouped[prayer.date]) {
        grouped[prayer.date] = [];
      }
      grouped[prayer.date].push(prayer);
    });
    
    return Object.entries(grouped).map(([date, prayers]) => ({
      date,
      formattedDate: formatDate(date),
      prayers
    })).sort((a, b) => {
      const dateA = new Date(a.date + 'T00:00:00');
      const dateB = new Date(b.date + 'T00:00:00');
      return dateB.getTime() - dateA.getTime();
    });
  }

  // Get status icon and color
  function getStatusInfo(status) {
    switch(status) {
      case 'ontime':
        return { icon: Check, color: '#4CAF50', text: 'On Time' };
      case 'late':
        return { icon: Clock, color: '#E09453', text: 'Late' };
      case 'missed':
        return { icon: Clock, color: '#F44336', text: 'Missed' };
      default:
        return { icon: Clock, color: '#9E9E9E', text: 'Not Marked' };
    }
  }

  // Refresh prayer history
  async function refreshPrayerHistory() {
    isRefreshing = true;
    
    try {
      // Force a complete refresh by invalidating the cache
      invalidatePrayerHistoryCache();
      
      // Force a fresh fetch of prayer history
      await getPrayerHistory();
      
      // Force UI update
      filteredHistory = filterPrayers();
    } catch (error) {
      console.error('Error refreshing prayer history:', error);
    } finally {
      isRefreshing = false;
    }
  }

  // Load prayer history on mount
  onMount(async () => {
    isLoading = true;
    try {
      // Invalidate cache to ensure we get fresh data
      invalidatePrayerHistoryCache();
      await getPrayerHistory();
    } catch (error) {
      console.error('Error loading prayer history:', error);
    } finally {
      isLoading = false;
    }
  });

  // Get grouped prayers
  $: groupedPrayers = groupByDate(filteredHistory);
</script>

<div class="prayer-history-section">
  <div class="prayer-history-card">
    <div class="header">
      <h2>Prayer History</h2>
      <div class="actions">
        <button 
          class="refresh-button" 
          on:click={refreshPrayerHistory}
          disabled={isRefreshing}
          title="Refresh prayer history"
        >
          <div class:spinning={isRefreshing}>
            <ArrowClockwise size={16} weight="bold" />
          </div>
        </button>
        <div class="filter-buttons">
          <button 
            class="filter-button {filterDays === 7 ? 'active' : ''}" 
            on:click={() => filterDays = 7}
          >
            Last 7 days
          </button>
          <button 
            class="filter-button {filterDays === 30 ? 'active' : ''}" 
            on:click={() => filterDays = 30}
          >
            Last 30 days
          </button>
        </div>
      </div>
    </div>

    {#if isLoading}
      <div class="loading">Loading prayer history...</div>
    {:else if groupedPrayers.length === 0}
      <div class="empty-state">
        <Calendar size={48} weight="thin" />
        <p>No prayer history found for the selected period.</p>
      </div>
    {:else}
      <!-- Prayer Summary Section -->
      <div class="prayer-summary">
        <div class="summary-title">Summary for last {filterDays} days</div>
        <div class="summary-stats">
          <div class="stat-item">
            <div class="stat-value on-time">{prayerStats.onTime}</div>
            <div class="stat-label">On Time</div>
            {#if prayerStats.total > 0}
              <div class="stat-percent">{prayerStats.onTimePercent}%</div>
            {/if}
          </div>
          <div class="stat-item">
            <div class="stat-value late">{prayerStats.late}</div>
            <div class="stat-label">Late</div>
            {#if prayerStats.total > 0}
              <div class="stat-percent">{prayerStats.latePercent}%</div>
            {/if}
          </div>
          <div class="stat-item">
            <div class="stat-value missed">{prayerStats.missed}</div>
            <div class="stat-label">Missed</div>
            {#if prayerStats.total > 0}
              <div class="stat-percent">{prayerStats.missedPercent}%</div>
            {/if}
          </div>
          <div class="stat-item">
            <div class="stat-value total">{prayerStats.total}</div>
            <div class="stat-label">Total</div>
          </div>
        </div>
        
        {#if prayerStats.total > 0}
          <div class="progress-bar">
            <div class="progress-segment on-time" style="width: {prayerStats.onTimePercent}%"></div>
            <div class="progress-segment late" style="width: {prayerStats.latePercent}%"></div>
            <div class="progress-segment missed" style="width: {prayerStats.missedPercent}%"></div>
          </div>
        {/if}
      </div>

      <div class="prayer-history-list">
        {#each groupedPrayers as group}
          <div class="date-group">
            <div class="date-header">
              <span class="date">{group.formattedDate}</span>
            </div>
            <div class="prayers-list">
              {#each group.prayers as prayer}
                {@const statusInfo = getStatusInfo(prayer.status)}
                <div class="prayer-item">
                  <div class="prayer-info">
                    <div class="prayer-name">{prayer.prayerName}</div>
                    <div class="prayer-time">{prayer.time || ''}</div>
                  </div>
                  <div class="prayer-status" style="color: {statusInfo.color}">
                    <div class="status-indicator" style="background-color: {statusInfo.color}"></div>
                    <svelte:component this={statusInfo.icon} size={16} weight="bold" />
                    <span>{statusInfo.text}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .prayer-history-section {
    padding: 0 16px;
    margin-top: 16px;
    padding-bottom: 16px;
  }

  .prayer-history-card {
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
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  h2 {
    font-size: 1rem;
    color: #216974;
    margin: 0;
    font-weight: 500;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .refresh-button {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .refresh-button:hover {
    background: #f1f5f9;
    color: #216974;
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

  .filter-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .filter-button {
    background: #f1f5f9;
    border: none;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    font-size: 0.75rem;
    cursor: pointer;
    color: #64748b;
    transition: all 0.2s;
  }

  .filter-button.active {
    background: #216974;
    color: white;
  }

  .filter-button:hover:not(.active) {
    background: #e2e8f0;
  }

  .loading {
    text-align: center;
    padding: 2rem 0;
    color: #64748b;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 0;
    color: #94a3b8;
    gap: 1rem;
  }

  .empty-state p {
    margin: 0;
    text-align: center;
  }

  .prayer-history-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 400px;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .prayer-history-list::-webkit-scrollbar {
    width: 4px;
  }

  .prayer-history-list::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  .prayer-history-list::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .date-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .date-header {
    padding: 0.25rem 0;
    border-bottom: 1px solid #e2e8f0;
  }

  .date {
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
  }

  .prayers-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .prayer-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 8px;
  }

  .prayer-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .prayer-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #334155;
  }
  
  .prayer-time {
    font-size: 0.75rem;
    color: #64748b;
  }

  .prayer-status {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.03);
  }
  
  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 0.25rem;
  }

  .prayer-summary {
    background: #f8fafc;
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 1rem;
    border: 1px solid #e2e8f0;
  }

  .summary-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
    margin-bottom: 0.75rem;
    text-align: center;
  }

  .summary-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  @media (max-width: 480px) {
    .summary-stats {
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    min-width: 2rem;
    text-align: center;
  }

  .stat-value.on-time {
    color: #4CAF50;
    background: rgba(76, 175, 80, 0.1);
  }

  .stat-value.late {
    color: #E09453;
    background: rgba(224, 148, 83, 0.1);
  }

  .stat-value.missed {
    color: #F44336;
    background: rgba(244, 67, 54, 0.1);
  }

  .stat-value.total {
    color: #216974;
    background: rgba(33, 105, 116, 0.1);
  }

  .stat-label {
    font-size: 0.75rem;
    color: #64748b;
  }
  
  .stat-percent {
    font-size: 0.7rem;
    color: #94a3b8;
    margin-top: -0.25rem;
  }
  
  .progress-bar {
    height: 6px;
    width: 100%;
    background: #e2e8f0;
    border-radius: 3px;
    display: flex;
    overflow: hidden;
  }
  
  .progress-segment {
    height: 100%;
  }
  
  .progress-segment.on-time {
    background-color: #4CAF50;
  }
  
  .progress-segment.late {
    background-color: #E09453;
  }
  
  .progress-segment.missed {
    background-color: #F44336;
  }
</style> 