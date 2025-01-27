<script>
  import { onMount } from 'svelte';
  import { Book, Sun, Moon, X, CaretRight, CaretLeft } from 'phosphor-svelte';
  import { auth } from '../firebase';
  import { journalStore } from '../stores/journalStore';
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  // Get current week days
  function getCurrentWeek() {
    const today = new Date();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - 6 + i); // Start from 6 days ago
      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.getDate(),
        fullDate: date.toISOString().split('T')[0],
        isToday: date.toDateString() === today.toDateString()
      });
    }
    console.log('Calendar days:', days);
    return days;
  }

  function getChallengeMessage() {
    const completedDays = $journalStore.completedDays;
    const totalCompletedDays = Math.min(completedDays, 7); // Cap at 7 for the challenge display

    switch(totalCompletedDays) {
      case 0:
        return "Ready to begin your journaling journey? Let's take the first step together!";
      case 1:
        return "Amazing start! You've completed your first day. Keep the momentum going!";
      case 2:
        return "Two days down! You're building a beautiful habit, keep going!";
      case 3:
        return "Halfway there! Your dedication is inspiring!";
      case 4:
        return "Four days strong! You're proving that consistency is key!";
      case 5:
        return "Just two more days! You're so close to achieving your goal!";
      case 6:
        return "One final day! You've come so far, finish strong!";
      case 7:
        return "Congratulations! You've completed the challenge! Keep going for another milestone!";
      default:
        return "One day at a time, one step closer to a better you";
    }
  }

  let weekDays = getCurrentWeek();
  let selectedReflection = null; // 'morning' or 'evening' or null
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
  $: greeting = getGreeting();
  $: weekDays.forEach(({ fullDate, isToday }) => {
    const hasCompletion = $journalStore.dailyProgress.find(d => d.date === fullDate && d.morning && d.evening);
    const isTodayComplete = isToday && $journalStore.streak?.morning && $journalStore.streak?.evening;
    if (hasCompletion || isTodayComplete) {
      console.log('Tick mark debug:', { 
        fullDate, 
        hasCompletion, 
        isTodayComplete, 
        dailyProgress: $journalStore.dailyProgress 
      });
    }
  });

  function getGreeting() {
    // First check if store is initialized
    if (!$journalStore || !$journalStore.streak) {
      return "Welcome to your journal";
    }

    const { morning, evening } = $journalStore.streak;

    // Both reflections completed
    if (morning && evening) {
      return "Great job completing your reflections today!";
    }
    // Only morning completed
    else if (morning && !evening) {
      return "Morning reflection complete! Don't forget to reflect on your day later.";
    }
    // Only evening completed
    else if (!morning && evening) {
      return "Evening reflection complete! See you tomorrow morning.";
    }
    // No reflections completed - show time-based messages
    else {
      const hour = new Date().getHours();
      const isMorningTime = hour >= 5 && hour < 12;
      const isEveningTime = hour >= 17;

      if (isMorningTime) {
        return "It's time for your morning reflection";
      } else if (isEveningTime) {
        return "Time to reflect on your day";
      } else {
        return "How is your day going?";
      }
    }
  }

  let currentQuestionIndex = 0;
  
  const morningQuestions = [
    {
      question: "What are 3 things you plan to do today?",
      placeholder: "1. \n2. \n3.",
      field: "plans",
      rows: 4
    },
    {
      question: "What new thing would you like to try today?",
      placeholder: "Write about something new you'd like to try...",
      field: "newThing",
      rows: 3
    },
    {
      question: "Today's Affirmation",
      placeholder: "Write a positive affirmation for today...",
      field: "affirmation",
      rows: 2
    }
  ];

  const eveningQuestions = [
    {
      question: "What were the highlights of your day?",
      placeholder: "Write about the best moments of your day...",
      field: "highlights",
      rows: 3
    },
    {
      question: "What did you learn today?",
      placeholder: "Share your learnings and insights...",
      field: "learnings",
      rows: 3
    },
    {
      question: "Are you satisfied with what you accomplished today?",
      placeholder: "Reflect on your satisfaction with today's accomplishments...",
      field: "satisfaction",
      rows: 3
    },
    {
      question: "If not fully satisfied, what were the barriers?",
      placeholder: "What prevented you from achieving your goals?",
      field: "barriers",
      rows: 3
    }
  ];

  $: currentQuestions = selectedReflection === 'morning' ? morningQuestions : eveningQuestions;
  $: currentQuestion = currentQuestions[currentQuestionIndex];
  $: isLastQuestion = currentQuestionIndex === currentQuestions.length - 1;
  $: isFirstQuestion = currentQuestionIndex === 0;

  // Add computed value for current reflection value
  $: currentReflectionValue = {
    get value() {
      return selectedReflection === 'morning'
        ? morningReflection[currentQuestion.field]
        : eveningReflection[currentQuestion.field];
    },
    set value(newValue) {
      if (selectedReflection === 'morning') {
        morningReflection[currentQuestion.field] = newValue;
      } else {
        eveningReflection[currentQuestion.field] = newValue;
      }
    }
  };

  function handleReflectionClick(type) {
    if (type === 'morning' && todayStreak.morning) {
      // Show completed morning reflection
      selectedReflection = 'morning-view';
      morningReflection = { ...$journalStore.todayMorningReflection };
    } else if (type === 'evening' && todayStreak.evening) {
      // Show completed evening reflection
      selectedReflection = 'evening-view';
      eveningReflection = { ...$journalStore.todayEveningReflection };
    } else if ((type === 'morning' && !todayStreak.morning) || 
        (type === 'evening' && !todayStreak.evening)) {
      // Start new reflection
      selectedReflection = selectedReflection === type ? null : type;
      currentQuestionIndex = 0;
    }
  }

  // Helper function to get reflection data based on type
  function getReflectionData(type) {
    if (type === 'morning-view') {
      return {
        title: 'Morning Reflection',
        questions: morningQuestions,
        answers: morningReflection
      };
    } else {
      return {
        title: 'Evening Reflection',
        questions: eveningQuestions,
        answers: eveningReflection
      };
    }
  }

  function nextQuestion() {
    if (!isLastQuestion) {
      currentQuestionIndex++;
    }
  }

  function previousQuestion() {
    if (!isFirstQuestion) {
      currentQuestionIndex--;
    }
  }

  let isSubmitting = false;

  async function handleSubmit() {
    if (isLastQuestion) {
      isSubmitting = true;
      try {
        if (selectedReflection === 'morning') {
          await saveMorningReflection();
        } else {
          await saveEveningReflection();
        }
        selectedReflection = null;
        currentQuestionIndex = 0;
        // Force a refresh of the greeting
        greeting = getGreeting();
      } catch (error) {
        console.error('Error submitting reflection:', error);
      } finally {
        isSubmitting = false;
      }
    } else {
      nextQuestion();
    }
  }

  // Add onMount to load initial data
  onMount(async () => {
    await journalStore.loadTodayReflections();
    weekDays = getCurrentWeek();
  });

  // Add this function to handle progress updates
  async function updateProgress() {
    if (!auth.currentUser) return;
    await journalStore.calculateProgress();
  }

  // Call updateProgress when the component mounts and when auth state changes
  $: if (auth.currentUser) {
    updateProgress();
  }

  // Add this computed value with proper reactivity
  $: challengeMessage = getChallengeMessage();
  $: console.log('Challenge message updated:', challengeMessage, 'Completed days:', $journalStore.completedDays);

  async function saveMorningReflection() {
    await journalStore.saveMorningReflection(morningReflection);
    await journalStore.loadTodayReflections(); // Refresh the store data
    weekDays = getCurrentWeek(); // Refresh the week display
    morningReflection = { plans: '', newThing: '', affirmation: '' }; // Reset form
  }

  async function saveEveningReflection() {
    await journalStore.saveEveningReflection(eveningReflection);
    await journalStore.loadTodayReflections(); // Refresh the store data
    weekDays = getCurrentWeek(); // Refresh the week display
    eveningReflection = { highlights: '', learnings: '', satisfaction: '', barriers: '' }; // Reset form
  }

  let scrollY = 0;

  function handleScroll(event) {
    const container = event.target;
    scrollY = container.scrollTop;
  }

  onMount(() => {
    const container = document.querySelector('.journal-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    // ... rest of onMount code ...

    return () => {
      // ... existing cleanup ...
      container?.removeEventListener('scroll', handleScroll);
    };
  });
</script>

<div class="journal-container">
  <div class="journal-header">
    <div class="week-strip" class:scrolled={scrollY > 50}>
      {#each weekDays as { day, date, isToday, fullDate }}
        {@const hasCompletion = $journalStore.dailyProgress.find(d => d.date === fullDate)}
        {@const isTodayComplete = isToday && $journalStore.streak?.morning && $journalStore.streak?.evening}
        {@const shouldShowTick = (hasCompletion?.morning && hasCompletion?.evening) || isTodayComplete}
        <div class="day-item {isToday ? 'active' : ''}">
          <span class="day-name">{day}</span>
          <span class="day-number">{date}</span>
          {#if shouldShowTick}
            <div class="completion-mark">✓</div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="date-header">
      <span class="current-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      <h1>{greeting}</h1>
    </div>
  </div>

  <div class="reflection-cards">
    <div 
      class="reflection-card {todayStreak.morning ? 'completed' : ''} {selectedReflection === 'morning' ? 'active' : ''}"
      on:click={() => handleReflectionClick('morning')}
    >
      <div class="card-content">
        <Sun weight={todayStreak.morning ? 'fill' : 'regular'} size={24} />
        <h3>Morning<br>reflection</h3>
        <span class="status">{todayStreak.morning ? 'Completed' : ''}</span>
      </div>
    </div>

    <div 
      class="reflection-card {todayStreak.evening ? 'completed' : ''} {selectedReflection === 'evening' ? 'active' : ''}"
      on:click={() => handleReflectionClick('evening')}
    >
      <div class="card-content">
        <Moon weight={todayStreak.evening ? 'fill' : 'regular'} size={24} />
        <h3>Evening<br>reflection</h3>
        <span class="status">{todayStreak.evening ? 'Completed' : ''}</span>
      </div>
    </div>
  </div>

  <div class="challenge-card">
    <div class="challenge-header">
      <h3>7-DAY JOURNALING CHALLENGE</h3>
      <p>{challengeMessage}</p>
    </div>
    <div class="challenge-progress">
      {#each Array(7) as _, i}
        <div class="progress-circle">
          <div class="circle-content">
            <div 
              class="circle-number {i < Math.min($journalStore.completedDays, 7) ? 'completed' : ''}"
            >
              {i + 1}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  {#if selectedReflection}
    <div class="modal-overlay" transition:fade={{ duration: 200 }}>
      <div 
        class="modal-content"
        transition:fly={{ y: 20, duration: 300, easing: quintOut }}
      >
        <div class="modal-header">
          <h3>
            {#if selectedReflection === 'morning-view' || selectedReflection === 'evening-view'}
              {getReflectionData(selectedReflection).title.split(' ').join('\n')}
            {:else}
              {(selectedReflection === 'morning' ? 'Morning' : 'Evening') + '\nReflection'}
            {/if}
          </h3>
          <button class="close-btn" on:click={() => selectedReflection = null}>
            <X weight="regular" size={32} />
          </button>
        </div>

        {#if selectedReflection === 'morning-view' || selectedReflection === 'evening-view'}
          <!-- View completed reflection -->
          <div class="modal-body view-mode">
            {#each getReflectionData(selectedReflection).questions as question}
              <div class="completed-question">
                <h4>{question.question}</h4>
                <p class="answer">{getReflectionData(selectedReflection).answers[question.field]}</p>
              </div>
            {/each}
          </div>
        {:else}
          <!-- Normal reflection input mode -->
          <div class="progress-bar">
            {#each currentQuestions as _, i}
              <div class="progress-dot {i <= currentQuestionIndex ? 'active' : ''}"></div>
            {/each}
          </div>

          <div class="modal-body">
            <form on:submit|preventDefault={handleSubmit}>
              <div class="question-content">
                <label>{currentQuestion.question}</label>
                <textarea 
                  bind:value={currentReflectionValue.value}
                  placeholder={currentQuestion.placeholder}
                  rows={currentQuestion.rows}
                  autofocus
                ></textarea>
              </div>

              <div class="modal-footer">
                {#if !isFirstQuestion}
                  <button type="button" class="nav-btn" on:click={previousQuestion}>
                    <CaretLeft size={20} />
                    Previous
                  </button>
                {/if}

                <button type="submit" class="submit-btn" disabled={isSubmitting}>
                  {#if isSubmitting}
                    <div class="loading-spinner"></div>
                  {:else}
                    {isLastQuestion ? 'Complete Reflection' : 'Next Question'}
                    {#if !isLastQuestion}
                      <CaretRight size={20} />
                    {/if}
                  {/if}
                </button>
              </div>
            </form>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .journal-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0;
    background: white;
    color: #333;
    height: 100vh;
    overflow-y: auto;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding-bottom: 6rem;
    width: 100%;
    box-sizing: border-box;
  }

  .journal-header {
    margin-bottom: 2rem;
  }

  .week-strip {
    display: flex;
    justify-content: space-between;
    background: #216974;
    padding: 1rem;
    margin: 10px;
    border-radius: 12px;
    position: sticky;
    top: 10px;
    z-index: 100;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .week-strip.scrolled {
    padding: 0.5rem 1rem;
    margin: 0 10px;
    border-radius: 12px;
  }

  .week-strip.scrolled .day-item {
    padding: 0.25rem 0.5rem;
  }

  .week-strip.scrolled .day-name {
    height: 0;
    opacity: 0;
    margin: 0;
    overflow: hidden;
  }

  .day-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    color: rgba(255, 255, 255, 0.8);
    position: relative;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .day-item.active {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .day-name {
    font-size: 0.75rem;
    text-transform: uppercase;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .day-number {
    font-size: 1.125rem;
    font-weight: 500;
  }

  .completion-mark {
    color: white;
    font-size: 1rem;
    margin-top: 0.125rem;
  }

  .date-header {
    text-align: center;
    padding: 0 1.5rem;
  }

  .current-date {
    font-size: 0.875rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 500;
    margin: 0.5rem 0;
    color: #216974;
  }

  .reflection-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin: 0 10px 1.5rem 10px;
  }

  .reflection-card {
    background: #f8fafc;
    border-radius: 16px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid #e0e0e0;
  }

  .reflection-card:hover:not(.completed) {
    border-color: #216974;
    background: #f0f9fa;
  }

  .reflection-card.active {
    border-color: #216974;
    background: #f0f9fa;
  }

  .reflection-card.completed {
    background: #216974;
    color: white;
    border: none;
    cursor: default;
  }

  .reflection-card.completed .card-content h3,
  .reflection-card.completed .status {
    color: white;
  }

  .reflection-card.completed :global(svg) {
    color: white;
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
    color: #216974;
    text-align: center;
    line-height: 1.2;
  }

  .status {
    font-size: 0.875rem;
    color: #216974;
  }

  .challenge-card {
    background: #f8fafc;
    border-radius: 16px;
    padding: 1.5rem;
    margin: 0 10px 1.5rem 10px;
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
    padding: 1.5rem 0;
  }

  .progress-circle {
    width: 48px;
    height: 48px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .circle-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .circle-number {
    font-size: 1.5rem;
    font-weight: 700;
    color: #e0e0e0;
    transition: all 0.3s ease;
  }

  .circle-number.morning-only {
    background: linear-gradient(
      to right,
      #216974 50%,
      #e0e0e0 50%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }

  .circle-number.completed {
    color: #216974;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 24px;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    padding: 2rem;
    position: relative;
  }

  .modal-header {
    text-align: left;
    margin-bottom: 1rem;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 500;
    color: #216974;
    white-space: pre-line;
    line-height: 1.2;
  }

  .close-btn {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #f5f5f5;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    color: #666;
    z-index: 2;
    padding: 0;
  }

  .close-btn:hover {
    background: #eeeeee;
    color: #333;
  }

  .progress-bar {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem 0;
    background: #f8fafc;
    margin: 0 -2rem;
  }

  .progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e0e0e0;
    transition: all 0.2s;
  }

  .progress-dot.active {
    background: #216974;
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex-grow: 1;
    padding: 2rem 0;
  }

  .question-content {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  label {
    display: block;
    font-size: 1.75rem;
    margin-bottom: 2rem;
    color: #333;
    font-weight: 400;
    line-height: 1.3;
    max-width: 90%;
  }

  form {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  textarea {
    width: 90%;
    padding: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 16px;
    background: white;
    color: #333;
    resize: none;
    font-family: inherit;
    font-size: 1rem;
    line-height: 1.5;
    min-height: 120px;
  }

  textarea:focus {
    outline: none;
    border-color: #216974;
    box-shadow: 0 0 0 2px rgba(33, 105, 116, 0.1);
  }

  .modal-footer {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
    width: 100%;
  }

  .submit-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 2rem;
    border: none;
    border-radius: 100px;
    background: #216974;
    color: white;
    font-weight: 500;
    font-size: 1.125rem;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 200px;
    justify-content: center;
  }

  .submit-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .submit-btn:active {
    transform: translateY(0);
  }

  .nav-btn {
    display: none;
  }

  .view-mode {
    padding: 1rem 0;
    overflow-y: auto;
  }

  .completed-question {
    padding: 1rem 2rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .completed-question:last-child {
    border-bottom: none;
  }

  .completed-question h4 {
    font-size: 1.125rem;
    color: #216974;
    margin: 0 0 0.75rem 0;
    font-weight: 500;
  }

  .answer {
    font-size: 1rem;
    line-height: 1.6;
    color: #333;
    white-space: pre-line;
    margin: 0;
  }

  .completion-mark {
    color: white;
    font-size: 0.875rem;
    margin-top: 0.125rem;
  }

  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #ffffff;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style> 