<script>
  import { ArrowLeft } from 'phosphor-svelte';
  import { prayerHistoryStore, savePrayerStatus, getPrayerHistory, updatePrayerStatuses } from '../stores/prayerHistoryStore';
  import { iconMap } from '../utils/icons';
  import { onMount } from 'svelte';

  export let onBack;
  
  let activeTab = 'pending'; // 'pending' or 'missed'

  function getPrayerIcon(prayerName) {
    const iconConfig = {
      'Fajr': { icon: 'SunDim', weight: 'regular' },
      'Dhuhr': { icon: 'Sun', weight: 'fill' },
      'Asr': { icon: 'CloudSun', weight: 'regular' },
      'Maghrib': { icon: 'SunHorizon', weight: 'regular' },
      'Isha': { icon: 'MoonStars', weight: 'regular' }
    };
    return iconConfig[prayerName] || { icon: 'Sun', weight: 'regular' };
  }

  async function markPrayerStatus(prayer, status) {
    console.log('Marking prayer status:', { prayer, status });
    try {
      // First update the UI optimistically
      prayerHistoryStore.update(store => {
        const updatedPendingByDate = { ...store.pendingByDate };
        Object.keys(updatedPendingByDate).forEach(date => {
          updatedPendingByDate[date].prayers = updatedPendingByDate[date].prayers.filter(
            p => p.prayerId !== prayer.prayerId
          );
          if (updatedPendingByDate[date].prayers.length === 0) {
            delete updatedPendingByDate[date];
          }
        });
        return { ...store, pendingByDate: updatedPendingByDate };
      });

      // Then save to database
      await savePrayerStatus({
        name: prayer.prayerName,
        time: prayer.time,
        status
      });
      console.log('Prayer status saved successfully');
      
      // Finally refresh the data
      await getPrayerHistory();
      console.log('Prayer history updated');
    } catch (error) {
      console.error('Error marking prayer status:', error);
      // If there's an error, refresh to get the correct state
      await getPrayerHistory();
    }
  }

  onMount(async () => {
    await updatePrayerStatuses();
    await getPrayerHistory();
  });
</script>

<div class="notifications-container">
  <header>
    <button class="back-button" on:click={onBack}>
      <ArrowLeft size={24} />
    </button>
    <div class="tabs">
      <button 
        class="tab-button {activeTab === 'pending' ? 'active' : ''}"
        on:click={() => activeTab = 'pending'}
      >
        Pending Actions
      </button>
      <button 
        class="tab-button {activeTab === 'missed' ? 'active' : ''}"
        on:click={() => activeTab = 'missed'}
      >
        Missed Prayers
      </button>
    </div>
  </header>

  {#if activeTab === 'pending'}
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
  {:else}
    {#if Object.keys($prayerHistoryStore.missedByDate).length === 0}
      <div class="empty-state">
        <span class="empty-icon">🙏</span>
        <p>No missed prayers</p>
        <p class="subtitle">Keep up the good work!</p>
      </div>
    {:else}
      {#each Object.entries($prayerHistoryStore.missedByDate) as [date, { prayers }]}
        <div class="date-group">
          <div class="date-header">
            {new Date(date).toLocaleDateString('en-US', { 
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
    border-bottom: 1px solid #eee;
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

  .tabs {
    display: flex;
    gap: 1rem;
    margin-left: auto;
  }

  .tab-button {
    background: none;
    border: none;
    padding: 0.5rem 1rem;
    color: #666;
    font-size: 0.875rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab-button.active {
    color: #216974;
    border-bottom-color: #216974;
    font-weight: 500;
  }
</style> 