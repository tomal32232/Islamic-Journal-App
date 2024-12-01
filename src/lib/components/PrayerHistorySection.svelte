<script>
  import { prayerHistoryStore } from '../stores/prayerHistoryStore';
  import { iconMap } from '../utils/icons';
  
  let selectedFilter = '7'; // Default to 7 days
  
  $: filteredHistory = filterPrayerHistory($prayerHistoryStore.history, selectedFilter);
  $: groupedHistory = groupHistoryByDate(filteredHistory);

  function filterPrayerHistory(history, days) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const filterDate = new Date(today);
    filterDate.setDate(filterDate.getDate() - parseInt(days));
    filterDate.setHours(0, 0, 0, 0);
    
    const now = new Date();
    
    return history
      .filter(prayer => {
        const prayerDate = new Date(prayer.date);
        const prayerDateTime = new Date(prayer.date + ' ' + prayer.time);
        
        return prayerDate >= filterDate && 
               prayerDate <= today && 
               prayer.status !== 'upcoming' &&
               (prayerDate.getTime() < now.setHours(0,0,0,0) || prayerDateTime.getTime() < now.getTime());
      })
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
  }

  function groupHistoryByDate(history) {
    const groups = {};
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
      groups[prayer.date].prayers[prayer.prayerName] = prayer.status;
    });
    return Object.values(groups);
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric'
    });
  }

  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
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

  .empty-state {
    text-align: center;
    padding: 1rem;
    color: #666;
    background: #f8f8f8;
    border-radius: 8px;
    font-size: 0.875rem;
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
  }
</style> 