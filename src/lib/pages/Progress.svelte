<script>
  import { prayerHistoryStore } from '../stores/prayerHistoryStore';
  import { weeklyStatsStore } from '../stores/tasbihStore';
  import { ArrowLeft, Mosque, Book, HandsPraying } from 'phosphor-svelte';
  import { currentPage } from '../stores/pageStore';
  import { onMount } from 'svelte';
  import { getTodayReadingTime } from '../services/readingTimeService';

  let prayerStats = { onTime: 0, late: 0, missed: 0, total: 0 };
  let todayReadingTime = 0;
  let todayDhikrCount = 0;
  let selectedTab = 'prayers';

  // Calculate prayer statistics when prayerHistoryStore changes
  $: if ($prayerHistoryStore?.history) {
    const allPrayers = $prayerHistoryStore.history;
    const today = new Date().toLocaleDateString('en-CA');
    
    const onTime = allPrayers.filter(p => p.status === 'ontime').length || 0;
    const late = allPrayers.filter(p => p.status === 'late').length || 0;
    const missed = allPrayers.filter(p => p.status === 'missed').length || 0;
    
    prayerStats = {
      onTime,
      late,
      missed,
      total: onTime + late + missed
    };
  }

  // Update today's dhikr count
  $: if ($weeklyStatsStore?.dailyCounts?.length > 0) {
    const today = $weeklyStatsStore.dailyCounts.find(d => d.isToday);
    todayDhikrCount = today?.count || 0;
  }

  onMount(async () => {
    todayReadingTime = await getTodayReadingTime();
  });

  function goBack() {
    currentPage.set('profile');
  }
</script>

<div class="progress-page">
  <header>
    <button class="back-button" on:click={goBack}>
      <ArrowLeft weight="bold" />
    </button>
    <h1>Your Progress</h1>
  </header>

  <div class="stats-overview">
    <div class="stat-card">
      <div class="stat-icon prayers">
        <Mosque weight="fill" />
      </div>
      <div class="stat-content">
        <span class="stat-value">{prayerStats.onTime}</span>
        <span class="stat-label">Prayers on time</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon reading">
        <Book weight="fill" />
      </div>
      <div class="stat-content">
        <span class="stat-value">{Math.floor(todayReadingTime / 60)}</span>
        <span class="stat-label">Minutes read</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon dhikr">
        <HandsPraying weight="fill" />
      </div>
      <div class="stat-content">
        <span class="stat-value">{todayDhikrCount}</span>
        <span class="stat-label">Dhikr today</span>
      </div>
    </div>
  </div>

  <div class="tabs">
    <button 
      class="tab-button" 
      class:active={selectedTab === 'prayers'}
      on:click={() => selectedTab = 'prayers'}
    >
      Prayers
    </button>
    <button 
      class="tab-button" 
      class:active={selectedTab === 'reading'}
      on:click={() => selectedTab = 'reading'}
    >
      Reading
    </button>
    <button 
      class="tab-button" 
      class:active={selectedTab === 'dhikr'}
      on:click={() => selectedTab = 'dhikr'}
    >
      Dhikr
    </button>
  </div>

  <div class="tab-content">
    {#if selectedTab === 'prayers'}
      <div class="prayer-stats">
        <div class="stat-row">
          <span class="stat-label">On Time</span>
          <div class="stat-details">
            <span class="stat-number on-time">{prayerStats.onTime}</span>
            <span class="stat-percentage">
              {prayerStats.total ? Math.round((prayerStats.onTime / prayerStats.total) * 100) : 0}%
            </span>
          </div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-row">
          <span class="stat-label">Late</span>
          <div class="stat-details">
            <span class="stat-number late">{prayerStats.late}</span>
            <span class="stat-percentage">
              {prayerStats.total ? Math.round((prayerStats.late / prayerStats.total) * 100) : 0}%
            </span>
          </div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-row">
          <span class="stat-label">Missed</span>
          <div class="stat-details">
            <span class="stat-number missed">{prayerStats.missed}</span>
            <span class="stat-percentage">
              {prayerStats.total ? Math.round((prayerStats.missed / prayerStats.total) * 100) : 0}%
            </span>
          </div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-row total">
          <span class="stat-label">Total Prayers</span>
          <span class="stat-number">{prayerStats.total}</span>
        </div>
      </div>
    {:else if selectedTab === 'reading'}
      <div class="reading-stats">
        <div class="stat-row">
          <span class="stat-label">Today's Reading</span>
          <span class="stat-number">{Math.floor(todayReadingTime / 60)} minutes</span>
        </div>
        <!-- Add more reading statistics here -->
      </div>
    {:else if selectedTab === 'dhikr'}
      <div class="dhikr-stats">
        <div class="stat-row">
          <span class="stat-label">Today's Dhikr</span>
          <span class="stat-number">{todayDhikrCount}</span>
        </div>
        <!-- Add more dhikr statistics here -->
      </div>
    {/if}
  </div>
</div>

<style>
  .progress-page {
    height: 100%;
    background: #f8f9fa;
    padding: 1rem;
  }

  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .back-button {
    background: none;
    border: none;
    color: #216974;
    padding: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .back-button:hover {
    background: rgba(33, 105, 116, 0.1);
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #212529;
    margin: 0;
  }

  .stats-overview {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .stat-icon.prayers {
    background: #216974;
  }

  .stat-icon.reading {
    background: #E09453;
  }

  .stat-icon.dhikr {
    background: #4CAF50;
  }

  .stat-content {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 600;
    color: #212529;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6c757d;
  }

  .tabs {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }

  .tab-button {
    background: none;
    border: none;
    padding: 0.75rem 1rem;
    color: #6c757d;
    font-weight: 500;
    cursor: pointer;
    position: relative;
  }

  .tab-button.active {
    color: #216974;
  }

  .tab-button.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: #216974;
  }

  .tab-content {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
  }

  .stat-details {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .stat-number {
    font-weight: 500;
    font-size: 1.1rem;
  }

  .stat-number.on-time {
    color: #216974;
  }

  .stat-number.late {
    color: #E09453;
  }

  .stat-number.missed {
    color: #ef4444;
  }

  .stat-percentage {
    color: #6c757d;
    font-size: 0.875rem;
    min-width: 3rem;
    text-align: right;
  }

  .stat-divider {
    height: 1px;
    background: rgba(0, 0, 0, 0.1);
  }

  .stat-row.total {
    font-weight: 600;
  }

  .stat-row.total .stat-label {
    color: #216974;
  }

  .stat-row.total .stat-number {
    color: #216974;
    font-size: 1.2rem;
  }

  @media (max-width: 480px) {
    .stats-overview {
      grid-template-columns: repeat(2, 1fr);
    }

    .stat-card:last-child {
      grid-column: span 2;
    }
  }
</style> 