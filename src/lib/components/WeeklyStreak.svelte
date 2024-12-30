<script>
  import { onMount } from 'svelte';
  import { weeklyStatsStore, getWeeklyStats } from '../stores/tasbihStore';
  import { auth } from '../firebase';
  import { onAuthStateChanged } from 'firebase/auth';

  let stats = {
    currentStreak: 0,
    totalDays: 7
  };

  let dailyCounts = [];

  async function loadWeeklyStats() {
    const weeklyStats = await getWeeklyStats();
    if (weeklyStats) {
      stats = {
        currentStreak: weeklyStats.currentStreak,
        totalDays: weeklyStats.totalDays
      };
      dailyCounts = weeklyStats.dailyCounts;
      weeklyStatsStore.set({
        dailyCounts: weeklyStats.dailyCounts,
        streak: weeklyStats.currentStreak
      });
    }
  }

  onMount(() => {
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadWeeklyStats();
      }
    });

    // If already authenticated, load stats immediately
    if (auth.currentUser) {
      loadWeeklyStats();
    }

    return () => {
      unsubscribe();
    };
  });

  // Subscribe to store changes
  $: {
    if ($weeklyStatsStore.dailyCounts) {
      dailyCounts = $weeklyStatsStore.dailyCounts;
      stats.currentStreak = $weeklyStatsStore.streak;
    }
  }
</script>

<div class="streak-card">
  <h2>Weekly Dhikr Streak</h2>
  <div class="streak-header">
    <div class="streak-stats">
      <span class="streak-count">{stats.currentStreak}/{stats.totalDays} Days</span>
      <span class="streak-subtitle">{stats.totalDays - stats.currentStreak} Days Missed</span>
    </div>
  </div>

  <div class="chart">
    {#each dailyCounts as { day, date, count, isToday }}
      <div class="chart-column">
        <div class="bar-container">
          <div 
            class="bar {isToday ? 'today' : ''} {count > 0 ? 'has-count' : ''}" 
            style="height: {count ? Math.min(Math.max(count / 100 * 100, 25), 100) : 4}%"
          >
            {#if count > 0}
              <span class="count">{count}</span>
            {/if}
          </div>
        </div>
        <div class="day-info">
          <span class="day-label">{day}</span>
          <span class="date-label">{date}</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .streak-card {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 1rem;
  }

  h2 {
    font-size: 1.25rem;
    color: #216974;
    margin: 0 0 1rem 0;
  }

  .streak-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .streak-stats {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .streak-count {
    font-size: 1rem;
    color: #216974;
    font-weight: 500;
  }

  .streak-subtitle {
    font-size: 0.75rem;
    color: #E09453;
    margin-top: 0.125rem;
  }

  .chart {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    height: 80px;
    gap: 0.25rem;
  }

  .chart-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .day-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
  }

  .day-label {
    font-size: 0.75rem;
    color: #666;
  }

  .date-label {
    font-size: 0.625rem;
    color: #999;
  }

  .bar-container {
    width: 100%;
    height: 50px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    overflow: hidden;
  }

  .bar {
    width: 28px;
    background: #E0E0E0;
    border-radius: 4px;
    position: relative;
    transition: height 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    max-height: 50px;
  }

  .bar.has-count {
    background: #216974;
  }

  .bar.today {
    background: #216974;
  }

  .count {
    font-size: 0.75rem;
    font-weight: 500;
    color: white;
  }

  .bar.today .count {
    color: white;
  }
</style> 