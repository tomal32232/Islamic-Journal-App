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
          <div class="verse-container">
            <div class="arabic-text">{moodData.guidance.arabicVerse}</div>
            <div class="translation">{moodData.guidance.translation}</div>
          </div>
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
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: flex-end;
    z-index: 1000;
    padding: 1rem;
    padding-bottom: calc(1rem + 80px);
    box-sizing: border-box;
  }

  .modal-content {
    background: white;
    border-radius: 24px 24px 16px 16px;
    padding: 1.5rem;
    width: 100%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
    width: 32px;
    height: 32px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
  }

  .close-button:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .mood-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #E2E8F0;
  }

  .mood-icon {
    width: 2.5rem;
    height: 2.5rem;
    color: #216974;
    background: rgba(33, 105, 116, 0.1);
    padding: 0.5rem;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
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
    gap: 2rem;
  }

  .verse-container {
    background: #F8FAFC;
    padding: 1.5rem;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .arabic-text {
    font-family: 'Traditional Arabic', serif;
    font-size: 1.75rem;
    text-align: center;
    color: #216974;
    line-height: 1.8;
    direction: rtl;
  }

  .translation {
    font-size: 0.875rem;
    color: #4A5568;
    text-align: center;
    font-style: italic;
    padding: 0 1rem;
    line-height: 1.6;
  }

  .guidance-text {
    padding-top: 0.5rem;
  }

  .guidance-text h3 {
    font-size: 1.125rem;
    color: #216974;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .guidance-list {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.9375rem;
    color: #4A5568;
    line-height: 1.6;
  }

  .guidance-list li {
    margin-bottom: 0.75rem;
    padding-left: 0.5rem;
  }

  .guidance-list li:last-child {
    margin-bottom: 0;
  }

  @media (max-width: 480px) {
    .modal-backdrop {
      padding: 0.75rem;
      padding-bottom: calc(0.75rem + 80px);
    }

    .modal-content {
      padding: 1.25rem;
      border-radius: 20px 20px 12px 12px;
      max-height: 70vh;
    }

    .arabic-text {
      font-size: 1.5rem;
    }

    .verse-container {
      padding: 1.25rem;
    }

    .guidance-list {
      font-size: 0.875rem;
    }
  }

  /* Add smooth scrolling */
  .modal-content {
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

  /* Style scrollbar */
  .modal-content::-webkit-scrollbar {
    width: 8px;
  }

  .modal-content::-webkit-scrollbar-track {
    background: #F8FAFC;
    border-radius: 4px;
  }

  .modal-content::-webkit-scrollbar-thumb {
    background: #CBD5E0;
    border-radius: 4px;
  }

  .modal-content::-webkit-scrollbar-thumb:hover {
    background: #A0AEC0;
  }
</style> 