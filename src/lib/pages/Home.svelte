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
  import { weeklyStatsStore, getWeeklyStats } from '../stores/tasbihStore';
  import { quoteStore, getRandomQuote } from '../services/quoteService';
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

  let completedPrayersToday = 0;
  let todayTasbihCount = 0;

  $: {
    const today = new Date().toISOString().split('T')[0];
    if ($prayerHistoryStore?.history) {
      const todayPrayers = $prayerHistoryStore.history.filter(p => 
        p.date === today && (p.status === 'ontime' || p.status === 'late')
      );
      completedPrayersToday = todayPrayers.length;
    }

    if ($weeklyStatsStore?.dailyCount?.[today]) {
      todayTasbihCount = $weeklyStatsStore.dailyCount[today];
    }
  }

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
    
    await getRandomQuote();
    await getWeeklyStats();
    
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
          <blockquote>"{$quoteStore.text}"</blockquote>
          <cite>{$quoteStore.source}</cite>
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
        <h3 class="section-title">Today's Activities</h3>
        <div class="activities-row">
          <div class="activity-card">
            <div class="activity-icon prayer">
              <svelte:component this={iconMap.Mosque} size={18} weight="fill" color="#216974" />
            </div>
            <div class="activity-info">
              <span class="activity-value">{completedPrayersToday}/5</span>
              <span class="activity-label">Prayer</span>
            </div>
          </div>

          <div class="activity-card">
            <div class="activity-icon quran">
              <svelte:component this={iconMap.Book} size={18} weight="fill" color="#216974" />
            </div>
            <div class="activity-info">
              <span class="activity-value">{formatReadingTime(todayReadingTime)}</span>
              <span class="activity-label">Quran</span>
            </div>
          </div>

          <div class="activity-card">
            <div class="activity-icon tasbih">
              <svelte:component this={iconMap.Timer} size={18} weight="fill" color="#216974" />
            </div>
            <div class="activity-info">
              <span class="activity-value">{todayTasbihCount}</span>
              <span class="activity-label">Tasbih</span>
            </div>
          </div>

          <div class="activity-card">
            <div class="activity-icon journal">
              <svelte:component this={iconMap.Note} size={18} weight="fill" color="#216974" />
            </div>
            <div class="activity-info">
              <span class="activity-value">1</span>
              <span class="activity-label">Journal</span>
            </div>
          </div>
        </div>
      </div>

      <div class="upcoming-prayer">
        <div class="prayer-card">
          <h3 class="section-title">Next Prayer</h3>
          {#if upcomingPrayer}
            <div class="prayer-info">
              <div class="prayer-header">
                <div class="left-section">
                  <div class="prayer-icon">
                    <svelte:component 
                      this={iconMap.Mosque} 
                      size={18} 
                      weight="fill" 
                      color="#216974" 
                    />
                  </div>
                  <div class="name-time">
                    <span class="prayer-name">{upcomingPrayer.name}</span>
                    <span class="prayer-time">{upcomingPrayer.time}</span>
                  </div>
                </div>
                {#if upcomingCountdown}
                  <span class="countdown">{upcomingCountdown}</span>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="weekly-streak">
        <h3 class="section-title">Weekly Dhikr Streak</h3>
        <WeeklyStreak />
      </div>

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
    padding: 0;
    padding-bottom: 60px;
    background: #FFFFFF;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    box-sizing: border-box;
  }

  .content {
    width: 100%;
    box-sizing: border-box;
    padding: 0 10px;
    margin-top: 20px;
  }

  @media (min-width: 600px) {
    .content {
      max-width: 600px;
      margin: 20px auto 0;
      padding: 0 1rem;
    }
  }

  .quote-card {
    background: #216974;
    color: white;
    padding: 0.5rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
  }

  .greeting-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
    padding-bottom: 0.25rem;
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
    margin: 0;
    padding: 0.25rem 0;
  }

  .day-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    padding: 0.25rem;
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
    margin-bottom: 0.5rem;
  }

  .prayer-card {
    background: white;
    padding: 0.375rem 0.5rem;
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    border: 1px solid transparent;
    background-image: linear-gradient(white, white), 
                     linear-gradient(to bottom, 
                       rgba(0, 0, 0, 0.01) 0%,
                       rgba(0, 0, 0, 0.1) 100%);
    background-origin: border-box;
    background-clip: padding-box, border-box;
  }

  .prayer-card h2 {
    font-size: 0.875rem;
    color: #216974;
    margin-bottom: 0.375rem;
    font-weight: 500;
  }

  .prayer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .left-section {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .prayer-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(33, 105, 116, 0.1);
    border-radius: 6px;
    flex-shrink: 0;
  }

  .name-time {
    display: flex;
    flex-direction: column;
    gap: 0rem;
  }

  .prayer-name {
    font-weight: 500;
    color: #216974;
    font-size: 0.875rem;
    line-height: 1.2;
  }

  .prayer-time {
    font-size: 0.75rem;
    color: #666;
    line-height: 1.2;
  }

  .countdown {
    font-size: 0.875rem;
    font-weight: 500;
    color: #E09453;
  }

  .pending-notice {
    margin-top: 0.25rem;
    padding-top: 0.25rem;
    border-top: 1px solid #eee;
    font-size: 0.75rem;
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
    margin-top: 0.5rem;
  }

  .stats-card {
    background: white;
    padding: 0.5rem;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }

  .stats-card h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
  }

  .reading-time {
    font-size: 1.5rem;
    color: #E09453;
    font-weight: 500;
    margin: 0;
  }

  .section-title {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.375rem;
    font-weight: normal;
  }

  .activities-row {
    display: flex;
    gap: 0.375rem;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .activity-card {
    background: white;
    padding: 0.375rem;
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    border: 1px solid transparent;
    background-image: linear-gradient(white, white), 
                     linear-gradient(to bottom, 
                       rgba(0, 0, 0, 0.01) 0%,
                       rgba(0, 0, 0, 0.1) 100%);
    background-origin: border-box;
    background-clip: padding-box, border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
  }

  .activity-icon {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(33, 105, 116, 0.1);
    flex-shrink: 0;
  }

  .activity-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
  }

  .activity-value {
    font-size: 0.75rem;
    font-weight: 500;
    color: #216974;
  }

  .activity-label {
    font-size: 0.625rem;
    color: #666;
  }

  .prayer-card .section-title {
    margin-bottom: 0.5rem;
  }
</style>

