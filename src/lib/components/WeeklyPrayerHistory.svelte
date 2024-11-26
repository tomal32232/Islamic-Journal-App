<script>
  import { prayerHistoryStore } from '../stores/prayerHistoryStore';
  import { prayerTimesStore } from '../stores/prayerTimes';

  let weeklyStats = [];
  
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
      
      // Get date in YYYY-MM-DD format
      const dateStr = current.toLocaleDateString('en-CA');
      const todayStr = today.toLocaleDateString('en-CA');
      
      const dayPrayers = $prayerHistoryStore.history.filter(h => h.date === dateStr);
      
      // Count both 'missed' status and pending prayers
      const missedCount = dayPrayers.filter(p => p.status === 'missed').length;
      const pendingCount = dayPrayers.filter(p => p.status === 'pending').length;
      
      const stats = {
        date: dateStr,
        isToday: dateStr === todayStr,
        total: $prayerTimesStore.length,
        ontime: dayPrayers.filter(p => p.status === 'ontime').length,
        late: dayPrayers.filter(p => p.status === 'late').length,
        missed: missedCount + pendingCount, // Combine both missed and pending
        weekday: current.toLocaleDateString('en-US', { weekday: 'short' })
      };
      
      days.push(stats);
    }
    return days;
  }

  $: weeklyStats = getCurrentWeekDays();
</script>

<div class="prayer-history">
  <h3>Weekly Prayer History</h3>
  <div class="history-scroll">
    <div class="days-container">
      {#each weeklyStats as day}
        <div class="day-card {day.isToday ? 'current' : ''}">
          <span class="date">
            {day.weekday}
          </span>
          <div class="prayer-counts">
            <span class="count ontime">{day.ontime}</span>
            <span class="count late">{day.late}</span>
            <span class="count missed">{day.missed}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>
  <div class="legend">
    <span class="legend-item ontime">On time</span>
    <span class="legend-item late">Late</span>
    <span class="legend-item missed">Missed</span>
  </div>
</div>

<style>
  .prayer-history {
    margin-top: 1.5rem;
    background: white;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  h3 {
    font-size: 1rem;
    color: #666;
    margin-bottom: 1rem;
  }

  .history-scroll {
    overflow-x: auto;
    margin: 0 -1rem;
    padding: 0 1rem;
    -webkit-overflow-scrolling: touch;
  }

  .days-container {
    display: flex;
    gap: 0.75rem;
    padding-bottom: 0.5rem;
  }

  .day-card {
    min-width: 60px;
    text-align: center;
    padding: 0.75rem 0.5rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .day-card.current {
    background: rgba(224, 148, 83, 0.1);
    border: 1px solid #E09453;
  }

  .date {
    font-size: 0.75rem;
    color: #666;
    display: block;
    margin-bottom: 0.5rem;
  }

  .prayer-counts {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .count {
    font-weight: 500;
    font-size: 1rem;
    padding: 0.25rem;
    border-radius: 4px;
  }

  .count.ontime { color: #216974; }
  .count.late { color: #E09453; }
  .count.missed { color: #ff0000; }

  .legend {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 0.75rem;
    font-size: 0.75rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .legend-item.ontime { color: #216974; }
  .legend-item.late { color: #E09453; }
  .legend-item.missed { color: #ff0000; }
</style>
