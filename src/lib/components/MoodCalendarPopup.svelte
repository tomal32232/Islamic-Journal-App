<script lang="ts">
  import { fade } from 'svelte/transition';
  import { createEventDispatcher, onMount } from 'svelte';
  import { moodHistoryStore, getMoodHistory } from '../stores/moodStore';

  const dispatch = createEventDispatcher();
  
  export let moods = [];
  export let onClose = () => {};

  let calendarDays = [];
  let currentMonth = new Date();
  let monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let moodsByDate = {};

  onMount(async () => {
    await loadMoodHistory();
    generateCalendar();
  });

  async function loadMoodHistory() {
    // Load 90 days of mood history
    await getMoodHistory(90);
    
    // Group moods by date
    moodsByDate = {};
    $moodHistoryStore.forEach(mood => {
      if (!moodsByDate[mood.date]) {
        moodsByDate[mood.date] = { morning: null, evening: null };
      }
      moodsByDate[mood.date][mood.period] = mood;
    });
  }

  function generateCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0-6)
    const firstDayIndex = firstDay.getDay();
    
    // Calculate days from previous month to show
    const prevMonthDays = [];
    if (firstDayIndex > 0) {
      const prevMonth = new Date(year, month, 0);
      const prevMonthLastDay = prevMonth.getDate();
      
      for (let i = prevMonthLastDay - firstDayIndex + 1; i <= prevMonthLastDay; i++) {
        const date = new Date(year, month - 1, i);
        const dateString = date.toLocaleDateString();
        prevMonthDays.push({
          date: i,
          fullDate: dateString,
          isCurrentMonth: false,
          moods: moodsByDate[dateString] || { morning: null, evening: null }
        });
      }
    }
    
    // Calculate days in current month
    const currentMonthDays = [];
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const dateString = date.toLocaleDateString();
      currentMonthDays.push({
        date: i,
        fullDate: dateString,
        isCurrentMonth: true,
        isToday: isToday(date),
        moods: moodsByDate[dateString] || { morning: null, evening: null }
      });
    }
    
    // Calculate days from next month to show
    const nextMonthDays = [];
    const totalDaysShown = prevMonthDays.length + currentMonthDays.length;
    const remainingDays = 42 - totalDaysShown; // 6 rows of 7 days
    
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      const dateString = date.toLocaleDateString();
      nextMonthDays.push({
        date: i,
        fullDate: dateString,
        isCurrentMonth: false,
        moods: moodsByDate[dateString] || { morning: null, evening: null }
      });
    }
    
    calendarDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  }

  function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  function previousMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    generateCalendar();
  }

  function nextMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    generateCalendar();
  }

  function handleMoodClick(mood) {
    dispatch('select', mood);
  }
</script>

<div class="popup-backdrop" on:click={onClose} transition:fade={{ duration: 300 }}>
  <div class="popup-content" on:click|stopPropagation>
    <button class="close-button" on:click={onClose}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    
    <div class="popup-header">
      <h2>Mood Calendar</h2>
      <p class="subtitle">Track your emotional journey</p>
    </div>

    <div class="calendar-navigation">
      <button class="nav-button" on:click={previousMonth}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="current-month">
        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
      </div>
      <button class="nav-button" on:click={nextMonth}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <div class="calendar-container">
      <div class="weekdays">
        {#each weekDays as day}
          <div class="weekday">{day}</div>
        {/each}
      </div>
      
      <div class="calendar-grid">
        {#each calendarDays as day}
          <div class="calendar-day {day.isCurrentMonth ? 'current-month' : 'other-month'} {day.isToday ? 'today' : ''}">
            <div class="date-number">{day.date}</div>
            
            <div class="mood-icons">
              {#if day.moods.morning}
                {@const morningMood = moods.find(m => m.value === day.moods.morning.mood)}
                {#if morningMood}
                  <button 
                    class="mood-icon-button morning" 
                    on:click={() => handleMoodClick(day.moods.morning)}
                    title={`Morning: ${morningMood.name}`}
                  >
                    {@html morningMood.icon}
                  </button>
                {/if}
              {/if}
              
              {#if day.moods.evening}
                {@const eveningMood = moods.find(m => m.value === day.moods.evening.mood)}
                {#if eveningMood}
                  <button 
                    class="mood-icon-button evening" 
                    on:click={() => handleMoodClick(day.moods.evening)}
                    title={`Evening: ${eveningMood.name}`}
                  >
                    {@html eveningMood.icon}
                  </button>
                {/if}
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .popup-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    padding: 1rem;
    box-sizing: border-box;
  }

  .popup-content {
    background: white;
    border-radius: 24px;
    padding: 1.5rem;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }

  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    color: #718096;
    padding: 0.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-button svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .close-button:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .popup-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .popup-header h2 {
    color: #216974;
    font-size: 1.5rem;
    margin: 0;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #718096;
    font-size: 0.875rem;
    margin: 0;
  }

  .calendar-navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .nav-button {
    background: none;
    border: none;
    cursor: pointer;
    color: #216974;
    padding: 0.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-button svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .nav-button:hover {
    background: rgba(33, 105, 116, 0.1);
  }

  .current-month {
    font-size: 1.125rem;
    font-weight: 500;
    color: #216974;
  }

  .calendar-container {
    border-radius: 16px;
    overflow: hidden;
    background: #F8FAFC;
  }

  .weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: #E6F7F9;
    padding: 0.75rem 0;
  }

  .weekday {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: #216974;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(6, 1fr);
  }

  .calendar-day {
    height: 3.5rem;
    padding: 0.25rem;
    border: 1px solid #EDF2F7;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .current-month {
    background: white;
  }

  .other-month {
    background: #F8FAFC;
    color: #A0AEC0;
  }

  .today {
    background: #E6F7F9;
  }

  .date-number {
    font-size: 0.75rem;
    margin-bottom: 0.25rem;
  }

  .mood-icons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    justify-content: center;
  }

  .mood-icon-button {
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: #216974;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mood-icon-button.morning {
    color: #F59E0B;
  }

  .mood-icon-button.evening {
    color: #10B981;
  }

  .mood-icon-button:hover {
    transform: scale(1.2);
  }

  @media (max-width: 480px) {
    .popup-content {
      padding: 1.25rem;
      border-radius: 20px;
    }

    .calendar-day {
      height: 3rem;
    }
  }
</style> 