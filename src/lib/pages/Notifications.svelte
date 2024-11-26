<script>
  import { ArrowLeft } from 'phosphor-svelte';
  import { prayerHistoryStore, savePrayerStatus, getPrayerHistory } from '../stores/prayerHistoryStore';
  import { iconMap } from '../utils/icons';

  export let onBack;

  async function markPrayerStatus(prayer, status) {
    await savePrayerStatus({
      name: prayer.name,
      time: prayer.time,
      status
    });
    
    // Refresh the prayer history after marking
    await getPrayerHistory();
  }
</script>

<div class="notifications-container">
  <header>
    <button class="back-button" on:click={onBack}>
      <ArrowLeft size={24} />
    </button>
    <h1>Pending Actions</h1>
  </header>

  {#if Object.keys($prayerHistoryStore.pendingByDate).length === 0}
    <div class="empty-state">
      No pending actions
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
          <div class="pending-prayer-item">
            <div class="prayer-info">
              <svelte:component 
                this={iconMap[prayer.icon]} 
                size={20} 
                weight={prayer.weight}
              />
              <span>{prayer.name}</span>
              <span class="prayer-time">{prayer.time}</span>
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
    max-width: 600px;
    margin: 0 auto;
  }

  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .back-button {
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    color: #216974;
  }

  h1 {
    font-size: 1.5rem;
    color: #216974;
    margin: 0;
  }

  .empty-state {
    text-align: center;
    color: #666;
    padding: 2rem;
  }

  .date-group {
    background: white;
    border-radius: 8px;
    margin-bottom: 1rem;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  /* Rest of the styles are the same as in Home.svelte */
</style> 