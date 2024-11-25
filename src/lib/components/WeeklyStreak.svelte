<script>
  import { onMount } from 'svelte';
  import { weeklyStatsStore, getWeeklyStats } from '../stores/tasbihStore';

  onMount(async () => {
    await getWeeklyStats();
  });
</script>

<div class="streak-card">
  <div class="streak-header">
    <h2>Weekly Dhikr Streak</h2>
    <span class="streak-count">{$weeklyStatsStore.streak} Days</span>
  </div>

  <div class="chart">
    {#each $weeklyStatsStore.dailyCounts as { day, date, count, isToday }}
      <div class="chart-column">
        <div class="bar-container">
          <div 
            class="bar {isToday ? 'today' : ''} {count > 0 ? 'has-count' : ''}" 
            style="height: {count ? Math.max(count / 100 * 100, 25) : 4}%"
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

  .streak-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  h2 {
    font-size: 0.875rem;
    color: #666;
    margin: 0;
  }

  .streak-count {
    color: #216974;
    font-weight: 500;
    font-size: 0.875rem;
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
  }

  .bar.has-count {
    min-height: 25px;
  }

  .bar.today {
    background: #216974;
  }

  .count {
    font-size: 0.75rem;
    font-weight: 500;
    color: #666;
  }

  .bar.today .count {
    color: white;
  }
</style> 