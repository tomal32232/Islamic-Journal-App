<script>
  import { onMount } from 'svelte';
  import { 
    prayerHistoryStore, 
    getPrayerHistory, 
    getPrayerDateTime,
    shouldMarkPrayerExcused 
  } from '../stores/prayerHistoryStore';
  import { prayerTimesStore, fetchPrayerTimes } from '../stores/prayerTimes';
  import { iconMap } from '../utils/icons';
  import { auth } from '../firebase';

  let weeklyGrid = [];
  let weeklyStats = {
    ontime: 0,
    late: 0,
    missed: 0,
    excused: 0
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
    console.log('Generated week days:', days);
    return days;
  }

  async function generatePrayerGrid() {
    const days = getCurrentWeekDays();
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const grid = [];
    
    console.log('\n=== Starting Grid Generation ===');
    console.log('Prayer History Store:', $prayerHistoryStore);
    console.log('Prayer Times Store:', $prayerTimesStore);
    console.log('Days to process:', days);
    
    // Reset weekly stats
    weeklyStats = {
      ontime: 0,
      late: 0,
      missed: 0,
      excused: 0
    };

    // Get the date range for the last 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    console.log('Date range:', { from: sevenDaysAgo.toISOString(), to: today.toISOString() });

    // Get user's account creation date
    const user = auth.currentUser;
    const accountCreationDateTime = new Date(user.metadata.creationTime);
    console.log('Account creation date:', accountCreationDateTime.toISOString());

    for (const prayer of prayers) {
      console.log(`\n=== Processing prayer: ${prayer} ===`);
      const row = {
        name: prayer,
        icon: $prayerTimesStore.find(p => p.name === prayer)?.icon || 'Sun',
        weight: $prayerTimesStore.find(p => p.name === prayer)?.weight || 'regular',
        days: []
      };
      console.log('Row initial data:', row);

      for (const day of days) {
        console.log(`\nChecking ${prayer} for ${day.date}`);
        const prayerRecord = $prayerHistoryStore.history.find(
          h => h.date === day.date && h.prayerName === prayer
        );
        console.log('Found prayer record:', prayerRecord);

        const now = new Date();
        const todayStr = new Date().toLocaleDateString('en-CA');
        const prayerTime = $prayerTimesStore.find(p => p.name === prayer)?.time || '00:00 AM';
        const prayerDateTime = getPrayerDateTime(day.date, prayerTime);
        console.log('Prayer datetime:', prayerDateTime.toISOString());
        
        let status = 'pending';
        const prayerDate = new Date(day.date);
        prayerDate.setHours(0, 0, 0, 0);

        if (prayerRecord) {
          status = prayerRecord.status;
          console.log(`Found record status: ${status}`);
          
          if (prayerDate >= sevenDaysAgo && prayerDate <= today) {
            if (status === 'ontime') weeklyStats.ontime++;
            else if (status === 'late') weeklyStats.late++;
            else if (status === 'missed') weeklyStats.missed++;
            else if (status === 'excused') weeklyStats.excused++;
            console.log('Updated weekly stats:', weeklyStats);
          }
        } else {
          const isExcused = await shouldMarkPrayerExcused(day.date, prayer);
          console.log(`No record found. Checking if excused: ${isExcused}`);
          
          if (isExcused) {
            status = 'excused';
            if (prayerDate >= sevenDaysAgo && prayerDate <= today) {
              weeklyStats.excused++;
            }
          } else if (day.date === todayStr) {
            const currentTime = new Date();
            const prayerData = $prayerTimesStore.find(p => p.name === prayer);
            
            if (!prayerData || !prayerData.time) {
              console.log(`No prayer time data for ${prayer}`);
              status = 'none';
            } else {
              console.log(`Processing ${prayer} - Current: ${currentTime.toISOString()}, Prayer: ${prayerTime}`);
              
              if (currentTime > prayerDateTime) {
                status = 'pending';
                if (!$prayerHistoryStore.pendingByDate[day.date]) {
                  $prayerHistoryStore.pendingByDate[day.date] = { prayers: [] };
                }
                if (!$prayerHistoryStore.pendingByDate[day.date].prayers.some(p => p.prayerName === prayer)) {
                  $prayerHistoryStore.pendingByDate[day.date].prayers.push({
                    prayerName: prayer,
                    time: prayerTime
                  });
                }
                console.log(`${prayer} is past time - marked pending`);
              } else {
                status = 'none';
                console.log(`${prayer} is upcoming - marked none`);
              }
            }
          } else if (day.date < todayStr) {
            if (prayerDateTime >= accountCreationDateTime) {
              status = 'missed';
              if (prayerDate >= sevenDaysAgo) {
                weeklyStats.missed++;
                console.log(`Marked as missed and updated stats`);
              }
            } else {
              status = 'none';
              console.log(`Before account creation - marked none`);
            }
          } else {
            status = 'none';
            console.log(`Future date - marked none`);
          }
        }

        console.log(`Final status for ${prayer} on ${day.date}: ${status}`);
        row.days.push({
          date: day.date,
          status,
          isToday: day.isToday
        });
      }
      grid.push(row);
    }

    console.log('\n=== Grid Generation Complete ===');
    console.log('Final weekly stats:', weeklyStats);
    console.log('Generated grid:', grid);
    return { days, grid, weeklyStats };
  }

  onMount(async () => {
    console.log('\n=== WeeklyPrayerHistory Mounted ===');
    console.log('Fetching initial data...');
    await Promise.all([
      getPrayerHistory(),
      fetchPrayerTimes()
    ]);
    console.log('Initial prayer history:', $prayerHistoryStore);
    console.log('Initial prayer times:', $prayerTimesStore);
    await updateGrid();
  });

  async function updateGrid() {
    console.log('\n=== Updating Grid ===');
    if ($prayerHistoryStore.history) {
      console.log('Prayer history available, generating grid...');
      const gridData = await generatePrayerGrid();
      weeklyGrid = gridData.grid;
      weeklyStats = gridData.weeklyStats;
      console.log('Grid updated successfully');
    } else {
      console.log('No prayer history available');
    }
  }

  $: if ($prayerHistoryStore.history) {
    console.log('\n=== Prayer History Store Changed ===');
    updateGrid();
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
    <div class="stat-item">
      <span class="stat-number">{weeklyStats.excused}</span>
      <span class="stat-label">Excused</span>
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
    <div class="legend-item">
      <div class="status-dot excused"></div>
      <span>Excused</span>
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

  .status-dot.upcoming {
    background: white;
    border: 1.5px solid #216974;
  }

  .status-dot.pending {
    background: white;
    border: 2px solid #216974;
  }

  .status-dot.none {
    background: transparent;
    border-color: #eee;
  }

  .status-dot.excused {
    background: #9CA3AF;
    border-color: #9CA3AF;
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
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    margin: 0.5rem 0;
    font-size: 0.8rem;
    border-radius: 8px;
    background: #f5f5f5;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-number {
    font-weight: 600;
    color: #216974;
  }

  .stat-label {
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
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      padding: 0.5rem;
    }

    .stat-number {
      font-size: 1.25rem;
    }

    .stat-label {
      font-size: 0.75rem;
    }
  }
</style>
