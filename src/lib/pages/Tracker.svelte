<script>
  import { onMount } from 'svelte';
  import { Timer, ChartLine, Heart, Brain } from 'phosphor-svelte';
  import { prayerHistoryStore, getPrayerHistory } from '../stores/prayerHistoryStore';
  import { moodHistoryStore, getMoodHistory } from '../stores/moodStore';
  import { auth } from '../firebase';
  import { quranHistoryStore, getQuranHistory, addTestQuranReading } from '../stores/quranHistoryStore';

  let prayerStreak = 0;
  let longestStreak = 0;
  let onTimeRate = 0;
  let onTimeChange = 0;
  let prayerAnalysis = {
    Fajr: { rate: 0, change: 0 },
    Dhuhr: { rate: 0, change: 0 },
    Asr: { rate: 0, change: 0 },
    Maghrib: { rate: 0, change: 0 },
    Isha: { rate: 0, change: 0 }
  };
  let mostCommonMood = '';
  let bestMood = '';
  let bestPrayerMood = '';
  let moodStreak = 0;
  let longestMoodStreak = 0;
  let bestMoodCount = 0;
  let quranStreak = 0;
  let longestQuranStreak = 0;

  const moods = [
    { 
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"/>
        <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"/>
        <path d="M15 9H15.01"/>
        <path d="M9 9H9.01"/>
      </svg>`,
      name: 'Grateful',
      value: 'grateful'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/>
        <path d="M8 12H16"/>
        <path d="M12 8V16"/>
      </svg>`,
      name: 'Seeking Peace',
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
      value: 'blessed'
    }
  ];

  const patternIcons = {
    Fajr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
      <path d="M12 16a4 4 0 100-8 4 4 0 000 8z"/>
    </svg>`,
    Dhuhr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>`,
    Asr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      <path d="M12 16a4 4 0 100-8 4 4 0 000 8z" fill="currentColor" fill-opacity="0.2"/>
    </svg>`,
    Maghrib: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17 12a5 5 0 10-10 0"/>
      <path d="M12 1v2M4.22 4.22l1.42 1.42M1 12h2M21 12h2M18.36 5.64l1.42-1.42"/>
      <path d="M17 12H7"/>
    </svg>`,
    Isha: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>`,
    Morning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>`,
    Evening: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
      <path d="M12 17v-5M7 12h10"/>
    </svg>`
  };

  function capitalizeFirstLetter(string) {
    if (!string) return '';
    const words = string.split('_');
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  onMount(async () => {
    await Promise.all([
      getPrayerHistory(),
      getMoodHistory(),
      getQuranHistory()
    ]);
    calculateInsights();
  });

  function calculateInsights() {
    if (!$prayerHistoryStore.history) return;

    console.log('Prayer History:', $prayerHistoryStore.history);

    // Calculate prayer streak and on-time rate
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Sort prayers by date in descending order
    const sortedPrayers = [...$prayerHistoryStore.history].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    console.log('Sorted Prayers:', sortedPrayers);

    // Group prayers by date
    const prayersByDate = {};
    sortedPrayers.forEach(prayer => {
      if (!prayersByDate[prayer.date]) {
        prayersByDate[prayer.date] = [];
      }
      prayersByDate[prayer.date].push(prayer);
    });
    console.log('Prayers By Date:', prayersByDate);

    // Calculate streak
    let currentStreak = 0;
    let maxStreak = 0;
    let streakBroken = false;

    // Get dates in order (past to present)
    const dates = Object.keys(prayersByDate)
      .filter(date => new Date(date) <= today)  // Only past and current dates
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());  // Past to present
    console.log('Filtered dates in order:', dates);

    // Calculate streak from past to present
    for (const date of dates) {
      const prayers = prayersByDate[date];
      console.log(`Checking date ${date}, prayers:`, prayers);
      
      // Check if all 5 prayers are either completed or excused for the day
      const isComplete = prayers.length === 5 && 
        prayers.every(prayer => 
          ['ontime', 'late'].includes(prayer.status) || prayer.status === 'excused'
        );

      // Count how many prayers are excused
      const excusedCount = prayers.filter(prayer => prayer.status === 'excused').length;
      
      // If all prayers are excused, don't increase streak but don't break it either
      if (prayers.length === 5 && excusedCount === 5) {
        console.log(`Date ${date} all prayers excused, maintaining streak at ${currentStreak}`);
        continue;
      }

      console.log(`Date ${date} complete?`, isComplete, 'prayers length:', prayers.length, 'excused:', excusedCount);

      if (isComplete) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
        console.log(`Streak increased to ${currentStreak}`);
      } else {
        currentStreak = 0;  // Reset streak on incomplete day
        console.log(`Streak reset at date ${date}`);
      }
    }

    prayerStreak = currentStreak;
    longestStreak = maxStreak;
    console.log('Final streak:', prayerStreak, 'Longest streak:', longestStreak);

    let totalPrayers = 0;
    let onTimePrayers = 0;
    const prayerCounts = {
      Fajr: { total: 0, completed: 0, lastWeekTotal: 0, lastWeekCompleted: 0 },
      Dhuhr: { total: 0, completed: 0, lastWeekTotal: 0, lastWeekCompleted: 0 },
      Asr: { total: 0, completed: 0, lastWeekTotal: 0, lastWeekCompleted: 0 },
      Maghrib: { total: 0, completed: 0, lastWeekTotal: 0, lastWeekCompleted: 0 },
      Isha: { total: 0, completed: 0, lastWeekTotal: 0, lastWeekCompleted: 0 }
    };

    // Process prayer history
    let currentWeekPrayers = 0;
    let currentWeekOnTime = 0;
    let lastWeekPrayers = 0;
    let lastWeekOnTime = 0;
    
    $prayerHistoryStore.history.forEach(prayer => {
      const prayerDate = new Date(prayer.date);
      if (prayerDate >= sevenDaysAgo && prayerDate <= today) {
        // Current week data
        prayerCounts[prayer.prayerName].total++;
        if (['ontime', 'late', 'excused'].includes(prayer.status)) {
          prayerCounts[prayer.prayerName].completed++;
        }

        if (prayer.status === 'ontime') {
          currentWeekOnTime++;
        }
        currentWeekPrayers++;
      } else {
        // Last week's data
        const lastWeekStart = new Date(sevenDaysAgo);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        if (prayerDate >= lastWeekStart && prayerDate < sevenDaysAgo) {
          prayerCounts[prayer.prayerName].lastWeekTotal++;
          if (['ontime', 'late', 'excused'].includes(prayer.status)) {
            prayerCounts[prayer.prayerName].lastWeekCompleted++;
          }
          if (prayer.status === 'ontime') {
            lastWeekOnTime++;
          }
          lastWeekPrayers++;
        }
      }
    });

    // Calculate on-time rates
    const currentWeekRate = currentWeekPrayers > 0 ? (currentWeekOnTime / currentWeekPrayers) * 100 : 0;
    const lastWeekRate = lastWeekPrayers > 0 ? (lastWeekOnTime / lastWeekPrayers) * 100 : 0;
    
    // Calculate the change in percentage points
    onTimeChange = Math.round(currentWeekRate - lastWeekRate);
    onTimeRate = Math.round(currentWeekRate);

    // Calculate completion rate and growth for each prayer
    Object.keys(prayerCounts).forEach(prayer => {
      const total = prayerCounts[prayer].total;
      const completed = prayerCounts[prayer].completed;
      const lastWeekTotal = prayerCounts[prayer].lastWeekTotal;
      const lastWeekCompleted = prayerCounts[prayer].lastWeekCompleted;

      const currentRate = total > 0 ? (completed / total) * 100 : 0;
      const lastWeekRate = lastWeekTotal > 0 ? (lastWeekCompleted / lastWeekTotal) * 100 : 0;
      
      prayerAnalysis[prayer] = {
        rate: Math.round(currentRate),
        change: Math.round(currentRate - lastWeekRate)
      };
    });

    // Process mood history
    if ($moodHistoryStore) {
      console.log('Mood History:', $moodHistoryStore);
      const moodCounts = {};
      let bestMoodScore = 0;
      let bestPrayerMoodScore = 0;
      
      // Sort moods by date
      const sortedMoods = [...$moodHistoryStore].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      console.log('Sorted Moods:', sortedMoods);

      // Group moods by date
      const moodsByDate = {};
      sortedMoods.forEach(mood => {
        const date = new Date(mood.timestamp).toLocaleDateString('en-CA');
        if (!moodsByDate[date]) {
          moodsByDate[date] = [];
        }
        moodsByDate[date].push(mood);
        
        // Count mood frequencies
        moodCounts[mood.mood] = (moodCounts[mood.mood] || 0) + 1;
        if (moodCounts[mood.mood] > bestMoodScore) {
          bestMood = mood.mood;
          bestMoodScore = moodCounts[mood.mood];
        }
      });
      console.log('Moods By Date:', moodsByDate);
      console.log('Mood Counts:', moodCounts);

      // Calculate mood streak
      let currentStreak = 0;
      let maxStreak = 0;
      
      // Get dates in order (past to present)
      const dates = Object.keys(moodsByDate)
        .filter(date => new Date(date) <= today)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      console.log('Filtered Mood Dates:', dates);

      // Start with the most recent date
      for (let i = dates.length - 1; i >= 0; i--) {
        const currentDate = new Date(dates[i]);
        
        if (i === dates.length - 1) {
          // First date in the streak
          currentStreak = 1;
          console.log(`Starting streak with date ${dates[i]}`);
        } else {
          // Check gap with next date
          const nextDate = new Date(dates[i + 1]);
          const dayDiff = Math.floor(
            (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          console.log(`Checking gap between ${dates[i]} and ${dates[i + 1]}, dayDiff:`, dayDiff);

          if (dayDiff === 1) {
            // Consecutive day, increase streak
            currentStreak++;
            console.log(`Consecutive day found, streak increased to ${currentStreak}`);
          } else {
            // Gap found, start new streak
            currentStreak = 1;
            console.log(`Gap of ${dayDiff} days found, resetting streak to 1`);
          }
        }
        
        maxStreak = Math.max(maxStreak, currentStreak);
      }

      moodStreak = currentStreak;
      longestMoodStreak = maxStreak;
      console.log('Final Mood Streak:', moodStreak, 'Longest Mood Streak:', longestMoodStreak);

      // Find most common mood
      mostCommonMood = Object.entries(moodCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Peaceful';
      console.log('Most Common Mood:', mostCommonMood, 'Best Mood:', bestMood);
    }

    // Add pattern analysis variables
    let moodPatterns = {
      prayerMoods: {
        Fajr: {},
        Dhuhr: {},
        Asr: {},
        Maghrib: {},
        Isha: {}
      },
      timeOfDay: {
        morning: {},
        afternoon: {},
        evening: {}
      },
      streakImpact: {
        withStreak: {},
        withoutStreak: {}
      }
    };

    function analyzeMoodPatterns() {
      if (!$moodHistoryStore || !$prayerHistoryStore.history) return [];

      const patterns = [];
      const moodsByDate = {};
      const prayersByDate = {};

      // Group moods by date
      $moodHistoryStore.forEach(mood => {
        const date = new Date(mood.timestamp).toLocaleDateString('en-CA');
        if (!moodsByDate[date]) moodsByDate[date] = [];
        moodsByDate[date].push(mood);
      });

      // Group prayers by date
      $prayerHistoryStore.history.forEach(prayer => {
        const date = prayer.date;
        if (!prayersByDate[date]) prayersByDate[date] = [];
        prayersByDate[date].push(prayer);
      });

      // Analyze prayer-mood correlations
      Object.keys(moodsByDate).forEach(date => {
        const dayMoods = moodsByDate[date];
        const dayPrayers = prayersByDate[date] || [];

        dayMoods.forEach(mood => {
          const moodTime = new Date(mood.timestamp);
          const hour = moodTime.getHours();

          // Time of day categorization
          if (hour >= 4 && hour < 12) {
            moodPatterns.timeOfDay.morning[mood.mood] = (moodPatterns.timeOfDay.morning[mood.mood] || 0) + 1;
          } else if (hour >= 12 && hour < 17) {
            moodPatterns.timeOfDay.afternoon[mood.mood] = (moodPatterns.timeOfDay.afternoon[mood.mood] || 0) + 1;
          } else {
            moodPatterns.timeOfDay.evening[mood.mood] = (moodPatterns.timeOfDay.evening[mood.mood] || 0) + 1;
          }

          // Find nearest prayer before this mood
          const nearestPrayer = dayPrayers.find(prayer => {
            const prayerTime = new Date(date + ' ' + prayer.time);
            return prayerTime <= moodTime;
          });

          if (nearestPrayer) {
            if (!moodPatterns.prayerMoods[nearestPrayer.prayerName][mood.mood]) {
              moodPatterns.prayerMoods[nearestPrayer.prayerName][mood.mood] = 0;
            }
            moodPatterns.prayerMoods[nearestPrayer.prayerName][mood.mood]++;
          }
        });
      });

      // Generate insights
      const insights = [];

      // Find best mood after each prayer
      Object.entries(moodPatterns.prayerMoods).forEach(([prayer, moods]) => {
        const bestMood = Object.entries(moods).sort((a, b) => b[1] - a[1])[0];
        if (bestMood) {
          insights.push({
            type: 'prayer-mood',
            icon: patternIcons[prayer],
            title: `${prayer} Reflection`,
            description: `Most ${capitalizeFirstLetter(bestMood[0])} after ${prayer} prayer`
          });
        }
      });

      // Find time of day patterns
      const morningMood = Object.entries(moodPatterns.timeOfDay.morning)
        .sort((a, b) => b[1] - a[1])[0];
      const eveningMood = Object.entries(moodPatterns.timeOfDay.evening)
        .sort((a, b) => b[1] - a[1])[0];

      if (morningMood) {
        insights.push({
          type: 'time-mood',
          icon: patternIcons.Morning,
          title: 'Morning Mindset',
          description: `Most ${capitalizeFirstLetter(morningMood[0])} in the mornings`
        });
      }

      if (eveningMood) {
        insights.push({
          type: 'time-mood',
          icon: patternIcons.Evening,
          title: 'Evening Energy',
          description: `Feeling ${capitalizeFirstLetter(eveningMood[0])} in the evenings`
        });
      }

      return insights.slice(0, 3); // Return top 3 insights
    }

    // Add pattern analysis
    const patterns = analyzeMoodPatterns();

    // Calculate Quran streak
    if ($quranHistoryStore) {
      console.log('Raw Quran History Store:', JSON.stringify($quranHistoryStore));
      console.log('Quran History Type:', typeof $quranHistoryStore);
      console.log('Is Array?', Array.isArray($quranHistoryStore));
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Sort reading sessions by date in descending order
      const sortedReadings = Array.isArray($quranHistoryStore) ? [...$quranHistoryStore] : [];
      console.log('Sorted Readings Length:', sortedReadings.length);
      sortedReadings.sort((a, b) => 
        new Date(b.endTime || b.timestamp).getTime() - new Date(a.endTime || a.timestamp).getTime()
      );
      console.log('Sorted Quran Readings:', JSON.stringify(sortedReadings));

      // Group readings by date and sum up reading time
      const readingsByDate = {};
      sortedReadings.forEach(reading => {
        console.log('Processing reading:', JSON.stringify(reading));
        const readingDate = new Date(reading.endTime || reading.timestamp);
        readingDate.setHours(0, 0, 0, 0);
        const dateKey = readingDate.toLocaleDateString('en-CA');
        console.log('Reading date key:', dateKey);
        if (!readingsByDate[dateKey]) {
          readingsByDate[dateKey] = {
            readings: [],
            totalTime: 0
          };
        }
        readingsByDate[dateKey].readings.push(reading);
        readingsByDate[dateKey].totalTime += (reading.duration || 0);
        console.log(`Updated total time for ${dateKey}:`, readingsByDate[dateKey].totalTime);
      });
      console.log('Readings By Date:', JSON.stringify(readingsByDate));

      // Calculate streak
      let currentStreak = 0;
      let maxStreak = 0;

      // Get dates in order (past to present)
      const dates = Object.keys(readingsByDate)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      console.log('Filtered Quran Dates:', dates);

      // If we have any readings
      if (dates.length > 0) {
        // Get the most recent date
        const mostRecentDate = new Date(dates[dates.length - 1]);
        mostRecentDate.setHours(0, 0, 0, 0);
        const todayKey = today.toLocaleDateString('en-CA');
        
        // Start with 1 if the most recent reading is from today and total time >= 5 minutes
        if (readingsByDate[todayKey] && readingsByDate[todayKey].totalTime >= 300) { // 300 seconds = 5 minutes
          currentStreak = 1;
          console.log('Found valid reading time for today:', readingsByDate[todayKey].totalTime, 'seconds');
        }

        // Check previous days
        let checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - 1); // Start checking from yesterday

        while (true) {
          const dateKey = checkDate.toLocaleDateString('en-CA');
          const dayData = readingsByDate[dateKey];
          
          if (dayData) {
            // Check if total reading time is at least 5 minutes (300 seconds)
            const hasValidReading = dayData.totalTime >= 300;
            
            if (hasValidReading) {
              currentStreak++;
              console.log(`Found valid reading time for ${dateKey}: ${dayData.totalTime} seconds, streak now ${currentStreak}`);
            } else {
              console.log(`Insufficient reading time for ${dateKey}: ${dayData.totalTime} seconds`);
              break;
            }
          } else {
            console.log(`No readings found for ${dateKey}`);
            break;
          }

          // Move to previous day
          checkDate.setDate(checkDate.getDate() - 1);
        }

        maxStreak = Math.max(maxStreak, currentStreak);
      }

      quranStreak = currentStreak;
      longestQuranStreak = maxStreak;
      console.log('Final Quran Streak:', quranStreak, 'Longest:', longestQuranStreak);
    }

    return patterns;
  }
</script>

<div class="tracker-container">
  <h1>Smart Worship Insights</h1>
  <p class="subtitle">Your spiritual journey patterns</p>

  <div class="insights-grid">
    <!-- Prayer Streak Card -->
    <div class="insight-card">
      <div class="card-header">
        <Timer weight="fill" size={24} />
        <h2>Prayer Streak</h2>
      </div>
      <div class="card-content">
        <div class="big-number">{prayerStreak} Days</div>
        <div class="sub-text">Longest: {longestStreak} days</div>
      </div>
    </div>

    <!-- On-Time Rate Card -->
    <div class="insight-card">
      <div class="card-header">
        <ChartLine weight="fill" size={24} />
        <h2>On-Time Rate</h2>
      </div>
      <div class="card-content">
        <div class="big-number">{onTimeRate}%</div>
        <div class="sub-text {onTimeChange >= 0 ? 'positive' : 'negative'}">
          {onTimeChange >= 0 ? '+' : ''}{onTimeChange}% from last week
        </div>
      </div>
    </div>

    <!-- Quran Streak Card -->
    <div class="analysis-card quran-streak">
      <div class="card-header">
        <svg class="quran-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          <path d="M12 11c0-2.5-2-3-2-3s2-.5 2-3"/>
          <path d="M12 13c0 2.5 2 3 2 3s-2 .5-2 3"/>
        </svg>
        <h2>Quran Streak</h2>
      </div>
      <div class="card-content">
        <div class="big-number">{quranStreak} Days</div>
        <div class="sub-text">Longest: {longestQuranStreak} days</div>
      </div>
    </div>
  </div>

  {#if import.meta.env.DEV}
    <button 
      class="test-button"
      on:click={addTestQuranReading}
    >
      Add Test Quran Reading
    </button>
  {/if}

  <!-- Prayer Time Analysis -->
  <div class="analysis-card">
    <div class="card-header">
      <Brain weight="fill" size={24} />
      <h2>Prayer Time Analysis</h2>
    </div>
    <div class="prayer-analysis">
      {#each Object.entries(prayerAnalysis) as [prayer, stats]}
        <div class="prayer-row">
          <span class="prayer-name">{prayer}</span>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: {stats.rate}%"></div>
          </div>
          <div class="prayer-stats">
            <span class="prayer-rate">{stats.rate}%</span>
            {#if stats.change !== 0}
              <span class="change-rate {stats.change >= 0 ? 'positive' : 'negative'}">
                {stats.change >= 0 ? '+' : ''}{stats.change}%
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Mood Insights -->
  <div class="insights-grid">
    <div class="insight-card">
      <div class="card-header">
        <Brain weight="fill" size={24} />
        <h2>Mood Streak</h2>
      </div>
      <div class="card-content">
        <div class="big-number">{moodStreak} Days</div>
        <div class="sub-text">Longest: {longestMoodStreak} days</div>
      </div>
    </div>

    <div class="insight-card">
      <div class="card-header">
        <Heart weight="fill" size={24} />
        <h2>Most Common Mood</h2>
      </div>
      <div class="card-content">
        <div class="mood-display">
          {#if mostCommonMood}
            {@const matchingMood = moods.find(m => m.value === mostCommonMood)}
            {#if matchingMood}
              <div class="mood-icon small">
                {@html matchingMood.icon}
              </div>
            {/if}
            <div class="big-number">{capitalizeFirstLetter(mostCommonMood)}</div>
          {/if}
        </div>
        <div class="sub-text">Best mood: {capitalizeFirstLetter(bestMood)}</div>
      </div>
    </div>
  </div>

  <!-- Mood & Prayer Patterns -->
  <div class="analysis-card">
    <div class="card-header">
      <Brain weight="fill" size={24} />
      <h2>Mood & Prayer Patterns</h2>
    </div>
    <div class="patterns-list">
      {#each calculateInsights() as pattern}
        <div class="pattern-item">
          <span class="pattern-icon">
            {@html pattern.icon}
          </span>
          <div class="pattern-content">
            <h3>{pattern.title}</h3>
            <p>{pattern.description}</p>
          </div>
        </div>
      {/each}
      {#if calculateInsights().length === 0}
        <div class="pattern-item">
          <div class="pattern-content">
            <p class="no-patterns">Track more prayers and moods to see patterns</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .tracker-container {
    padding: 1rem;
    max-width: 600px;
    margin: 0 auto;
    padding-bottom: 80px;
  }

  h1 {
    color: #216974;
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #666;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .insights-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .insight-card {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .analysis-card {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    color: #216974;
  }

  .card-header h2 {
    font-size: 1rem;
    font-weight: 500;
    margin: 0;
  }

  .big-number {
    font-size: 1.75rem;
    font-weight: 600;
    color: #216974;
    margin-bottom: 0.25rem;
  }

  .sub-text {
    font-size: 0.875rem;
    color: #666;
  }

  .sub-text.positive {
    color: #216974;
  }

  .sub-text.negative {
    color: #D4AF37;
  }

  .prayer-analysis {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .prayer-row {
    display: grid;
    grid-template-columns: 80px 1fr 120px;
    align-items: center;
    gap: 1rem;
  }

  .prayer-name {
    font-size: 0.875rem;
    color: #216974;
    font-weight: 500;
  }

  .progress-bar-container {
    height: 8px;
    background: #f1f5f9;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: #D4AF37;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .prayer-rate {
    font-size: 0.875rem;
    color: #666;
    text-align: right;
    min-width: 45px;
  }

  .patterns-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .pattern-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 8px;
  }

  .pattern-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: #216974;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pattern-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .pattern-content h3 {
    font-size: 1rem;
    color: #216974;
    margin: 0 0 0.25rem 0;
  }

  .pattern-content p {
    font-size: 0.875rem;
    color: #666;
    margin: 0;
  }

  .prayer-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: flex-end;
    white-space: nowrap;
  }

  .change-rate {
    font-size: 0.75rem;
    padding: 0.125rem 0.25rem;
    border-radius: 4px;
    min-width: 45px;
    text-align: center;
  }

  .change-rate.positive {
    color: #216974;
    background: rgba(33, 105, 116, 0.1);
  }

  .change-rate.negative {
    color: #D4AF37;
    background: rgba(212, 175, 55, 0.1);
  }

  .mood-display {
    display: flex;
    align-items: left;
    gap: 0.5rem;
    justify-content: left;
  }

  .mood-icon.small {
    width: 1.5rem;
    height: 1.5rem;
    color: #216974;
  }

  .mood-icon.small :global(svg) {
    width: 100%;
    height: 100%;
  }

  @media (max-width: 480px) {
    .tracker-container {
      padding: 1rem;
    }

    .insights-grid {
      grid-template-columns: 1fr;
    }

    .big-number {
      font-size: 1.5rem;
    }
  }

  .no-patterns {
    text-align: center;
    color: #666;
    font-style: italic;
    margin: 1rem 0;
  }

  .quran-streak {
    margin-bottom: 1.5rem;
  }

  .quran-icon {
    width: 24px;
    height: 24px;
  }

  .test-button {
    background: #216974;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    cursor: pointer;
  }

  .test-button:hover {
    opacity: 0.9;
  }
</style> 