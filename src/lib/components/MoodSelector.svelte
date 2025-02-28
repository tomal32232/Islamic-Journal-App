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

  function handleNextClick() {
    if (selectedMood) {
      // Open the guidance modal
      showGuidanceModal = true;
    }
  }

  let showGuidanceModal = false;

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
    <div class="selected-mood-display">
      {#if selectedMood}
        <div class="selected-mood">
          <div class="selected-mood-icon">
            {@html selectedMood.icon}
          </div>
          <div class="selected-mood-text">
            <span class="selected-mood-name">{selectedMood.name}</span>
            <span class="selected-mood-description">{selectedMood.description}</span>
          </div>
        </div>
        <button class="next-button" on:click={handleNextClick}>
          Next
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      {:else}
        <div class="mood-prompt">
          <h3>How are you feeling today?</h3>
          <p>Select a mood below</p>
        </div>
      {/if}
    </div>
    
    <div class="mood-carousel">
      <div class="mood-options">
        {#each moods as mood}
          <button 
            class="mood-button {selectedMood && selectedMood.value === mood.value ? 'selected' : ''}" 
            on:click={() => handleMoodClick(mood)}
            title={mood.description}
          >
            <div class="mood-icon">
              {@html mood.icon}
            </div>
            <span class="mood-name">{mood.name}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- Hidden button to trigger the modal -->
<button id="mood-guidance-trigger" style="display: none;" on:click={() => {}}></button>

{#if showGuidanceModal}
  <MoodGuidanceModal 
    mood={selectedMood} 
    onClose={handleModalClose}
  />
{/if}

<style>
  .mood-selector {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }

  .selected-mood-display {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 2rem 1rem;
    min-height: 200px;
  }

  .mood-prompt {
    text-align: center;
  }

  .mood-prompt h3 {
    font-size: 1.25rem;
    color: #216974;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .mood-prompt p {
    color: #718096;
    font-size: 0.875rem;
    margin: 0;
  }

  .selected-mood {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .selected-mood-icon {
    width: 5rem;
    height: 5rem;
    color: #216974;
    background: rgba(33, 105, 116, 0.1);
    padding: 1.5rem;
    border-radius: 50%;
    transition: all 0.3s;
  }

  .selected-mood-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .selected-mood-name {
    font-size: 1.25rem;
    color: #2D3748;
    font-weight: 500;
  }

  .selected-mood-description {
    font-size: 0.875rem;
    color: #718096;
  }

  .next-button {
    background: #216974;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    margin-top: 1rem;
  }

  .next-button:hover {
    background: #184f58;
    transform: translateY(-2px);
  }

  .next-button svg {
    width: 1rem;
    height: 1rem;
  }

  .mood-carousel {
    padding: 1rem 0;
    background: #f8f9fa;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.05);
  }

  .mood-options {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 1rem;
    padding: 0.5rem 1rem;
    -ms-overflow-style: none;  /* Hide scrollbar for IE and Edge */
    scrollbar-width: none;  /* Hide scrollbar for Firefox */
  }

  .mood-options::-webkit-scrollbar {
    display: none; /* Hide scrollbar for Chrome, Safari and Opera */
  }

  .mood-button {
    background: white;
    border: 1px solid #E2E8F0;
    padding: 0.75rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    border-radius: 12px;
    min-width: 80px;
    scroll-snap-align: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .mood-button:hover, .mood-button.selected {
    border-color: #216974;
    transform: translateY(-2px);
  }

  .mood-button.selected {
    background-color: rgba(33, 105, 116, 0.05);
  }

  .mood-icon {
    width: 2.5rem;
    height: 2.5rem;
    color: #216974;
    background: rgba(33, 105, 116, 0.1);
    padding: 0.75rem;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .mood-button:hover .mood-icon, .mood-button.selected .mood-icon {
    background: rgba(33, 105, 116, 0.15);
  }

  .mood-name {
    font-size: 0.75rem;
    color: #2D3748;
    font-weight: 500;
    text-align: center;
  }

  @media (max-width: 360px) {
    .selected-mood-icon {
      width: 4rem;
      height: 4rem;
      padding: 1.25rem;
    }
    
    .mood-icon {
      width: 2rem;
      height: 2rem;
      padding: 0.625rem;
    }
  }
</style> 