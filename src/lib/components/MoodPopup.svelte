<script lang="ts">
  import { fade } from 'svelte/transition';
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
  <div class="popup-content" transition:fade={{ duration: 300, delay: 150 }}>
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
    padding: 1rem;
    box-sizing: border-box;
  }

  .popup-content {
    background: white;
    border-radius: 24px;
    padding: 2rem;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  }

  .popup-header {
    text-align: center;
    margin-bottom: 2rem;
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
    margin-bottom: 2rem;
  }

  .skip-button {
    width: 100%;
    padding: 0.75rem;
    background: none;
    border: 1px solid #E2E8F0;
    border-radius: 12px;
    color: #718096;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .skip-button:hover {
    background: #F7FAFC;
    border-color: #CBD5E0;
  }
</style> 