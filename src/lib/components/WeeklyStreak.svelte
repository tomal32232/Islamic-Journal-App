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
            class="bar {isToday ? 'today' : ''}" 
            style="height: {count ? Math.max(count / 100 * 100, 20) : 0}%"
          >
            {#if count > 0}
              <span class="count-tooltip">{count}</span>
            {/if}
          </div>
        </div>
        <span class="day-label">{day}</span>
        <span class="date-label">{date}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .streak-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 1.5rem;
  }

  .streak-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  h2 {
    font-size: 1rem;
    color: #000;
    margin: 0;
  }

  .streak-count {
    color: #216974;
    font-weight: 500;
  }

  .chart {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    height: 150px;
    padding-top: 1rem;
  }

  .chart-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .bar-container {
    width: 100%;
    height: 120px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .bar {
    width: 8px;
    background: #E0E0E0;
    border-radius: 4px;
    position: relative;
    transition: height 0.3s ease;
  }

  .bar.today {
    background: #216974;
  }

  .count-tooltip {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    background: #216974;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .bar:hover .count-tooltip {
    opacity: 1;
  }

  .day-label {
    font-size: 0.75rem;
    color: #666;
    margin-bottom: 0.125rem;
  }

  .date-label {
    font-size: 0.75rem;
    color: #666;
  }
</style> 