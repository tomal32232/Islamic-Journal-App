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
  let scrollY = 0;

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

  function handleScroll(event) {
    const container = event.target;
    scrollY = container.scrollTop;
  }

  onMount(() => {
    const container = document.querySelector('.prayer-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }

    timeInterval = setInterval(updateNextPrayer, 60000);
    updateNextPrayer();

    return () => {
      if (timeInterval) clearInterval(timeInterval);
      container?.removeEventListener('scroll', handleScroll);
    };
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
  });
</script>

<div class="prayer-container">
  <div class="tabs" class:scrolled={scrollY > 50}>
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
    padding: 0;
    max-width: 1200px;
    margin: 0 auto;
    margin-bottom: 4rem;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    box-sizing: border-box;
    background: #F8FAFC;
  }

  .tabs {
    display: flex;
    gap: 1rem;
    margin: 10px;
    padding: 1rem;
    justify-content: center;
    background: #216974;
    border-radius: 12px;
    position: sticky;
    top: 10px;
    z-index: 100;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tabs.scrolled {
    padding: 0.5rem 1rem;
    margin: 0 10px;
    border-radius: 12px;
  }

  .tab-button {
    background: none;
    border: none;
    padding: 0.75rem 2rem;
    color: rgba(255, 255, 255, 0.8);
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
    background: rgba(255, 255, 255, 0.1);
  }

  .tab-button.active {
    color: white;
    background: rgba(255, 255, 255, 0.1);
    font-weight: 500;
  }

  .tab-button :global(svg) {
    color: inherit;
  }

  .prayer-times-section {
    padding: 0 10px;
    margin-top: 10px;
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
    padding: 0.5rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .prayer-time-card {
    background: #f8fafc;
    padding: 0.75rem;
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
    background: rgba(224, 148, 83, 0.05);
    border: 1px solid #E09453;
  }

  .icon-wrapper {
    background: rgba(33, 105, 116, 0.1);
    padding: 0.5rem;
    border-radius: 8px;
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
      padding: 0;
    }

    .prayer-times-grid {
      gap: 0.375rem;
      padding: 0.375rem;
    }

    .prayer-time-card {
      padding: 0.5rem;
      gap: 0.25rem;
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
  }
</style>

