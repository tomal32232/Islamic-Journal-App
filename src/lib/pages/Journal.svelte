<script>
  import { onMount } from 'svelte';
  import { Book, Sun, Moon } from 'phosphor-svelte';
  import { auth } from '../firebase';
  import { journalStore } from '../stores/journalStore';

  let selectedTab = 'morning';
  let morningReflection = {
    plans: '',
    newThing: '',
    affirmation: ''
  };

  let eveningReflection = {
    highlights: '',
    learnings: '',
    satisfaction: '',
    barriers: ''
  };

  // Subscribe to the store
  $: todayStreak = $journalStore.streak;

  onMount(async () => {
    await journalStore.loadTodayReflections();
    
    // Pre-fill forms if reflections exist
    if ($journalStore.todayMorningReflection) {
      morningReflection = { ...$journalStore.todayMorningReflection };
    }
    if ($journalStore.todayEveningReflection) {
      eveningReflection = { ...$journalStore.todayEveningReflection };
    }
  });

  async function saveMorningReflection() {
    await journalStore.saveMorningReflection(morningReflection);
  }

  async function saveEveningReflection() {
    await journalStore.saveEveningReflection(eveningReflection);
  }
</script>

<div class="journal-container">
  <div class="journal-header">
    <h2>Daily Reflections</h2>
    <div class="streak-info">
      <span class="streak-count">Streak: {Math.floor($journalStore.streak.current)} days</span>
      <div class="streak-indicator">
        <div class="streak-item {todayStreak.morning ? 'completed' : ''}">
          <Sun weight={todayStreak.morning ? 'fill' : 'regular'} size={20} />
          <span>Morning</span>
        </div>
        <div class="streak-item {todayStreak.evening ? 'completed' : ''}">
          <Moon weight={todayStreak.evening ? 'fill' : 'regular'} size={20} />
          <span>Evening</span>
        </div>
      </div>
    </div>
  </div>

  <div class="reflection-tabs">
    <button 
      class="tab-btn {selectedTab === 'morning' ? 'active' : ''}"
      on:click={() => selectedTab = 'morning'}
    >
      <Sun weight={selectedTab === 'morning' ? 'fill' : 'regular'} size={20} />
      Morning Reflection
    </button>
    <button 
      class="tab-btn {selectedTab === 'evening' ? 'active' : ''}"
      on:click={() => selectedTab = 'evening'}
    >
      <Moon weight={selectedTab === 'evening' ? 'fill' : 'regular'} size={20} />
      Evening Reflection
    </button>
  </div>

  <div class="reflection-content">
    {#if selectedTab === 'morning'}
      <form class="reflection-form" on:submit|preventDefault={saveMorningReflection}>
        <div class="form-group">
          <label>What are 3 things you plan to do today?</label>
          <textarea 
            bind:value={morningReflection.plans}
            placeholder="1. &#10;2. &#10;3."
            rows="4"
            disabled={todayStreak.morning}
          ></textarea>
        </div>

        <div class="form-group">
          <label>What new thing would you like to try today?</label>
          <textarea 
            bind:value={morningReflection.newThing}
            placeholder="Write about something new you'd like to try..."
            rows="3"
            disabled={todayStreak.morning}
          ></textarea>
        </div>

        <div class="form-group">
          <label>Today's Affirmation</label>
          <textarea 
            bind:value={morningReflection.affirmation}
            placeholder="Write a positive affirmation for today..."
            rows="2"
            disabled={todayStreak.morning}
          ></textarea>
        </div>

        {#if !todayStreak.morning}
          <button type="submit" class="submit-btn">Save Morning Reflection</button>
        {:else}
          <div class="completed-message">
            <Sun weight="fill" size={24} />
            <span>Morning reflection completed!</span>
          </div>
        {/if}
      </form>
    {:else}
      <form class="reflection-form" on:submit|preventDefault={saveEveningReflection}>
        <div class="form-group">
          <label>What were the highlights of your day?</label>
          <textarea 
            bind:value={eveningReflection.highlights}
            placeholder="Write about the best moments of your day..."
            rows="3"
            disabled={todayStreak.evening}
          ></textarea>
        </div>

        <div class="form-group">
          <label>What did you learn today?</label>
          <textarea 
            bind:value={eveningReflection.learnings}
            placeholder="Share your learnings and insights..."
            rows="3"
            disabled={todayStreak.evening}
          ></textarea>
        </div>

        <div class="form-group">
          <label>Are you satisfied with what you accomplished today?</label>
          <textarea 
            bind:value={eveningReflection.satisfaction}
            placeholder="Reflect on your satisfaction with today's accomplishments..."
            rows="3"
            disabled={todayStreak.evening}
          ></textarea>
        </div>

        <div class="form-group">
          <label>If not fully satisfied, what were the barriers?</label>
          <textarea 
            bind:value={eveningReflection.barriers}
            placeholder="What prevented you from achieving your goals?"
            rows="3"
            disabled={todayStreak.evening}
          ></textarea>
        </div>

        {#if !todayStreak.evening}
          <button type="submit" class="submit-btn">Save Evening Reflection</button>
        {:else}
          <div class="completed-message">
            <Moon weight="fill" size={24} />
            <span>Evening reflection completed!</span>
          </div>
        {/if}
      </form>
    {/if}
  </div>
</div>

<style>
  .journal-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .journal-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  h2 {
    font-size: 1.25rem;
    color: #216974;
    font-weight: 500;
    margin: 0;
  }

  .streak-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .streak-count {
    font-size: 0.875rem;
    color: #666;
  }

  .streak-indicator {
    display: flex;
    gap: 1rem;
  }

  .streak-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    background: #f5f5f5;
    color: #666;
  }

  .streak-item.completed {
    background: #216974;
    color: white;
  }

  .reflection-tabs {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border: none;
    border-radius: 8px;
    background: #f5f5f5;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn.active {
    background: #216974;
    color: white;
  }

  .reflection-form {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    color: #216974;
    font-weight: 500;
  }

  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    resize: vertical;
    font-family: inherit;
  }

  textarea:focus {
    outline: none;
    border-color: #216974;
  }

  textarea:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .submit-btn {
    width: 100%;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    background: #216974;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .submit-btn:hover {
    opacity: 0.9;
  }

  .completed-message {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    background: #f0f9fa;
    border-radius: 8px;
    color: #216974;
    font-weight: 500;
  }
</style> 