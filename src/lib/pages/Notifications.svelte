<script>
  import { ArrowLeft } from 'phosphor-svelte';
  import { prayerHistoryStore, savePrayerStatus, getPrayerHistory } from '../stores/prayerHistoryStore';
  import { iconMap } from '../utils/icons';

  export let onBack;

  // Helper function to get icon and weight based on prayer name
  function getPrayerIcon(prayerName) {
    const iconConfig = {
      'Fajr': { icon: 'SunDim', weight: 'regular' },
      'Dhuhr': { icon: 'Sun', weight: 'fill' },
      'Asr': { icon: 'CloudSun', weight: 'regular' },
      'Maghrib': { icon: 'SunHorizon', weight: 'regular' },
      'Isha': { icon: 'MoonStars', weight: 'regular' }
    };

    return iconConfig[prayerName] || { icon: 'Sun', weight: 'regular' }; // Default fallback
  }

  async function markPrayerStatus(prayer, status) {
    await savePrayerStatus({
      name: prayer.prayerName,
      time: prayer.time,
      status
    });
    await getPrayerHistory();
  }
</script>

<div class="notifications-container">
  <header>
    <button class="back-button" on:click={onBack}>
      <ArrowLeft size={24} />
    </button>
    <h1>Pending Prayers</h1>
  </header>

  {#if Object.keys($prayerHistoryStore.pendingByDate).length === 0}
    <div class="empty-state">
      <span class="empty-icon">🎉</span>
      <p>All caught up!</p>
      <p class="subtitle">No pending prayers to mark</p>
    </div>
  {:else}
    {#each Object.entries($prayerHistoryStore.pendingByDate) as [date, { isToday, prayers }]}
      <div class="date-group">
        <div class="date-header">
          {isToday ? 'Today' : new Date(date).toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          })}
        </div>
        
        {#each prayers as prayer}
          {@const iconDetails = getPrayerIcon(prayer.prayerName)}
          <div class="prayer-card">
            <div class="prayer-info">
              <div class="icon-wrapper">
                <svelte:component 
                  this={iconMap[iconDetails.icon]} 
                  size={20} 
                  weight={iconDetails.weight}
                  color="#216974"
                />
              </div>
              <div class="prayer-details">
                <span class="prayer-name">{prayer.prayerName}</span>
                <span class="prayer-time">{prayer.time}</span>
              </div>
            </div>
            <div class="prayer-actions">
              <button 
                class="status-button ontime" 
                on:click={() => markPrayerStatus(prayer, 'ontime')}
              >
                On time
              </button>
              <button 
                class="status-button late" 
                on:click={() => markPrayerStatus(prayer, 'late')}
              >
                Late
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/each}
  {/if}
</div>

<style>
  .notifications-container {
    padding: 1rem;
    padding-bottom: 80px;
    max-width: 600px;
    margin: 0 auto;
  }

  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
    position: sticky;
    top: 0;
    background: white;
    padding: 1rem 0;
    z-index: 10;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
    color: #216974;
  }

  .back-button {
    background: transparent;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    color: #216974;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
  }

  .back-button:hover {
    background: rgba(33, 105, 116, 0.1);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #666;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    display: block;
  }

  .empty-state p {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
  }

  .empty-state .subtitle {
    font-size: 0.875rem;
    color: #999;
    margin-top: 0.5rem;
  }

  .date-group {
    margin-bottom: 2rem;
  }

  .date-header {
    font-size: 0.875rem;
    color: #666;
    font-weight: 500;
    margin-bottom: 1rem;
    padding-left: 0.5rem;
  }

  .prayer-card {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    border: 1px solid #eee;
  }

  .prayer-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .icon-wrapper {
    background: rgba(33, 105, 116, 0.1);
    padding: 0.75rem;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .prayer-details {
    flex: 1;
  }

  .prayer-name {
    display: block;
    font-weight: 500;
    color: #216974;
    font-size: 1rem;
  }

  .prayer-time {
    font-size: 0.875rem;
    color: #666;
  }

  .prayer-actions {
    display: flex;
    gap: 0.75rem;
  }

  .status-button {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .status-button.ontime {
    background: #216974;
    color: white;
  }

  .status-button.ontime:hover {
    background: #185761;
  }

  .status-button.late {
    background: #E09453;
    color: white;
  }

  .status-button.late:hover {
    background: #c77f43;
  }

  @media (max-width: 480px) {
    .notifications-container {
      padding: 0.5rem;
    }

    .prayer-card {
      border-radius: 8px;
      padding: 0.875rem;
    }

    .status-button {
      padding: 0.625rem;
    }
  }
</style> 