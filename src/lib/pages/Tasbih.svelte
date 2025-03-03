<script>
  import { writable } from 'svelte/store';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { saveTasbihSession, getWeeklyStats, weeklyStatsStore } from '../stores/tasbihStore';
  import { updateDhikrProgress, updateDhikrStreak } from '../services/badgeProgressService';

  const dispatch = createEventDispatcher();

  const dhikrOptions = [
    { arabic: 'سُبْحَانَ ٱللَّٰهِ', latin: 'SubhanAllah', meaning: 'Glory be to Allah' },
    { arabic: 'ٱلْحَمْدُ لِلَّٰهِ', latin: 'Alhamdulillah', meaning: 'Praise be to Allah' },
    { arabic: 'ٱللَّٰهُ أَكْبَرُ', latin: 'Allahu Akbar', meaning: 'Allah is Greater' },
    { arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', latin: 'La ilaha illAllah', meaning: 'There is no deity except Allah' }
  ];

  const targetOptions = [33, 100, 1000];
  let customTarget = '';
  let selectedTarget = 33;
  let count = 0;
  let sets = 0;
  let totalCount = 0;
  let selectedDhikr = dhikrOptions[0];
  let isCounterMode = false;
  let weeklyStreak = 0;
  let target = 33;

  onMount(async () => {
    const stats = await getWeeklyStats();
    weeklyStreak = stats?.streak || 0;
  });

  function handleTargetChange(target) {
    selectedTarget = target;
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
    dispatch('countermodechange', { isCounterMode: true });
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
      
      // Update badge progress
      updateDhikrProgress(totalCount);
      updateDhikrStreak(weeklyStreak);
    }
  }

  async function exitCounter() {
    await saveSession();
    isCounterMode = false;
    count = 0;
    dispatch('countermodechange', { isCounterMode: false });
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
    target = parseInt(value) || 33;
    selectedTarget = target;
    count = 0;
  }

  function handleBeforeUnload(event) {
    if (isCounterMode && totalCount > 0) {
      saveSession();
      event.preventDefault();
      event.returnValue = '';
    }
  }

  onMount(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
  });

  onDestroy(() => {
    if (isCounterMode && totalCount > 0) {
      saveSession();
    }
    window.removeEventListener('beforeunload', handleBeforeUnload);
  });
</script>

{#if !isCounterMode}
  <div class="tasbih-container">
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

<style>
  .tasbih-container {
    padding: 0 10px;
    padding-bottom: 60px;
    width: 100%;
    box-sizing: border-box;
    margin-top: 20px;
  }

  @media (min-width: 600px) {
    .tasbih-container {
      max-width: 600px;
      margin: 20px auto 0;
      padding: 0 1rem;
    }
  }

  .setup-card {
    background: white;
    padding: 0.75rem;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }

  h2 {
    font-size: 1.125rem;
    color: #216974;
    margin-bottom: 0.75rem;
    font-weight: 500;
  }

  h3 {
    font-size: 1rem;
    color: #216974;
    margin-bottom: 0.75rem;
    font-weight: 500;
  }

  .dhikr-selector, .target-selector {
    margin-bottom: 0.75rem;
  }

  .dhikr-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .dhikr-button {
    background: white;
    border: 1px solid #E0E0E0;
    padding: 0.75rem;
    border-radius: 8px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    transition: all 0.2s ease;
  }

  .dhikr-button.active {
    border-color: #216974;
    background: #216974;
    color: white;
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
    transition: all 0.2s ease;
    font-size: 0.875rem;
    text-align: center;
    color: #216974;
  }

  .target-button:hover {
    border-color: #216974;
    transform: translateY(-1px);
  }

  .target-button.active {
    background: #216974;
    border-color: #216974;
    color: white;
    font-weight: 500;
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
    padding: 0.25rem;
    font-size: 0.875rem;
    color: #216974;
    text-align: center;
  }

  .custom-target input:focus {
    outline: none;
  }

  .custom-target.active {
    border-color: #216974;
    background: #216974;
  }

  .custom-target.active input {
    background: white;
    border-radius: 4px;
  }

  .custom-target span {
    color: #666;
    font-size: 0.875rem;
  }

  .custom-target.active span {
    color: white;
  }

  .start-button {
    background: #216974;
    color: white;
    width: 100%;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-size: 1.125rem;
    margin-top: 2rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .counter-mode {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #216974, #1a545d);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    color: white;
  }

  .exit-button {
    position: absolute;
    top: 1rem;
    left: 1rem;
    background: rgba(255,255,255,0.2);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .counter-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 3rem 1rem 2rem 1rem;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }

  .dhikr-display {
    text-align: center;
    width: 100%;
    max-width: 90%;
    margin: 0 auto;
  }

  .arabic-large {
    font-size: min(4vw, 1.75rem);
    display: block;
    margin-bottom: 0.5rem;
    line-height: 1.3;
  }

  .latin-large {
    font-size: min(4vw, 1rem);
    display: block;
    margin-bottom: 0.25rem;
    opacity: 0.9;
  }

  .meaning {
    font-size: min(3.5vw, 0.875rem);
    display: block;
    opacity: 0.7;
    margin-bottom: 0.5rem;
  }

  .progress {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin: 1rem 0;
  }

  .sets-display {
    font-size: min(3.5vw, 1rem);
    opacity: 0.8;
    display: block;
  }

  .count-large {
    font-size: min(12vw, 4rem);
    font-weight: 500;
    display: block;
    line-height: 1;
  }

  .target-display {
    font-size: min(4vw, 1rem);
    opacity: 0.8;
  }

  .total-count {
    display: block;
    font-size: min(3.5vw, 0.875rem);
    opacity: 0.8;
    color: #E09453;
    margin-top: 0.25rem;
  }

  .counter-button {
    width: min(60vw, 180px);
    height: min(60vw, 180px);
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 2px solid rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    margin: 1rem 0;
  }

  .inner-circle {
    width: 85%;
    height: 85%;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .tap-text {
    font-size: min(4vw, 1.25rem);
    color: white;
    opacity: 0.9;
  }

  .counter-button:active .inner-circle {
    transform: scale(0.95);
    background: rgba(255,255,255,0.25);
  }

  .reset-button {
    background: rgba(255,255,255,0.1);
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 100px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .reset-button:hover {
    background: rgba(255,255,255,0.15);
  }

  /* Add responsive container for better layout on larger screens */
  @media (min-width: 768px) {
    .counter-content {
      gap: 3rem;
    }

    .dhikr-display {
      margin-bottom: 0;
    }

    .progress {
      margin: 0;
    }
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
</style>
