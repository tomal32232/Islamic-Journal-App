<script>
  import { onMount } from 'svelte';
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
  import MoodSelector from '../components/MoodSelector.svelte';
  import { moodHistoryStore, saveMood, getMoodHistory, getMoodForDate } from '../stores/moodStore';
  import { get } from 'svelte/store';
  import MoodHistoryModal from '../components/MoodHistoryModal.svelte';
  const dispatch = createEventDispatcher();
  
  let currentPage = 'home';
  
  // Get greeting based on time of day
  const hour = new Date().getHours();
  let greeting = '';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 17) greeting = 'Good Afternoon';
  else greeting = 'Good Evening';

  function navigateTo(page) {
    dispatch('navigate', page);
  }

  function handleTabChange(event) {
    currentPage = event.detail;
    if (currentPage === 'home') {
      updateStats();
    }
  }

  async function updateStats() {
    todayReadingTime = await getTodayReadingTime();
    const today = new Date().toISOString().split('T')[0];
    if ($prayerHistoryStore?.history) {
      const todayPrayers = $prayerHistoryStore.history.filter(p => 
        p.date === today && (p.status === 'ontime' || p.status === 'late')
      );
      completedPrayersToday = todayPrayers.length;
    }

    if ($weeklyStatsStore?.dailyCounts) {
      const todayCount = $weeklyStatsStore.dailyCounts.find(day => day.isToday);
      todayTasbihCount = todayCount ? todayCount.count : 0;
    }
  }

  function markAsDone(index) {
    $prayerTimesStore = $prayerTimesStore.map((prayer, i) => 
      i === index ? { ...prayer, done: !prayer.done } : prayer
    );
  }

  // Get current week days
  function getCurrentWeek() {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.getDate(),
        fullDate: date.toLocaleDateString(),
        isToday: i === 0
      };
    }).reverse();
  }

  $: weekDays = getCurrentWeek();

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

  let showMoodSelector = false;
  let currentMood = null;
  let weekMoods = {};

  let selectedHistoryMood = null;

  function handleMoodHistoryClick(moodData) {
    selectedHistoryMood = moodData;
  }

  function handleHistoryModalClose() {
    selectedHistoryMood = null;
  }

  const moods = [
    { 
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"/>
        <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"/>
        <path d="M15 9H15.01"/>
        <path d="M9 9H9.01"/>
      </svg>`,
      name: 'Grateful',
      description: 'Alhamdulillah',
      value: 'grateful'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/>
        <path d="M8 12H16"/>
        <path d="M12 8V16"/>
      </svg>`,
      name: 'Seeking Peace',
      description: 'Sabr',
      value: 'seeking_peace'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"/>
        <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"/>
        <path d="M15 9H15.01"/>
        <path d="M9 9H9.01"/>
      </svg>`,
      name: 'Hopeful',
      description: 'InshaAllah',
      value: 'hopeful'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"/>
        <path d="M8 16C8 16 9.5 14 12 14C14.5 14 16 16 16 16"/>
        <path d="M12 7V11"/>
        <path d="M12 12L12 12.01"/>
      </svg>`,
      name: 'Anxious',
      description: 'Ya Allah',
      value: 'anxious'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"/>
        <path d="M12 7V11"/>
        <path d="M12 12L12 12.01"/>
        <path d="M8 15H16"/>
      </svg>`,
      name: 'Reflecting',
      description: 'SubhanAllah',
      value: 'reflecting'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"/>
        <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"/>
        <path d="M15 9H15.01"/>
        <path d="M9 9H9.01"/>
      </svg>`,
      name: 'Blessed',
      description: 'MashaAllah',
      value: 'blessed'
    }
  ];

  $: {
    const today = new Date().toISOString().split('T')[0];
    if ($prayerHistoryStore?.history) {
      const todayPrayers = $prayerHistoryStore.history.filter(p => 
        p.date === today && (p.status === 'ontime' || p.status === 'late')
      );
      completedPrayersToday = todayPrayers.length;
    }

    if ($weeklyStatsStore?.dailyCounts) {
      const todayCount = $weeklyStatsStore.dailyCounts.find(day => day.isToday);
      todayTasbihCount = todayCount ? todayCount.count : 0;
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

  async function handleMoodSelect(event) {
    const selectedMood = event.detail;
    console.log('Selected mood:', selectedMood);
    try {
      await saveMood(selectedMood, selectedMood.guidance);
      // Use the local mood template to ensure we have the icon
      const matchingMood = moods.find(m => m.value === selectedMood.value);
      if (matchingMood) {
        currentMood = {
          value: selectedMood.value,
          name: matchingMood.name,
          icon: matchingMood.icon,
          description: matchingMood.description,
          guidance: selectedMood.guidance
        };
      }
      showMoodSelector = false;
      await loadWeekMoods();
    } catch (error) {
      console.error('Error saving mood:', error);
    }
  }

  async function loadWeekMoods() {
    try {
      await getMoodHistory(7);
      const moodsFromDb = get(moodHistoryStore);
      console.log('Loaded moods from database:', moodsFromDb);
      weekMoods = moodsFromDb.reduce((acc, mood) => {
        acc[mood.date] = mood;
        return acc;
      }, {});

      // Check if we have a mood for today
      const today = new Date().toLocaleDateString();
      const todayMood = weekMoods[today];
      console.log('Today\'s mood from database:', todayMood);
      
      if (todayMood) {
        // Find the matching mood from our local moods array to get the icon
        const matchingMood = moods.find(m => m.value === todayMood.mood);
        console.log('Local mood template:', matchingMood);
        if (matchingMood) {
          currentMood = {
            value: todayMood.mood,
            name: matchingMood.name,
            icon: matchingMood.icon,
            description: matchingMood.description
          };
          console.log('Set current mood to:', currentMood);
          showMoodSelector = false;
        }
      } else {
        // If no mood for today, show the selector
        showMoodSelector = true;
        currentMood = null;
      }
    } catch (error) {
      console.error('Error loading moods:', error);
    }
  }

  onMount(async () => {
    auth.onAuthStateChanged(async (user) => {
      userName = capitalizeFirstLetter(user?.displayName?.split(' ')[0]) || 'Guest';
      if (user) {
        console.log('User authenticated:', user.uid);
        await fetchPrayerTimes();
        await getPrayerHistory();
        await loadWeekMoods(); // This will handle mood selector visibility
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
      <div class="home-content">
        <div class="quote-card">
          <div class="greeting-section">
            <div class="greeting-content">
              <div class="greeting-text">
                <h1>Good Morning, {userName}!</h1>
                {#if currentMood}
                  <div class="mood-icon small">
                    {@html currentMood.icon}
                  </div>
                {/if}
              </div>
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
        </div>

        {#if showMoodSelector}
          <MoodSelector on:select={handleMoodSelect} />
        {/if}

        <div class="calendar-strip">
          {#each weekDays as { day, date, fullDate, isToday }}
            <div class="day-item {isToday ? 'active' : ''}">
              <span class="day">{day}</span>
              <span class="date-num">{date}</span>
              {#if weekMoods[fullDate]}
                {@const matchingMood = moods.find(m => m.value === weekMoods[fullDate].mood)}
                {#if matchingMood}
                  <button 
                    class="mood-icon-button" 
                    on:click={() => handleMoodHistoryClick(weekMoods[fullDate])}
                    title={matchingMood.name}
                  >
                    {@html matchingMood.icon}
                  </button>
                {/if}
              {/if}
            </div>
          {/each}
        </div>

        <MoodHistoryModal 
          moodData={selectedHistoryMood}
          moods={moods}
          onClose={handleHistoryModalClose}
        />

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

        <h3 class="section-title">Next Prayer</h3>
        <div class="upcoming-prayer">
          {#if upcomingPrayer}
            <div class="prayer-info-card">
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
          {:else}
            <div class="prayer-info-card">
              <div class="no-prayer-message">
                <p>All prayers for today are complete. 🌙</p>
                <p class="subtitle">Have a blessed rest of your day!</p>
              </div>
            </div>
          {/if}
        </div>

        <div class="weekly-streak">
          <h3 class="section-title">Weekly Dhikr Streak</h3>
          <WeeklyStreak />
        </div>

        <div class="weekly-prayer-history">
          <h3 class="section-title">Weekly Prayer History</h3>
          <WeeklyPrayerHistory />
        </div>
      </div>
    {:else if currentPage === 'prayer'}
      <Prayer />
    {:else if currentPage === 'tasbih'}
      <Tasbih />
    {:else if currentPage === 'journal'}
      <Journal />
    {:else if currentPage === 'profile'}
      <Profile {navigateTo} />
    {/if}
  </div>
</main>

<style>
  .home-container {
    padding: 0;
    padding-bottom: 60px;
    background: #F8FAFC;
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

  .home-content {
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
    flex-direction: column;
    gap: 0.75rem;
  }

  .greeting-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
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
    margin-bottom: 1rem;
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
    text-align: center;
    width: 100%;
    display: block;
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

  .greeting-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .current-mood {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #4A5568;
    margin-top: 0.25rem;
  }

  .mood-icon.small {
    width: 1.25rem;
    height: 1.25rem;
    color: #4A5568;
  }

  .mood-description {
    color: #718096;
    font-size: 0.75rem;
  }

  h1 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 500;
  }

  .mood-indicator {
    margin-top: 0.25rem;
    display: flex;
    justify-content: center;
  }

  .mood-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .mood-dot.grateful {
    background-color: #4CAF50;
  }

  .mood-dot.seeking_peace {
    background-color: #2196F3;
  }

  .mood-dot.hopeful {
    background-color: #9C27B0;
  }

  .mood-dot.anxious {
    background-color: #FFC107;
  }

  .mood-dot.reflecting {
    background-color: #607D8B;
  }

  .mood-dot.blessed {
    background-color: #E91E63;
  }

  .greeting-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .mood-icon.small {
    width: 1.5rem;
    height: 1.5rem;
    color: #4A5568;
    cursor: help;
  }

  h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: #2D3748;
  }

  .greeting-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .greeting-text h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: white;
  }

  .mood-icon.small {
    width: 1.25rem;
    height: 1.25rem;
    color: white;
  }

  .no-prayer-message {
    text-align: center;
    padding: 1.5rem 1rem;
    color: #216974;
  }

  .no-prayer-message p {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .no-prayer-message .subtitle {
    margin-top: 0.5rem;
    color: #666;
    font-weight: normal;
  }

  .prayer-info-card {
    background: white;
    padding: 0.75rem;
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

  .upcoming-prayer {
    margin-bottom: 1rem;
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
    transition: transform 0.2s;
  }

  .mood-icon-button:hover {
    transform: scale(1.1);
    color: #184f57;
  }

  .mood-icon-button :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>

