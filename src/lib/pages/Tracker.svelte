<script>
  import { onMount } from 'svelte';
  import { Timer, ChartLine, Heart, Brain } from 'phosphor-svelte';
  import { prayerHistoryStore, getPrayerHistory } from '../stores/prayerHistoryStore';
  import { moodHistoryStore, getMoodHistory } from '../stores/moodStore';
  import { auth } from '../firebase';

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

  onMount(async () => {
    await Promise.all([
      getPrayerHistory(),
      getMoodHistory()
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
  </div>

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
        <div class="big-number">{mostCommonMood}</div>
        <div class="sub-text">Best mood: {bestMood}</div>
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
      <div class="pattern-item">
        <span class="pattern-icon">🌅</span>
        <div class="pattern-content">
          <h3>Morning Peace</h3>
          <p>Most peaceful after Fajr prayer</p>
        </div>
      </div>
      <div class="pattern-item">
        <span class="pattern-icon">🙏</span>
        <div class="pattern-content">
          <h3>Evening Reflection</h3>
          <p>Highest gratitude during Maghrib</p>
        </div>
      </div>
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
    color: #22C55E;
  }

  .sub-text.negative {
    color: #EF4444;
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
    background: #22C55E;
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
    font-size: 1.5rem;
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
    color: #22C55E;
    background: rgba(34, 197, 94, 0.1);
  }

  .change-rate.negative {
    color: #EF4444;
    background: rgba(239, 68, 68, 0.1);
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
</style> 