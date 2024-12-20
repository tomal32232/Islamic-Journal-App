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
  import QuranReading from '../components/QuranReading.svelte';
  import { Mosque, Book } from 'phosphor-svelte';

  let timeInterval;
  let currentPrayer = null;
  let nextPrayer = null;
  let activeTab = 'prayer'; // 'prayer' or 'quran'

  function getNextPrayer(prayers) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Convert prayer times to minutes for comparison
    const prayerMinutes = prayers.map(prayer => {
      const [time, period] = prayer.time.split(' ');
      const [hours, minutes] = time.split(':');
      let hour = parseInt(hours);
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      return {
        ...prayer,
        minutes: hour * 60 + parseInt(minutes)
      };
    });

    // Find the next prayer
    let next = prayerMinutes.find(prayer => prayer.minutes > currentTime);
    
    // If no next prayer today, get the first prayer (it will be tomorrow's)
    if (!next) {
      next = prayerMinutes[0];
    }

    return next;
  }

  function updateNextPrayer() {
    const prayers = $prayerTimesStore;
    if (prayers.length > 0) {
      nextPrayer = getNextPrayer(prayers);
    }
  }

  onMount(() => {
    timeInterval = setInterval(updateNextPrayer, 60000);
    updateNextPrayer();
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
  });
</script>

<div class="prayer-container">
  <div class="tabs">
    <button 
      class="tab-button {activeTab === 'prayer' ? 'active' : ''}"
      on:click={() => activeTab = 'prayer'}
    >
      <Mosque weight={activeTab === 'prayer' ? 'fill' : 'regular'} size={20} />
      <span>Prayers</span>
    </button>
    <button 
      class="tab-button {activeTab === 'quran' ? 'active' : ''}"
      on:click={() => activeTab = 'quran'}
    >
      <Book weight={activeTab === 'quran' ? 'fill' : 'regular'} size={20} />
      <span>Quran</span>
    </button>
  </div>

  {#if activeTab === 'prayer'}
    <div class="prayer-times-section">
      <h2>Prayer Times</h2>
      
      {#if $loadingStore}
        <div class="loading">Loading prayer times...</div>
      {:else if $errorStore}
        <div class="error">{$errorStore}</div>
      {:else}
        <div class="prayer-times-grid">
          {#each $prayerTimesStore as prayer}
            <div class="prayer-time-card {prayer.name === nextPrayer?.name ? 'current' : ''}">
              <div class="icon-wrapper">
                <svelte:component 
                  this={iconMap[prayer.icon]} 
                  size={24} 
                  weight={prayer.weight}
                  color={prayer.name === nextPrayer?.name ? '#E09453' : '#216974'}
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
  {:else}
    <QuranReading />
  {/if}
</div>

<style>
  .prayer-container {
    padding: 0.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .tabs {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding: 0.5rem 1rem;
    justify-content: center;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .tab-button {
    background: none;
    border: none;
    padding: 0.75rem 2rem;
    color: #666;
    font-size: 1rem;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid transparent;
  }

  .tab-button:hover {
    background: rgba(33, 105, 116, 0.05);
    border-color: #eee;
  }

  .tab-button.active {
    color: #216974;
    background: rgba(33, 105, 116, 0.1);
    border-color: #216974;
    font-weight: 500;
  }

  h2 {
    font-size: 1.125rem;
    color: #333;
    margin-bottom: 0.75rem;
    font-weight: 500;
  }

  .prayer-times-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
    margin-bottom: 1rem;
    background: white;
    padding: 0.75rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }

  .prayer-time-card {
    background: #f8fafc;
    padding: 0.75rem 0.5rem;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    text-align: center;
    transition: all 0.2s ease;
    border: 1px solid #eee;
  }

  .prayer-time-card.current {
    border: 2px solid #E09453;
    padding: calc(0.75rem - 1px) calc(0.5rem - 1px);
    background: rgba(224, 148, 83, 0.05);
  }

  .icon-wrapper {
    background: rgba(33, 105, 116, 0.1);
    padding: 0.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .prayer-time-card.current .icon-wrapper {
    background: rgba(224, 148, 83, 0.15);
  }

  .prayer-name {
    font-size: 0.875rem;
    color: #216974;
    font-weight: 500;
  }

  .prayer-time {
    font-size: 0.875rem;
    font-weight: 500;
    color: #666;
  }

  .prayer-time-card.current .prayer-name {
    color: #E09453;
  }

  .prayer-time-card.current .prayer-time {
    color: #E09453;
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

    .prayer-times-grid {
      padding: 0.5rem;
      gap: 0.375rem;
    }

    .prayer-time-card {
      padding: 0.5rem 0.25rem;
    }

    .prayer-time-card.current {
      padding: calc(0.5rem - 1px) calc(0.25rem - 1px);
    }

    .icon-wrapper {
      padding: 0.375rem;
    }

    .prayer-name {
      font-size: 0.75rem;
    }

    .prayer-time {
      font-size: 0.75rem;
    }

    svelte:component {
      size: 16;
    }
  }
</style>

