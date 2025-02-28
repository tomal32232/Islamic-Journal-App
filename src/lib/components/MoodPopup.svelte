<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import MoodSelector from './MoodSelector.svelte';

  export let onSelect = (event) => {};
  export let onSkip = () => {};
  export let period: 'morning' | 'evening';

  const titles = {
    morning: 'Morning Reflection',
    evening: 'Evening Reflection'
  };

  const subtitles = {
    morning: 'Start your day with mindful reflection',
    evening: 'End your day with peaceful contemplation'
  };
</script>

<div class="popup-backdrop" transition:fade={{ duration: 300 }}>
  <div class="popup-content" transition:fly={{ y: 50, duration: 300, delay: 150 }}>
    <button class="close-button" on:click={onSkip}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    
    <div class="popup-header">
      <h2>{titles[period]}</h2>
      <p class="subtitle">{subtitles[period]}</p>
    </div>

    <div class="mood-selector-container">
      <MoodSelector on:select={onSelect} />
    </div>

    <button class="skip-button" on:click={onSkip}>
      Skip for now
    </button>
  </div>
</div>

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