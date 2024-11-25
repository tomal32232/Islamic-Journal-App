<script>
  import { onMount } from 'svelte';
  import BottomNav from '../BottomNav.svelte';
  import Profile from './Profile.svelte';
  import { iconMap } from '../utils/icons';
  import { prayerTimesStore, loadingStore, errorStore, fetchPrayerTimes, locationStore } from '../services/prayerTimes';
  import { auth } from '../firebase';
  import Tasbih from './Tasbih.svelte';
  import WeeklyStreak from '../components/WeeklyStreak.svelte';
  import Prayer from './Prayer.svelte';
  import { savePrayerStatus, getPrayerHistory, prayerHistoryStore } from '../stores/prayerHistoryStore';
  
  let currentPage = 'home';
  const date = new Date();
  
  // Format current time
  const currentTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
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

  function markAsDone(index) {
    $prayerTimesStore = $prayerTimesStore.map((prayer, i) => 
      i === index ? { ...prayer, done: !prayer.done } : prayer
    );
  }

  // Get current week days
  function getCurrentWeek() {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay()); // Go back to last Sunday
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(sunday);
      current.setDate(current.getDate() + i);
      
      week.push({
        day: current.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        date: current.getDate(),
        isToday: current.getDate() === today.getDate() &&
                 current.getMonth() === today.getMonth()
      });
    }
    
    return week;
  }

  const weekDays = getCurrentWeek();

  function capitalizeFirstLetter(string) {
    return string ? string.charAt(0).toUpperCase() + string.slice(1).toLowerCase() : '';
  }

  let userName = capitalizeFirstLetter(auth.currentUser?.displayName?.split(' ')[0]) || 'Guest';

  let upcomingPrayer = null;
  let pendingPrayers = [];

  let upcomingCountdown = '';
  let countdownEnded = false;

  async function updateCountdown() {
    if (!upcomingPrayer) return;
    
    const [time, period] = upcomingPrayer.time.split(' ');
    const [hours, minutes] = time.split(':');
    const now = new Date();
    const prayerDate = new Date();
    
    let hour = parseInt(hours);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    prayerDate.setHours(hour, parseInt(minutes), 0);
    
    const diff = prayerDate - now;
    if (diff < 0) {
      // Prayer time has passed
      countdownEnded = true;
      // Move to pending and find next upcoming prayer
      await getPrayerHistory();
      updatePrayerStatus();
      return;
    }
    
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    
    upcomingCountdown = `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    countdownEnded = false;
  }

  async function updatePrayerStatus() {
    const prayers = $prayerTimesStore;
    const now = new Date();
    
    // Reset upcoming prayer
    upcomingPrayer = null;
    
    // Find next upcoming prayer
    for (let prayer of prayers) {
      const [time, period] = prayer.time.split(' ');
      const [hours, minutes] = time.split(':');
      const prayerDate = new Date();
      
      let hour = parseInt(hours);
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      
      prayerDate.setHours(hour, parseInt(minutes), 0);
      
      if (prayerDate > now && !prayer.status) {
        upcomingPrayer = prayer;
        break;
      }
    }

    // If no upcoming prayer found today, set to first prayer of next day
    if (!upcomingPrayer && prayers.length > 0) {
      upcomingPrayer = prayers[0];
    }

    // Update pending prayers
    await getPrayerHistory();
  }

  async function markPrayerStatus(prayer, status) {
    await savePrayerStatus({
      name: prayer.name,
      time: prayer.time,
      status
    });
    
    $prayerTimesStore = $prayerTimesStore.map(p => 
      p.name === prayer.name ? { ...p, status } : p
    );
    
    // Update lists
    updatePrayerStatus();
  }

  onMount(async () => {
    auth.onAuthStateChanged(async (user) => {
      userName = capitalizeFirstLetter(user?.displayName?.split(' ')[0]) || 'Guest';
      if (user) {
        await fetchPrayerTimes();
        await getPrayerHistory();
        updatePrayerStatus();
      }
    });
    
    const prayerInterval = setInterval(updatePrayerStatus, 60000);
    const countdownInterval = setInterval(updateCountdown, 1000);
    
    return () => {
      clearInterval(prayerInterval);
      clearInterval(countdownInterval);
    };
  });

  // Add console log to debug
  $: console.log('Prayer History Store:', $prayerHistoryStore);
</script>

<main class="home-container">
  <div class="content">
    {#if currentPage === 'profile'}
      <Profile />
    {:else if currentPage === 'tasbih'}
      <Tasbih />
    {:else if currentPage === 'prayer'}
      <Prayer />
    {:else if currentPage === 'home'}
      <header class="greeting">
        <div class="datetime">
          <span class="time">{currentTime}</span>
          <span class="date">{formattedDate}</span>
          {#if $locationStore}
            <span class="location">{$locationStore}</span>
          {/if}
        </div>
        <h1>{greeting}, {userName}!</h1>
        
        <div class="calendar-strip">
          {#each weekDays as { day, date, isToday }}
            <div class="day-item {isToday ? 'active' : ''}">
              <span class="day">{day}</span>
              <span class="date-num">{date}</span>
            </div>
          {/each}
        </div>
      </header>

      <section class="prayer-times">
        {#if $loadingStore}
          <div class="loading">Loading prayer times...</div>
        {:else if $errorStore}
          <div class="error">{$errorStore}</div>
        {:else if upcomingPrayer && !countdownEnded}
          <div class="upcoming-prayer">
            <div class="prayer-info">
              <svelte:component 
                this={iconMap[upcomingPrayer.icon]} 
                size={18} 
                weight={upcomingPrayer.weight}
              />
              <div class="prayer-details">
                <div class="name-time">
                  <span class="prayer-name">{upcomingPrayer.name}</span>
                  <span class="prayer-time">{upcomingPrayer.time}</span>
                </div>
                {#if upcomingCountdown}
                  <span class="countdown">{upcomingCountdown}</span>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </section>

      <WeeklyStreak />

      <div class="quote-card">
        <blockquote>
          "Indeed, with hardship comes ease." 
        </blockquote>
        <cite>Surah Ash-Sharh [94:5-6]</cite>
      </div>
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
    padding: 0.75rem 1rem;
    border-radius: 12px;
    border: 1px solid rgba(226, 148, 83, 0.2);
    margin-bottom: 1rem;
  }

  .upcoming-prayer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .prayer-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .prayer-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .name-time {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .prayer-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #216974;
  }

  .prayer-time {
    font-size: 0.75rem;
    color: #666;
  }

  .countdown {
    font-size: 1rem;
    font-weight: 500;
    color: #E09453;
    margin-left: auto;
  }

  .loading, .error {
    font-size: 0.875rem;
    color: #666;
    text-align: center;
    padding: 0.5rem;
  }

  .location {
    display: block;
    color: #666;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  .pending-prayers {
    margin-top: 1.5rem;
  }

  .pending-prayers h3 {
    font-size: 1rem;
    margin-bottom: 1rem;
    color: #666;
  }

  .pending-prayer-item {
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #eee;
  }

  .pending-prayer-item:last-child {
    border-bottom: none;
  }

  .prayer-actions {
    display: flex;
    gap: 0.5rem;
  }

  .status-button {
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .status-button.ontime {
    background: #216974;
    color: white;
  }

  .status-button.late {
    background: #E09453;
    color: white;
  }

  .date-group {
    background: white;
    border-radius: 8px;
    margin-bottom: 1rem;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .date-header {
    background: #f5f5f5;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: #666;
    font-weight: 500;
  }
</style>

