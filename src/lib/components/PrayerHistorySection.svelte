<script>
  import { prayerHistoryStore } from '../stores/prayerHistoryStore';
  import { iconMap } from '../utils/icons';
  
  let selectedFilter = '7'; // Default to 7 days
  
  $: filteredHistory = filterPrayerHistory($prayerHistoryStore.history, selectedFilter);
  $: groupedHistory = groupHistoryByDate(filteredHistory);
  $: summary = calculateSummary(filteredHistory);
  $: prayerPatterns = analyzePrayerPatterns(filteredHistory);

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

  function calculateSummary(history) {
    const total = history.length;
    const ontime = history.filter(p => p.status === 'ontime').length;
    const late = history.filter(p => p.status === 'late').length;
    const missed = history.filter(p => p.status === 'missed').length;
    const pending = history.filter(p => p.status === 'pending').length;

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
    history.forEach(prayer => {
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

    <div class="summary-section">
      <div class="summary-stats">
        <div class="stat-box">
          <span class="stat-label">Total Prayers</span>
          <span class="stat-value">{summary.total}</span>
        </div>
        <div class="stat-box ontime">
          <span class="stat-label">On Time</span>
          <span class="stat-value">{summary.ontime}</span>
          <span class="stat-percentage">({summary.ontimePercentage}%)</span>
        </div>
        <div class="stat-box late">
          <span class="stat-label">Late</span>
          <span class="stat-value">{summary.late}</span>
          <span class="stat-percentage">({summary.latePercentage}%)</span>
        </div>
        <div class="stat-box missed">
          <span class="stat-label">Missed</span>
          <span class="stat-value">{summary.missed}</span>
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

  .summary-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #eee;
  }

  .summary-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-box {
    background: #f8f8f8;
    padding: 1rem;
    border-radius: 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-box.ontime {
    background: rgba(33, 105, 116, 0.1);
  }

  .stat-box.late {
    background: rgba(224, 148, 83, 0.1);
  }

  .stat-box.missed {
    background: rgba(239, 68, 68, 0.1);
  }

  .stat-label {
    font-size: 0.75rem;
    color: #666;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 600;
    color: #216974;
  }

  .stat-box.late .stat-value {
    color: #E09453;
  }

  .stat-box.missed .stat-value {
    color: #EF4444;
  }

  .stat-percentage {
    font-size: 0.75rem;
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
      grid-template-columns: repeat(2, 1fr);
    }

    .stat-value {
      font-size: 1.25rem;
    }

    .pattern-item {
      font-size: 0.75rem;
    }

    .prayer-stat {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
    }
  }
</style> 