<script>
  import { onMount, onDestroy } from 'svelte';
  import { prayerTimesStore, loadingStore, errorStore, fetchPrayerTimes } from '../services/prayerTimes';
  import { Sun, SunDim, CloudSun, SunHorizon, MoonStars } from 'phosphor-svelte';
  import { savePrayerStatus, getPrayerHistory, prayerHistoryStore } from '../stores/prayerHistoryStore';

  let timeInterval;
  let currentPrayer = null;
  let timeRemaining = '';

  const iconMap = {
    SunDim,
    Sun,
    CloudSun,
    SunHorizon,
    MoonStars
  };

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
  }

  onMount(() => {
    fetchPrayerTimes();
    timeInterval = setInterval(updatePrayerStatus, 60000);
    updatePrayerStatus();
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
  });
</script>

<div class="prayer-container">
  <h1>Prayer Times</h1>
  
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
              <span class="prayer-name">{prayer.name}</span>
            </div>
            <span class="prayer-time">{prayer.time}</span>
          </div>

          {#if prayer === currentPrayer}
            <div class="time-remaining">{timeRemaining}</div>
          {/if}

          {#if !prayer.status && (prayer === currentPrayer || getTimeRemaining(prayer.time) === 'Time passed')}
            <div class="prayer-actions">
              <button 
                class="status-button ontime" 
                on:click={() => markPrayerStatus(i, 'ontime')}
              >
                Prayed on time
              </button>
              <button 
                class="status-button late" 
                on:click={() => markPrayerStatus(i, 'late')}
              >
                Prayed late
              </button>
            </div>
          {:else if prayer.status}
            <div class="status-badge {prayer.status}">
              {prayer.status === 'ontime' ? 'Prayed on time' : 'Prayed late'}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .prayer-container {
    padding: 1rem;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    font-weight: 500;
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

  .prayer-name {
    font-weight: 500;
  }

  .prayer-time {
    color: #666;
  }

  .time-remaining {
    font-size: 0.875rem;
    color: #666;
  }

  .prayer-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
  }

  .status-button {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .status-button.ontime {
    background-color: #d3d3d3;
  }

  .status-button.late {
    background-color: #ffd7d7;
  }

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    color: #fff;
  }

  .status-badge.ontime {
    background-color: #216974;
  }

  .status-badge.late {
    background-color: #ff4d4d;
  }
</style> 