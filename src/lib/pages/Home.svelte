<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Profile from './Profile.svelte';
  import { iconMap } from '../utils/icons';
  import { prayerTimesStore, loadingStore, errorStore, fetchPrayerTimes, locationStore } from '../services/prayerTimes';
  import { auth } from '../firebase';
  import { getAuth } from 'firebase/auth';
  import Tasbih from './Tasbih.svelte';
  import WeeklyStreak from '../components/WeeklyStreak.svelte';
  import Prayer from './Prayer.svelte';
  import { 
    savePrayerStatus, 
    getPrayerHistory, 
    prayerHistoryStore, 
    convertPrayerTimeToDate, 
    updatePrayerStatuses,
    saveExcusedPeriod,
    endExcusedPeriod,
    getActiveExcusedPeriod 
  } from '../stores/prayerHistoryStore';
  import WeeklyPrayerHistory from '../components/WeeklyPrayerHistory.svelte';
  import { createEventDispatcher } from 'svelte';
  import Journal from './Journal.svelte';
  import { getTodayReadingTime, formatReadingTime } from '../services/readingTimeService';
  import { weeklyStatsStore, getWeeklyStats } from '../stores/tasbihStore';
  import { quoteStore, getRandomQuote, syncQuotes } from '../services/quoteService';
  import MoodSelector from '../components/MoodSelector.svelte';
  import { moodHistoryStore, saveMood, getMoodHistory, getMoodForDate, shouldShowMoodSelector } from '../stores/moodStore';
  import { get } from 'svelte/store';
  import MoodHistoryModal from '../components/MoodHistoryModal.svelte';
  import { Lock } from 'phosphor-svelte';
  import { LocalNotifications } from '@capacitor/local-notifications';
  import NotificationIcon from '../components/NotificationIcon.svelte';
  import { journalStore } from '../stores/journalStore';
  import { quranStore, fetchCompleteQuran } from '../services/quranService';
  import { notificationPermissionStore, checkNotificationPermission } from '../services/notificationService';
  import NotificationPermissionDialog from '../components/NotificationPermissionDialog.svelte';
  import { checkAdminStatus } from '../services/adminService';
  import { fetchMoodGuidance } from '../services/moodGuidanceService';
  const dispatch = createEventDispatcher();
  
  let currentPage = 'home';
  
  // Get greeting based on time of day
  const hour = new Date().getHours();
  let greeting = '';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 17) greeting = 'Good Afternoon';
  else greeting = 'Good Evening';

  let showPermissionDialog = false;

  let isAdmin = false;

  async function checkAndSetAdminStatus() {
    const firebaseAuth = getAuth();
    const user = firebaseAuth.currentUser;
    if (user) {
      const idTokenResult = await user.getIdTokenResult();
      isAdmin = idTokenResult.claims.admin === true;
    }
  }

  async function handleSync() {
    try {
      await Promise.all([
        fetchMoodGuidance(),
        syncQuotes()
      ]);
      console.log('Mood guidance and quotes sync completed');
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  }

  // Request notification permissions on mount
  onMount(async () => {
    try {
      // Start loading Quran data immediately
      fetchCompleteQuran().catch(error => {
        // console.error('Error prefetching Quran data:', error);
      });

      // Check notification permission
      const permStatus = await checkNotificationPermission();
      if (permStatus === 'prompt') {
        showPermissionDialog = true;
      }
    } catch (error) {
      console.error('Error in onMount:', error);
    }

    const container = document.querySelector('.home-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }

    const cleanup = auth.onAuthStateChanged((user) => {
      userName = capitalizeFirstLetter(user?.displayName?.split(' ')[0]) || 'Guest';
      if (user) {
        // Check admin status
        checkAndSetAdminStatus();
        checkAdminStatus();
        // console.log('User authenticated:', user.uid);
        Promise.all([
          fetchPrayerTimes(),
          getPrayerHistory(),
          loadWeekMoods(),
          updateExcusedStatus(),
          getWeeklyStats().then(stats => {
            if (stats?.dailyCounts) {
              const todayCount = stats.dailyCounts.find(day => day.isToday);
              todayTasbihCount = todayCount ? todayCount.count : 0;
            }
          })
        ]).then(() => {
          updatePrayerStatus();
        });
      }
    });

    Promise.all([
      getRandomQuote(),
      getWeeklyStats(),
      getTodayReadingTime().then(time => {
        todayReadingTime = time;
      }),
      checkExcusedStatus()
    ]);
    
    const prayerInterval = setInterval(() => updatePrayerStatus(), 60000);
    const countdownInterval = setInterval(updateCountdown, 1000);
    const notificationInterval = setInterval(checkPrayerNotifications, 60000);
    
    return () => {
      cleanup();
      clearInterval(prayerInterval);
      clearInterval(countdownInterval);
      clearInterval(notificationInterval);
      container?.removeEventListener('scroll', handleScroll);
    };
  });

  function navigateTo(page) {
    currentPage = page;
    dispatch('navigate', page);
  }

  function handleTabChange(event) {
    const previousPage = currentPage;
    currentPage = event.detail;
    if (currentPage === 'home') {
      // Always update stats when returning to home
      updateStats();
      // Refresh weekly stats
      weeklyStatsStore.set({ dailyCounts: [], streak: 0 }); // Reset store first
      getWeeklyStats().then((stats) => {
        if (stats?.dailyCounts) {
          const todayCount = stats.dailyCounts.find(day => day.isToday);
          todayTasbihCount = todayCount ? todayCount.count : 0;
        }
      });
      // Update prayer status if needed
      if (!upcomingPrayer || (!$prayerTimesStore || $prayerTimesStore.length === 0)) {
        updatePrayerStatus();
      }
    }
  }

  async function updateStats() {
    todayReadingTime = await getTodayReadingTime();
    const today = new Date().toISOString().split('T')[0];
    if ($prayerHistoryStore?.history) {
      const todayPrayers = $prayerHistoryStore.history.filter(p => 
        p.date === today && (p.status === 'ontime' || p.status === 'late' || p.status === 'excused')
      );
      completedPrayersToday = todayPrayers.length;
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
  let isLoadingPrayers = true;

  let upcomingCountdown = '';
  let countdownEnded = false;

  let todayReadingTime = 0;

  let completedPrayersToday = 0;
  let todayTasbihCount = 0;

  let showMoodSelector = false;
  let currentMorningMood = null;
  let currentEveningMood = null;
  let weekMoods = {};
  let currentMoodPeriod = 'morning';

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
        p.date === today && (p.status === 'ontime' || p.status === 'late' || p.status === 'excused')
      );
      completedPrayersToday = todayPrayers.length;
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
    console.log('Starting updatePrayerStatus...');
    console.log('Current prayer times store:', $prayerTimesStore);
    console.log('Current prayer history store:', $prayerHistoryStore);
    
    isLoadingPrayers = true;
    try {
      // Check if we have data in the store
      if (!$prayerTimesStore || $prayerTimesStore.length === 0) {
        console.log('No prayer times in store, fetching...');
        // Only fetch if we don't have any data
        await fetchPrayerTimes();
      } else {
        // Check if we need to fetch new prayer times (after midnight)
        const now = new Date();
        const lastFetchDate = $prayerTimesStore[0]?.fetchDate;
        console.log('Last fetch date:', lastFetchDate);
        if (lastFetchDate && new Date(lastFetchDate).getDate() !== now.getDate()) {
          console.log('New day detected, fetching new prayer times...');
          await fetchPrayerTimes();
        } else {
          console.log('Using cached prayer times');
        }
      }

      // Only update prayer statuses if we have no history data
      if (!$prayerHistoryStore?.history) {
        console.log('No prayer history in store, fetching...');
        await getPrayerHistory();
      } else {
        console.log('Using cached prayer history');
      }

      // Skip updatePrayerStatuses if we already have data
      if (!$prayerHistoryStore?.pendingByDate) {
        console.log('Updating prayer statuses...');
        await updatePrayerStatuses();
      } else {
        console.log('Using cached prayer statuses');
      }
      
      // Use the same counting logic as NotificationIcon
      pendingPrayers = Object.values($prayerHistoryStore.pendingByDate)
        .reduce((prayers, { prayers: datePrayers }) => [...prayers, ...datePrayers], []);
      
      upcomingPrayer = null;
      
      // Check if all prayers for today have passed
      let allPrayersPassed = true;
      if ($prayerTimesStore && $prayerTimesStore.length > 0) {
        const now = new Date();
        for (const prayer of $prayerTimesStore) {
          if (!prayer?.time) continue;
          const prayerTime = convertPrayerTimeToDate(prayer.time);
          if (prayerTime > now) {
            allPrayersPassed = false;
            if (!upcomingPrayer) {
              upcomingPrayer = prayer;
              console.log('Found upcoming prayer:', prayer);
              break;
            }
          }
        }
      }

      // If all prayers have passed, set upcomingPrayer to null to show appropriate message
      if (allPrayersPassed) {
        console.log('All prayers have passed for today');
        upcomingPrayer = null;
      }
    } catch (error) {
      console.error('Error updating prayer status:', error);
    } finally {
      isLoadingPrayers = false;
      console.log('Finished updatePrayerStatus');
    }
  }

  async function markPrayerStatus(prayer, status) {
    if (!prayer?.name && !prayer?.prayerName) {
      console.error('Invalid prayer data:', prayer);
      return;
    }

    const today = new Date().toLocaleDateString('en-CA');
    await savePrayerStatus({
      name: prayer.prayerName || prayer.name,
      time: prayer.time,
      date: prayer.date || today,
      status
    });
    
    await getPrayerHistory();
    await updatePrayerStatus();
  }

  async function checkPrayerNotifications() {
    try {
      // First check if notifications are supported
      if (!LocalNotifications) {
        // console.error('LocalNotifications plugin not available');
        return;
      }

      // Check current permission status
      const permStatus = await LocalNotifications.checkPermissions();
      // console.log('Current notification permission status:', permStatus);

      // Request permissions if not granted
      if (permStatus.display !== 'granted') {
        // console.log('Requesting notification permissions...');
        const result = await LocalNotifications.requestPermissions();
        // console.log('Permission request result:', result);
        
        if (result.display !== 'granted') {
          // console.log('Notification permission denied');
          return;
        }
      }

      // First update prayer statuses to ensure they're current
      await updatePrayerStatuses();
      await getPrayerHistory();

      // Get current time
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA');

      // Schedule notifications for pending prayers
      const pendingPrayers = Object.values($prayerHistoryStore.pendingByDate)
        .reduce((prayers, { prayers: datePrayers }) => [...prayers, ...datePrayers], []);

      // console.log('Pending prayers to notify:', pendingPrayers);

      let notificationId = 1;
      for (const prayer of pendingPrayers) {
        if (!prayer.notified) {
          // console.log('Scheduling notification for prayer:', prayer.prayerName);
          
          try {
            await LocalNotifications.schedule({
              notifications: [{
                title: 'Prayer Reminder',
                body: `Time for ${prayer.prayerName} prayer has passed. Don't forget to mark it.`,
                id: notificationId++,
                schedule: { at: new Date() },
                sound: null,
                attachments: null,
                actionTypeId: '',
                extra: null
              }]
            });

            // Mark as notified in the store
            prayer.notified = true;
            // console.log('Notification scheduled successfully for:', prayer.prayerName);
          } catch (error) {
            // console.error('Error scheduling notification for prayer:', prayer.prayerName, error);
          }
        }
      }

      // Update UI
      await updatePrayerStatus();
    } catch (error) {
      // console.error('Error in checkPrayerNotifications:', error);
    }
  }

  async function handleMoodSelect(event) {
    const selectedMood = event.detail;
    try {
      await saveMood(selectedMood, selectedMood.guidance, currentMoodPeriod);
      
      // Use the local mood template to ensure we have the icon
      const matchingMood = moods.find(m => m.value === selectedMood.value);
      if (matchingMood) {
        const moodData = {
          value: selectedMood.value,
          name: matchingMood.name,
          icon: matchingMood.icon,
          description: matchingMood.description,
          guidance: selectedMood.guidance
        };

        if (currentMoodPeriod === 'morning') {
          currentMorningMood = moodData;
        } else {
          currentEveningMood = moodData;
        }
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
      weekMoods = moodsFromDb.reduce((acc, mood) => {
        if (!acc[mood.date]) {
          acc[mood.date] = {};
        }
        acc[mood.date][mood.period] = mood;
        return acc;
      }, {});

      // Check if we have moods for today
      const today = new Date().toLocaleDateString();
      const todayMoods = weekMoods[today] || {};
      
      // Get prayer times to determine which mood selector to show
      const prayerTimes = get(prayerTimesStore);
      const { showMorningMood, showEveningMood } = shouldShowMoodSelector(prayerTimes);

      if (todayMoods.morning) {
        const matchingMood = moods.find(m => m.value === todayMoods.morning.mood);
        if (matchingMood) {
          currentMorningMood = {
            value: todayMoods.morning.mood,
            name: matchingMood.name,
            icon: matchingMood.icon,
            description: matchingMood.description
          };
        }
      }

      if (todayMoods.evening) {
        const matchingMood = moods.find(m => m.value === todayMoods.evening.mood);
        if (matchingMood) {
          currentEveningMood = {
            value: todayMoods.evening.mood,
            name: matchingMood.name,
            icon: matchingMood.icon,
            description: matchingMood.description
          };
        }
      }

      // Show mood selector if we're in the right time window and haven't recorded mood yet
      if (showMorningMood && !currentMorningMood) {
        showMoodSelector = true;
        currentMoodPeriod = 'morning';
      } else if (showEveningMood && !currentEveningMood) {
        showMoodSelector = true;
        currentMoodPeriod = 'evening';
      } else {
        showMoodSelector = false;
      }
    } catch (error) {
      console.error('Error loading moods:', error);
    }
  }

  let isExcusedPeriodActive = false;
  let activeExcusedPeriod = null;

  async function toggleExcusedPeriod() {
    const today = new Date().toLocaleDateString('en-CA');
    if (!isExcusedPeriodActive) {
      // Start a new excused period
      await saveExcusedPeriod(today, null, 'Fajr', null);
    } else if (activeExcusedPeriod?.id) {
      // End the current excused period
      await endExcusedPeriod(activeExcusedPeriod.id, today, 'Isha');
    }
    await updateExcusedStatus();
  }

  async function updateExcusedStatus() {
    activeExcusedPeriod = await getActiveExcusedPeriod();
    isExcusedPeriodActive = !!activeExcusedPeriod;
  }

  async function checkExcusedStatus() {
    const activeExcusedPeriod = await getActiveExcusedPeriod();
    isExcusedPeriodActive = !!activeExcusedPeriod;
  }

  let scrollY = 0;
  let isScrolled = false;
  const SCROLL_THRESHOLD = 50;
  const SCROLL_BUFFER = 10;

  function handleScroll(event) {
    const container = event.target;
    const newScrollY = container.scrollTop;
    
    // Add buffer zone to prevent oscillation
    if (!isScrolled && newScrollY > SCROLL_THRESHOLD + SCROLL_BUFFER) {
      isScrolled = true;
    } else if (isScrolled && newScrollY < SCROLL_THRESHOLD - SCROLL_BUFFER) {
      isScrolled = false;
    }
    
    scrollY = newScrollY;
  }

  // Add console log to debug
  // $: console.log('Prayer History Store:', $prayerHistoryStore);

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

  function calculateCountdown(prayerTime) {
    if (!prayerTime) return '';
    
    const [time, period] = prayerTime.split(' ');
    const [hours, minutes] = time.split(':');
    const prayerDate = new Date();
    
    let hour = parseInt(hours);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    prayerDate.setHours(hour, parseInt(minutes), 0);
    
    const now = new Date();
    const diff = Number(prayerDate.getTime()) - Number(now.getTime());
    
    if (diff <= 0) return '';
    
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  }

  // Function to get the next prayer
  function getNextPrayer() {
    if (!$prayerTimesStore || $prayerTimesStore.length === 0) return null;
    
    const now = new Date();
    const currentTime = Number(now.getHours()) * 60 + Number(now.getMinutes());
    
    for (const prayer of $prayerTimesStore) {
      const [time, period] = prayer.time.split(' ');
      const [hours, minutes] = time.split(':');
      let prayerHours = Number(parseInt(hours));
      
      // Convert to 24-hour format
      if (period === 'PM' && prayerHours !== 12) {
        prayerHours += 12;
      } else if (period === 'AM' && prayerHours === 12) {
        prayerHours = 0;
      }
      
      const prayerTime = prayerHours * 60 + Number(parseInt(minutes));
      
      if (prayerTime > currentTime) {
        return prayer;
      }
    }
    
    // If no prayer is found for today, return the first prayer of tomorrow
    return $prayerTimesStore[0];
  }

  // Function to test notification
  async function testNotification() {
    const nextPrayer = getNextPrayer();
    if (!nextPrayer) return;
    
    try {
      // Schedule the notification for 1 second in the future
      const scheduleTime = new Date(Date.now() + 1000);
      
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Prayer Time',
            body: `It's time for ${nextPrayer.name} prayer`,
            id: Math.floor(Math.random() * 100000),
            schedule: { at: scheduleTime },
            smallIcon: 'ic_launcher_foreground',
            actionTypeId: '',
            extra: null
          }
        ]
      });
    } catch (error) {
      console.error('Error scheduling test notification:', error);
    }
  }

  function handlePermissionResult(event) {
    showPermissionDialog = false;
  }
</script>

<div class="home-container">
  <NotificationIcon on:click={() => navigateTo('notifications')} />
  <div class="content">
    {#if currentPage === 'home'}
      <div class="home-content">
        <div class="quote-card" class:scrolled={isScrolled}>
          <div class="greeting-section">
            <div class="greeting-content">
              <div class="greeting-text">
                <h1>{greeting}, {userName}!</h1>
                {#if currentMorningMood || currentEveningMood}
                  <div class="mood-icons">
                    {#if currentMorningMood}
                      <div class="mood-icon small" title="Morning mood">
                        {@html currentMorningMood.icon}
                      </div>
                    {/if}
                    {#if currentEveningMood}
                      <div class="mood-icon small" title="Evening mood">
                        {@html currentEveningMood.icon}
                      </div>
                    {/if}
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
            {#if isAdmin}
              <div class="button-container">
                <button class="test-notification" on:click={testNotification}>
                  Test Notification
                </button>
                <button class="sync-button" on:click={handleSync}>
                  Sync Mood Guidance
                </button>
              </div>
            {/if}
          </div>
        </div>

        <div class="animated-section" class:scrolled={isScrolled}>
          {#if showMoodSelector}
            <div class="mood-selector-wrapper" transition:fade={{ duration: 300 }}>
              <MoodSelector on:select={handleMoodSelect} />
            </div>
          {/if}

          <div class="calendar-strip">
            {#each weekDays as { day, date, fullDate, isToday }}
              <div class="day-item {isToday ? 'active' : ''}">
                <span class="day">{day}</span>
                <span class="date-num">{date}</span>
                {#if $journalStore.dailyProgress.find(d => d.date === fullDate && d.morning && d.evening)}
                  <div class="completion-mark">✓</div>
                {/if}
                {#if weekMoods[fullDate]}
                  <div class="mood-buttons">
                    {#if weekMoods[fullDate].morning}
                      {@const morningMood = moods.find(m => m.value === weekMoods[fullDate].morning.mood)}
                      {#if morningMood}
                        <button 
                          class="mood-icon-button morning" 
                          on:click={() => handleMoodHistoryClick(weekMoods[fullDate].morning)}
                          title={`Morning: ${morningMood.name}`}
                        >
                          {@html morningMood.icon}
                        </button>
                      {/if}
                    {/if}
                    {#if weekMoods[fullDate].evening}
                      {@const eveningMood = moods.find(m => m.value === weekMoods[fullDate].evening.mood)}
                      {#if eveningMood}
                        <button 
                          class="mood-icon-button evening" 
                          on:click={() => handleMoodHistoryClick(weekMoods[fullDate].evening)}
                          title={`Evening: ${eveningMood.name}`}
                        >
                          {@html eveningMood.icon}
                        </button>
                      {/if}
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <MoodHistoryModal 
          moodData={selectedHistoryMood}
          moods={moods}
          onClose={handleHistoryModalClose}
        />

        <div class="reading-stats">
          <h3 class="section-title">Today's Activities</h3>
          <div class="activities-row">
            <div class="activity-card" on:click={() => navigateTo('prayer')}>
              <div class="activity-icon prayer">
                {#if isExcusedPeriodActive}
                  <Lock size={18} weight="fill" color="#9CA3AF" />
                {:else}
                  <svelte:component this={iconMap.Mosque} size={18} weight="fill" color="#216974" />
                {/if}
              </div>
              <div class="activity-info">
                <span class="activity-value {isExcusedPeriodActive ? 'excused' : ''}">{isExcusedPeriodActive ? 'Excused' : `${completedPrayersToday}/5`}</span>
                <span class="activity-label">Prayer</span>
              </div>
            </div>

            <div class="activity-card" on:click={() => navigateTo('quran')}>
              <div class="activity-icon quran">
                <svelte:component this={iconMap.Book} size={18} weight="fill" color="#216974" />
              </div>
              <div class="activity-info">
                <span class="activity-value">{formatReadingTime(todayReadingTime)}</span>
                <span class="activity-label">Quran</span>
              </div>
            </div>

            <div class="activity-card" on:click={() => navigateTo('tasbih')}>
              <div class="activity-icon tasbih">
                <svelte:component this={iconMap.Timer} size={18} weight="fill" color="#216974" />
              </div>
              <div class="activity-info">
                <span class="activity-value">{todayTasbihCount}</span>
                <span class="activity-label">Tasbih</span>
              </div>
            </div>

            <div class="activity-card" on:click={() => navigateTo('journal')}>
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

        <div class="next-prayer-card">
          <h3 class="section-title">Next Prayer</h3>
          <div class="next-prayer-content">
            {#if isLoadingPrayers}
              <div class="loading-message">
                <p>Loading prayer times...</p>
              </div>
            {:else if isExcusedPeriodActive}
              <div class="excused-message">
                <p>You are currently excused from prayers.</p>
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isExcusedPeriodActive}
                    on:change={toggleExcusedPeriod}
                  />
                  <span class="slider"></span>
                </label>
              </div>
            {:else if upcomingPrayer}
              <div class="prayer-info">
                <div class="prayer-name">
                  <svelte:component this={iconMap[upcomingPrayer.icon]} size={20} weight={upcomingPrayer.weight} />
                  <h4>{upcomingPrayer.name}</h4>
                  <span class="prayer-time">{upcomingPrayer.time}</span>
                </div>
                <div class="prayer-right">
                  <div class="countdown">{upcomingCountdown}</div>
                  {#if isExcusedPeriodActive}
                    <label class="toggle-switch">
                      <input
                        type="checkbox"
                        checked={isExcusedPeriodActive}
                        on:change={toggleExcusedPeriod}
                      />
                      <span class="slider"></span>
                    </label>
                  {/if}
                </div>
              </div>
              <button 
                class="test-notification-btn"
                on:click={testNotification}
              >
                Test Notification
              </button>
            {:else}
              <div class="no-prayer-message">
                <p>All prayers for today have passed. The next prayer times will be shown after midnight.</p>
              </div>
            {/if}
          </div>
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
</div>

{#if showPermissionDialog}
  <NotificationPermissionDialog on:permissionResult={handlePermissionResult} />
{/if}

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
    padding: 10px 10px 0;
    margin-bottom: 4rem;
  }

  .home-content {
    max-width: 600px;
    margin: 0 auto;
  }

  .quote-card {
    background: #216974;
    color: white;
    padding: 1rem;
    margin: 0 0 10px 0;
    border-radius: 12px;
    position: sticky;
    top: 10px;
    z-index: 100;
    transform-origin: top center;
    transition: all 0.3s ease;
    will-change: transform, height;
  }

  .quote-card.scrolled {
    padding: 0.75rem 1rem;
    border-radius: 12px;
    margin: 0;
  }

  .greeting-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    max-height: 200px;
    opacity: 1;
    margin-bottom: 0.75rem;
    transition: max-height 0.3s ease, opacity 0.3s ease;
    overflow: hidden;
  }

  .quote-card.scrolled .greeting-content {
    max-height: 0;
    opacity: 0;
    margin: 0;
    pointer-events: none;
  }

  .calendar-strip {
    display: flex;
    justify-content: space-between;
    margin: 0;
    padding: 0.25rem 0;
    transition: opacity 0.3s ease, transform 0.3s ease;
    transform-origin: top center;
  }

  .quote-card.scrolled + .calendar-strip {
    display: none;
  }

  .quote-section {
    text-align: center;
    transition: margin 0.3s ease;
    margin-top: 0.75rem;
  }

  .quote-card.scrolled .quote-section {
    margin: 0;
  }

  .greeting-section {
    display: flex;
    flex-direction: column;
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
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .activity-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .activity-card:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

  .next-prayer-card {
    margin-bottom: 1rem;
  }

  .next-prayer-content {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .excused-message {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    color: #666;
  }

  .prayer-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
  }

  .prayer-name {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #216974;
  }

  .prayer-name h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
  }

  .prayer-time {
    color: #216974;
    font-weight: 500;
  }

  .prayer-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .countdown {
    color: #E09453;
    font-weight: 500;
  }

  .section-title {
    font-size: 1rem;
    color: #216974;
    margin-bottom: 0.75rem;
    font-weight: 500;
  }

  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 24px;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: .4s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: #216974;
  }

  input:checked + .slider:before {
    transform: translateX(24px);
  }

  .activity-value.excused {
    color: #9CA3AF;
    font-style: italic;
  }

  .activity-icon.prayer {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(33, 105, 116, 0.1);
  }

  .no-prayer-message {
    text-align: center;
    padding: 1rem;
    color: #666;
    font-size: 0.875rem;
  }

  .loading-message {
    text-align: center;
    padding: 1rem;
    color: #666;
    font-size: 0.875rem;
  }

  .test-notification-btn {
    background-color: #4CAF50;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    margin-top: 12px;
    width: 100%;
    transition: background-color 0.2s ease;
  }
  
  .test-notification-btn:hover {
    background-color: #45a049;
  }
  
  .test-notification-btn:active {
    background-color: #3d8b40;
  }
  
  .next-prayer-card {
    background: white;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 16px;
  }
  
  .prayer-info {
    margin-bottom: 8px;
  }
  
  .prayer-info h3 {
    margin: 0;
    color: #333;
    font-size: 18px;
  }
  
  .prayer-info p {
    margin: 4px 0 0;
    color: #666;
    font-size: 16px;
  }

  .animated-section {
    transition: opacity 0.3s ease, transform 0.3s ease;
    transform-origin: top center;
  }

  .animated-section.scrolled {
    opacity: 0;
    transform: translateY(-100%);
    pointer-events: none;
  }

  .mood-selector-wrapper {
    margin: 10px 0;
  }

  .calendar-strip {
    display: flex;
    justify-content: space-between;
    margin: 0;
    padding: 0.25rem 0;
  }

  /* Remove the old calendar-strip transition styles */
  .quote-card.scrolled + .calendar-strip {
    display: none;
  }

  .mood-icons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .mood-icon.small {
    width: 1.25rem;
    height: 1.25rem;
    color: white;
  }

  .mood-icon-button.morning {
    color: #216974;
  }

  .mood-icon-button.evening {
    color: #E09453;
  }

  .day-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .mood-buttons {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .mood-icon-button {
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  }

  .mood-icon-button:hover {
    transform: scale(1.1);
  }

  .mood-icon-button.morning {
    color: #216974;
  }

  .mood-icon-button.evening {
    color: #E09453;
  }

  .sync-button, .test-notification {
    background: #216974;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    margin-bottom: 10px;
    width: 100%;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .sync-button:hover, .test-notification:hover {
    background: #184f57;
  }

  .button-container {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }
</style>

