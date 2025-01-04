<script>
  import { onMount, onDestroy } from 'svelte';
  import { prayerTimesStore } from '../stores/prayerTimes';
  import { Sun, SunDim, CloudSun, SunHorizon, MoonStars } from 'phosphor-svelte';
  import { savePrayerStatus } from '../stores/prayerHistoryStore';
  import { getPrayerHistory } from '../stores/prayerHistoryStore';

  let timeInterval;
  let currentPrayer = null;
  let nextPrayer = null;
  let timeRemaining = '';

  const icons = {
    SunDim,
    Sun,
    CloudSun,
    SunHorizon,
    MoonStars
  };

  function getTimeRemaining(prayerTime) {
    const now = new Date();
    const [time, period] = prayerTime.split(' ');
    const [hours, minutes] = time.split(':');
    const prayerDate = new Date();
    
    let hour = parseInt(hours);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    prayerDate.setHours(hour, parseInt(minutes), 0);
    
    const diff = prayerDate.getTime() - now.getTime();
    if (diff < 0) return null;
    
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}h ${mins}m`;
  }

  function updatePrayerStatus() {
    const prayers = $prayerTimesStore;
    const now = new Date();
    
    for (let i = 0; i < prayers.length; i++) {
      const remaining = getTimeRemaining(prayers[i].time);
      if (remaining) {
        currentPrayer = prayers[i];
        nextPrayer = prayers[i + 1] || prayers[0];
        timeRemaining = remaining;
        break;
      }
    }
  }

  async function markPrayer(prayer, status) {
    const today = new Date().toLocaleDateString('en-CA');
    await savePrayerStatus({
      name: prayer.name,
      time: prayer.time,
      date: today,
      status
    });
    
    $prayerTimesStore = $prayerTimesStore.map(p => 
      p.name === prayer.name ? { ...p, status } : p
    );
    
    await getPrayerHistory();
  }

  onMount(() => {
    timeInterval = setInterval(updatePrayerStatus, 60000);
    updatePrayerStatus();
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
  });
</script>

<div class="prayer-times-container">
  {#each $prayerTimesStore as prayer}
    <div class="prayer-card {prayer === currentPrayer ? 'current' : ''}">
      <div class="prayer-info">
        <svelte:component 
          this={icons[prayer.icon]} 
          size={24} 
          weight={prayer.weight} 
        />
        <div class="prayer-details">
          <span class="prayer-name">{prayer.name}</span>
          <span class="prayer-time">{prayer.time}</span>
        </div>
      </div>

      {#if prayer === currentPrayer}
        <div class="time-remaining">
          <span>Time remaining: {timeRemaining}</span>
        </div>
      {/if}

      {#if prayer.status}
        <div class="prayer-status {prayer.status}">
          {#if prayer.status === 'ontime'}
            Prayed on time
          {:else if prayer.status === 'late'}
            Prayed late
          {:else if prayer.status === 'excused'}
            Excused
          {/if}
        </div>
      {:else if prayer === currentPrayer || getTimeRemaining(prayer.time) === null}
        <div class="prayer-actions">
          <button 
            class="status-button ontime" 
            on:click={() => markPrayer(prayer, 'ontime')}
          >
            Prayed on time
          </button>
          <button 
            class="status-button late" 
            on:click={() => markPrayer(prayer, 'late')}
          >
            Prayed late
          </button>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .prayer-times-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 0.75rem;
    padding: 0.75rem;
    height: calc(100vh - 120px);
    overflow-y: auto;
  }

  .prayer-card {
    background: white;
    padding: 0.75rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 100px;
  }

  .prayer-card.current {
    border: 2px solid #216974;
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
    font-size: 0.9rem;
  }

  .prayer-time {
    font-size: 0.8rem;
    color: #666;
  }

  .time-remaining {
    margin-top: 0.375rem;
    font-size: 0.8rem;
    color: #216974;
  }

  .prayer-actions {
    display: flex;
    gap: 0.375rem;
    margin-top: 0.375rem;
    flex-wrap: wrap;
  }

  .status-button {
    flex: 1;
    min-width: 100px;
    padding: 0.375rem;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .status-button.ontime {
    background: #216974;
    color: white;
  }

  .status-button.late {
    background: #E09453;
    color: white;
  }

  .prayer-status {
    margin-top: 0.375rem;
    padding: 0.25rem 0.375rem;
    border-radius: 4px;
    font-size: 0.8rem;
    text-align: center;
  }

  .prayer-status.ontime {
    background: rgba(33, 105, 116, 0.1);
    color: #216974;
  }

  .prayer-status.late {
    background: rgba(224, 148, 83, 0.1);
    color: #E09453;
  }

  .prayer-status.excused {
    background: rgba(156, 163, 175, 0.1);
    color: #6B7280;
  }

  @media (max-width: 640px) {
    .prayer-times-container {
      grid-template-columns: 1fr;
      gap: 0.5rem;
      padding: 0.5rem;
      height: calc(100vh - 64px);
    }

    .prayer-card {
      min-height: unset;
      padding: 0.5rem;
    }

    .prayer-info {
      gap: 0.5rem;
    }

    .prayer-details {
      gap: 0.125rem;
    }

    .prayer-name {
      font-size: 0.85rem;
    }

    .prayer-time {
      font-size: 0.75rem;
    }

    .time-remaining {
      margin-top: 0.25rem;
      font-size: 0.75rem;
    }

    .prayer-actions {
      gap: 0.25rem;
      margin-top: 0.25rem;
    }

    .status-button {
      padding: 0.25rem;
      font-size: 0.75rem;
      min-width: 80px;
      flex: 0 1 calc(50% - 0.125rem);
    }

    .prayer-status {
      margin-top: 0.25rem;
      padding: 0.125rem 0.25rem;
      font-size: 0.75rem;
    }

    svelte:component {
      size: 20;
    }
  }
</style> 