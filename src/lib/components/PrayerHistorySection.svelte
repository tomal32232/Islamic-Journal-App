<script>
  import { prayerHistoryStore } from '../stores/prayerHistoryStore';
  import { iconMap } from '../utils/icons';
  
  let selectedFilter = '7'; // Default to 7 days
  
  $: filteredHistory = filterPrayerHistory($prayerHistoryStore.history, selectedFilter);
  $: stats = calculateStats(filteredHistory);
  
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

  function calculateStats(prayers) {
    const total = prayers.length;
    const ontime = prayers.filter(p => p.status === 'ontime').length;
    const late = prayers.filter(p => p.status === 'late').length;
    const missed = prayers.filter(p => p.status === 'missed').length;
    const pending = prayers.filter(p => p.status === 'pending').length;

    return {
      total,
      ontime,
      late,
      missed,
      pending,
      ontimePercentage: total ? Math.round((ontime / total) * 100) : 0,
      latePercentage: total ? Math.round((late / total) * 100) : 0,
      missedPercentage: total ? Math.round((missed / total) * 100) : 0,
      pendingPercentage: total ? Math.round((pending / total) * 100) : 0
    };
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
    <div class="stats-summary">
      <div class="stat-row total">
        <span class="label">Total Prayers</span>
        <span class="value">{stats.total}</span>
      </div>
      
      <div class="stat-bars">
        <div class="stat-bar-item">
          <div class="bar-label">
            <span>On Time</span>
            <span class="percentage">{stats.ontimePercentage}%</span>
          </div>
          <div class="bar-container">
            <div class="bar ontime" style="width: {stats.ontimePercentage}%">
              <span class="bar-value">{stats.ontime}</span>
            </div>
          </div>
        </div>

        <div class="stat-bar-item">
          <div class="bar-label">
            <span>Late</span>
            <span class="percentage">{stats.latePercentage}%</span>
          </div>
          <div class="bar-container">
            <div class="bar late" style="width: {stats.latePercentage}%">
              <span class="bar-value">{stats.late}</span>
            </div>
          </div>
        </div>

        <div class="stat-bar-item">
          <div class="bar-label">
            <span>Missed</span>
            <span class="percentage">{stats.missedPercentage}%</span>
          </div>
          <div class="bar-container">
            <div class="bar missed" style="width: {stats.missedPercentage}%">
              <span class="bar-value">{stats.missed}</span>
            </div>
          </div>
        </div>

        {#if stats.pending > 0}
          <div class="stat-bar-item">
            <div class="bar-label">
              <span>Pending</span>
              <span class="percentage">{stats.pendingPercentage}%</span>
            </div>
            <div class="bar-container">
              <div class="bar pending" style="width: {stats.pendingPercentage}%">
                <span class="bar-value">{stats.pending}</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div class="recent-prayers">
      <h3>Recent Prayers</h3>
      <div class="prayer-grid">
        {#each filteredHistory.slice(0, 10) as prayer}
          <div class="prayer-card {prayer.status}">
            <div class="prayer-info">
              <div class="icon-wrapper">
                <svelte:component 
                  this={iconMap[prayer.icon] || iconMap.Sun} 
                  size={16} 
                  weight="regular"
                  color="#216974"
                />
              </div>
              <div class="prayer-details">
                <span class="prayer-name">{prayer.prayerName}</span>
                <span class="prayer-meta">
                  {new Date(prayer.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })} · {prayer.time}
                </span>
              </div>
            </div>
            <div class="status-badge {prayer.status}">
              {getStatusText(prayer.status)}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .prayer-history-section {
    margin-top: 2rem;
    padding: 1.5rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  h2 {
    font-size: 1.25rem;
    color: #216974;
    font-weight: 500;
  }

  h3 {
    font-size: 1rem;
    color: #216974;
    font-weight: 500;
    margin: 1.5rem 0 1rem;
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

  .stats-summary {
    background: #f8f8f8;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .stat-row.total {
    font-size: 1.125rem;
    font-weight: 500;
    color: #216974;
  }

  .stat-bars {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .stat-bar-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: #666;
  }

  .percentage {
    font-weight: 500;
    color: #216974;
  }

  .bar-container {
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
  }

  .bar {
    height: 100%;
    border-radius: 4px;
    position: relative;
    transition: width 0.3s ease;
    min-width: 24px;
  }

  .bar-value {
    position: absolute;
    right: 4px;
    top: -18px;
    font-size: 0.75rem;
    font-weight: 500;
    color: #666;
  }

  .bar.ontime {
    background: #216974;
  }

  .bar.late {
    background: #E09453;
  }

  .bar.missed {
    background: #EF4444;
  }

  .bar.pending {
    background: #9CA3AF;
  }

  .recent-prayers {
    margin-top: 1.5rem;
  }

  .prayer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
  }

  .prayer-card {
    background: #f8f8f8;
    padding: 1rem;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .prayer-card.ontime {
    border-left: 3px solid #216974;
  }

  .prayer-card.late {
    border-left: 3px solid #E09453;
  }

  .prayer-card.missed {
    border-left: 3px solid #EF4444;
  }

  .prayer-card.pending {
    border-left: 3px solid #9CA3AF;
  }

  .prayer-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .icon-wrapper {
    background: rgba(33, 105, 116, 0.1);
    padding: 0.5rem;
    border-radius: 6px;
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
    font-size: 0.875rem;
  }

  .prayer-meta {
    font-size: 0.75rem;
    color: #666;
  }

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    align-self: flex-start;
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