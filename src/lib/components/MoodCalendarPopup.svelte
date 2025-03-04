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
      
      // Store the mood in the appropriate period slot
      moodsByDate[mood.date][mood.period] = mood;
      
      // Debug log
      console.log(`Mood for ${mood.date}, period ${mood.period}:`, mood.mood);
    });
    
    // Log the grouped moods
    console.log('Grouped moods by date:', moodsByDate);
    
    // Additional debug for March 3rd specifically
    const march3 = new Date('2024-03-03').toLocaleDateString();
    if (moodsByDate[march3]) {
      console.log('March 3rd moods:', moodsByDate[march3]);
    }
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
                {@const morningMood = moods.find(m => 
                  m.value === day.moods.morning.mood || 
                  m.value === day.moods.morning.mood.replace(/\s+/g, '_') || 
                  m.value === day.moods.morning.mood.replace(/_+/g, ' ')
                )}
                {#if morningMood}
                  <button 
                    class="mood-icon-button morning mood-{morningMood.value}" 
                    on:click={() => handleMoodClick(day.moods.morning)}
                    title={`Morning: ${morningMood.name}`}
                  >
                    <div class="mood-icon-wrapper">
                      <div class="time-indicator morning"></div>
                      <div class="mood-name morning">{morningMood.name}</div>
                    </div>
                  </button>
                {:else}
                  <span class="debug-info" style="display: none;">
                    {console.log(`No matching morning mood found for ${day.fullDate}. Value:`, day.moods.morning.mood)}
                  </span>
                {/if}
              {/if}
              
              {#if day.moods.evening}
                {@const eveningMood = moods.find(m => 
                  m.value === day.moods.evening.mood || 
                  m.value === day.moods.evening.mood.replace(/\s+/g, '_') || 
                  m.value === day.moods.evening.mood.replace(/_+/g, ' ')
                )}
                {#if eveningMood}
                  <button 
                    class="mood-icon-button evening mood-{eveningMood.value}" 
                    on:click={() => handleMoodClick(day.moods.evening)}
                    title={`Evening: ${eveningMood.name}`}
                  >
                    <div class="mood-icon-wrapper">
                      <div class="time-indicator evening"></div>
                      <div class="mood-name evening">{eveningMood.name}</div>
                    </div>
                  </button>
                {:else}
                  <span class="debug-info" style="display: none;">
                    {console.log(`No matching evening mood found for ${day.fullDate}. Value:`, day.moods.evening.mood)}
                  </span>
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
    background: white;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-top: 0.5rem;
  }

  .weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: #F8FAFC;
    padding: 0.5rem 0;
    text-align: center;
    font-weight: 500;
    color: #64748B;
    font-size: 0.75rem;
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
    gap: 0.25rem;
    border-radius: 0.5rem;
    overflow: hidden;
    grid-auto-rows: 4.5rem;
  }

  .calendar-day {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 0.25rem 0.1rem;
    border-radius: 0.5rem;
    position: relative;
    height: 4.5rem;
    width: 100%;
    cursor: pointer;
    box-sizing: border-box;
    overflow: hidden;
  }

  .calendar-day:hover {
    background-color: rgba(33, 105, 116, 0.05);
  }

  .date-number {
    font-size: 0.875rem;
    margin-bottom: 0.3rem;
    font-weight: 500;
    width: 100%;
    text-align: center;
  }

  .other-month .date-number {
    color: #A0AEC0;
  }

  .today {
    background-color: rgba(33, 105, 116, 0.1);
  }

  .today .date-number {
    color: #216974;
    font-weight: 600;
  }

  .mood-icons {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
    justify-content: flex-start;
    width: 100%;
    max-height: 2.5rem;
    overflow: hidden;
    padding: 0;
  }

  .mood-icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-bottom: 0.1rem;
    width: 100%;
    padding-left: 0;
  }

  .mood-icon-button {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    transition: transform 0.2s;
    width: 100%;
    position: relative;
    height: 1rem;
  }

  .mood-icon-button svg {
    width: 1.2rem;
    height: 1.2rem;
  }

  .time-indicator {
    display: inline-block;
    width: 0.25rem;
    height: 0.25rem;
    border-radius: 50%;
    margin-right: 0.15rem;
    position: relative;
    top: 0;
    left: 0;
    border: none;
    flex-shrink: 0;
  }

  .time-indicator.morning {
    background-color: #FFB84D; /* Orange */
  }

  .time-indicator.evening {
    background-color: #7DD3FC; /* Light blue */
  }

  .mood-icon-button.morning {
    color: #216974;
  }

  .mood-icon-button.evening {
    color: #216974;
  }

  .mood-grateful {
    color: #10B981;
  }

  .mood-seeking_peace {
    color: #3B82F6;
  }

  .mood-hopeful {
    color: #F59E0B;
  }

  .mood-anxious {
    color: #EF4444;
  }

  .mood-reflecting {
    color: #8B5CF6;
  }

  .mood-blessed {
    color: #14B8A6;
  }

  .mood-icon-button:hover {
    transform: none;
  }

  .mood-icon-button svg {
    display: none;
  }

  @media (max-width: 480px) {
    .popup-content {
      padding: 1.25rem;
      border-radius: 20px;
    }

    .calendar-day {
      height: 4rem;
    }
    
    .mood-icons {
      max-height: 2.5rem;
    }
    
    .calendar-grid {
      grid-auto-rows: 4rem;
    }
  }

  .current-month {
    background: white;
    border: 1px solid #EDF2F7;
  }

  .other-month {
    background: #F8FAFC;
    color: #A0AEC0;
    border: 1px solid #F8FAFC;
  }

  .calendar-day.current-month {
    background: white;
    border: 1px solid #EDF2F7;
  }

  .calendar-day.other-month {
    background: #F8FAFC;
    border: 1px solid #F8FAFC;
  }

  .calendar-day.other-month .date-number {
    color: #A0AEC0;
  }

  .time-indicator {
    display: inline-block;
    width: 0.25rem;
    height: 0.25rem;
    border-radius: 50%;
    margin-right: 0.15rem;
    position: relative;
    top: 0;
    left: 0;
    border: none;
    flex-shrink: 0;
  }

  .time-indicator.morning {
    background-color: #FFB84D; /* Orange */
  }

  .time-indicator.evening {
    background-color: #7DD3FC; /* Light blue */
  }

  .mood-name {
    font-size: 0.45rem;
    line-height: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 4rem;
    padding-top: 0.05rem;
  }

  .mood-name.morning {
    color: #F59E0B; /* Orange */
  }

  .mood-name.evening {
    color: #0EA5E9; /* Blue */
  }
</style> 