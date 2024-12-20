<script>
  import { onMount } from 'svelte';
  import { Book, Sun, Moon, X } from 'phosphor-svelte';
  import { auth } from '../firebase';
  import { journalStore } from '../stores/journalStore';

  // Get current week days
  function getCurrentWeek() {
    const today = new Date();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - 3 + i); // Center current day
      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.getDate(),
        fullDate: date.toISOString().split('T')[0],
        isToday: i === 3
      });
    }
    return days;
  }

  let weekDays = getCurrentWeek();
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
  $: userName = auth.currentUser?.displayName?.split(' ')[0] || 'friend';
  $: greeting = getGreeting();

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

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
    <div class="date-header">
      <span class="current-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      <h1>{greeting}, {userName}!</h1>
    </div>

    <div class="week-strip">
      {#each weekDays as { day, date, isToday }}
        <div class="day-item {isToday ? 'active' : ''}">
          <span class="day-name">{day}</span>
          <span class="day-number">{date}</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="reflection-cards">
    <div class="reflection-card {todayStreak.morning ? 'completed' : ''}">
      <div class="card-content">
        <Sun weight={todayStreak.morning ? 'fill' : 'regular'} size={24} />
        <h3>Morning reflection</h3>
        <span class="status">{todayStreak.morning ? 'Completed' : ''}</span>
      </div>
    </div>

    <div class="reflection-card {todayStreak.evening ? 'completed' : ''}">
      <div class="card-content">
        <Moon weight={todayStreak.evening ? 'fill' : 'regular'} size={24} />
        <h3>Evening reflection</h3>
        <span class="status">{todayStreak.evening ? 'Completed' : ''}</span>
      </div>
    </div>
  </div>

  <div class="challenge-card">
    <div class="challenge-header">
      <h3>7-DAY JOURNALING CHALLENGE</h3>
      <p>One day at a time, one step closer to a better you</p>
    </div>
    <div class="challenge-progress">
      {#each Array(7) as _, i}
        <div class="progress-day {i < $journalStore.completedDays ? 'completed' : ''}">
          {#if i < $journalStore.completedDays}
            <span class="checkmark">✓</span>
          {:else}
            <span class="day-number">{i + 1}</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  {#if selectedTab === 'morning' && !todayStreak.morning}
    <form class="reflection-form" on:submit|preventDefault={saveMorningReflection}>
      <div class="form-group">
        <label>What are 3 things you plan to do today?</label>
        <textarea 
          bind:value={morningReflection.plans}
          placeholder="1. &#10;2. &#10;3."
          rows="4"
        ></textarea>
      </div>

      <div class="form-group">
        <label>What new thing would you like to try today?</label>
        <textarea 
          bind:value={morningReflection.newThing}
          placeholder="Write about something new you'd like to try..."
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label>Today's Affirmation</label>
        <textarea 
          bind:value={morningReflection.affirmation}
          placeholder="Write a positive affirmation for today..."
          rows="2"
        ></textarea>
      </div>

      <button type="submit" class="submit-btn">Save Morning Reflection</button>
    </form>
  {/if}

  {#if selectedTab === 'evening' && !todayStreak.evening}
    <form class="reflection-form" on:submit|preventDefault={saveEveningReflection}>
      <div class="form-group">
        <label>What were the highlights of your day?</label>
        <textarea 
          bind:value={eveningReflection.highlights}
          placeholder="Write about the best moments of your day..."
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label>What did you learn today?</label>
        <textarea 
          bind:value={eveningReflection.learnings}
          placeholder="Share your learnings and insights..."
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label>Are you satisfied with what you accomplished today?</label>
        <textarea 
          bind:value={eveningReflection.satisfaction}
          placeholder="Reflect on your satisfaction with today's accomplishments..."
          rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label>If not fully satisfied, what were the barriers?</label>
        <textarea 
          bind:value={eveningReflection.barriers}
          placeholder="What prevented you from achieving your goals?"
          rows="3"
        ></textarea>
      </div>

      <button type="submit" class="submit-btn">Save Evening Reflection</button>
    </form>
  {/if}
</div>

<style>
  .journal-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 1.5rem;
    background: white;
    color: #333;
    min-height: 100vh;
  }

  .journal-header {
    margin-bottom: 2rem;
  }

  .date-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .current-date {
    font-size: 0.875rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  h1 {
    font-size: 2rem;
    font-weight: 500;
    margin: 0.5rem 0;
    color: #216974;
  }

  .week-strip {
    display: flex;
    justify-content: space-between;
    margin-top: 1.5rem;
  }

  .day-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    color: #666;
  }

  .day-item.active {
    background: rgba(33, 105, 116, 0.1);
    border-radius: 8px;
    color: #216974;
  }

  .day-name {
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .day-number {
    font-size: 1rem;
    font-weight: 500;
  }

  .reflection-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .reflection-card {
    background: #f8fafc;
    border-radius: 12px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid #e0e0e0;
  }

  .reflection-card.completed {
    background: #216974;
    color: white;
    border: none;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
  }

  .card-content h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 500;
  }

  .status {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
  }

  .challenge-card {
    background: #f8fafc;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    border: 1px solid #e0e0e0;
  }

  .challenge-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .challenge-header h3 {
    font-size: 0.875rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0 0 0.5rem 0;
  }

  .challenge-header p {
    font-size: 1.25rem;
    margin: 0;
    color: #216974;
  }

  .challenge-progress {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }

  .progress-day {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: white;
    color: #666;
    font-weight: 500;
    border: 1px solid #e0e0e0;
  }

  .progress-day.completed {
    background: #216974;
    color: white;
    border: none;
  }

  .reflection-form {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    border: 1px solid #e0e0e0;
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
    background: white;
    color: #333;
    resize: vertical;
    font-family: inherit;
  }

  textarea:focus {
    outline: none;
    border-color: #216974;
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
</style> 