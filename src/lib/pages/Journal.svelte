<script>
  import { onMount } from 'svelte';
  import { Book, Sun, Moon, X, CaretRight, CaretLeft, ClockCounterClockwise } from 'phosphor-svelte';
  import { auth } from '../firebase';
  import { journalStore } from '../stores/journalStore';
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { notificationStore } from '../stores/notificationStore';
  import Notification from '../components/Notification.svelte';

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
  let selectedReflection = null; // 'morning' or 'evening' or 'freeWrite' or 'deenReflections' or null
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

  let freeWriteContent = '';

  let deenReflections = {
    duas: '',
    surahs: '',
    quranQuotes: '',
    gratitude: ''
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

  const deenReflectionQuestions = [
    {
      question: "Duas You Are Praying For",
      placeholder: "write down the duas that are close to your heart—whether for yourself, your loved ones, or the Ummah. Keep track of what you're asking Allah (SWT) for and reflect on them over time.",
      field: "duas",
      rows: 4
    },
    {
      question: "Surahs You're Learning or Want to Learn",
      placeholder: "Keep a list of the Surahs you are currently memorizing or plan to learn in the future. This will help track your progress and keep you motivated on your Quran memorization journey.",
      field: "surahs",
      rows: 3
    },
    {
      question: "Quranic Verses That Resonate With You",
      placeholder: "Jot down the Quranic verses that deeply inspire you, bring you comfort, or serve as a reminder in your daily life. This section helps you reflect on their meanings and how they apply to your journey",
      field: "quranQuotes",
      rows: 4
    },
    {
      question: "Gratitude List for Allah (SWT)",
      placeholder: "A space to list the blessings in your life that you are thankful to Allah (SWT) for. Practicing gratitude strengthens faith and reminds us of Allah's endless mercy and kindness.",
      field: "gratitude",
      rows: 4
    }
  ];

  $: currentQuestions = selectedReflection === 'morning' 
    ? morningQuestions 
    : selectedReflection === 'evening'
    ? eveningQuestions
    : selectedReflection === 'deenReflections'
    ? deenReflectionQuestions
    : [];
  $: currentQuestion = currentQuestions[currentQuestionIndex];
  $: isLastQuestion = currentQuestionIndex === currentQuestions.length - 1;
  $: isFirstQuestion = currentQuestionIndex === 0;

  // Add computed value for current reflection value
  $: currentReflectionValue = {
    get value() {
      return selectedReflection === 'morning'
        ? morningReflection[currentQuestion.field]
        : selectedReflection === 'evening'
        ? eveningReflection[currentQuestion.field]
        : selectedReflection === 'deenReflections'
        ? deenReflections[currentQuestion.field]
        : '';
    },
    set value(newValue) {
      if (selectedReflection === 'morning') {
        morningReflection[currentQuestion.field] = newValue;
      } else if (selectedReflection === 'evening') {
        eveningReflection[currentQuestion.field] = newValue;
      } else if (selectedReflection === 'deenReflections') {
        deenReflections[currentQuestion.field] = newValue;
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
    } else if (type === 'freeWrite' && $journalStore.todayFreeWrite) {
      // Show completed free write
      selectedReflection = 'freeWrite-view';
      freeWriteContent = $journalStore.todayFreeWrite;
    } else if (type === 'deenReflections' && $journalStore.todayDeenReflection) {
      // Show completed deen reflection
      selectedReflection = 'deenReflections-view';
      deenReflections = { ...$journalStore.todayDeenReflection };
    } else if ((type === 'morning' && !todayStreak.morning) || 
        (type === 'evening' && !todayStreak.evening) ||
        (type === 'freeWrite' && !$journalStore.todayFreeWrite) ||
        (type === 'deenReflections' && !$journalStore.todayDeenReflection)) {
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
    } else if (type === 'evening-view') {
      return {
        title: 'Evening Reflection',
        questions: eveningQuestions,
        answers: eveningReflection
      };
    } else if (type === 'freeWrite-view') {
      return {
        title: 'Free Write',
        content: freeWriteContent
      };
    } else if (type === 'deenReflections-view') {
      return {
        title: 'Deen Reflections',
        questions: deenReflectionQuestions,
        answers: deenReflections
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

  async function handleSubmit(event) {
    // Prevent default only if it's a form submission
    if (event) event.preventDefault();
    
    if (isLastQuestion) {
      isSubmitting = true;
      try {
        if (selectedReflection === 'morning') {
          await saveMorningReflection();
        } else if (selectedReflection === 'evening') {
          await saveEveningReflection();
        } else if (selectedReflection === 'deenReflections') {
          await saveDeenReflection();
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

  // Add achievement checking function
  function checkAchievements() {
    const completedDays = $journalStore.completedDays;
    const streakDays = $journalStore.streak?.days || 0;
    
    console.log('Checking achievements:', {
      completedDays,
      streakDays,
      streak: $journalStore.streak,
      store: $journalStore
    });
    
    // Journal streak achievements
    if (completedDays === 1) {
      console.log('🎯 Triggering first entry achievement');
      notificationStore.showNotification('🎉 First journal entry complete! Your journey begins now!');
    } else if (completedDays === 7) {
      console.log('🎯 Triggering week completion achievement');
      notificationStore.showNotification('🏆 Amazing! You\'ve completed your first week of journaling!');
    } else if (completedDays === 30) {
      console.log('🎯 Triggering month completion achievement');
      notificationStore.showNotification('⭐ Incredible milestone! You\'ve journaled for 30 days!');
    }
    
    // Streak achievements
    if (streakDays === 3) {
      console.log('🎯 Triggering 3-day streak achievement');
      notificationStore.showNotification('🔥 3-day streak! You\'re building a beautiful habit!');
    } else if (streakDays === 7) {
      console.log('🎯 Triggering week streak achievement');
      notificationStore.showNotification('🌟 Wonderful! A full week streak achieved!');
    } else if (streakDays === 30) {
      console.log('🎯 Triggering month streak achievement');
      notificationStore.showNotification('👑 Mastery achieved! 30-day streak completed!');
    }
  }

  // Modify the save functions to check achievements
  async function saveMorningReflection() {
    console.log('Saving morning reflection...');
    await journalStore.saveMorningReflection(morningReflection);
    await journalStore.loadTodayReflections();
    weekDays = getCurrentWeek();
    morningReflection = { plans: '', newThing: '', affirmation: '' };
    console.log('Checking achievements after morning reflection...');
    checkAchievements();
  }

  async function saveEveningReflection() {
    console.log('Saving evening reflection...');
    await journalStore.saveEveningReflection(eveningReflection);
    await journalStore.loadTodayReflections();
    weekDays = getCurrentWeek();
    eveningReflection = { highlights: '', learnings: '', satisfaction: '', barriers: '' };
    console.log('Checking achievements after evening reflection...');
    checkAchievements();
  }

  async function saveDeenReflection() {
    console.log('Saving deen reflection...');
    isSubmitting = true;
    try {
      // Ensure all fields exist even if they're empty
      const completeDeenReflections = {
        duas: deenReflections.duas || '',
        surahs: deenReflections.surahs || '',
        quranQuotes: deenReflections.quranQuotes || '',
        gratitude: deenReflections.gratitude || ''
      };
      await journalStore.saveDeenReflection(completeDeenReflections);
      deenReflections = { duas: '', surahs: '', quranQuotes: '', gratitude: '' };
      selectedReflection = null;
      console.log('Checking achievements after deen reflection...');
      checkAchievements();
    } catch (error) {
      console.error('Error saving deen reflection:', error);
    } finally {
      isSubmitting = false;
    }
  }

  async function saveFreeWrite() {
    console.log('Saving free write...');
    isSubmitting = true;
    try {
      await journalStore.saveFreeWrite(freeWriteContent);
      freeWriteContent = '';
      selectedReflection = null;
      console.log('Checking achievements after free write...');
      checkAchievements();
    } catch (error) {
      console.error('Error saving free write:', error);
    } finally {
      isSubmitting = false;
    }
  }

  onMount(() => {
    const container = document.querySelector('.journal-container');
    
    // Initialize textarea heights
    initTextareaHeights();
    
    // ... rest of onMount code ...

    return () => {
      // ... existing cleanup ...
    };
  });

  function autoExpand(event) {
    const textarea = event.target;
    // Reset height to auto first to handle text deletion
    textarea.style.height = 'auto';
    // Set height based on scroll height (content height)
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  // Function to initialize textarea heights after they're rendered
  function initTextareaHeights() {
    setTimeout(() => {
      const textareas = document.querySelectorAll('.auto-expand');
      textareas.forEach(textarea => {
        if (textarea instanceof HTMLTextAreaElement) {
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;
        }
      });
    }, 0);
  }
  
  // Call initTextareaHeights when currentQuestion changes
  $: if (currentQuestion) {
    initTextareaHeights();
  }

  // Add state for history modal
  let showHistoryModal = false;
  let historyEntries = [];
  let selectedHistoryDate = null;
  let isLoadingHistory = false;

  // Function to handle showing history
  async function showHistory() {
    showHistoryModal = true;
    isLoadingHistory = true;
    try {
      // Load history entries from journalStore
      historyEntries = await journalStore.getJournalHistory();
      console.log('Loaded history entries:', historyEntries);
    } catch (error) {
      console.error('Error loading journal history:', error);
    } finally {
      isLoadingHistory = false;
    }
  }

  // Function to view a specific history entry
  function viewHistoryEntry(date) {
    selectedHistoryDate = date;
  }

  // Function to close history view and return to main view
  function closeHistoryView() {
    selectedHistoryDate = null;
  }

  // Function to format date for display
  function formatDate(dateString) {
    try {
      // Handle Firestore timestamp objects
      if (dateString && typeof dateString === 'object' && dateString.toDate) {
        return dateString.toDate().toLocaleDateString('en-US', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        });
      }
      
      // Handle string dates
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString);
        return 'Unknown Date';
      }
      
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return 'Unknown Date';
    }
  }
</script>

<div class="journal-container">
  <Notification />
  <div class="journal-header">
    <div class="week-strip">
      <div class="week-strip-content">
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
      <button class="history-button" on:click={showHistory} aria-label="View journal history">
        <ClockCounterClockwise size={22} weight="bold" />
      </button>
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

  <div class="reflection-cards mt-4">
    <div 
      class="reflection-card {$journalStore.todayFreeWrite ? 'completed' : ''} {selectedReflection === 'freeWrite' ? 'active' : ''}"
      on:click={() => handleReflectionClick('freeWrite')}
    >
      <div class="card-content">
        <Book weight={$journalStore.todayFreeWrite ? 'fill' : 'regular'} size={24} class="text-[#216974]" />
        <h3>Free<br>Write</h3>
        <span class="status">{$journalStore.todayFreeWrite ? 'Completed' : ''}</span>
      </div>
    </div>

    <div 
      class="reflection-card {$journalStore.todayDeenReflection ? 'completed' : ''} {selectedReflection === 'deenReflections' ? 'active' : ''}"
      on:click={() => handleReflectionClick('deenReflections')}
    >
      <div class="card-content">
        <Book weight={$journalStore.todayDeenReflection ? 'fill' : 'regular'} size={24} class="text-[#E09453]" />
        <h3>Deen<br>Reflections</h3>
        <span class="status">{$journalStore.todayDeenReflection ? 'Completed' : ''}</span>
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
            {#if selectedReflection.endsWith('-view')}
              {getReflectionData(selectedReflection).title.split(' ').join('\n')}
            {:else}
              {(selectedReflection === 'morning' ? 'Morning' : 
                selectedReflection === 'evening' ? 'Evening' : 
                selectedReflection === 'freeWrite' ? 'Free Write' : 
                'Deen Reflections')}
            {/if}
          </h3>
          <button class="close-btn" on:click={() => selectedReflection = null}>
            <X weight="regular" size={32} />
          </button>
        </div>

        {#if selectedReflection === 'morning-view' || selectedReflection === 'evening-view' || selectedReflection === 'deenReflections-view'}
          <!-- View completed reflection -->
          <div class="modal-body view-mode">
            {#each getReflectionData(selectedReflection).questions as question}
              <div class="completed-question">
                <h4>{question.question}</h4>
                <p class="answer">{getReflectionData(selectedReflection).answers[question.field]}</p>
              </div>
            {/each}
          </div>
        {:else if selectedReflection === 'freeWrite-view'}
          <!-- View completed free write -->
          <div class="modal-body view-mode">
            <div class="completed-question">
              <p class="answer">{getReflectionData(selectedReflection).content}</p>
            </div>
          </div>
        {:else if selectedReflection === 'freeWrite'}
          <!-- Free Write input mode -->
          <div class="modal-body free-write-body">
            <form on:submit|preventDefault={saveFreeWrite}>
              <div class="question-content full-width">
                <div class="auto-expand-container full-width">
                  <textarea 
                    bind:value={freeWriteContent}
                    placeholder="Express your thoughts freely..."
                    maxlength="500"
                    autofocus
                    class="auto-expand free-write-textarea"
                    on:input={autoExpand}
                  ></textarea>
                  <div class="character-count">
                    {freeWriteContent ? freeWriteContent.length : 0}/500
                  </div>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="nav-btn" on:click={() => selectedReflection = null}>
                  Cancel
                </button>
                <button type="submit" class="submit-btn" disabled={isSubmitting}>
                  {#if isSubmitting}
                    <div class="loading-spinner"></div>
                  {:else}
                    Complete
                  {/if}
                </button>
              </div>
            </form>
          </div>
        {:else}
          <!-- Normal reflection input mode (Morning, Evening, and Deen) -->
          <div class="progress-bar">
            {#each currentQuestions as _, i}
              <div class="progress-dot {i <= currentQuestionIndex ? 'active' : ''} {selectedReflection === 'deenReflections' ? 'deen' : ''}"></div>
            {/each}
          </div>

          <div class="modal-body">
            <form on:submit={handleSubmit}>
              <div class="question-content">
                <label>{currentQuestion.question}</label>
                <div class="auto-expand-container">
                  <textarea 
                    bind:value={currentReflectionValue.value}
                    placeholder={currentQuestion.placeholder}
                    maxlength="500"
                    autofocus
                    class="auto-expand"
                    on:input={autoExpand}
                  ></textarea>
                  <div class="character-count">
                    {currentReflectionValue.value ? currentReflectionValue.value.length : 0}/500
                  </div>
                </div>
              </div>

              <div class="modal-footer">
                {#if !isFirstQuestion}
                  <button type="button" class="nav-btn" on:click={previousQuestion}>
                    <CaretLeft size={20} />
                    Previous
                  </button>
                {/if}

                <button type="submit" class="submit-btn {selectedReflection === 'deenReflections' ? 'deen-save' : ''}" disabled={isSubmitting}>
                  {#if isSubmitting}
                    <div class="loading-spinner"></div>
                  {:else}
                    {isLastQuestion ? 'Complete' : 'Next'}
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

  {#if showHistoryModal}
    <div class="modal-overlay" transition:fade={{ duration: 200 }}>
      <div 
        class="modal-content history-modal"
        transition:fly={{ y: 20, duration: 300, easing: quintOut }}
      >
        <div class="modal-header">
          <h3>Journal History</h3>
          <button class="close-btn" on:click={() => showHistoryModal = false}>
            <X weight="regular" size={32} />
          </button>
        </div>

        <div class="modal-body history-body">
          {#if isLoadingHistory}
            <div class="loading-container">
              <div class="loading-spinner history-spinner"></div>
              <p>Loading your journal history...</p>
            </div>
          {:else if selectedHistoryDate}
            <div class="history-entry-view">
              <button class="back-to-history" on:click={closeHistoryView}>
                <CaretLeft size={16} /> Back to history
              </button>
              
              <h4 class="history-date">{formatDate(selectedHistoryDate)}</h4>
              
              {#if true}
                {@const currentEntry = historyEntries.find(entry => 
                  entry.date === selectedHistoryDate || 
                  (entry.date && entry.date.toDate && entry.date.toDate().toISOString().split('T')[0] === selectedHistoryDate)
                )}
                
                {#if currentEntry?.morning}
                  <div class="history-section">
                    <h5>Morning Reflection</h5>
                    {#each morningQuestions as question}
                      <div class="history-question">
                        <h6>{question.question}</h6>
                        <p>{currentEntry.morning[question.field] || 'Not answered'}</p>
                      </div>
                    {/each}
                  </div>
                {/if}
                
                {#if currentEntry?.evening}
                  <div class="history-section">
                    <h5>Evening Reflection</h5>
                    {#each eveningQuestions as question}
                      <div class="history-question">
                        <h6>{question.question}</h6>
                        <p>{currentEntry.evening[question.field] || 'Not answered'}</p>
                      </div>
                    {/each}
                  </div>
                {/if}
                
                {#if currentEntry?.freeWrite}
                  <div class="history-section">
                    <h5>Free Write</h5>
                    <p class="history-free-write">{currentEntry.freeWrite}</p>
                  </div>
                {/if}
                
                {#if currentEntry?.deenReflections}
                  <div class="history-section">
                    <h5>Deen Reflections</h5>
                    {#each deenReflectionQuestions as question}
                      <div class="history-question">
                        <h6>{question.question}</h6>
                        <p>{currentEntry.deenReflections[question.field] || 'Not answered'}</p>
                      </div>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
          {:else if historyEntries.length === 0}
            <div class="empty-history">
              <p>You haven't created any journal entries yet.</p>
              <p>Start your journaling journey today!</p>
            </div>
          {:else}
            <div class="history-list">
              {#each historyEntries as entry}
                {#if true}
                  {@const entryDate = entry.date && entry.date.toDate ? entry.date.toDate().toISOString().split('T')[0] : entry.date}
                  <button class="history-item" on:click={() => viewHistoryEntry(entryDate)}>
                    <div class="history-item-date">{formatDate(entry.date)}</div>
                    <div class="history-item-content">
                      {#if entry.morning}<span class="history-tag morning">Morning</span>{/if}
                      {#if entry.evening}<span class="history-tag evening">Evening</span>{/if}
                      {#if entry.freeWrite}<span class="history-tag free-write">Free Write</span>{/if}
                      {#if entry.deenReflections}<span class="history-tag deen">Deen</span>{/if}
                    </div>
                    <CaretRight size={16} />
                  </button>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
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
    align-items: center;
    background: #216974;
    padding: 0.5rem 1rem;
    margin: 0 10px 1.25rem 10px;
    border-radius: 12px;
    position: sticky;
    top: 10px;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .week-strip-content {
    display: flex;
    flex: 1;
    justify-content: space-between;
  }

  .history-button {
    background: rgba(255, 255, 255, 0.25);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }

  .history-button:hover {
    background: rgba(255, 255, 255, 0.4);
    transform: translateY(-1px);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
  }

  .history-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }

  .week-strip.scrolled {
    /* Removed */
  }

  .week-strip.scrolled .day-item {
    /* Removed */
  }

  .week-strip.scrolled .day-name {
    /* Removed */
  }

  .day-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    color: rgba(255, 255, 255, 0.8);
    position: relative;
    border-radius: 8px;
  }

  .day-item.active {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .day-name {
    font-size: 0.75rem;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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
    display: flex;
    justify-content: space-between;
    align-items: center;
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

  .progress-dot.deen {
    background: #e0e0e0;
  }

  .progress-dot.deen.active {
    background: #E09453;
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
    width: 100%;
    padding: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 16px;
    background: white;
    color: #333;
    font-family: inherit;
    font-size: 1rem;
    line-height: 1.5;
    min-height: 120px;
  }
  
  textarea::placeholder {
    font-size: 0.85rem;
    opacity: 0.7;
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
    padding: 0 1rem;
  }

  .submit-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 100px;
    background: #216974;
    color: white;
    font-weight: 500;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 120px;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 100px;
    background: #f5f5f5;
    color: #666;
    font-weight: 500;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .nav-btn:hover {
    background: #eeeeee;
    color: #333;
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

  .additional-reflections {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 1.5rem;
    padding: 0 0.5rem;
  }

  .reflection-box {
    background: white;
    border: none;
    border-radius: 16px;
    padding: 2rem 1.5rem;
    width: 100%;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    position: relative;
    overflow: hidden;
  }

  .reflection-box::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: #216974;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .reflection-box.deen::before {
    background: #E09453;
  }

  .reflection-box:hover::before {
    opacity: 1;
  }

  .reflection-box:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .reflection-box-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .reflection-box .icon {
    width: 2rem;
    height: 2rem;
    color: #216974;
  }

  .reflection-box.deen .icon {
    color: #E09453;
  }

  .reflection-box h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #333;
    margin: 0;
  }

  .reflection-box p {
    font-size: 0.875rem;
    color: #666;
    margin: 0;
    text-align: center;
  }

  .reflection-panel {
    background: white;
    border-radius: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .reflection-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #f0f0f0;
  }

  .reflection-panel-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #216974;
    margin: 0;
  }

  .deen-panel .reflection-panel-header h2 {
    color: #E09453;
  }

  .close-button {
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: #f5f5f5;
    color: #333;
  }

  .reflection-textarea {
    width: 100%;
    padding: 1.5rem;
    border: none;
    background: #f8fafc;
    color: #333;
    font-size: 1rem;
    line-height: 1.6;
    resize: none;
    transition: background 0.2s ease;
  }

  .reflection-textarea:focus {
    outline: none;
    background: #f0f9fa;
  }

  .deen-questions {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .deen-question h3 {
    font-size: 1.125rem;
    font-weight: 500;
    color: #333;
    margin: 0 0 0.75rem 0;
  }

  .deen-textarea:focus {
    background: #fdf6f0;
  }

  .reflection-panel-footer {
    padding: 1.5rem;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #f0f0f0;
  }

  .save-button {
    padding: 0.75rem 2rem;
    border: none;
    border-radius: 12px;
    background: #216974;
    color: white;
    font-weight: 500;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .save-button:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .save-button.deen-save {
    background: #E09453;
  }

  .save-button.deen-save:hover {
    background: #c77f43;
  }

  @media (max-width: 640px) {
    .additional-reflections {
      grid-template-columns: 1fr;
      padding: 0;
    }

    .reflection-box {
      padding: 1.5rem 1rem;
    }

    .reflection-panel {
      border-radius: 16px;
    }

    .reflection-panel-header {
      padding: 1rem;
    }

    .reflection-panel-header h2 {
      font-size: 1.25rem;
    }

    .reflection-textarea {
      padding: 1rem;
    }

    .deen-questions {
      padding: 1rem;
      gap: 1.5rem;
    }

    .reflection-panel-footer {
      padding: 1rem;
    }

    .save-button, .cancel-button {
      padding: 0.5rem 1.5rem;
      font-size: 0.875rem;
    }
  }

  .reflection-form {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .reflection-panel-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid #f0f0f0;
    margin-top: auto;
  }

  .cancel-button {
    padding: 0.75rem 2rem;
    border: none;
    border-radius: 12px;
    background: #f5f5f5;
    color: #666;
    font-weight: 500;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button:hover {
    background: #eeeeee;
    color: #333;
  }

  .save-button {
    padding: 0.75rem 2rem;
    border: none;
    border-radius: 12px;
    background: #216974;
    color: white;
    font-weight: 500;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .save-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .save-button:not(:disabled):hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .save-button.deen-save {
    background: #E09453;
  }

  .save-button.deen-save:hover {
    background: #c77f43;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #ffffff;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .mt-4 {
    margin-top: 1rem;
  }

  .deen-question {
    margin-bottom: 2rem;
  }

  .deen-question:last-child {
    margin-bottom: 0;
  }

  .auto-expand-container {
    position: relative;
    width: 90%;
    margin-bottom: 1.5rem;
  }
  
  .auto-expand {
    resize: none;
    overflow: hidden;
    min-height: 120px;
    transition: height 0.1s ease;
  }
  
  .auto-expand::placeholder {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .auto-expand:focus {
    outline: none;
    border-color: #216974;
    box-shadow: 0 0 0 2px rgba(33, 105, 116, 0.1);
  }

  .character-count {
    position: absolute;
    bottom: -20px;
    right: 0;
    font-size: 0.75rem;
    color: #999;
    padding: 2px 0;
  }

  .full-width {
    width: 100%;
    padding: 0 1rem;
  }

  .free-write-textarea {
    min-height: 180px;
  }

  .free-write-body {
    padding: 1.5rem 0;
  }

  .history-modal {
    max-width: 600px;
    max-height: 80vh;
    padding: 1.5rem;
  }

  .history-body {
    overflow-y: auto;
    padding: 0;
    max-height: 60vh;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 0;
  }

  .history-spinner {
    width: 40px;
    height: 40px;
    border-width: 3px;
    margin-bottom: 1rem;
    border: 3px solid #216974;
    border-top-color: transparent;
  }

  .empty-history {
    text-align: center;
    padding: 3rem 1rem;
    color: #666;
  }

  .empty-history p {
    margin: 0.5rem 0;
  }

  .history-list {
    display: flex;
    flex-direction: column;
  }

  .history-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #eee;
    background: none;
    border-left: none;
    border-right: none;
    border-top: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .history-item:hover {
    background: #f0f9fa;
  }

  .history-item-date {
    font-weight: 500;
    color: #216974;
  }

  .history-item-content {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .history-tag {
    font-size: 0.75rem;
    padding: 0.25rem 0.75rem;
    border-radius: 100px;
    font-weight: 500;
    display: inline-block;
  }

  .history-tag.morning {
    background: #e6f7f9;
    color: #216974;
  }

  .history-tag.evening {
    background: #e6eef9;
    color: #2c4c8c;
  }

  .history-tag.free-write {
    background: #f0f9e6;
    color: #4c8c2c;
  }

  .history-tag.deen {
    background: #f9eee6;
    color: #E09453;
  }

  .history-entry-view {
    padding: 1rem 0;
  }

  .back-to-history {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: #216974;
    font-weight: 500;
    padding: 0;
    margin-bottom: 1.5rem;
    cursor: pointer;
  }

  .back-to-history:hover {
    opacity: 0.8;
  }

  .history-date {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1.5rem 0;
    color: #216974;
  }

  .history-section {
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #eee;
  }

  .history-section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .history-section h5 {
    font-size: 1.125rem;
    font-weight: 500;
    margin: 0 0 1rem 0;
    color: #216974;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e6f7f9;
  }

  .history-question {
    margin-bottom: 1.5rem;
  }

  .history-question:last-child {
    margin-bottom: 0;
  }

  .history-question h6 {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: #555;
  }

  .history-question p {
    margin: 0;
    line-height: 1.5;
    white-space: pre-line;
    color: #333;
  }

  .history-free-write {
    white-space: pre-line;
    line-height: 1.5;
    color: #333;
  }
</style> 