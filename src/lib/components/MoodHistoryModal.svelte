<script lang="ts">
  import { fade } from 'svelte/transition';

  interface MoodData {
    mood: string;
    guidance?: {
      arabicVerse: string;
      translation: string;
      guidance: string;
    };
  }

  export let moodData: MoodData | null = null;
  export let onClose = () => {};
  export let moods: any[] = [];

  $: selectedMood = moodData ? moods.find(m => m.value === moodData.mood) : null;
</script>

{#if moodData && selectedMood}
  <div class="modal-backdrop" on:click={onClose} transition:fade>
    <div class="modal-content" on:click|stopPropagation>
      <button class="close-button" on:click={onClose}>×</button>
      
      <div class="mood-header">
        <div class="mood-icon">
          {@html selectedMood.icon}
        </div>
        <h2 class="title">
          {selectedMood.name}
          <span class="subtitle">{selectedMood.description}</span>
        </h2>
      </div>

      {#if moodData.guidance}
        <div class="guidance-content">
          <div class="arabic-text">{moodData.guidance.arabicVerse}</div>
          <div class="translation">{moodData.guidance.translation}</div>
          <div class="guidance-text">
            <h3>Guidance</h3>
            <ol class="guidance-list">
              {#each moodData.guidance.guidance.split('\n').filter(line => line.trim()) as point}
                <li>{point.replace(/^\d+\.\s*/, '')}</li>
              {/each}
            </ol>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
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
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .close-button:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .mood-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .mood-icon {
    width: 2rem;
    height: 2rem;
    color: #216974;
  }

  .mood-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .title {
    font-size: 1.25rem;
    color: #216974;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #718096;
    font-weight: normal;
  }

  .guidance-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .arabic-text {
    font-family: 'Traditional Arabic', serif;
    font-size: 1.5rem;
    text-align: center;
    color: #2D3748;
    line-height: 1.8;
    direction: rtl;
  }

  .translation {
    font-size: 0.875rem;
    color: #4A5568;
    text-align: center;
    font-style: italic;
    padding: 0 1rem;
  }

  .guidance-text {
    border-top: 1px solid #E2E8F0;
    padding-top: 1rem;
  }

  .guidance-text h3 {
    font-size: 1rem;
    color: #2D3748;
    margin-bottom: 0.75rem;
    font-weight: 500;
  }

  .guidance-list {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.875rem;
    color: #4A5568;
    line-height: 1.6;
  }

  .guidance-list li {
    margin-bottom: 0.5rem;
  }

  .guidance-list li:last-child {
    margin-bottom: 0;
  }

  @media (max-width: 480px) {
    .modal-content {
      width: 95%;
      padding: 1rem;
    }

    .arabic-text {
      font-size: 1.25rem;
    }
  }
</style> 