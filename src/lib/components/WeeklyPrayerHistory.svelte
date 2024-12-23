<script>
  import { onMount } from 'svelte';
  import { prayerHistoryStore, getPrayerHistory, getPrayerDateTime } from '../stores/prayerHistoryStore';
  import { prayerTimesStore } from '../stores/prayerTimes';
  import { iconMap } from '../utils/icons';

  let weeklyGrid = [];
  let weeklyStats = {
    ontime: 0,
    late: 0,
    missed: 0
  };
  
  function getCurrentWeekDays() {
    const today = new Date();
    const days = [];
    
    // Generate last 7 days ending with today
    for (let i = 6; i >= 0; i--) {
      const current = new Date(today);
      current.setDate(today.getDate() - i);
      days.push({
        date: current.toLocaleDateString('en-CA'), // YYYY-MM-DD format
        dayName: current.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: current.getDate(),
        isToday: i === 0
      });
    }
    return days;
  }

  function generatePrayerGrid() {
    const days = getCurrentWeekDays();
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const grid = [];
    
    // Add weekly stats object
    let weeklyStats = {
      ontime: 0,
      late: 0,
      missed: 0
    };

    // Get the date range for the last 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // -6 because we want to include today

    prayers.forEach(prayer => {
      const row = {
        name: prayer,
        icon: $prayerTimesStore.find(p => p.name === prayer)?.icon || 'Sun',
        weight: $prayerTimesStore.find(p => p.name === prayer)?.weight || 'regular',
        days: days.map(day => {
          const prayerRecord = $prayerHistoryStore.history.find(
            h => h.date === day.date && h.prayerName === prayer
          );

          // Get current time for comparison
          const now = new Date();
          const todayStr = new Date().toLocaleDateString('en-CA');
          const prayerDateTime = getPrayerDateTime(day.date, 
            $prayerTimesStore.find(p => p.name === prayer)?.time || '00:00 AM'
          );
          
          let status = 'pending';
          if (prayerRecord) {
            status = prayerRecord.status;
            // Only count stats if the prayer is within the last 7 days
            const prayerDate = new Date(day.date);
            prayerDate.setHours(0, 0, 0, 0);
            if (prayerDate >= sevenDaysAgo && prayerDate <= today) {
              if (status === 'ontime') weeklyStats.ontime++;
              else if (status === 'late') weeklyStats.late++;
              else if (status === 'missed') weeklyStats.missed++;
            }
          } else if (day.date < todayStr || (day.date === todayStr && prayerDateTime < now)) {
            status = 'missed';
            // Only count missed if within the last 7 days
            const prayerDate = new Date(day.date);
            prayerDate.setHours(0, 0, 0, 0);
            if (prayerDate >= sevenDaysAgo && prayerDate <= today) {
              weeklyStats.missed++;
            }
          }

          return {
            date: day.date,
            status,
            isToday: day.isToday
          };
        })
      };
      grid.push(row);
    });

    return { days, grid, weeklyStats };
  }

  onMount(async () => {
    console.log('WeeklyPrayerHistory mounted');
    await getPrayerHistory();
    console.log('Prayer history:', $prayerHistoryStore);
  });

  $: if ($prayerHistoryStore.history) {
    console.log('Generating grid with history:', $prayerHistoryStore.history);
    const gridData = generatePrayerGrid();
    weeklyGrid = gridData.grid;
    weeklyStats = gridData.weeklyStats;
    console.log('Generated grid:', weeklyGrid);
  }
</script>

<div class="prayer-history">
  <div class="history-grid">
    <div class="header-row">
      <div class="prayer-label"></div>
      {#each getCurrentWeekDays() as day}
        <div class="day-column {day.isToday ? 'today' : ''}">
          <span class="day-name">{day.dayName}</span>
          <span class="day-number">{day.dayNumber}</span>
        </div>
      {/each}
    </div>

    {#each weeklyGrid as row}
      <div class="prayer-row">
        <div class="prayer-label">
          <svelte:component this={iconMap[row.icon]} size={16} weight={row.weight} />
          <span>{row.name}</span>
        </div>
        {#each row.days as day}
          {@const isPending = $prayerHistoryStore.pendingByDate[day.date]?.prayers.some(p => p.prayerName === row.name)}
          <div class="status-cell">
            <div class="status-dot {day.status} {day.status === 'pending' && isPending ? 'has-notification' : ''}"></div>
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <div class="weekly-stats">
    <div class="stat-item">
      <span class="stat-number">{weeklyStats.ontime}</span>
      <span class="stat-label">On Time</span>
    </div>
    <div class="stat-item">
      <span class="stat-number">{weeklyStats.late}</span>
      <span class="stat-label">Late</span>
    </div>
    <div class="stat-item">
      <span class="stat-number">{weeklyStats.missed}</span>
      <span class="stat-label">Missed</span>
    </div>
  </div>

  <div class="legend">
    <div class="legend-item">
      <div class="status-dot ontime"></div>
      <span>On time</span>
    </div>
    <div class="legend-item">
      <div class="status-dot late"></div>
      <span>Late</span>
    </div>
    <div class="legend-item">
      <div class="status-dot missed"></div>
      <span>Missed</span>
    </div>
  </div>
</div>

<style>
  .prayer-history {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 1rem;
  }

  h3 {
    font-size: 1rem;
    color: #216974;
    margin-bottom: 1rem;
  }

  .history-grid {
    width: 100%;
  }

  .header-row {
    display: grid;
    grid-template-columns: 80px repeat(7, 1fr);
    gap: 0.25rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #eee;
  }

  .day-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
  }

  .day-column.today {
    color: #216974;
    font-weight: 500;
  }

  .day-name {
    font-size: 0.75rem;
    color: #666;
  }

  .day-number {
    font-size: 0.875rem;
  }

  .prayer-row {
    display: grid;
    grid-template-columns: 80px repeat(7, 1fr);
    gap: 0.25rem;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f5f5f5;
  }

  .prayer-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: #216974;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .status-cell {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .status-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1.5px solid #eee;
    position: relative;
  }

  .status-dot.pending.has-notification {
    background: white;
    border: 2px solid #216974;
  }

  .status-dot.ontime {
    background: #216974;
    border-color: #216974;
  }

  .status-dot.late {
    background: #E09453;
    border-color: #E09453;
  }

  .status-dot.missed {
    background: #EF4444;
    border-color: #EF4444;
  }

  .status-dot.pending {
    background: white;
    border: 1.5px solid #eee;
  }

  .legend {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #666;
  }

  .legend-item .status-dot {
    width: 8px;
    height: 8px;
  }

  .weekly-stats {
    display: flex;
    justify-content: space-around;
    padding: 0.75rem;
    margin: 0.5rem 0;
    background: #f8f8f8;
    border-radius: 8px;
    gap: 1rem;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-number {
    font-size: 1rem;
    font-weight: 500;
    color: #216974;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #666;
  }

  @media (max-width: 480px) {
    .prayer-history {
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .header-row, .prayer-row {
      grid-template-columns: 70px repeat(7, 1fr);
      gap: 0.2rem;
    }

    .prayer-label {
      font-size: 0.75rem;
      gap: 0.25rem;
    }

    .status-dot {
      width: 12px;
      height: 12px;
      border-width: 1.5px;
    }

    .legend {
      gap: 0.75rem;
    }

    .weekly-stats {
      padding: 0.75rem;
      margin: 0.75rem 0;
    }

    .stat-number {
      font-size: 1.25rem;
    }

    .stat-label {
      font-size: 0.75rem;
    }
  }
</style>
