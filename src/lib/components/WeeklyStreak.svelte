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
  let maxCount = 0;

  // Format large numbers (e.g., 1000 -> 1k)
  function formatCount(count) {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'k';
    }
    return count.toString();
  }

  // Calculate bar height based on maximum value using a hybrid approach
  function getBarHeight(count) {
    if (count === 0) return 4;
    if (maxCount === 0) return 25;
    
    // Minimum height for non-zero values (25%)
    const minHeight = 25;
    
    // For very small numbers (< 10), use linear scale
    if (maxCount < 10) {
      return minHeight + (count / maxCount * 75);
    }
    
    // For larger numbers, use a hybrid approach
    // This gives more weight to smaller numbers while still showing differences in larger ones
    const ratio = count / maxCount;
    const logScale = Math.log10(count + 1) / Math.log10(maxCount + 1);
    
    // Blend linear and logarithmic scales
    const blendedScale = (ratio + logScale) / 2;
    
    return minHeight + (blendedScale * 75);
  }

  async function loadWeeklyStats() {
    const weeklyStats = await getWeeklyStats();
    if (weeklyStats) {
      stats = {
        currentStreak: weeklyStats.currentStreak,
        totalDays: weeklyStats.totalDays
      };
      dailyCounts = weeklyStats.dailyCounts;
      maxCount = Math.max(...dailyCounts.map(d => d.count));
      weeklyStatsStore.set({
        dailyCounts: weeklyStats.dailyCounts,
        streak: weeklyStats.currentStreak,
        todayCompleted: weeklyStats.todayCompleted,
        totalDays: weeklyStats.totalDays
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
      stats.totalDays = $weeklyStatsStore.totalDays;
      maxCount = Math.max(...dailyCounts.map(d => d.count));
    }
  }
</script>

<div class="streak-card">
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
            style="height: {getBarHeight(count)}%"
          >
            {#if count > 0}
              <span class="count">{formatCount(count)}</span>
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
    overflow: hidden;
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
    height: 100px;
    gap: 0.25rem;
    margin-top: 1rem;
    position: relative;
  }

  .chart-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    height: 100%;
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
    height: 60px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    overflow: visible;
  }

  .bar {
    width: 32px; /* Slightly wider to accommodate larger numbers */
    background: #E0E0E0;
    border-radius: 4px;
    position: relative;
    transition: height 0.3s ease;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 4px;
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
    position: absolute;
    bottom: 4px;
    width: 100%;
    text-align: center;
    padding: 0 2px;
    box-sizing: border-box;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar.today .count {
    color: white;
  }
</style> 