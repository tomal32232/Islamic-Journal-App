<script>
  import { onMount, onDestroy } from 'svelte';
  import { 
    prayerTimesStore, 
    loadingStore, 
    errorStore, 
    fetchPrayerTimes,
    getCurrentLocation 
  } from '../services/prayerTimes';
  import { savePrayerStatus, getPrayerHistory, prayerHistoryStore, initializeMonthlyPrayers, updatePrayerStatuses } from '../stores/prayerHistoryStore';
  import { iconMap } from '../utils/icons';
  import { nearbyMosquesStore, mosqueLoadingStore, fetchNearbyMosques } from '../services/mosqueService';
  import PrayerHistorySection from '../components/PrayerHistorySection.svelte';

  let timeInterval;
  let currentPrayer = null;
  let timeRemaining = '';
  let dailyStats = {
    onTime: 0,
    late: 0,
    pending: 0
  };

  let countdownInterval;
  let currentPrayerCountdown = '';

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
    let foundCurrent = false;
    
    $prayerTimesStore = prayers.map(prayer => {
      if (!foundCurrent && prayer.time) {
        const prayerTime = convertPrayerTimeToDate(prayer.time);
        if (prayerTime > now) {
          foundCurrent = true;
          return { ...prayer, isCurrent: true };
        }
      }
      return { ...prayer, isCurrent: false };
    });
  }

  function updateCountdown(prayer) {
    if (!prayer?.time) return null;
    
    const [time, period] = prayer.time.split(' ');
    const [hours, minutes] = time.split(':');
    const now = new Date();
    const prayerDate = new Date();
    
    let hour = parseInt(hours);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    prayerDate.setHours(hour, parseInt(minutes), 0);
    
    const diff = prayerDate - now;
    if (diff < 0) return null;
    
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function isToday(prayerTime) {
    const today = new Date().toLocaleDateString('en-CA');
    const prayerDate = convertPrayerTimeToDate(prayerTime);
    return prayerDate.toLocaleDateString('en-CA') === today;
  }

  function withinMarkingWindow(prayerTime) {
    const prayerDate = convertPrayerTimeToDate(prayerTime);
    const now = new Date();
    const diff = now - prayerDate;
    // Allow marking within 6 hours of prayer time
    return diff < (6 * 60 * 60 * 1000);
  }

  function convertPrayerTimeToDate(prayerTime) {
    const [time, period] = prayerTime.split(' ');
    const [hours, minutes] = time.split(':');
    const now = new Date();
    const prayerDate = new Date(now);
    
    let hour = parseInt(hours);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    prayerDate.setHours(hour, parseInt(minutes), 0, 0);
    return prayerDate;
  }

  onMount(async () => {
    try {
      // Run these in parallel
      const [coords] = await Promise.all([
        getCurrentLocation(),
        fetchPrayerTimes(),
        getPrayerHistory()
      ]);
      
      if (coords) {
        fetchNearbyMosques(coords.latitude, coords.longitude);
      }
      
      updatePrayerStatus();
      updateDailyStats();
      
      // Set up intervals
      timeInterval = setInterval(updatePrayerStatus, 60000);
      countdownInterval = setInterval(() => {
        const currentPrayer = $prayerTimesStore.find(p => p.isCurrent);
        if (currentPrayer) {
          currentPrayerCountdown = updateCountdown(currentPrayer);
        }
      }, 1000);

      return () => {
        clearInterval(timeInterval);
        clearInterval(countdownInterval);
      };
    } catch (error) {
      console.error('Error initializing prayer tab:', error);
    }
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
    clearInterval(countdownInterval);
  });
</script>
<div class="prayer-container">
  <h2>Praying Times</h2>
  
  {#if $loadingStore}
    <div class="loading">Loading prayer times...</div>
  {:else if $errorStore}
    <div class="error">{$errorStore}</div>
  {:else}
    <div class="prayer-times-grid">
      {#each $prayerTimesStore.filter(p => isToday(p.time)) as prayer}
        <div class="prayer-time-card {prayer.isCurrent ? 'current' : ''}">
          <div class="icon-wrapper">
            <svelte:component 
              this={iconMap[prayer.icon]} 
              size={24} 
              weight={prayer.weight}
              color={prayer.isCurrent ? 'white' : '#216974'}
            />
          </div>
          <span class="prayer-name">{prayer.name}</span>
          <span class="prayer-time">{prayer.time}</span>
        </div>
      {/each}
    </div>
  {/if}

  <PrayerHistorySection />
</div>

<style>
  .prayer-container {
    padding: 0.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    font-size: 1.125rem;
    color: #333;
    margin-bottom: 0.75rem;
    font-weight: 500;
  }

  .prayer-times-grid {
    display: flex;
    justify-content: space-between;
    gap: 0.25rem;
    margin-bottom: 1rem;
  }

  .prayer-time-card {
    background: white;
    padding: 0.375rem;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    text-align: center;
    transition: all 0.2s ease;
    border: 1px solid #eee;
    width: calc(100% / 6 - 0.25rem);
    min-width: unset;
    max-width: unset;
  }

  .prayer-time-card.current {
    background: #216974;
    color: white;
  }

  .icon-wrapper {
    background: rgba(33, 105, 116, 0.1);
    padding: 0.375rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .prayer-time-card.current .icon-wrapper {
    background: rgba(255, 255, 255, 0.2);
  }

  .prayer-name {
    font-size: 0.75rem;
    color: #666;
    font-weight: 500;
  }

  .prayer-time {
    font-size: 0.75rem;
    font-weight: 600;
    color: #216974;
  }

  .prayer-time-card.current .prayer-name,
  .prayer-time-card.current .prayer-time {
    color: white;
  }

  .loading, .error {
    text-align: center;
    padding: 1rem;
    color: #666;
    background: #f8f8f8;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .error {
    color: #EF4444;
    background: rgba(239, 68, 68, 0.1);
  }

  @media (max-width: 640px) {
    .prayer-container {
      padding: 0.5rem;
    }

    h2 {
      font-size: 1rem;
      margin-bottom: 0.5rem;
    }

    .prayer-time-card {
      padding: 0.25rem;
    }

    .icon-wrapper {
      padding: 0.25rem;
    }

    .prayer-name {
      font-size: 0.625rem;
    }

    .prayer-time {
      font-size: 0.625rem;
    }

    svelte:component {
      size: 16;
    }
  }
</style>

