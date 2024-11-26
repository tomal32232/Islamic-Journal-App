<script>
  import { onMount, onDestroy } from 'svelte';
  import { 
    prayerTimesStore, 
    loadingStore, 
    errorStore, 
    fetchPrayerTimes,
    getCurrentLocation 
  } from '../services/prayerTimes';
  import { savePrayerStatus, getPrayerHistory, prayerHistoryStore, initializeTodaysPrayers, updatePrayerStatuses } from '../stores/prayerHistoryStore';
  import { iconMap } from '../utils/icons';
  import { nearbyMosquesStore, mosqueLoadingStore, fetchNearbyMosques } from '../services/mosqueService';

  let timeInterval;
  let currentPrayer = null;
  let timeRemaining = '';
  let dailyStats = {
    onTime: 0,
    late: 0,
    pending: 0
  };

  function updateDailyStats() {
    const prayers = $prayerTimesStore;
    dailyStats = prayers.reduce((stats, prayer) => {
      if (prayer.status === 'ontime') stats.onTime++;
      else if (prayer.status === 'late') stats.late++;
      else stats.pending++;
      return stats;
    }, { onTime: 0, late: 0, pending: 0 });
  }

  function getTimeRemaining(prayerTime) {
    const [time, period] = prayerTime.split(' ');
    const [hours, minutes] = time.split(':');
    const now = new Date();
    const prayerDate = new Date();
    
    let hour = parseInt(hours);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    prayerDate.setHours(hour, parseInt(minutes), 0);
    
    const diff = prayerDate - now;
    if (diff < 0) return 'Time passed';
    
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}h ${mins}m remaining`;
  }

  async function markPrayerStatus(index, status) {
    const prayer = $prayerTimesStore[index];
    await savePrayerStatus({
      name: prayer.name,
      time: prayer.time,
      status
    });
    
    $prayerTimesStore = $prayerTimesStore.map((p, i) => 
      i === index ? { ...p, status } : p
    );
    
    updateDailyStats();
  }

  function updatePrayerStatus() {
    const now = new Date();
    const prayers = $prayerTimesStore;
    
    for (let i = 0; i < prayers.length; i++) {
      const remaining = getTimeRemaining(prayers[i].time);
      if (remaining !== 'Time passed') {
        currentPrayer = prayers[i];
        timeRemaining = remaining;
        break;
      }
    }
    updateDailyStats();
  }

  onMount(async () => {
    await fetchPrayerTimes();
    await initializeTodaysPrayers($prayerTimesStore);
    
    // Update prayer statuses every minute
    timeInterval = setInterval(async () => {
      await updatePrayerStatuses();
      updatePrayerStatus();
    }, 60000);
    
    await updatePrayerStatuses();
    updatePrayerStatus();
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
  });
</script>

<div class="prayer-container">
  <div class="daily-stats">
    <h2>Today's Progress</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-number">{dailyStats.onTime}</span>
        <span class="stat-label">On Time</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">{dailyStats.late}</span>
        <span class="stat-label">Late</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">{dailyStats.pending}</span>
        <span class="stat-label">Pending</span>
      </div>
    </div>
  </div>

  {#if $loadingStore}
    <div class="loading">Loading prayer times...</div>
  {:else if $errorStore}
    <div class="error">{$errorStore}</div>
  {:else}
    <div class="prayer-list">
      {#each $prayerTimesStore as prayer, i}
        <div class="prayer-card {prayer === currentPrayer ? 'current' : ''}">
          <div class="prayer-header">
            <div class="prayer-info">
              <svelte:component 
                this={iconMap[prayer.icon]} 
                size={24} 
                weight={prayer.weight}
              />
              <div class="prayer-details">
                <span class="prayer-name">{prayer.name}</span>
                <span class="prayer-time">{prayer.time}</span>
                {#if prayer === currentPrayer}
                  <span class="time-remaining">{timeRemaining}</span>
                {/if}
              </div>
            </div>
          </div>
          {#if prayer.status}
            <div class="status-badge {prayer.status}">
              {prayer.status === 'ontime' ? 'Prayed on time' : 
               prayer.status === 'late' ? 'Prayed late' : 
               prayer.status === 'missed' ? 'Missed' : ''}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<div class="mosque-section">
  <h2>Nearby Mosques</h2>
  {#if $mosqueLoadingStore}
    <div class="loading">Loading nearby mosques...</div>
  {:else if $nearbyMosquesStore.length > 0}
    <div class="mosque-list">
      {#each $nearbyMosquesStore as mosque}
        <div class="mosque-card" 
          on:click={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mosque.name + ' ' + mosque.address)}`, '_blank')}
        >
          <div class="mosque-info">
            <span class="mosque-name">{mosque.name}</span>
            <span class="mosque-address">{mosque.address}</span>
            <span class="mosque-distance">{mosque.distance}</span>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-state">No mosques found nearby</div>
  {/if}
</div>

<style>
  .prayer-container {
    padding: 1rem;
    max-width: 600px;
    margin: 0 auto;
  }

  .daily-stats {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 1.5rem;
  }

  h2 {
    font-size: 1.25rem;
    color: #216974;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .stat-card {
    background: #f8f8f8;
    padding: 1rem;
    border-radius: 8px;
    text-align: center;
  }

  .stat-number {
    display: block;
    font-size: 1.5rem;
    font-weight: 500;
    color: #216974;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #666;
  }

  .prayer-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .prayer-card {
    background: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .prayer-card.current {
    border: 2px solid #216974;
  }

  .prayer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .prayer-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .prayer-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .prayer-name {
    font-weight: 500;
  }

  .prayer-time {
    font-size: 0.875rem;
    color: #666;
  }

  .time-remaining {
    font-size: 0.75rem;
    color: #216974;
    font-weight: 500;
  }

  .prayer-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .status-button {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .status-button.ontime {
    background: #216974;
    color: white;
  }

  .status-button.late {
    background: #E09453;
    color: white;
  }

  .status-badge {
    margin-top: 0.75rem;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    text-align: center;
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

  .mosque-section {
    margin-top: 2rem;
  }

  .mosque-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .mosque-card {
    background: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .mosque-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .mosque-name {
    font-weight: 500;
    color: #216974;
  }

  .mosque-address {
    font-size: 0.875rem;
    color: #666;
  }

  .mosque-distance {
    font-size: 0.75rem;
    color: #216974;
  }
</style>
