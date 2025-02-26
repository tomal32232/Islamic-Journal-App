<script>
  import { createEventDispatcher } from 'svelte';
  import MoodGuidanceModal from './MoodGuidanceModal.svelte';
  const dispatch = createEventDispatcher();

  export let showSelector = true;
  let selectedMood = null;

  function handleMoodClick(mood) {
    selectedMood = mood;
  }

  function handleModalClose(guidance) {
    dispatch('select', {
      value: selectedMood.value,
      name: selectedMood.name,
      description: selectedMood.description,
      icon: selectedMood.icon,
      guidance: guidance
    });
    selectedMood = null;
    showSelector = false;
  }

  const moods = [
    { 
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
        <path d="M8 13C8.5 15 10.5 16 12 16C13.5 16 15.5 15 16 13" stroke-linecap="round" />
        <path d="M9 9H9.01" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
        <path d="M15 9H15.01" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
      </svg>`,
      name: 'Grateful',
      description: 'Alhamdulillah',
      value: 'grateful'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
        <path d="M12 7V12L14.5 14.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M7.5 12H8.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M15.5 12H16.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>`,
      name: 'Seeking Peace',
      description: 'Sabr',
      value: 'seeking_peace'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
        <path d="M12 16L12 7" stroke-linecap="round" />
        <path d="M9 13L12 16L15 13" stroke-linecap="round" stroke-linejoin="round" />
      </svg>`,
      name: 'Hopeful',
      description: 'InshaAllah',
      value: 'hopeful'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
        <path d="M8 15H16" stroke-linecap="round" />
        <path d="M9 9H9.01" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
        <path d="M15 9H15.01" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
      </svg>`,
      name: 'Anxious',
      description: 'Ya Allah',
      value: 'anxious'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
        <path d="M12 7V12" stroke-linecap="round" />
        <path d="M12 16H12.01" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
      </svg>`,
      name: 'Reflecting',
      description: 'SubhanAllah',
      value: 'reflecting'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
        <path d="M12 16L12 7" stroke-linecap="round" />
        <path d="M15 10L12 7L9 10" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M9 14L12 16L15 14" stroke-linecap="round" stroke-linejoin="round" />
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
    border: 1px solid transparent;
    padding: 1.25rem 0.5rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.2s;
    border-radius: 12px;
    width: 100%;
  }

  .mood-button:hover {
    background-color: #F7FAFC;
    border-color: #E2E8F0;
    transform: translateY(-2px);
  }

  .mood-icon {
    width: 3rem;
    height: 3rem;
    color: #216974;
    background: rgba(33, 105, 116, 0.1);
    padding: 1rem;
    border-radius: 20px;
    transition: all 0.2s;
  }

  .mood-button:hover .mood-icon {
    background: rgba(33, 105, 116, 0.15);
    transform: scale(1.05);
  }

  .mood-name {
    font-size: 0.875rem;
    color: #2D3748;
    font-weight: 500;
    text-align: center;
  }

  .mood-description {
    font-size: 0.75rem;
    color: #718096;
    font-weight: normal;
    text-align: center;
  }

  @media (max-width: 360px) {
    .mood-icon {
      width: 2.5rem;
      height: 2.5rem;
      padding: 0.875rem;
    }
  }
</style> 