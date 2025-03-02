<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import MoodSelector from './MoodSelector.svelte';
  import OnboardingGuide from './OnboardingGuide.svelte';
  import { isFirstTimeVisitor } from '../stores/userPreferences';

  const dispatch = createEventDispatcher();

  export let period: 'morning' | 'evening';

  let showOnboarding = false;

  onMount(() => {
    // Check if user is a first-time visitor
    const unsubscribe = isFirstTimeVisitor.subscribe(value => {
      showOnboarding = value;
    });

    return unsubscribe;
  });

  function handleGuideClose() {
    showOnboarding = false;
  }

  function handleSelect(event) {
    dispatch('select', event.detail);
  }

  function handleSkip() {
    dispatch('skip');
  }

  function handleClose() {
    dispatch('close');
  }

  const titles = {
    morning: 'Morning Reflection',
    evening: 'Evening Reflection'
  };

  const subtitles = {
    morning: 'Start your day with mindful reflection',
    evening: 'End your day with peaceful contemplation'
  };

  // Add time indicator icons
  const timeIcons = {
    morning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" stroke-linecap="round" />
      <path d="M12 20v2" stroke-linecap="round" />
      <path d="M4.93 4.93l1.41 1.41" stroke-linecap="round" />
      <path d="M17.66 17.66l1.41 1.41" stroke-linecap="round" />
      <path d="M2 12h2" stroke-linecap="round" />
      <path d="M20 12h2" stroke-linecap="round" />
      <path d="M6.34 17.66l-1.41 1.41" stroke-linecap="round" />
      <path d="M19.07 4.93l-1.41 1.41" stroke-linecap="round" />
    </svg>`,
    evening: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 3v9l5.2 3.2" />
      <path d="M21 12h-9" />
    </svg>`
  };
</script>

<div class="popup-backdrop" transition:fade={{ duration: 300 }}>
  <div class="popup-content" transition:fly={{ y: 50, duration: 300, delay: 150 }}>
    <button class="close-button" on:click={handleClose}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    
    <div class="popup-header">
      <div class="time-indicator {period}">
        {@html timeIcons[period]}
      </div>
      <h2>{titles[period]}</h2>
      <p class="subtitle">{subtitles[period]}</p>
    </div>

    <div class="mood-selector-container">
      <MoodSelector on:select={handleSelect} />
    </div>

    <button class="skip-button" on:click={handleSkip}>
      Skip for now
    </button>
  </div>
</div>

{#if showOnboarding}
  <OnboardingGuide onClose={handleGuideClose} />
{/if}

<style>
  .popup-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    padding: 0;
    box-sizing: border-box;
  }

  .popup-content {
    background: white;
    border-radius: 24px 24px 0 0;
    padding: 2rem 1rem 0 1rem;
    width: 100%;
    height: 90vh;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    position: absolute;
    bottom: 0;
    box-shadow: 0 -10px 25px rgba(0, 0, 0, 0.1);
  }

  .close-button {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    background: none;
    border: none;
    cursor: pointer;
    color: #718096;
    padding: 0.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-button svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .close-button:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .popup-header {
    text-align: center;
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .time-indicator {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.75rem;
  }
  
  .time-indicator svg {
    width: 1.5rem;
    height: 1.5rem;
  }
  
  .morning {
    background: #FFF8E1;
    color: #F59E0B;
  }
  
  .evening {
    background: #E8F5E9;
    color: #10B981;
  }

  .popup-header h2 {
    color: #216974;
    font-size: 1.5rem;
    margin: 0;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #718096;
    font-size: 0.875rem;
    margin: 0;
  }

  .mood-selector-container {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .skip-button {
    width: 100%;
    padding: 0.75rem;
    background: none;
    border: none;
    color: #718096;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    margin: 1rem 0;
  }

  .skip-button:hover {
    color: #4A5568;
  }

  @media (min-width: 768px) {
    .popup-content {
      max-width: 500px;
      height: auto;
      max-height: 90vh;
      border-radius: 24px;
      padding: 2rem;
      bottom: auto;
    }
  }
</style> 