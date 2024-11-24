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

      <WeeklyStreak />

      <div class="quote-card">
        <blockquote>
          "Indeed, with hardship comes ease." 
        </blockquote>
        <cite>Surah Ash-Sharh [94:5-6]</cite>
      </div>

      <section class="prayer-times">
        <h2>Upcoming Prayer</h2>
        {#if $loadingStore}
          <div class="loading">Loading prayer times...</div>
        {:else if $errorStore}
          <div class="error">{$errorStore}</div>
        {:else if upcomingPrayer && !countdownEnded}
          <div class="upcoming-prayer">
            <div class="prayer-info">
              <svelte:component 
                this={iconMap[upcomingPrayer.icon]} 
                size={24} 
                weight={upcomingPrayer.weight}
              />
              <div class="prayer-details">
                <span class="prayer-name">{upcomingPrayer.name}</span>
                <span class="prayer-time">{upcomingPrayer.time}</span>
                {#if upcomingCountdown}
                  <span class="countdown">{upcomingCountdown}</span>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        {#if Object.keys($prayerHistoryStore.pendingByDate || {}).length > 0}
          <div class="pending-prayers">
            <h3>Pending Actions</h3>
            {#each Object.entries($prayerHistoryStore.pendingByDate) as [date, { isToday, prayers }]}
              <div class="date-group">
                <div class="date-header">
                  {isToday ? 'Today' : new Date(date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
                {#each prayers as prayer}
                  <div class="pending-prayer-item">
                    <div class="prayer-info">
                      <svelte:component 
                        this={iconMap[prayer.icon]} 
                        size={20} 
                        weight={prayer.weight}
                      />
                      <span>{prayer.name}</span>
                      <span class="prayer-time">{prayer.time}</span>
                    </div>
                    <div class="prayer-actions">
                      <button 
                        class="status-button ontime" 
                        on:click={() => markPrayerStatus(prayer, 'ontime')}
                      >
                        On time
                      </button>
                      <button 
                        class="status-button late" 
                        on:click={() => markPrayerStatus(prayer, 'late')}
                      >
                        Late
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
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

  .location {
    display: block;
    color: #666;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  .upcoming-prayer {
    background: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 1.5rem;
    opacity: 1;
    transition: opacity 0.3s ease;
  }

  .upcoming-prayer.ending {
    opacity: 0;
  }

  .prayer-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
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

  .prayer-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .prayer-time {
    color: #666;
    font-size: 0.875rem;
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

  .countdown {
    font-size: 1.25rem;
    font-weight: 500;
    color: #216974;
    margin-top: 0.25rem;
  }
</style>

