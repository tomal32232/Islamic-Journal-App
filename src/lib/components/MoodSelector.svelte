<script>
  import { createEventDispatcher } from 'svelte';
  import MoodGuidanceModal from './MoodGuidanceModal.svelte';
  const dispatch = createEventDispatcher();

  export let showSelector = true;
  let selectedMood = null;

  function handleMoodClick(mood) {
    console.log('Mood clicked:', mood.value);
    selectedMood = mood;
  }

  function handleModalClose() {
    console.log('Modal closed, dispatching selected mood:', selectedMood.value);
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
      console.log('Next clicked for mood:', selectedMood.value);
      // Open the guidance modal
      showGuidanceModal = true;
    }
  }

  let showGuidanceModal = false;

  const moods = [
    { 
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14C8.5 16 10.5 17 12 17C13.5 17 15.5 16 16 14" stroke-linecap="round" />
        <circle cx="9" cy="9" r="1" />
        <circle cx="15" cy="9" r="1" />
      </svg>`,
      name: 'Grateful',
      description: 'Alhamdulillah',
      value: 'grateful'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="10" r="2" />
        <path d="M7 17C8.5 15.5 10.5 14.5 12 14.5C13.5 14.5 15.5 15.5 17 17" stroke-linecap="round" />
      </svg>`,
      name: 'Seeking Peace',
      description: 'Sabr',
      value: 'seeking_peace'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12L12 8L16 12" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M12 8L12 16" stroke-linecap="round" />
      </svg>`,
      name: 'Hopeful',
      description: 'InshaAllah',
      value: 'hopeful'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14L16 14" stroke-linecap="round" />
        <circle cx="9" cy="9" r="1" />
        <circle cx="15" cy="9" r="1" />
      </svg>`,
      name: 'Anxious',
      description: 'Ya Allah',
      value: 'anxious'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8V12" stroke-linecap="round" />
        <circle cx="12" cy="16" r="1" />
      </svg>`,
      name: 'Reflecting',
      description: 'SubhanAllah',
      value: 'reflecting'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M7 11L12 7L17 11" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M7 15L12 19L17 15" stroke-linecap="round" stroke-linejoin="round" />
      </svg>`,
      name: 'Blessed',
      description: 'MashaAllah',
      value: 'blessed'
    }
  ];

  console.log('Available moods:', moods.map(m => m.value));
  console.log('Seeking peace mood in MoodSelector:', moods.find(m => m.value === 'seeking_peace'));
  console.log('Seeking peace mood value characters:', 
    [...moods.find(m => m.value === 'seeking_peace').value].map(c => `'${c}' (${c.charCodeAt(0)})`));
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
    width: 6rem;
    height: 6rem;
    color: #216974;
    background: none;
    padding: 0;
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
    width: 4rem;
    height: 4rem;
    color: #216974;
    background: none;
    padding: 0;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .mood-button:hover .mood-icon, .mood-button.selected .mood-icon {
    background: none;
    transform: scale(1.1);
  }

  .mood-name {
    font-size: 0.75rem;
    color: #2D3748;
    font-weight: 500;
    text-align: center;
  }

  @media (max-width: 360px) {
    .selected-mood-icon {
      width: 5rem;
      height: 5rem;
      padding: 0;
    }
    
    .mood-icon {
      width: 3rem;
      height: 3rem;
      padding: 0;
    }
  }
</style> 