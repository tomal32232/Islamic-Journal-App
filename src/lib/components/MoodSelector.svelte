<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  const moods = [
    { 
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"/>
        <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"/>
        <path d="M15 9H15.01"/>
        <path d="M9 9H9.01"/>
      </svg>`,
      name: 'Grateful',
      description: 'Alhamdulillah',
      value: 'grateful'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/>
        <path d="M8 12H16"/>
        <path d="M12 8V16"/>
      </svg>`,
      name: 'Peaceful',
      description: 'Sabr',
      value: 'peaceful'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"/>
        <path d="M8 16C8 16 9.5 14 12 14C14.5 14 16 16 16 16"/>
        <path d="M12 7V11"/>
        <path d="M12 12L12 12.01"/>
      </svg>`,
      name: 'Anxious',
      description: 'Ya Allah',
      value: 'anxious'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"/>
        <path d="M16 16C16 16 14.5 14 12 14C9.5 14 8 16 8 16"/>
        <path d="M15 9H15.01"/>
        <path d="M9 9H9.01"/>
      </svg>`,
      name: 'Struggling',
      description: 'Astaghfirullah',
      value: 'struggling'
    }
  ];

  export let showSelector = true;

  function selectMood(mood) {
    dispatch('select', {
      value: mood.value,
      name: mood.name,
      description: mood.description,
      icon: mood.icon
    });
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
          title={mood.description}
        >
          <div class="mood-icon">
            {@html mood.icon}
          </div>
          <span class="mood-name">{mood.name}</span>
          <span class="mood-description">{mood.description}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .mood-selector {
    background: white;
    border-radius: 12px;
    padding: 1rem;
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
    margin-bottom: 1rem;
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
    padding: 0.75rem 0.5rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    transition: all 0.2s;
    flex: 1;
    border-radius: 8px;
  }

  .mood-button:hover {
    background-color: rgba(0, 0, 0, 0.05);
    transform: translateY(-2px);
  }

  .mood-icon {
    width: 2rem;
    height: 2rem;
    color: #4A5568;
    margin-bottom: 0.25rem;
  }

  .mood-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .mood-name {
    font-size: 0.8125rem;
    color: #2D3748;
    font-weight: 500;
  }

  .mood-description {
    font-size: 0.6875rem;
    color: #718096;
    font-weight: normal;
  }
</style> 