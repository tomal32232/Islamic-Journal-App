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
  import { savePrayerStatus, getPrayerHistory, prayerHistoryStore, convertPrayerTimeToDate, updatePrayerStatuses } from '../stores/prayerHistoryStore';
  import WeeklyPrayerHistory from '../components/WeeklyPrayerHistory.svelte';
  import { createEventDispatcher } from 'svelte';
  import Journal from './Journal.svelte';
  import { getTodayReadingTime, formatReadingTime } from '../services/readingTimeService';
  const dispatch = createEventDispatcher();
  
  let currentPage = 'home';
  
  // Get greeting based on time of day
  const hour = new Date().getHours();
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

  let todayReadingTime = 0;

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
    await updatePrayerStatuses();
    
    // Use the same counting logic as NotificationIcon
    pendingPrayers = Object.values($prayerHistoryStore.pendingByDate)
      .reduce((prayers, { prayers: datePrayers }) => [...prayers, ...datePrayers], []);
    
    const now = new Date();
    upcomingPrayer = null;
    
    for (const prayer of $prayerTimesStore) {
      if (!prayer?.time) continue;
      const prayerTime = convertPrayerTimeToDate(prayer.time);
      if (prayerTime > now && !upcomingPrayer) {
        upcomingPrayer = prayer;
        break;
      }
    }
  }

  async function markPrayerStatus(prayer, status) {
    if (!prayer?.name && !prayer?.prayerName) {
      console.error('Invalid prayer data:', prayer);
      return;
    }

    await savePrayerStatus({
      name: prayer.prayerName || prayer.name,
      time: prayer.time,
      status
    });
    
    await getPrayerHistory();
    await updatePrayerStatus();
  }

  function checkPrayerNotifications() {
    $prayerTimesStore.forEach(prayer => {
      if (prayer.isPast && !prayer.notified) {
        // Show notification
        if (Notification.permission === "granted") {
          new Notification(`Prayer Reminder`, {
            body: `Time for ${prayer.name} prayer has passed. Don't forget to mark it.`,
            icon: '/icon.png'
          });
        }
        // Update store to mark as notified
        prayer.notified = true;
      }
    });
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
    const notificationInterval = setInterval(checkPrayerNotifications, 60000);
    
    todayReadingTime = await getTodayReadingTime();
    
    return () => {
      clearInterval(prayerInterval);
      clearInterval(countdownInterval);
      clearInterval(notificationInterval);
    };
  });

  // Add console log to debug
  $: console.log('Prayer History Store:', $prayerHistoryStore);

  function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }

  function getFormattedDate() {
    const now = new Date();
    return now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  let currentTime = getCurrentTime();
  let formattedDate = getFormattedDate();

  onMount(() => {
    const timeInterval = setInterval(() => {
      currentTime = getCurrentTime();
      formattedDate = getFormattedDate();
    }, 1000);

    return () => clearInterval(timeInterval);
  });
</script>

<main class="home-container">
  <div class="content">
    {#if currentPage === 'home'}
      <div class="quote-card">
        <div class="greeting-section">
          <h1>{greeting}, {userName}!</h1>
          <div class="datetime">
            <span class="time">{currentTime}</span>
            <span class="date">{formattedDate}</span>
            {#if $locationStore}
              <span class="location">{$locationStore}</span>
            {/if}
          </div>
        </div>
        <div class="quote-section">
          <blockquote>"Indeed, with hardship comes ease."</blockquote>
          <cite>Surah Ash-Sharh [94:5-6]</cite>
        </div>
      </div>

      <div class="calendar-strip">
        {#each weekDays as { day, date, isToday }}
          <div class="day-item {isToday ? 'active' : ''}">
            <span class="day">{day}</span>
            <span class="date-num">{date}</span>
          </div>
        {/each}
      </div>

      <div class="reading-stats">
        <div class="stats-card">
          <h3>Today's Quran Reading</h3>
          <p class="reading-time">{formatReadingTime(todayReadingTime)}</p>
        </div>
      </div>

      <section class="upcoming-prayer">
        <div class="prayer-card">
          <h2>Next Prayer</h2>
          {#if upcomingPrayer}
            <div class="prayer-info">
              <div class="prayer-header">
                <div class="prayer-icon">
                  <svelte:component 
                    this={iconMap[upcomingPrayer.icon]} 
                    size={24} 
                    weight={upcomingPrayer.weight}
                    color="#216974"
                  />
                </div>
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
            {#if pendingPrayers.length > 0}
              <div class="pending-notice">
                You have {pendingPrayers.length} unmarked {pendingPrayers.length === 1 ? 'prayer' : 'prayers'}. 
                <button class="link-button" on:click={() => dispatch('showNotifications')}>
                  Mark them now
                </button>
              </div>
            {/if}
          {:else}
            <div class="no-prayers-message">
              <p>No more prayers scheduled for today</p>
              {#if pendingPrayers.length > 0}
                <p class="pending-notice">
                  You have {pendingPrayers.length} unmarked {pendingPrayers.length === 1 ? 'prayer' : 'prayers'}. 
                  <button class="link-button" on:click={() => dispatch('showNotifications')}>
                    Mark them now
                  </button>
                </p>
              {/if}
            </div>
          {/if}
        </div>
      </section>

      <WeeklyStreak />
      <WeeklyPrayerHistory />
    {:else if currentPage === 'prayer'}
      <Prayer />
    {:else if currentPage === 'tasbih'}
      <Tasbih />
    {:else if currentPage === 'journal'}
      <Journal />
    {:else if currentPage === 'profile'}
      <Profile />
    {/if}
  </div>
  <BottomNav activeTab={currentPage} on:tabChange={handleTabChange} />
</main>

<style>
  .home-container {
    padding: 1rem;
    padding-top: calc(1rem + 20px);
    padding-bottom: 88px;
    background: #FFFFFF;
    height: 100%;
    overflow-y: auto;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .content {
    max-width: 600px;
    margin: 0 auto;
  }

  .quote-card {
    background: #216974;
    color: white;
    padding: 1rem;
    border-radius: 12px;
    margin-bottom: 1rem;
  }

  .greeting-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .greeting-section h1 {
    color: white;
    font-size: 1.125rem;
    font-weight: 500;
    margin: 0;
  }

  .datetime {
    text-align: right;
  }

  .time {
    display: block;
    font-size: 1rem;
    font-weight: 500;
    color: white;
  }

  .date, .location {
    display: block;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .quote-section {
    text-align: center;
  }

  blockquote {
    font-size: 0.875rem;
    margin: 0 0 0.25rem;
  }

  cite {
    font-size: 0.75rem;
    opacity: 0.8;
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

  .prayer-times {
    background: white;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    border: 1px solid rgba(226, 148, 83, 0.2);
    margin-bottom: 1rem;
  }

  .upcoming-prayer {
    margin-bottom: 1rem;
  }

  .prayer-card {
    background: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .prayer-card h2 {
    font-size: 1rem;
    color: #216974;
    margin-bottom: 1rem;
  }

  .prayer-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .prayer-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(33, 105, 116, 0.1);
    border-radius: 8px;
  }

  .prayer-details {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .name-time {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .prayer-name {
    font-weight: 500;
    color: #216974;
    font-size: 1rem;
  }

  .prayer-time {
    font-size: 0.875rem;
    color: #666;
  }

  .countdown {
    font-size: 1.125rem;
    font-weight: 500;
    color: #E09453;
  }

  .pending-notice {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
    font-size: 0.875rem;
    color: #666;
  }

  .loading, .error {
    font-size: 0.875rem;
    color: #666;
    text-align: center;
    padding: 0.5rem;
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: white;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .prayer-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .prayer-name {
    font-weight: 500;
    color: #216974;
  }

  .prayer-date {
    font-size: 0.875rem;
    color: #666;
  }

  .prayer-time {
    font-size: 0.875rem;
    color: #666;
  }

  .prayer-actions {
    display: flex;
    gap: 0.5rem;
  }

  .status-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: opacity 0.2s;
  }

  .status-button:hover {
    opacity: 0.9;
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

  .no-prayers-card {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    border: 1px solid #eee;
  }

  .no-prayers-message {
    color: #666;
    font-size: 1rem;
    margin: 0;
    margin-bottom: 0.5rem;
  }

  .pending-notice {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
    font-size: 0.875rem;
    color: #666;
  }

  .link-button {
    background: none;
    border: none;
    color: #216974;
    font-weight: 500;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
  }

  .link-button:hover {
    opacity: 0.8;
  }

  .prayer-card h2 {
    font-size: 1rem;
    color: #216974;
    margin-bottom: 1rem;
  }

  .no-prayers-message {
    text-align: center;
    color: #666;
    margin: 1rem 0;
  }

  .reading-stats {
    margin-top: 2rem;
  }

  .stats-card {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .stats-card h3 {
    color: #216974;
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 500;
  }

  .reading-time {
    font-size: 1.5rem;
    color: #E09453;
    font-weight: 500;
    margin: 0;
  }
</style>

