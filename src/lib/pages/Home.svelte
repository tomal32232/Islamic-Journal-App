<script>
  import BottomNav from '../BottomNav.svelte';
  import Profile from './Profile.svelte';
  import { 
    Sun, 
    SunDim, 
    CloudSun,
    SunHorizon, 
    MoonStars 
  } from 'phosphor-svelte';
  
  let currentPage = 'home';
  const date = new Date();
  
  // Format current time
  const currentTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Format date
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Get greeting based on time of day
  const hour = date.getHours();
  let greeting = '';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 17) greeting = 'Good Afternoon';
  else greeting = 'Good Evening';

  function handleTabChange(event) {
    currentPage = event.detail;
  }

  let prayers = [
    { 
      name: 'Fajr', 
      time: '5:43 AM', 
      done: false,
      icon: SunDim,  // Dawn
      weight: 'regular'
    },
    { 
      name: 'Dhuhr', 
      time: '12:15 PM', 
      done: false,
      icon: Sun,  // Noon sun
      weight: 'fill'
    },
    { 
      name: 'Asr', 
      time: '3:30 PM', 
      done: false,
      icon: CloudSun,  // Afternoon sun
      weight: 'regular'
    },
    { 
      name: 'Maghrib', 
      time: '5:45 PM', 
      done: false,
      icon: SunHorizon,  // Sunset
      weight: 'regular'
    },
    { 
      name: 'Isha', 
      time: '7:15 PM', 
      done: false,
      icon: MoonStars,  // Night
      weight: 'regular'
    }
  ];

  function markAsDone(index) {
    prayers[index].done = !prayers[index].done;
    prayers = [...prayers]; // trigger reactivity
  }

  // Get current week days
  function getCurrentWeek() {
    const current = new Date();
    const week = [];
    
    // Get Monday
    current.setDate(current.getDate() - current.getDay() + 1);
    
    for (let i = 0; i < 7; i++) {
      week.push({
        day: current.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        date: current.getDate(),
        isToday: current.getDate() === new Date().getDate()
      });
      current.setDate(current.getDate() + 1);
    }
    
    return week;
  }

  const weekDays = getCurrentWeek();
</script>

<main class="home-container">
  <div class="content">
    {#if currentPage === 'profile'}
      <Profile />
    {:else if currentPage === 'home'}
      <header class="greeting">
        <div class="datetime">
          <span class="time">{currentTime}</span>
          <span class="date">{formattedDate}</span>
        </div>
        <h1>{greeting}, Alex!</h1>
        
        <div class="calendar-strip">
          {#each weekDays as { day, date, isToday }}
            <div class="day-item {isToday ? 'active' : ''}">
              <span class="day">{day}</span>
              <span class="date-num">{date}</span>
            </div>
          {/each}
        </div>
      </header>

      <div class="quote-card">
        <blockquote>
          "Nothing is impossible. The word itself says 'I'm possible'!"
        </blockquote>
        <cite>AUDREY HEPBURN - ACTRESS</cite>
      </div>

      <section class="prayer-times">
        <h2>Prayer Times</h2>
        <div class="prayer-list">
          {#each prayers as prayer, i}
            <div class="prayer-item">
              <div class="prayer-info">
                <svelte:component 
                  this={prayer.icon} 
                  size={20} 
                  weight={prayer.weight}
                  color={prayer.done ? "#E09453" : "#000000"}
                />
                <span>{prayer.name}</span>
              </div>
              <div class="prayer-actions">
                <span class="prayer-time">{prayer.time}</span>
                <button 
                  class="mark-button {prayer.done ? 'done' : ''}" 
                  on:click={() => markAsDone(i)}
                >
                  {prayer.done ? '✓' : 'Mark'}
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </div>
  <BottomNav activeTab={currentPage} on:tabChange={handleTabChange} />
</main>

<style>
  .home-container {
    padding: 1rem;
    padding-bottom: 88px;
    background: #FFFFFF;
    min-height: 100vh;
  }

  .content {
    max-width: 600px;
    margin: 0 auto;
  }

  .datetime {
    text-align: center;
    margin-bottom: 1.5rem;
    padding-top: 0.5rem;
  }

  .time {
    display: block;
    font-size: 1.5rem;
    font-weight: 500;
    color: #000;
    margin-bottom: 0.25rem;
  }

  .date {
    color: #666;
    font-size: 0.875rem;
  }

  h1 {
    text-align: center;
    font-size: 1.25rem;
    margin-bottom: 1.5rem;
    color: #000;
    font-weight: 500;
  }

  .calendar-strip {
    display: flex;
    justify-content: space-between;
    margin: 0 -0.5rem 1.5rem;
    padding: 0 1rem;
  }

  .day-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    min-width: 2rem;
  }

  .day {
    font-size: 0.75rem;
    color: #666;
  }

  .date-num {
    font-size: 1rem;
    color: #000;
  }

  .day-item.active .date-num {
    color: #E09453;
    font-weight: 500;
  }

  .quote-card {
    background: #216974;
    color: white;
    padding: 1.5rem;
    border-radius: 12px;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  blockquote {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  cite {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .prayer-times {
    background: white;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    border: 1px solid rgba(226, 148, 83, 0.2);
  }

  .prayer-times h2 {
    font-size: 1rem;
    color: #000;
    margin-bottom: 1rem;
    padding-left: 0.5rem;
  }

  .prayer-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid #eee;
  }

  .prayer-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #000;
  }

  .prayer-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .prayer-time {
    color: #000;
    font-size: 0.875rem;
  }

  .mark-button {
    background: transparent;
    border: 1px solid #E09453;
    color: #E09453;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mark-button.done {
    background: #E09453;
    color: white;
  }

  /* Remove the border from the last prayer item */
  .prayer-item:last-child {
    border-bottom: none;
  }

  .prayer-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
</style>
