<script>
  import { prayerHistoryStore } from '../stores/prayerHistoryStore';
  import { iconMap } from '../utils/icons';
  
  let selectedFilter = '7'; // Default to 7 days
  
  $: filteredHistory = filterPrayerHistory($prayerHistoryStore.history, selectedFilter);
  
  function filterPrayerHistory(history, days) {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    const filterDate = new Date(today);
    filterDate.setDate(filterDate.getDate() - parseInt(days));
    filterDate.setHours(0, 0, 0, 0); // Start of filter date
    
    const now = new Date();
    
    return history
      .filter(prayer => {
        const prayerDate = new Date(prayer.date);
        const prayerDateTime = new Date(prayer.date + ' ' + prayer.time);
        
        // Only show prayers that:
        // 1. Are within the date range
        // 2. Are not upcoming
        // 3. Have already passed for today
        return prayerDate >= filterDate && 
               prayerDate <= today && 
               prayer.status !== 'upcoming' &&
               (prayerDate < now.setHours(0,0,0,0) || prayerDateTime < now);
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA; // Sort by date descending
      });
  }

  function getStatusText(status) {
    switch (status) {
      case 'ontime':
        return 'On Time';
      case 'late':
        return 'Late';
      case 'missed':
        return 'Missed';
      default:
        return 'Pending';
    }
  }

  function groupPrayersByDate(prayers) {
    const groups = {};
    prayers.forEach(prayer => {
      if (!groups[prayer.date]) {
        groups[prayer.date] = [];
      }
      groups[prayer.date].push(prayer);
    });
    return groups;
  }

  $: groupedPrayers = groupPrayersByDate(filteredHistory);
</script>

<div class="prayer-history-section">
  <div class="header">
    <h2>Prayer History</h2>
    <select 
      bind:value={selectedFilter}
      class="filter-select"
    >
      <option value="7">Last 7 days</option>
      <option value="30">Last 30 days</option>
    </select>
  </div>

  <div class="history-list">
    {#if filteredHistory.length === 0}
      <div class="empty-state">
        <p>No prayer records found for the selected period</p>
      </div>
    {:else}
      {#each Object.entries(groupedPrayers) as [date, prayers]}
        <div class="date-group">
          <div class="date-header">
            {new Date(date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            })}
          </div>
          {#each prayers as prayer}
            <div class="prayer-history-card">
              <div class="prayer-info">
                <div class="icon-wrapper">
                  <svelte:component 
                    this={iconMap[prayer.icon] || iconMap.Sun} 
                    size={20} 
                    weight="regular"
                    color="#216974"
                  />
                </div>
                <div class="prayer-details">
                  <span class="prayer-name">{prayer.prayerName}</span>
                  <span class="prayer-time">{prayer.time}</span>
                </div>
              </div>
              <div class="status-badge {prayer.status}">
                {getStatusText(prayer.status)}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .prayer-history-section {
    margin-top: 2rem;
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
    font-size: 1.25rem;
    color: #216974;
    font-weight: 500;
  }

  .filter-select {
    padding: 0.5rem;
    border: 1px solid #eee;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #216974;
    background: white;
    cursor: pointer;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .date-group {
    background: #f8f8f8;
    border-radius: 8px;
    overflow: hidden;
  }

  .date-header {
    background: #216974;
    color: white;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .prayer-history-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: white;
    border-bottom: 1px solid #eee;
  }

  .prayer-history-card:last-child {
    border-bottom: none;
  }

  .prayer-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .icon-wrapper {
    background: rgba(33, 105, 116, 0.1);
    padding: 0.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .prayer-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .prayer-name {
    font-weight: 500;
    color: #216974;
  }

  .prayer-time {
    font-size: 0.875rem;
    color: #666;
  }

  .status-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-badge.ontime {
    background: rgba(33, 105, 116, 0.1);
    color: #216974;
  }

  .status-badge.late {
    background: rgba(224, 148, 83, 0.1);
    color: #E09453;
  }

  .status-badge.missed {
    background: rgba(239, 68, 68, 0.1);
    color: #EF4444;
  }

  .status-badge.pending {
    background: rgba(156, 163, 175, 0.1);
    color: #6B7280;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #666;
    background: #f8f8f8;
    border-radius: 8px;
  }
</style> 