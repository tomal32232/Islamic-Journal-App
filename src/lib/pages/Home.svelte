<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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
    getActiveExcusedPeriod,
    cache as prayerHistoryCache,
    updatePastPrayerStatuses
  } from '../stores/prayerHistoryStore';
  import WeeklyPrayerHistory from '../components/WeeklyPrayerHistory.svelte';
  import { createEventDispatcher } from 'svelte';
  import Journal from './Journal.svelte';
  import { getTodayReadingTime, formatReadingTime } from '../services/readingTimeService';
  import { weeklyStatsStore, getWeeklyStats, initializeTasbihStore, ensureAccurateDailyCount } from '../stores/tasbihStore';
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
  import { fetchMoodGuidance, addSeekingPeaceGuidance } from '../services/moodGuidanceService';
  import QuranReading from '../components/QuranReading.svelte';
  import LocationPermissionDialog from '../components/LocationPermissionDialog.svelte';
  import MoodPopup from '../components/MoodPopup.svelte';
  import MoodCalendarPopup from '../components/MoodCalendarPopup.svelte';
  const dispatch = createEventDispatcher();
  
  let currentPage = 'home';
  
  // Get greeting
  let greeting = 'Asalaamu Alaikum';

  let showPermissionDialog = false;
  let showLocationDialog = false;

  let isAdmin = false;

  type MoodPeriod = 'morning' | 'evening';
  type PrayerTime = {
    name: string;
    timestamp: string;
  };

  type WeekMoods = {
    [date: string]: {
      morning?: any;
      evening?: any;
    };
  };

  type MoodSelectorResult = {
    showMorningMood: boolean;
    showEveningMood: boolean;
  };

  type PrayerTimesStore = Array<PrayerTime>;

  let showMoodPopup = false;
  let currentMoodPeriod: MoodPeriod = 'morning';
  let lastMoodCheck: Date | null = null;
  let weekMoods: WeekMoods = {};

  // Add a flag to track if an update is already in progress
  let isUpdatingPrayerStatus = false;
  // Add a timestamp to track the last update time
  let lastPrayerStatusUpdate: number = 0;
  // Minimum time between updates (5 seconds)
  const MIN_UPDATE_INTERVAL: number = 5000;

  let showMoodCalendarPopup = false;

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

      // Check location permission
      if ($locationStore === 'Location unavailable') {
        showLocationDialog = true;
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
          // Also update past prayer statuses to ensure they're properly marked as missed
          updatePastPrayerStatuses();
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
    
    // Increase the interval to 5 minutes to reduce frequency of calls
    const prayerInterval = setInterval(() => updatePrayerStatus(), 300000);
    // Add an interval to update past prayer statuses every hour
    const pastPrayerInterval = setInterval(() => updatePastPrayerStatuses(), 3600000);
    const countdownInterval = setInterval(updateCountdown, 1000);
    const notificationInterval = setInterval(checkPrayerNotifications, 60000);
    
    // Initial check and setup interval
    checkMoodPopup();
    const moodCheckInterval = setInterval(checkMoodPopup, 60000);

    // Initialize the tasbih store to ensure accurate daily count
    if (auth.currentUser) {
      try {
        await initializeTasbihStore();
        // After initialization, ensure we have the most accurate count
        await ensureAccurateDailyCount();
        // Update the UI with the latest count from the store
        const latestStats = await getWeeklyStats();
        if (latestStats?.dailyCounts) {
          const todayCount = latestStats.dailyCounts.find(day => day.isToday);
          todayTasbihCount = todayCount ? todayCount.count : 0;
          console.log('Home: Updated today\'s tasbih count to', todayTasbihCount);
        }
      } catch (error) {
        console.error('Error initializing tasbih store:', error);
      }
    }

    return () => {
      cleanup();
      clearInterval(prayerInterval);
      clearInterval(pastPrayerInterval);
      clearInterval(countdownInterval);
      clearInterval(notificationInterval);
      clearInterval(moodCheckInterval);
      container?.removeEventListener('scroll', handleScroll);
    };
  });

  function navigateTo(page) {
    currentPage = page;
    dispatch('navigate', page);
  }

  // Function to refresh the dhikr count
  async function refreshDhikrCount() {
    if (!auth.currentUser) return;
    
    try {
      // Ensure we have the most accurate count
      await ensureAccurateDailyCount();
      
      // Update the UI with the latest count from the store
      const latestStats = await getWeeklyStats();
      if (latestStats?.dailyCounts) {
        const todayCount = latestStats.dailyCounts.find(day => day.isToday);
        todayTasbihCount = todayCount ? todayCount.count : 0;
        console.log('Home: Refreshed today\'s tasbih count to', todayTasbihCount);
      }
    } catch (error) {
      console.error('Error refreshing dhikr count:', error);
    }
  }

  // Add a function to force refresh prayer history
  async function refreshPrayerHistory() {
    if (!auth.currentUser) return;
    
    try {
      console.log('Home: Force refreshing prayer history');
      // Invalidate the prayer history cache
      prayerHistoryCache.prayerHistory = null;
      prayerHistoryCache.lastFetched = null;
      
      // Fetch fresh prayer history data
      await getPrayerHistory();
      
      // Update the prayer count
      const today = new Date().toISOString().split('T')[0];
      if ($prayerHistoryStore?.history) {
        const todayPrayers = $prayerHistoryStore.history.filter(p => 
          p.date === today && (p.status === 'ontime' || p.status === 'late' || p.status === 'excused')
        );
        completedPrayersToday = todayPrayers.length;
        console.log('Home: Updated completed prayers count to', completedPrayersToday);
      }
    } catch (error) {
      console.error('Error refreshing prayer history:', error);
    }
  }

  // Refresh the dhikr count when the component becomes visible
  $: if (currentPage === 'home' && auth.currentUser) {
    refreshDhikrCount();
    refreshPrayerHistory(); // Also refresh prayer history
  }

  function handleTabChange(event) {
    const previousPage = currentPage;
    currentPage = event.detail;
    if (currentPage === 'home') {
      // Always update stats when returning to home
      updateStats();
      // Refresh prayer history data
      refreshPrayerHistory();
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
  let isLoadingPrayers = false;

  let upcomingCountdown = '';
  let countdownEnded = false;

  let todayReadingTime = 0;

  let completedPrayersToday = 0;
  let todayTasbihCount = 0;

  let showMoodSelector = false;
  let currentMorningMood = null;
  let currentEveningMood = null;

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

  // Add this right after the moods array definition
  console.log('Moods array in Home.svelte:', moods);
  console.log('Seeking peace mood in Home.svelte:', moods.find(m => m.value === 'seeking_peace'));

  $: {
    const today = new Date().toISOString().split('T')[0];
    if ($prayerHistoryStore?.history) {
      const todayPrayers = $prayerHistoryStore.history.filter(p => 
        p.date === today && (p.status === 'ontime' || p.status === 'late' || p.status === 'excused')
      );
      completedPrayersToday = todayPrayers.length;
    }
  }

  // Add a computed value for today's journal count
  $: todayJournalCount = $journalStore.streak?.morning && $journalStore.streak?.evening ? 2 : 
                         $journalStore.streak?.morning || $journalStore.streak?.evening ? 1 : 0;

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
      // Only update if countdown wasn't already ended
      if (!countdownEnded) {
        countdownEnded = true;
        // Move to pending and find next upcoming prayer
        await getPrayerHistory();
        updatePrayerStatus();
      }
      return;
    }
    
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    
    upcomingCountdown = `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    countdownEnded = false;
  }

  async function updatePrayerStatus() {
    // Check if document is visible (skip updates when app is in background)
    if (document.hidden) {
      console.log('pppp Skipping update - app is in background');
      return;
    }
    
    // Check if an update is already in progress or if it's too soon for another update
    const now = Date.now();
    if (isUpdatingPrayerStatus || (now - lastPrayerStatusUpdate < MIN_UPDATE_INTERVAL)) {
      console.log('pppp Skipping update - already in progress or too soon since last update');
      return;
    }
    
    // Set the flag to prevent concurrent updates
    isUpdatingPrayerStatus = true;
    isLoadingPrayers = true;
    
    try {
      // Update past prayer statuses first
      await updatePastPrayerStatuses();
      
      // Check if we have data in the store
      if (!$prayerTimesStore || $prayerTimesStore.length === 0) {
        console.log('pppp No prayer times in store, fetching...');
        await fetchPrayerTimes();
      }
      
      // Only fetch prayer history if we don't have it or if it's stale
      if (!$prayerHistoryStore?.history || !prayerHistoryCache.lastFetched) {
        console.log('pppp No prayer history in store or cache expired, fetching...');
        await getPrayerHistory();
      } else {
        const cacheAge = Number(Date.now()) - Number(prayerHistoryCache.lastFetched);
        const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
        
        if (cacheAge > CACHE_MAX_AGE) {
          console.log('pppp Prayer history cache expired, fetching fresh data...');
          await getPrayerHistory();
        } else {
          console.log('pppp Using cached prayer history, age:', Math.round(cacheAge / 1000), 'seconds');
        }
      }

      // Update the upcoming prayer
      console.log('pppp Updating upcoming prayer...');
      console.log('pppp Prayer times store:', $prayerTimesStore);
      
      // Get the next prayer
      upcomingPrayer = getNextPrayer();
      console.log('pppp Next prayer:', upcomingPrayer);
      
      // Update countdown if we have an upcoming prayer
      if (upcomingPrayer) {
        updateCountdown();
        console.log('pppp Updated countdown:', upcomingCountdown);
      } else {
        console.log('pppp No upcoming prayer found');
      }
      
      // Update the timestamp of the last successful update
      lastPrayerStatusUpdate = Date.now();
    } catch (error) {
      console.error('pppp Error updating prayer status:', error);
    } finally {
      isLoadingPrayers = false;
      // Reset the flag to allow future updates
      isUpdatingPrayerStatus = false;
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

  // Function to check if we should show the mood popup
  function checkMoodPopup(): void {
    if (!$prayerTimesStore || !Array.isArray($prayerTimesStore) || $prayerTimesStore.length === 0) return;

    const now = new Date();
    const today = now.toLocaleDateString();

    // Don't check more than once per minute
    const timeDiff = lastMoodCheck ? now.getTime() - lastMoodCheck.getTime() : Infinity;
    if (timeDiff < 60000) return;
    lastMoodCheck = now;

    // Get today's moods
    const todayMoods = weekMoods[today] || {};

    // Get prayer times
    const prayerTimes = $prayerTimesStore as PrayerTimesStore;
    const fajrPrayer = prayerTimes.find(p => p.name === 'Fajr');
    const maghribPrayer = prayerTimes.find(p => p.name === 'Maghrib');
    const dhuhrPrayer = prayerTimes.find(p => p.name === 'Dhuhr');

    if (!fajrPrayer || !maghribPrayer || !dhuhrPrayer) return;

    const fajrTime = new Date(fajrPrayer.timestamp);
    const maghribTime = new Date(maghribPrayer.timestamp);
    const dhuhrTime = new Date(dhuhrPrayer.timestamp);

    // Check if we're in the morning window (after Fajr, before Dhuhr)
    const isMorningWindow = now >= fajrTime && now < dhuhrTime;
    
    // Check if we're in the evening window (after Maghrib, before midnight)
    const isEveningWindow = now >= maghribTime && now.getHours() < 24;

    // Show popup for morning if:
    // 1. It's after Fajr and before Dhuhr
    // 2. We haven't recorded morning mood yet
    if (isMorningWindow && !todayMoods.morning) {
      currentMoodPeriod = 'morning';
      showMoodPopup = true;
      return;
    }

    // Show popup for evening if:
    // 1. It's after Maghrib and before midnight
    // 2. We haven't recorded evening mood yet
    if (isEveningWindow && !todayMoods.evening) {
      currentMoodPeriod = 'evening';
      showMoodPopup = true;
      return;
    }

    showMoodPopup = false;
  }

  async function handleMoodSubmit(selectedMood: any, period: MoodPeriod): Promise<void> {
    try {
      console.log('handleMoodSubmit called with mood:', selectedMood.value, 'period:', period);
      await saveMood(selectedMood, selectedMood.guidance, period);
      
      // Use the local mood template to ensure we have the icon
      const matchingMood = moods.find(m => m.value === selectedMood.value);
      console.log('Found matching mood:', matchingMood ? matchingMood.value : 'none');
      
      if (matchingMood) {
        const moodData = {
          value: selectedMood.value,
          name: matchingMood.name,
          icon: matchingMood.icon,
          description: matchingMood.description,
          guidance: selectedMood.guidance
        };
        
        console.log('Created mood data:', moodData.value);

        if (period === 'morning') {
          currentMorningMood = moodData;
          console.log('Set currentMorningMood');
        } else {
          currentEveningMood = moodData;
          console.log('Set currentEveningMood');
        }
      }
      await loadWeekMoods();
    } catch (error) {
      console.error('Error saving mood:', error);
    }
  }

  function handleMoodSelect(event: CustomEvent): void {
    void handleMoodSubmit(event.detail, currentMoodPeriod);
    showMoodPopup = false;
  }

  function handleMoodSkip(): void {
    showMoodPopup = false;
  }

  function handleMoodClose(): void {
    showMoodPopup = false;
  }

  async function loadWeekMoods() {
    try {
      await getMoodHistory(7);
      const moodsFromDb = get(moodHistoryStore);
      console.log('Raw moods from DB:', JSON.stringify(moodsFromDb));
      
      // Check for duplicate mood entries (same date and period)
      const moodsByDateAndPeriod: Record<string, any[]> = {};
      moodsFromDb.forEach(mood => {
        const key = `${mood.date}_${mood.period}`;
        if (!moodsByDateAndPeriod[key]) {
          moodsByDateAndPeriod[key] = [];
        }
        moodsByDateAndPeriod[key].push(mood);
      });
      
      // Log any duplicates found
      Object.entries(moodsByDateAndPeriod).forEach(([key, moods]) => {
        if (moods.length > 1) {
          console.log(`Found ${moods.length} duplicate moods for ${key}:`, moods);
        }
      });
      
      // Use the most recent mood for each date and period
      const uniqueMoods = Object.values(moodsByDateAndPeriod).map(moods => {
        // Sort by timestamp descending and take the first one
        return moods.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      });
      
      console.log('Unique moods after deduplication:', uniqueMoods);
      
      weekMoods = uniqueMoods.reduce((acc, mood) => {
        if (!acc[mood.date]) {
          acc[mood.date] = {};
        }
        acc[mood.date][mood.period] = mood;
        console.log(`Setting mood for ${mood.date}, period ${mood.period}:`, mood);
        return acc;
      }, {});

      console.log('Processed weekMoods:', JSON.stringify(weekMoods));

      // Check if we have moods for today
      const today = new Date().toLocaleDateString();
      console.log('Today is:', today);
      const todayMoods = weekMoods[today] || {};
      console.log('Today moods:', JSON.stringify(todayMoods));
      
      // Get prayer times to determine which mood selector to show
      const prayerTimes = get(prayerTimesStore);
      const selectorInfo = shouldShowMoodSelector(prayerTimes);
      const showMorningMood = selectorInfo ? selectorInfo.showMorningMood : false;
      const showEveningMood = selectorInfo ? selectorInfo.showEveningMood : false;

      if (todayMoods.morning) {
        console.log('Found morning mood:', todayMoods.morning.mood);
        // Try to find a direct match first
        let matchingMood = moods.find(m => m.value === todayMoods.morning.mood);
        
        // If no match found, try converting spaces to underscores
        if (!matchingMood) {
          const normalizedValue = todayMoods.morning.mood.replace(/\s+/g, '_');
          console.log('Trying normalized value with underscores:', normalizedValue);
          matchingMood = moods.find(m => m.value === normalizedValue);
        }
        
        // If still no match, try converting underscores to spaces
        if (!matchingMood) {
          const denormalizedValue = todayMoods.morning.mood.replace(/_+/g, ' ');
          console.log('Trying denormalized value with spaces:', denormalizedValue);
          matchingMood = moods.find(m => m.value === denormalizedValue);
        }
        
        console.log('Matching mood from array:', matchingMood ? matchingMood.value : 'none');
        if (matchingMood) {
          currentMorningMood = {
            value: todayMoods.morning.mood,
            name: matchingMood.name,
            icon: matchingMood.icon,
            description: matchingMood.description
          };
          console.log('Set currentMorningMood:', currentMorningMood.value);
        }
      }

      if (todayMoods.evening) {
        console.log('Found evening mood:', todayMoods.evening.mood);
        // Try to find a direct match first
        let matchingMood = moods.find(m => m.value === todayMoods.evening.mood);
        
        // If no match found, try converting spaces to underscores
        if (!matchingMood) {
          const normalizedValue = todayMoods.evening.mood.replace(/\s+/g, '_');
          console.log('Trying normalized value with underscores:', normalizedValue);
          matchingMood = moods.find(m => m.value === normalizedValue);
        }
        
        // If still no match, try converting underscores to spaces
        if (!matchingMood) {
          const denormalizedValue = todayMoods.evening.mood.replace(/_+/g, ' ');
          console.log('Trying denormalized value with spaces:', denormalizedValue);
          matchingMood = moods.find(m => m.value === denormalizedValue);
        }
        
        console.log('Matching mood from array:', matchingMood ? matchingMood.value : 'none');
        if (matchingMood) {
          currentEveningMood = {
            value: todayMoods.evening.mood,
            name: matchingMood.name,
            icon: matchingMood.icon,
            description: matchingMood.description
          };
          console.log('Set currentEveningMood:', currentEveningMood.value);
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
    if (!$prayerTimesStore || $prayerTimesStore.length === 0) {
      return null;
    }
    
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
    
    // If no prayer is found for today, only return Fajr if it's after midnight
    const fajr = $prayerTimesStore[0]; // Fajr is always the first prayer
    const [fajrTime, fajrPeriod] = fajr.time.split(' ');
    const [fajrHours] = fajrTime.split(':');
    let fajrHour = parseInt(fajrHours);
    if (fajrPeriod === 'AM' && fajrHour === 12) fajrHour = 0;
    
    // Only show Fajr as next prayer if current time is after midnight and before Fajr
    if (now.getHours() >= 0 && now.getHours() < fajrHour) {
      return fajr;
    }
    
    return null; // No next prayer to show
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

  function handleLocationResult(event) {
    showLocationDialog = false;
    if (event.detail === 'granted') {
      // Retry fetching prayer times
      fetchPrayerTimes();
    }
  }

  function handleTestMoodPopup() {
    // Toggle between morning and evening
    currentMoodPeriod = currentMoodPeriod === 'morning' ? 'evening' : 'morning';
    showMoodPopup = true;
  }

  // Add this function to handle manual mood tracking
  function handleManualMoodTracking(period) {
    // Get prayer times
    const prayerTimes = $prayerTimesStore;
    const fajrPrayer = prayerTimes.find(p => p.name === 'Fajr');
    const maghribPrayer = prayerTimes.find(p => p.name === 'Maghrib');
    
    if (!fajrPrayer || !maghribPrayer) return;

    const now = new Date();
    const fajrTime = new Date(fajrPrayer.timestamp);
    const maghribTime = new Date(maghribPrayer.timestamp);

    if (period === 'morning' && now < fajrTime) {
      alert('Please wait until after Fajr prayer to record your morning reflection.');
      return;
    }

    if (period === 'evening' && now < maghribTime) {
      alert('Please wait until after Maghrib prayer to record your evening reflection.');
      return;
    }

    currentMoodPeriod = period;
    showMoodPopup = true;
  }

  // Update today's tasbih count whenever the weeklyStatsStore changes
  $: if ($weeklyStatsStore?.dailyCounts) {
    const todayCount = $weeklyStatsStore.dailyCounts.find(day => day.isToday);
    if (todayCount) {
      todayTasbihCount = todayCount.count;
      console.log('Home: Updated today\'s tasbih count from store to', todayTasbihCount);
    }
  }

  // Add this function to test the seeking_peace mood specifically
  function testSeekingPeaceMood() {
    console.log('Testing seeking_peace mood specifically');
    const seekingPeaceMood = moods.find(m => m.value === 'seeking_peace');
    if (seekingPeaceMood) {
      console.log('Found seeking_peace mood in moods array:', seekingPeaceMood);
      currentMoodPeriod = 'morning';
      void handleMoodSubmit(seekingPeaceMood, currentMoodPeriod);
    } else {
      console.error('Could not find seeking_peace mood in moods array');
    }
  }

  // Add this function to the Home.svelte component
  async function handleAddSeekingPeaceGuidance() {
    console.log('Adding seeking_peace guidance');
    const result = await addSeekingPeaceGuidance();
    console.log('Result of adding seeking_peace guidance:', result);
  }

  function handleMoodCalendarClick() {
    showMoodCalendarPopup = true;
  }

  function handleMoodCalendarClose() {
    showMoodCalendarPopup = false;
  }

  function handleMoodCalendarSelect(event) {
    // Handle mood selection from calendar
    const selectedMood = event.detail;
    selectedHistoryMood = selectedMood;
    showMoodCalendarPopup = false;
  }

  // Add this function to the script section
  async function refreshActivities() {
    console.log('Manually refreshing activities');
    
    // Show a small loading indicator or feedback
    const activitiesSection = document.querySelector('.reading-stats');
    if (activitiesSection) {
      activitiesSection.classList.add('refreshing');
    }
    
    try {
      // Refresh all activity data
      await Promise.all([
        refreshPrayerHistory(),
        getTodayReadingTime().then(time => {
          todayReadingTime = time;
        }),
        refreshDhikrCount()
      ]);
      
      // Update journal count (this is reactive so no need to fetch)
      todayJournalCount = $journalStore.streak?.morning && $journalStore.streak?.evening ? 2 : 
                         $journalStore.streak?.morning || $journalStore.streak?.evening ? 1 : 0;
                         
      console.log('Activities refreshed successfully');
    } catch (error) {
      console.error('Error refreshing activities:', error);
    } finally {
      // Remove loading indicator
      if (activitiesSection) {
        activitiesSection.classList.remove('refreshing');
        
        // Add a brief "refreshed" indicator
        activitiesSection.classList.add('refreshed');
        setTimeout(() => {
          activitiesSection.classList.remove('refreshed');
        }, 1000);
      }
    }
  }
</script>

<div class="home-container">
  <div class="top-bar">
    <NotificationIcon on:click={() => navigateTo('notifications')} />
  </div>
  <div class="content">
    {#if currentPage === 'home'}
      <div class="home-content">
        <!-- Add test button at the top -->
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
                      <!-- Try to find a direct match first -->
                      {@const moodValue = weekMoods[fullDate].morning.mood}
                      {@const morningMood = moods.find(m => 
                        m.value === moodValue || 
                        m.value === moodValue.replace(/\s+/g, '_') || 
                        m.value === moodValue.replace(/_+/g, ' ')
                      )}
                      {#if morningMood}
                        <button 
                          class="mood-icon-button morning" 
                          on:click={() => handleMoodHistoryClick(weekMoods[fullDate].morning)}
                          title={`Morning: ${morningMood.name}`}
                        >
                          {@html morningMood.icon}
                          <span class="debug-info" style="display: none;">
                            {console.log(`Rendering morning mood for ${fullDate}:`, weekMoods[fullDate].morning.mood)}
                          </span>
                        </button>
                      {:else}
                        <span class="debug-info" style="display: none;">
                          {console.log(`No matching morning mood found for ${fullDate}. Value:`, weekMoods[fullDate].morning.mood)}
                        </span>
                      {/if}
                    {:else}
                      <span class="debug-info" style="display: none;">
                        {console.log(`No morning mood data for ${fullDate}`)}
                      </span>
                    {/if}
                    {#if weekMoods[fullDate].evening}
                      <!-- Try to find a direct match first -->
                      {@const moodValue = weekMoods[fullDate].evening.mood}
                      {@const eveningMood = moods.find(m => 
                        m.value === moodValue || 
                        m.value === moodValue.replace(/\s+/g, '_') || 
                        m.value === moodValue.replace(/_+/g, ' ')
                      )}
                      {#if eveningMood}
                        <button 
                          class="mood-icon-button evening" 
                          on:click={() => handleMoodHistoryClick(weekMoods[fullDate].evening)}
                          title={`Evening: ${eveningMood.name}`}
                        >
                          {@html eveningMood.icon}
                          <span class="debug-info" style="display: none;">
                            {console.log(`Rendering evening mood for ${fullDate}:`, weekMoods[fullDate].evening.mood)}
                          </span>
                        </button>
                      {:else}
                        <span class="debug-info" style="display: none;">
                          {console.log(`No matching evening mood found for ${fullDate}. Value:`, weekMoods[fullDate].evening.mood)}
                        </span>
                      {/if}
                    {:else}
                      <span class="debug-info" style="display: none;">
                        {console.log(`No evening mood data for ${fullDate}`)}
                      </span>
                    {/if}
                  </div>
                {/if}
                
                {#if isToday}
                  <div class="mood-add-buttons">
                    {#if !weekMoods[fullDate]?.morning}
                      <button 
                        class="mood-add-button morning" 
                        on:click={() => handleManualMoodTracking('morning')}
                        title="Add morning mood"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    {/if}
                    {#if !weekMoods[fullDate]?.evening}
                      <button 
                        class="mood-add-button evening" 
                        on:click={() => handleManualMoodTracking('evening')}
                        title="Add evening mood"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
            
            <!-- Mood Calendar Button -->
            <button class="mood-calendar-button" on:click={handleMoodCalendarClick} title="View Mood Calendar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <circle cx="12" cy="15" r="2" />
              </svg>
            </button>
          </div>
        </div>

        <MoodHistoryModal 
          moodData={selectedHistoryMood}
          moods={moods}
          onClose={handleHistoryModalClose}
        />

        <div class="reading-stats">
          <h3 class="section-title">
            Today's Activities
          </h3>
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

            <div class="activity-card" on:click={() => {
              // Set the activeTab in Prayer component to 'tasbih' first
              if (typeof window !== 'undefined') {
                window.localStorage.setItem('prayer_active_tab', 'tasbih');
              }
              // Then navigate to prayer page
              navigateTo('prayer');
            }}>
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
                <span class="activity-value">{todayJournalCount}</span>
                <span class="activity-label">Journal</span>
              </div>
            </div>
          </div>
          
          {#if $journalStore.todayMorningReflection?.affirmation}
            <div class="affirmation-card" on:click={() => navigateTo('journal')}>
              <div class="affirmation-icon">
                <svelte:component this={iconMap.Star} size={20} weight="fill" color="#E09453" />
              </div>
              <div class="affirmation-content">
                <span class="affirmation-label">Today's Affirmation</span>
                <p class="affirmation-text">"{$journalStore.todayMorningReflection.affirmation}"</p>
              </div>
            </div>
          {:else}
            <div class="affirmation-card" on:click={() => navigateTo('journal')}>
              <div class="affirmation-icon">
                <svelte:component this={iconMap.Star} size={20} weight="fill" color="#E09453" />
              </div>
              <div class="affirmation-content">
                <span class="affirmation-label">Today's Affirmation</span>
                <p class="affirmation-text reminder">Take a moment to set your daily affirmation and watch how it shapes your day. Write your morning reflection to ground yourself before the day unfolds.</p>
              </div>
            </div>
          {/if}
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
          <WeeklyPrayerHistory />
        </div>
      </div>
    {:else if currentPage === 'prayer'}
      <Prayer />
    {:else if currentPage === 'tasbih'}
      <Tasbih />
    {:else if currentPage === 'journal'}
      <Journal />
    {:else if currentPage === 'quran'}
      <QuranReading />
    {:else if currentPage === 'profile'}
      <Profile {navigateTo} />
    {/if}
  </div>
</div>

{#if showPermissionDialog}
  <NotificationPermissionDialog on:permissionResult={handlePermissionResult} />
{/if}

{#if showLocationDialog}
  <LocationPermissionDialog on:permissionResult={handleLocationResult} />
{/if}

{#if showMoodPopup}
  <MoodPopup
    period={currentMoodPeriod}
    on:select={handleMoodSelect}
    on:skip={handleMoodSkip}
    on:close={handleMoodClose}
  />
{/if}

{#if isAdmin}
  <div class="admin-controls">
    <button on:click={handleSync}>Sync Quotes</button>
    <button on:click={handleTestMoodPopup}>Test Mood Popup</button>
    <button on:click={testSeekingPeaceMood}>Test Seeking Peace</button>
    <button on:click={handleAddSeekingPeaceGuidance}>Add Seeking Peace Guidance</button>
  </div>
{/if}

{#if showMoodCalendarPopup}
  <MoodCalendarPopup 
    moods={moods}
    onClose={handleMoodCalendarClose}
    on:select={handleMoodCalendarSelect}
  />
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
    align-items: flex-start;
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
    min-width: 2.5rem;
    position: relative;
    height: 6rem; /* Fixed height to ensure consistent alignment */
  }

  .day {
    font-size: 0.75rem;
    color: #666;
  }

  .date-num {
    font-size: 1rem;
    color: #000;
    margin-bottom: 0.25rem;
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
    margin-top: 30px;
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
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .refresh-button {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    padding: 4px;
    margin-left: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .refresh-button:hover {
    background: rgba(0, 0, 0, 0.05);
  }
  
  .refresh-button:active {
    background: rgba(0, 0, 0, 0.1);
  }
  
  .refreshing .refresh-button {
    animation: spin 1s linear infinite;
  }
  
  .refreshed .activities-row {
    animation: flash 0.5s ease-out;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes flash {
    0% { opacity: 0.5; }
    100% { opacity: 1; }
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
    width: 1.5rem;
    height: 1.5rem;
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

  .mood-icon-button :global(svg) {
    width: 100%;
    height: 100%;
  }

  .next-prayer-card {
    margin-top: 1rem;
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
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .mood-add-buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .mood-icon-button {
    width: 1.5rem;
    height: 1.5rem;
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

  .test-button-container {
    padding: 0.5rem 0;
    display: flex;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .test-button {
    background: #216974;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(33, 105, 116, 0.1);
    flex-grow: 1;
  }

  .test-button:hover {
    background-color: #184f57;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(33, 105, 116, 0.15);
  }

  .test-button:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(33, 105, 116, 0.1);
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background: transparent;
    position: absolute;
    top: 0;
    right: 0;
    z-index: 100;
    gap: 1rem;
  }

  .mood-add-buttons {
    display: flex;
    justify-content: center;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  .mood-add-button {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: none;
    background: #f0f4f5;
    color: #216974;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .mood-add-button:hover {
    background: #e0eaec;
    transform: scale(1.1);
    box-shadow: 0 2px 5px rgba(0,0,0,0.15);
  }

  .mood-add-button svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .mood-add-button.morning {
    border: 1px solid rgba(33, 105, 116, 0.3);
  }

  .mood-add-button.evening {
    border: 1px solid rgba(224, 148, 83, 0.3);
  }

  .next-prayer-card {
    margin-top: 1rem;
  }
  
  .affirmation-card {
    background-color: #f8f5f0;
    border-radius: 12px;
    padding: 0.75rem;
    margin-top: 0.75rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .affirmation-card:hover {
    background-color: #f5f0e8;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    transform: translateY(-1px);
  }
  
  .affirmation-icon {
    background-color: #fdf2e9;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 4px;
  }
  
  .affirmation-content {
    flex: 1;
  }
  
  .affirmation-label {
    font-size: 0.75rem;
    color: #666;
    display: block;
    margin-bottom: 0.25rem;
  }
  
  .affirmation-text {
    font-size: 0.875rem;
    color: #333;
    font-style: italic;
    margin: 0;
    line-height: 1.4;
  }
  
  .affirmation-text.reminder {
    color: #E09453;
    font-style: normal;
    font-weight: 500;
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .mood-calendar-button {
    width: 3.5rem;
    height: 100%;
    background: #E6F7F9;
    border: 1px solid #E2E8F0;
    border-left: none;
    border-radius: 0 12px 12px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #216974;
    transition: all 0.2s;
  }

  .mood-calendar-button svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .mood-calendar-button:hover {
    background: #D1EFF2;
  }
</style>

