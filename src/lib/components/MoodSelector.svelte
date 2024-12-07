<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  const moods = [
    { emoji: '🤲', name: 'Grateful', value: 'grateful' },
    { emoji: '☪️', name: 'Peaceful', value: 'peaceful' },
    { emoji: '📿', name: 'Reflective', value: 'reflective' },
    { emoji: '🕌', name: 'Seeking Guidance', value: 'seeking' }
  ];

  export let showSelector = true;

  function selectMood(mood) {
    dispatch('select', mood);
    showSelector = false;
  }
</script>

{#if showSelector}
  <div class="mood-selector">
    <h3 class="mood-title">How are you feeling today?</h3>
    <div class="mood-options">
      {#each moods as mood}
        <button 
          class="mood-button" 
          on:click={() => selectMood(mood)}
          title={mood.name}
        >
          <span class="mood-emoji">{mood.emoji}</span>
          <span class="mood-name">{mood.name}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .mood-selector {
    background: white;
    border-radius: 12px;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border: 1px solid transparent;
    background-image: linear-gradient(white, white), 
                     linear-gradient(to bottom, 
                       rgba(0, 0, 0, 0.01) 0%,
                       rgba(0, 0, 0, 0.1) 100%);
    background-origin: border-box;
    background-clip: padding-box, border-box;
  }

  .mood-title {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.75rem;
    text-align: center;
    font-weight: normal;
  }

  .mood-options {
    display: flex;
    justify-content: space-around;
    gap: 0.75rem;
  }

  .mood-button {
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    transition: transform 0.2s;
    flex: 1;
  }

  .mood-button:hover {
    transform: scale(1.1);
  }

  .mood-emoji {
    font-size: 1.75rem;
  }

  .mood-name {
    font-size: 0.75rem;
    color: #666;
  }
</style> 