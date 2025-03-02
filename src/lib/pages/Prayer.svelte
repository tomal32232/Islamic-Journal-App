<script>
  import { onMount, onDestroy } from 'svelte';
  import { 
    prayerTimesStore, 
    loadingStore, 
    errorStore, 
    fetchPrayerTimes,
    getCurrentLocation 
  } from '../services/prayerTimes';
  import { savePrayerStatus, getPrayerHistory, prayerHistoryStore, initializeMonthlyPrayers, updatePrayerStatuses, cache as prayerHistoryCache } from '../stores/prayerHistoryStore';
  import { iconMap } from '../utils/icons';
  import { nearbyMosquesStore, mosqueLoadingStore, fetchNearbyMosques } from '../services/mosqueService';
  import QuranReading from '../components/QuranReading.svelte';
  import { Mosque, Book, HandsPraying, Check, Clock } from 'phosphor-svelte';
  import { saveTasbihSession, getWeeklyStats, weeklyStatsStore, ensureAccurateDailyCount } from '../stores/tasbihStore';
  import { fade, slide } from 'svelte/transition';
  import { auth } from '../firebase';

  let timeInterval;
  let currentPrayer = null;
  let nextPrayer = null;
  let activeTab = 'prayer'; // 'prayer', 'quran', or 'tasbih'
  let scrollY = 0;
  let showBottomSheet = false;
  let selectedPrayer = null;
  let isClosing = false;

  // Tasbih state
  const dhikrOptions = [
    { arabic: 'سُبْحَانَ ٱللَّٰهِ', latin: 'SubhanAllah', meaning: 'Glory be to Allah' },
    { arabic: 'ٱلْحَمْدُ لِلَّٰهِ', latin: 'Alhamdulillah', meaning: 'Praise be to Allah' },
    { arabic: 'ٱللَّٰهُ أَكْبَرُ', latin: 'Allahu Akbar', meaning: 'Allah is Greater' },
    { arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', latin: 'La ilaha illAllah', meaning: 'There is no deity except Allah' },
    { arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ', latin: 'Astagfirullah', meaning: 'I seek forgiveness from Allah' }
  ];

  let selectedDhikrs = [];
  let manualCountStr = '';
  let count = 0;
  let sets = 0;
  let totalCount = 0;
  let selectedTarget = 33;
  let customTarget = '';
  let isCounterMode = false;
  let weeklyStreak = 0;
  let target = 33;

  // Track if initial data has been loaded
  let initialDataLoaded = false;

  // Add a flag to track if we're currently loading data
  let isLoadingPrayerData = false;

  let showManualDhikrPopup = false;
  let manualDhikrSelection = null;
  let manualDhikrCount = 33;
  let manualDhikrText = '';

  function getNextPrayer(prayers) {
    if (!prayers || prayers.length === 0) {
      return null;
    }
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Convert prayer times to minutes for comparison
    const prayerMinutes = prayers.map(prayer => {
      const [time, period] = prayer.time.split(' ');
      const [hours, minutes] = time.split(':');
      let hour = parseInt(hours);
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      
      const totalMinutes = hour * 60 + parseInt(minutes);
      
      return {
        ...prayer,
        minutes: totalMinutes
      };
    });

    // Find the next prayer for today
    let next = prayerMinutes.find(prayer => prayer.minutes > currentTime);
    
    // If no next prayer today, only return Fajr if it's after midnight
    if (!next) {
      const fajr = prayers[0]; // Fajr is always the first prayer
      const [fajrTime, fajrPeriod] = fajr.time.split(' ');
      const [fajrHours, fajrMinutes] = fajrTime.split(':');
      let fajrHour = parseInt(fajrHours);
      if (fajrPeriod === 'AM' && fajrHour === 12) fajrHour = 0;
      
      // Only show Fajr as next prayer if current time is after midnight and before Fajr
      if (now.getHours() >= 0 && now.getHours() < fajrHour) {
        return fajr;
      }
      return null; // No next prayer to show
    }

    return next;
  }

  function handleScroll(event) {
    const container = event.target;
    scrollY = container.scrollTop;
  }

  function getPrayerStatus(prayerName) {
    const today = new Date().toLocaleDateString('en-CA');
    const prayer = $prayerHistoryStore?.history?.find(
      p => p.date === today && p.prayerName === prayerName
    );
    // console.log(`Getting status for ${prayerName}:`, prayer?.status);
    return prayer?.status;
  }

  // Add reactive statement to handle prayer history updates
  $: if ($prayerHistoryStore?.history) {
    // console.log('Prayer history updated:', $prayerHistoryStore.history);
    // Force component update
    $prayerTimesStore = [...$prayerTimesStore];
  }

  // Add a reactive statement to recalculate the daily count when the user navigates to the tasbih tab
  $: if (activeTab === 'tasbih' && auth.currentUser) {
    ensureAccurateDailyCount().catch(error => {
      console.error('Error ensuring accurate daily count:', error);
    });
  }

  onMount(() => {
    const container = document.querySelector('.prayer-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }

    // Set up interval to update next prayer
    timeInterval = setInterval(() => {
      if ($prayerTimesStore.length > 0) {
        nextPrayer = getNextPrayer($prayerTimesStore);
      }
    }, 60000); // Update every minute

    // Initial update
    if ($prayerTimesStore.length > 0) {
      nextPrayer = getNextPrayer($prayerTimesStore);
    }

    // Check if we already have data in the store
    const hasHistoryData = $prayerHistoryStore?.history && $prayerHistoryStore.history.length > 0;
    const hasPrayerTimes = $prayerTimesStore && $prayerTimesStore.length > 0;
    
    if (hasHistoryData && hasPrayerTimes && !initialDataLoaded) {
      console.log('Using existing data from stores');
      // Just update prayer statuses without fetching everything
      isLoadingPrayerData = true;
      updatePrayerStatuses().then(() => {
        nextPrayer = getNextPrayer($prayerTimesStore);
        initialDataLoaded = true;
        isLoadingPrayerData = false;
      }).catch(error => {
        console.error('Error updating prayer statuses:', error);
        isLoadingPrayerData = false;
      });
    } else if (!initialDataLoaded) {
      // Initial data load only if not already loaded
      console.log('Loading initial data');
      isLoadingPrayerData = true;
      Promise.all([
        getPrayerHistory(),
        fetchPrayerTimes(),
        updatePrayerStatuses()
      ]).then(() => {
        // Update next prayer after data is loaded
        nextPrayer = getNextPrayer($prayerTimesStore);
        initialDataLoaded = true;
        isLoadingPrayerData = false;
      }).catch(error => {
        console.error('Error loading initial data:', error);
        isLoadingPrayerData = false;
      });
    }

    getWeeklyStats().then(stats => {
      weeklyStreak = stats?.streak || 0;
    });

    // Ensure the daily count is accurate
    if (auth.currentUser) {
      ensureAccurateDailyCount().catch(error => {
        console.error('Error ensuring accurate daily count:', error);
      });
    }

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
    const numValue = customTarget ? parseInt(customTarget) : null;
    if (numValue && !isNaN(numValue)) {
      selectedTarget = numValue;
      count = 0;
    }
  }

  function startCounter() {
    isCounterMode = true;
    document.body.classList.add('counter-active');
  }

  async function exitCounter() {
    if (totalCount > 0) {
      isLoadingPrayerData = true;
      console.log(`Saving session: totalCount=${totalCount}, dhikrs selected=${selectedDhikrs.length}`);
      try {
        // Flag to indicate if we're in a multi-dhikr session
        const isMultiDhikr = selectedDhikrs.length > 1;
        
        // Save each dhikr as a separate session, but only count the first one
        for (let i = 0; i < selectedDhikrs.length; i++) {
          const dhikr = selectedDhikrs[i];
          const isFirstDhikr = i === 0; // Only the first dhikr will contribute to the total count
          
          console.log(`Saving dhikr: ${dhikr.latin}, totalCount=${isFirstDhikr ? totalCount : 0}, isFirstDhikr=${isFirstDhikr}`);
          await saveTasbihSession({
            dhikr,
            count,
            sets,
            // Only pass the totalCount for the first dhikr to prevent double counting
            totalCount: isFirstDhikr ? totalCount : 0,
            isManualEntry: dhikr.isCustom,
            isMultiDhikr,
            isFirstDhikr
          });
        }
        const stats = await getWeeklyStats();
        weeklyStreak = stats?.streak || 0;
      } catch (error) {
        console.error('Error saving dhikr session:', error);
      } finally {
        isLoadingPrayerData = false;
      }
    }
    isCounterMode = false;
    document.body.classList.remove('counter-active');
    count = 0;
  }

  function increment() {
    count++;
    totalCount++;
    console.log(`Increment: count=${count}, totalCount=${totalCount}, dhikrs selected=${selectedDhikrs.length}`);
    
    // No need to recalculate after each tap - we'll do it when saving
    // This was causing unnecessary database operations
    // The recalculation will happen when the session is saved
    
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
    console.log('Counter reset: all counts set to 0');
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

  async function closeBottomSheet() {
    isClosing = true;
    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    showBottomSheet = false;
    isClosing = false;
  }

  async function markPrayer(status) {
    if (!selectedPrayer) return;

    const today = new Date().toLocaleDateString('en-CA');
    isLoadingPrayerData = true;
    
    try {
      // First save the prayer status
      await savePrayerStatus({
        name: selectedPrayer.name,
        time: selectedPrayer.time,
        status,
        date: today
      });

      // Close the popup immediately after saving
      showBottomSheet = false;
      selectedPrayer = null;

      // Then refresh the data
      await Promise.all([
        getPrayerHistory(),
        fetchPrayerTimes(),
        updatePrayerStatuses()
      ]);

      // Force a UI update by creating a new array
      $prayerTimesStore = [...$prayerTimesStore];
      
      // Invalidate the prayer history cache to force a fresh fetch
      prayerHistoryCache.prayerHistory = null;
      prayerHistoryCache.lastFetched = null;
      
      // Fetch fresh data
      await getPrayerHistory();
    } finally {
      isLoadingPrayerData = false;
    }
  }

  // Add this function to handle manual refresh
  async function refreshPrayerData() {
    await Promise.all([
      getPrayerHistory(),
      fetchPrayerTimes(),
      updatePrayerStatuses()
    ]);
    prayerHistoryStore.update(store => ({ ...store }));
  }

  function shouldShowMarkButton(prayer) {
    const now = new Date();
    const today = now.toLocaleDateString('en-CA');
    
    // Get the prayer date by converting its time to a full date
    const [time, period] = prayer.time.split(' ');
    const [hours, minutes] = time.split(':');
    let hour = parseInt(hours);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    const prayerDate = new Date();
    prayerDate.setHours(hour, parseInt(minutes), 0);
    
    // Check if the prayer is from today
    const prayerDateStr = prayerDate.toLocaleDateString('en-CA');
    if (prayerDateStr !== today) {
      return false; // Don't show mark button for prayers not from today
    }
    
    // Check if prayer has already been marked
    const status = getPrayerStatus(prayer.name);
    if (status === 'ontime' || status === 'late') {
      return false; // Already marked, don't show mark button
    }
    
    // For today's prayers that have passed and haven't been marked, show mark button
    return isPrayerPassed(prayer.time);
  }

  function openManualDhikrPopup() {
    manualDhikrText = '';
    manualDhikrCount = 33;
    showManualDhikrPopup = true;
  }

  async function submitManualDhikr() {
    if (manualDhikrText?.trim() && manualDhikrCount > 0) {
      try {
        // Create a custom dhikr object similar to predefined ones
        const customDhikr = {
          text: manualDhikrText.trim(),
          latin: manualDhikrText.trim(),
          arabic: manualDhikrText.trim(),
          meaning: '',
          isCustom: true
        };
        
        // Set this as the selected dhikr
        selectedDhikrs = [customDhikr];
        
        // Close the popup
        showManualDhikrPopup = false;
        
        // Start counter mode
        isCounterMode = true;
        
        // Reset counters
        count = 0;
        sets = 0;
        totalCount = 0;
        
        // Set the target
        selectedTarget = manualDhikrCount;
        target = manualDhikrCount;
      } catch (error) {
        console.error('Error setting up manual dhikr:', error);
      }
    }
  }

  function toggleDhikr(dhikr) {
    const index = selectedDhikrs.findIndex(d => d.latin === dhikr.latin);
    if (index === -1) {
      selectedDhikrs = [...selectedDhikrs, dhikr];
    } else {
      selectedDhikrs = selectedDhikrs.filter(d => d.latin !== dhikr.latin);
    }
  }

  function saveSession() {
    return exitCounter();
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
      <div class="prayer-times-card">
        <div class="header">
          <h2>Prayer Times</h2>
        </div>
      
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
                    size={20} 
                    weight={prayer.weight}
                    color={prayer.name === nextPrayer?.name ? '#E09453' : '#216974'}
                  />
                </div>
                <div class="prayer-info">
                  <span class="prayer-name">{prayer.name}</span>
                  <span class="prayer-time">{prayer.time}</span>
                </div>
                {#if getPrayerStatus(prayer.name) === 'ontime' || getPrayerStatus(prayer.name) === 'late'}
                  <button 
                    class="status-label {getPrayerStatus(prayer.name)}"
                    on:click={() => openMarkPrayerSheet(prayer)}
                  >
                    {#if getPrayerStatus(prayer.name) === 'ontime'}
                      <Check weight="bold" size={14} />
                      On Time
                    {:else}
                      <Clock weight="bold" size={14} />
                      Late
                    {/if}
                  </button>
                {:else if shouldShowMarkButton(prayer)}
                  <button 
                    class="mark-prayer-btn"
                    on:click={() => openMarkPrayerSheet(prayer)}
                  >
                    Mark Prayer
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else if activeTab === 'tasbih'}
    {#if !isCounterMode}
      <div class="tasbih-section">
        <div class="setup-card">
          <h2>Select Dhikr (Multiple Selection)</h2>
          <div class="dhikr-options">
            {#each dhikrOptions as dhikr}
              <button 
                class="dhikr-button {selectedDhikrs.some(d => d.latin === dhikr.latin) ? 'active' : ''}"
                on:click={() => toggleDhikr(dhikr)}
              >
                <span class="arabic">{dhikr.arabic}</span>
                <span class="latin">{dhikr.latin}</span>
              </button>
            {/each}
            <button class="dhikr-button add-dhikr" on:click={openManualDhikrPopup}>
              <span class="arabic">+</span>
              <span class="latin">Choose your own Dhikr</span>
            </button>
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
            {#each selectedDhikrs as dhikr}
              <div class="dhikr-item">
                <span class="arabic-large">{dhikr.isCustom ? dhikr.text : dhikr.arabic}</span>
                <span class="latin-large">{dhikr.latin}</span>
                {#if !dhikr.isCustom}
                  <span class="meaning">{dhikr.meaning}</span>
                {/if}
              </div>
            {/each}
          </div>

          <div class="progress">
            <div class="count-info">
              <span class="sets-display">Set {sets + 1}</span>
              <span class="total-count">Total: {totalCount}</span>
            </div>
            <span class="count-large">{count}</span>
            <span class="target-display">of {selectedTarget}</span>
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
  <div 
    class="bottom-sheet-overlay" 
    on:click={closeBottomSheet} 
    transition:fade
  >
    <div 
      class="bottom-sheet" 
      class:sliding-down={isClosing}
      on:click|stopPropagation 
      transition:slide={{ duration: 300, axis: 'y' }}
    >
      <h3>Mark {selectedPrayer?.name} Prayer</h3>
      <div class="mark-options">
        <button 
          class="mark-btn on-time" 
          on:click={() => markPrayer('ontime')}
          disabled={isLoadingPrayerData}
        >
          {#if isLoadingPrayerData}
            <div class="loading-spinner"></div>
          {:else}
            <Check weight="bold" />
            Prayed On Time
          {/if}
        </button>
        <button 
          class="mark-btn late" 
          on:click={() => markPrayer('late')}
          disabled={isLoadingPrayerData}
        >
          {#if isLoadingPrayerData}
            <div class="loading-spinner"></div>
          {:else}
            <Clock weight="bold" />
            Prayed Late
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showManualDhikrPopup}
  <div 
    class="popup-overlay" 
    on:click={() => showManualDhikrPopup = false} 
    transition:fade
  >
    <div 
      class="popup-content"
      on:click|stopPropagation
      transition:slide={{ duration: 300, axis: 'y' }}
    >
      <h3>Start Dhikr</h3>
      
      <div class="popup-section">
        <h4>Enter Dhikr Text</h4>
        <div class="dhikr-input">
          <input 
            type="text" 
            bind:value={manualDhikrText}
            placeholder="Enter your dhikr"
            class="text-input"
          />
        </div>
      </div>

      <div class="popup-section">
        <h4>Enter Count</h4>
        <div class="count-input">
          <input 
            type="number" 
            bind:value={manualDhikrCount}
            min="1" 
            max="1000"
            placeholder="Enter count"
          />
        </div>
      </div>

      <div class="popup-actions">
        <button 
          class="cancel-button" 
          on:click={() => showManualDhikrPopup = false}
        >
          Cancel
        </button>
        <button 
          class="submit-button" 
          on:click={submitManualDhikr}
          disabled={!manualDhikrText?.trim() || manualDhikrCount <= 0}
        >
          Add Dhikr
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
    padding: 0 16px;
    margin-top: 16px;
    padding-bottom: 6rem;
  }

  .prayer-times-card {
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
    font-size: 1rem;
    color: #216974;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .prayer-times-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    background: white;
    border-radius: 12px;
    padding: 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }

  .prayer-time-card {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border-radius: 8px;
    background: #fafafa;
    gap: 1rem;
    position: relative;
  }

  .prayer-time-card.current {
    background: rgba(224, 148, 83, 0.08);
    border: 1px solid #E09453;
  }

  .icon-wrapper {
    background: white;
    padding: 0.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }

  .prayer-info {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .prayer-name {
    font-size: 0.9375rem;
    color: #1a1a1a;
    font-weight: 500;
  }

  .prayer-time {
    font-size: 0.9375rem;
    font-weight: 500;
    color: #4a5568;
  }

  .prayer-time-card.current .prayer-name,
  .prayer-time-card.current .prayer-time {
    color: #E09453;
  }

  .status-label,
  .mark-prayer-btn {
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .status-label.ontime {
    background: #E5F6E5;
    color: #166534;
  }

  .status-label.late {
    background: #FEF3C7;
    color: #92400E;
  }

  .mark-prayer-btn {
    background: #216974;
    color: white;
  }

  .mark-prayer-btn:hover {
    opacity: 0.9;
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

  .dhikr-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .dhikr-button {
    background: white;
    border: 1px solid #E0E0E0;
    padding: 0.75rem 0.5rem;
    border-radius: 8px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .dhikr-button.active {
    border-color: #216974;
    background: #216974;
    color: white;
  }

  .dhikr-button.add-dhikr {
    border-style: dashed;
    color: #216974;
  }

  .dhikr-button.add-dhikr:hover {
    background: rgba(33, 105, 116, 0.05);
    border-color: #216974;
  }

  .dhikr-button.add-dhikr .arabic {
    font-size: 1.5rem;
    font-weight: 300;
  }

  .arabic {
    font-size: 1.25rem;
    font-weight: 500;
  }

  .latin {
    font-size: 0.75rem;
  }

  .target-selector {
    margin-bottom: 1.5rem;
  }

  .target-options {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .target-button {
    background: white;
    border: 1px solid #E0E0E0;
    padding: 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
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
    padding: 0.5rem;
    border-radius: 6px;
    border: 1px solid #E0E0E0;
  }

  .custom-target input {
    width: 80px;
    border: none;
    padding: 0.375rem;
    font-size: 0.875rem;
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
    padding: 0.75rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
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
    display: flex;
    flex-direction: column;
    align-items: center;
    color: white;
    z-index: 999999;
    height: 100vh;
    min-height: 100vh;
    max-height: 100vh;
    overflow: hidden;
  }

  :global(body.counter-active) {
    overflow: hidden !important;
    position: fixed !important;
    width: 100% !important;
    height: 100% !important;
    max-height: 100vh !important;
  }

  :global(body.counter-active nav),
  :global(body.counter-active div[style*="position: fixed"]),
  :global(body.counter-active div[style*="position:fixed"]),
  :global(body.counter-active *[style*="bottom: 0"]),
  :global(body.counter-active *[style*="bottom:0"]) {
    display: none !important;
    z-index: -1 !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }

  .exit-button {
    position: absolute;
    top: 1rem;
    left: 1rem;
    background: rgba(255,255,255,0.15);
    color: white;
    border: none;
    padding: 0.5rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .exit-button:hover {
    background: rgba(255,255,255,0.2);
  }

  .counter-content {
    height: 100%;
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 4rem 1rem 2rem;
    box-sizing: border-box;
  }

  .dhikr-display {
    text-align: center;
    width: 100%;
    padding: 0.75rem;
    background: rgba(255,255,255,0.1);
    border-radius: 12px;
    margin-bottom: 1.5rem;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    align-items: start;
  }

  .dhikr-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
  }

  .arabic-large {
    font-size: 1.5rem;
    font-weight: 500;
    line-height: 1.2;
  }

  .latin-large {
    font-size: 0.875rem;
    opacity: 0.9;
  }

  .meaning {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .progress {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin: 1rem 0 2rem;
  }

  .count-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .count-large {
    font-size: 4.5rem;
    font-weight: 600;
    line-height: 1;
    color: #fff;
    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .sets-display {
    font-size: 1.125rem;
    opacity: 0.9;
    font-weight: 500;
  }

  .target-display {
    font-size: 1rem;
    opacity: 0.7;
  }

  .total-count {
    font-size: 0.875rem;
    color: rgba(255,255,255,0.9);
    background: rgba(224, 148, 83, 0.2);
    padding: 0.375rem 1rem;
    border-radius: 100px;
  }

  .counter-button {
    width: 130px;
    height: 130px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 2px solid rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 1.5rem;
    flex-shrink: 0;
  }

  .inner-circle {
    width: 85%;
    height: 85%;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .tap-text {
    font-size: 1.125rem;
    opacity: 0.9;
    font-weight: 500;
  }

  .counter-button:active .inner-circle {
    transform: scale(0.95);
    background: rgba(255,255,255,0.25);
  }

  .reset-button {
    background: rgba(255,255,255,0.1);
    color: white;
    border: none;
    padding: 0.625rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .reset-button:hover {
    background: rgba(255,255,255,0.15);
  }

  @media (max-height: 700px) {
    .counter-content {
      padding: 3rem 1rem 1.5rem;
    }

    .dhikr-display {
      margin-bottom: 1rem;
      padding: 0.5rem;
      gap: 0.5rem;
    }

    .arabic-large {
      font-size: 1.25rem;
    }

    .latin-large {
      font-size: 0.75rem;
    }

    .meaning {
      font-size: 0.675rem;
    }

    .progress {
      margin: 0.75rem 0 1.5rem;
    }

    .count-large {
      font-size: 3.5rem;
    }

    .counter-button {
      width: 130px;
      height: 130px;
      margin-bottom: 1rem;
    }
  }

  .quran-section {
    padding-bottom: 6rem;
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
    transform: translateY(0);
    transition: transform 0.3s ease-in-out;
  }

  .bottom-sheet.sliding-down {
    transform: translateY(100%);
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

  .popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 1000;
  }

  .popup-content {
    background: white;
    border-radius: 12px;
    padding: 1.25rem;
    width: 100%;
    max-width: 320px;
  }

  .popup-content h3 {
    color: #216974;
    font-size: 1.125rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .popup-section {
    margin-bottom: 1rem;
  }

  .popup-section h4 {
    color: #216974;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .dhikr-input {
    margin-bottom: 1rem;
  }

  .text-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #E0E0E0;
    border-radius: 8px;
    font-size: 1rem;
    color: #216974;
  }

  .text-input:focus {
    outline: none;
    border-color: #216974;
    box-shadow: 0 0 0 2px rgba(33, 105, 116, 0.1);
  }

  .count-input {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .count-input input[type="number"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #E0E0E0;
    border-radius: 8px;
    text-align: center;
    font-size: 1rem;
  }

  .popup-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .cancel-button, .submit-button {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button {
    background: #f1f1f1;
    color: #666;
  }

  .submit-button {
    background: #216974;
    color: white;
  }

  .submit-button:disabled {
    background: #cccccc;
    cursor: not-allowed;
  }
</style>

