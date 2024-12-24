<script>
  import { createEventDispatcher } from 'svelte';
  import MoodGuidanceModal from './MoodGuidanceModal.svelte';
  const dispatch = createEventDispatcher();

  export let showSelector = true;
  let selectedMood = null;

  function handleMoodClick(mood) {
    selectedMood = mood;
  }

  function handleModalClose() {
    dispatch('select', {
      value: selectedMood.value,
      name: selectedMood.name,
      description: selectedMood.description,
      icon: selectedMood.icon
    });
    selectedMood = null;
    showSelector = false;
  }

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
      name: 'Seeking Peace',
      description: 'Sabr',
      value: 'seeking_peace'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"/>
        <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"/>
        <path d="M15 9H15.01"/>
        <path d="M9 9H9.01"/>
      </svg>`,
      name: 'Hopeful',
      description: 'InshaAllah',
      value: 'hopeful'
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
        <path d="M12 7V11"/>
        <path d="M12 12L12 12.01"/>
        <path d="M8 15H16"/>
      </svg>`,
      name: 'Reflecting',
      description: 'SubhanAllah',
      value: 'reflecting'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"/>
        <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"/>
        <path d="M15 9H15.01"/>
        <path d="M9 9H9.01"/>
      </svg>`,
      name: 'Blessed',
      description: 'MashaAllah',
      value: 'blessed'
    }
  ];
</script>

{#if showSelector}
  <div class="mood-selector">
    <h3 class="mood-title">How are you feeling today?</h3>
    <div class="mood-options">
      {#each moods as mood}
        <button 
          class="mood-button" 
          on:click={() => handleMoodClick(mood)}
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

<MoodGuidanceModal 
  mood={selectedMood} 
  onClose={handleModalClose}
/>

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
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 0.5rem;
    padding: 0.25rem;
  }

  .mood-button {
    background: none;
    border: none;
    padding: 0.5rem 0.25rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    transition: all 0.2s;
    border-radius: 8px;
    width: 100%;
  }

  .mood-button:hover {
    background-color: rgba(0, 0, 0, 0.05);
    transform: translateY(-2px);
  }

  .mood-icon {
    width: 1.75rem;
    height: 1.75rem;
    color: #4A5568;
    margin-bottom: 0.125rem;
  }

  .mood-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .mood-name {
    font-size: 0.75rem;
    color: #2D3748;
    font-weight: 500;
    text-align: center;
  }

  .mood-description {
    font-size: 0.625rem;
    color: #718096;
    font-weight: normal;
    text-align: center;
  }

  @media (max-width: 360px) {
    .mood-icon {
      width: 1.5rem;
      height: 1.5rem;
    }
  }
</style> 