<script>
  import { onMount } from 'svelte';
  import { prayerHistoryStore, getPrayerHistory, invalidatePrayerHistoryCache } from '../stores/prayerHistoryStore';
  import { Calendar, Clock, Check, ArrowClockwise } from 'phosphor-svelte';

  let filterDays = 7;
  let filteredHistory = [];
  let isLoading = true;
  let isRefreshing = false;

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
        return prayerDate >= filterDate;
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

  // Update filtered history when filter days or prayer history changes
  $: {
    if ($prayerHistoryStore?.history) {
      filteredHistory = filterPrayers();
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
                  <div class="prayer-name">{prayer.prayerName}</div>
                  <div class="prayer-status" style="color: {statusInfo.color}">
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

  .prayer-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #334155;
  }

  .prayer-status {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }
</style> 