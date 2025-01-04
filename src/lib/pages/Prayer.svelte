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
  import { Mosque, Book, HandsPraying, Check, Clock } from 'phosphor-svelte';
  import { saveTasbihSession, getWeeklyStats, weeklyStatsStore } from '../stores/tasbihStore';
  import { fade, slide } from 'svelte/transition';

  let timeInterval;
  let currentPrayer = null;
  let nextPrayer = null;
  let activeTab = 'prayer'; // 'prayer', 'quran', or 'tasbih'
  let scrollY = 0;
  let showBottomSheet = false;
  let selectedPrayer = null;

  // Tasbih state
  const dhikrOptions = [
    { arabic: 'سُبْحَانَ ٱللَّٰهِ', latin: 'SubhanAllah', meaning: 'Glory be to Allah' },
    { arabic: 'ٱلْحَمْدُ لِلَّٰهِ', latin: 'Alhamdulillah', meaning: 'Praise be to Allah' },
    { arabic: 'ٱللَّٰهُ أَكْبَرُ', latin: 'Allahu Akbar', meaning: 'Allah is Greater' },
    { arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', latin: 'La ilaha illAllah', meaning: 'There is no deity except Allah' }
  ];

  let selectedDhikr = dhikrOptions[0];
  let count = 0;
  let sets = 0;
  let totalCount = 0;
  let selectedTarget = 33;
  let customTarget = '';
  let isCounterMode = false;
  let weeklyStreak = 0;
  let target = 33;

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

    getWeeklyStats().then(stats => {
      weeklyStreak = stats?.streak || 0;
    });

    return () => {
      if (timeInterval) clearInterval(timeInterval);
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
  });

  // Tasbih functions
  function handleTargetChange(newTarget) {
    selectedTarget = newTarget;
    count = 0;
  }

  function handleCustomTarget() {
    if (customTarget && !isNaN(customTarget)) {
      selectedTarget = parseInt(customTarget);
      count = 0;
    }
  }

  function startCounter() {
    isCounterMode = true;
  }

  async function saveSession() {
    if (totalCount > 0) {
      await saveTasbihSession({
        dhikr: selectedDhikr,
        count,
        sets,
        totalCount
      });
      const stats = await getWeeklyStats();
      weeklyStreak = stats?.streak || 0;
    }
  }

  async function exitCounter() {
    await saveSession();
    isCounterMode = false;
    count = 0;
  }

  function increment() {
    count++;
    totalCount++;
    if (count === selectedTarget) {
      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }
      sets++;
      count = 0;
    }
  }

  function reset() {
    count = 0;
    sets = 0;
    totalCount = 0;
  }

  function setTarget(value) {
    const numValue = typeof value === 'string' ? parseInt(value) : value;
    target = numValue || 33;
    selectedTarget = target;
    count = 0;
  }

  function isPrayerPassed(prayerTime) {
    const now = new Date();
    const [time, period] = prayerTime.split(' ');
    const [hours, minutes] = time.split(':');
    let hour = parseInt(hours);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    const prayerDate = new Date();
    prayerDate.setHours(hour, parseInt(minutes), 0);
    return now > prayerDate;
  }

  function openMarkPrayerSheet(prayer) {
    selectedPrayer = prayer;
    showBottomSheet = true;
  }

  async function markPrayer(status) {
    if (!selectedPrayer) return;

    const today = new Date().toLocaleDateString('en-CA');
    await savePrayerStatus({
      name: selectedPrayer.name,
      time: selectedPrayer.time,
      status,
      date: today
    });

    showBottomSheet = false;
    selectedPrayer = null;
    await getPrayerHistory();
  }

  function getPrayerStatus(prayerName) {
    const today = new Date().toLocaleDateString('en-CA');
    const prayer = $prayerHistoryStore?.history?.find(
      p => p.date === today && p.prayerName === prayerName
    );
    return prayer?.status;
  }
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
    <button 
      class="tab-button {activeTab === 'tasbih' ? 'active' : ''}"
      on:click={() => activeTab = 'tasbih'}
    >
      <HandsPraying weight={activeTab === 'tasbih' ? 'fill' : 'regular'} size={20} />
      <span>Tasbih</span>
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
              {#if isPrayerPassed(prayer.time)}
                {@const status = getPrayerStatus(prayer.name)}
                {#if status === 'ontime' || status === 'late'}
                  <button 
                    class="status-label {status}"
                    on:click={() => openMarkPrayerSheet(prayer)}
                  >
                    {#if status === 'ontime'}
                      <Check weight="bold" size={14} />
                      On Time
                    {:else}
                      <Clock weight="bold" size={14} />
                      Late
                    {/if}
                  </button>
                {:else}
                  <button 
                    class="mark-prayer-btn"
                    on:click={() => openMarkPrayerSheet(prayer)}
                  >
                    Mark Prayer
                  </button>
                {/if}
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <PrayerHistorySection />
    </div>
  {:else if activeTab === 'tasbih'}
    {#if !isCounterMode}
      <div class="tasbih-section">
        <div class="setup-card">
          <div class="streak-display">
            <h3>Weekly Streak</h3>
            <span class="streak-count">{weeklyStreak} days</span>
          </div>
          
          <h2>Select Dhikr</h2>
          <div class="dhikr-options">
            {#each dhikrOptions as dhikr}
              <button 
                class="dhikr-button {selectedDhikr === dhikr ? 'active' : ''}"
                on:click={() => selectedDhikr = dhikr}
              >
                <span class="arabic">{dhikr.arabic}</span>
                <span class="latin">{dhikr.latin}</span>
              </button>
            {/each}
          </div>

          <div class="target-selector">
            <h3>Select Target</h3>
            <div class="target-options">
              <button 
                class="target-button {target === 33 ? 'active' : ''}" 
                on:click={() => setTarget(33)}
              >
                33
              </button>
              <button 
                class="target-button {target === 66 ? 'active' : ''}" 
                on:click={() => setTarget(66)}
              >
                66
              </button>
              <button 
                class="target-button {target === 99 ? 'active' : ''}" 
                on:click={() => setTarget(99)}
              >
                99
              </button>
              <button 
                class="target-button {target === 100 ? 'active' : ''}" 
                on:click={() => setTarget(100)}
              >
                100
              </button>
            </div>
            
            <div class="custom-target {target === parseInt(customTarget) ? 'active' : ''}">
              <input
                type="number"
                bind:value={customTarget}
                on:focus={() => setTarget(customTarget)}
                placeholder="Custom"
                min="1"
                max="999"
              />
              <span>times</span>
            </div>
          </div>

          <button class="start-button" on:click={startCounter}>
            Start Dhikr
          </button>
        </div>
      </div>
    {:else}
      <div class="counter-mode">
        <button class="exit-button" on:click={exitCounter}>Exit</button>
        
        <div class="counter-content">
          <div class="dhikr-display">
            <span class="arabic-large">{selectedDhikr.arabic}</span>
            <span class="latin-large">{selectedDhikr.latin}</span>
            <span class="meaning">{selectedDhikr.meaning}</span>
          </div>

          <div class="progress">
            <span class="sets-display">Set {sets + 1}</span>
            <span class="count-large">{count}</span>
            <span class="target-display">of {selectedTarget}</span>
            <span class="total-count">Total: {totalCount}</span>
          </div>

          <button class="counter-button" on:click={increment}>
            <div class="inner-circle">
              <span class="tap-text">Tap</span>
            </div>
          </button>

          <button class="reset-button" on:click={reset}>Reset</button>
        </div>
      </div>
    {/if}
  {:else}
    <div class="quran-section">
      <QuranReading />
    </div>
  {/if}
</div>

{#if showBottomSheet}
  <div class="bottom-sheet-overlay" on:click={() => showBottomSheet = false} transition:fade>
    <div class="bottom-sheet" on:click|stopPropagation transition:slide={{ duration: 300, axis: 'y' }}>
      <h3>Mark {selectedPrayer?.name} Prayer</h3>
      <div class="mark-options">
        <button class="mark-btn on-time" on:click={() => markPrayer('ontime')}>
          <Check weight="bold" />
          Prayed On Time
        </button>
        <button class="mark-btn late" on:click={() => markPrayer('late')}>
          <Clock weight="bold" />
          Prayed Late
        </button>
      </div>
    </div>
  </div>
{/if}

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
    gap: 0.5rem;
    margin: 10px;
    padding: 0.75rem;
    justify-content: space-between;
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
    padding: 0.75rem;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.875rem;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    border: 1px solid transparent;
    flex: 1;
    min-width: 0;
  }

  .tab-button span {
    white-space: nowrap;
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
    padding-bottom: 6rem;
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

  .tasbih-section {
    padding: 1rem;
    max-width: 600px;
    margin: 0 auto;
    padding-bottom: 6rem;
  }

  .setup-card {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .streak-display {
    text-align: center;
    margin-bottom: 2rem;
    padding: 1rem;
    background: rgba(33, 105, 116, 0.1);
    border-radius: 8px;
  }

  .streak-count {
    font-size: 1.5rem;
    color: #216974;
    font-weight: 500;
  }

  .dhikr-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 2rem;
  }

  .dhikr-button {
    background: white;
    border: 1px solid #E0E0E0;
    padding: 1rem;
    border-radius: 8px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .dhikr-button.active {
    border-color: #216974;
    background: #216974;
    color: white;
  }

  .arabic {
    font-size: 1.5rem;
    font-weight: 500;
  }

  .latin {
    font-size: 0.875rem;
  }

  .target-selector {
    margin-bottom: 2rem;
  }

  .target-options {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .target-button {
    background: white;
    border: 1px solid #E0E0E0;
    padding: 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 1rem;
    color: #216974;
  }

  .target-button:hover {
    border-color: #216974;
  }

  .target-button.active {
    background: #216974;
    border-color: #216974;
    color: white;
  }

  .custom-target {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: white;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid #E0E0E0;
  }

  .custom-target input {
    width: 100px;
    border: none;
    padding: 0.5rem;
    font-size: 1rem;
    color: #216974;
    text-align: center;
  }

  .custom-target.active {
    border-color: #216974;
  }

  .start-button {
    background: #216974;
    color: white;
    width: 100%;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-size: 1.125rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .counter-mode {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #216974, #1a545d);
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    color: white;
    z-index: 1000;
  }

  .exit-button {
    position: absolute;
    top: 1rem;
    left: 1rem;
    background: rgba(255,255,255,0.2);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .counter-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
  }

  .dhikr-display {
    text-align: center;
  }

  .arabic-large {
    font-size: 3rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .latin-large {
    font-size: 1.5rem;
    display: block;
    margin-bottom: 0.25rem;
  }

  .meaning {
    font-size: 1rem;
    opacity: 0.8;
  }

  .progress {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .count-large {
    font-size: 5rem;
    font-weight: 500;
  }

  .sets-display, .target-display {
    font-size: 1.25rem;
    opacity: 0.8;
  }

  .total-count {
    font-size: 1rem;
    color: #E09453;
    margin-top: 0.5rem;
  }

  .counter-button {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 2px solid rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .inner-circle {
    width: 80%;
    height: 80%;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tap-text {
    font-size: 1.5rem;
    opacity: 0.9;
  }

  .counter-button:active {
    transform: scale(0.95);
    background: rgba(255,255,255,0.15);
  }

  .reset-button {
    background: rgba(255,255,255,0.1);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
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

    .tabs {
      padding: 0.5rem;
      gap: 0.25rem;
    }

    .tab-button {
      padding: 0.5rem;
      font-size: 0.75rem;
    }

    .tab-button :global(svg) {
      width: 16px;
      height: 16px;
    }
  }

  .quran-section {
    padding-bottom: 6rem;
  }

  .mark-prayer-btn {
    margin-top: 8px;
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    background-color: #E09453;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .mark-prayer-btn:hover {
    background-color: #d68642;
  }

  .bottom-sheet-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
    z-index: 9999;
  }

  .bottom-sheet {
    background-color: white;
    width: 100%;
    padding: 24px;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 10000;
  }

  .bottom-sheet h3 {
    margin: 0 0 20px;
    color: #216974;
    font-size: 18px;
    text-align: center;
  }

  .mark-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mark-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .mark-btn:active {
    transform: scale(0.98);
  }

  .mark-btn.on-time {
    background-color: #4CAF50;
    color: white;
  }

  .mark-btn.late {
    background-color: #FFA726;
    color: white;
  }

  .prayer-time-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    background-color: #f5f5f5;
    border-radius: 12px;
    transition: transform 0.2s;
  }

  .prayer-time-card.current {
    background-color: #FFF3E0;
    transform: scale(1.05);
  }

  .status-label {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .status-label:hover {
    opacity: 0.9;
  }

  .status-label.ontime {
    background-color: #4CAF50;
    color: white;
  }

  .status-label.late {
    background-color: #FFA726;
    color: white;
  }
</style>

