<script>
  import { Bell } from 'phosphor-svelte';
  import { prayerHistoryStore } from '../stores/prayerHistoryStore';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  $: pendingCount = Object.values($prayerHistoryStore.pendingByDate)
    .reduce((total, { prayers }) => total + prayers.length, 0);

  function handleClick() {
    dispatch('click');
  }
</script>

{#if false}
<button class="notification-icon" on:click={handleClick} aria-label="Notifications">
  <Bell weight="fill" color="#E09453" size={24} />
  <span class="badge">{pendingCount}</span>
</button>
{/if}

<style>
  .notification-icon {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
    background: white;
    border: none;
    padding: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .notification-icon:hover {
    transform: scale(1.1);
  }

  .badge {
    position: absolute;
    top: 0;
    right: 0;
    background: rgb(0, 0, 0);
    color: #ffffff;
    border-radius: 999px;
    min-width: 18px;
    height: 18px;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    padding: 0 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
</style> 