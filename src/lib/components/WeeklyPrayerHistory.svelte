<script>
  import { onMount } from 'svelte';
  import { prayerHistoryStore, getPrayerHistory } from '../stores/prayerHistoryStore';
  import { prayerTimesStore } from '../stores/prayerTimes';
  import { iconMap } from '../utils/icons';

  let weeklyGrid = [];
  
  function getCurrentWeekDays() {
    const today = new Date();
    const days = [];
    
    // Get last Sunday (start of the week)
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    sunday.setHours(0, 0, 0, 0);
    
    // Generate days from Sunday to Saturday
    for (let i = 0; i < 7; i++) {
      const current = new Date(sunday);
      current.setDate(sunday.getDate() + i);
      days.push({
        date: current.toLocaleDateString('en-CA'), // YYYY-MM-DD format
        dayName: current.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: current.getDate(),
        isToday: current.toLocaleDateString() === today.toLocaleDateString()
      });
    }
    return days;
  }

  function generatePrayerGrid() {
    const days = getCurrentWeekDays();
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const grid = [];

    prayers.forEach(prayer => {
      const row = {
        name: prayer,
        icon: $prayerTimesStore.find(p => p.name === prayer)?.icon || 'Sun',
        weight: $prayerTimesStore.find(p => p.name === prayer)?.weight || 'regular',
        days: days.map(day => {
          const prayerRecord = $prayerHistoryStore.history.find(
            h => h.date === day.date && h.prayerName === prayer
          );
          return {
            date: day.date,
            status: prayerRecord?.status || 'pending',
            isToday: day.isToday
          };
        })
      };
      grid.push(row);
    });

    return { days, grid };
  }

  onMount(async () => {
    await getPrayerHistory();
  });

  $: if ($prayerHistoryStore.history) {
    const gridData = generatePrayerGrid();
    weeklyGrid = gridData.grid;
  }
</script>

<div class="prayer-history">
  <h3>Weekly Prayer History</h3>
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
          <svelte:component this={iconMap[row.icon]} size={18} weight={row.weight} />
          <span>{row.name}</span>
        </div>
        {#each row.days as day}
          <div class="status-cell">
            <div class="status-dot {day.status}"></div>
          </div>
        {/each}
      </div>
    {/each}
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
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 1.5rem;
  }

  h3 {
    font-size: 1.25rem;
    color: #216974;
    margin-bottom: 1.5rem;
  }

  .history-grid {
    width: 100%;
    overflow-x: auto;
  }

  .header-row {
    display: grid;
    grid-template-columns: 120px repeat(7, 1fr);
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
  }

  .day-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .day-column.today {
    color: #216974;
    font-weight: 500;
  }

  .day-name {
    font-size: 0.875rem;
    color: #666;
  }

  .day-number {
    font-size: 1rem;
  }

  .prayer-row {
    display: grid;
    grid-template-columns: 120px repeat(7, 1fr);
    gap: 0.5rem;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid #f5f5f5;
  }

  .prayer-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #216974;
    font-weight: 500;
  }

  .status-cell {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .status-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #eee;
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
    border: 2px solid #eee;
  }

  .legend {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #666;
  }

  .legend-item .status-dot {
    width: 12px;
    height: 12px;
  }
</style>
