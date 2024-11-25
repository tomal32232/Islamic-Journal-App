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

<button class="notification-icon" on:click={handleClick} aria-label="Notifications">
  <Bell weight="fill" color="#E09453" size={24} />
  {#if pendingCount > 0}
    <span class="badge">{pendingCount}</span>
  {/if}
</button>

<style>
  .notification-icon {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
    background: transparent;
    border: none;
    padding: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
  }

  .notification-icon:hover {
    transform: scale(1.1);
  }

  .badge {
    position: absolute;
    top: 0;
    right: 0;
    background: #E09453;
    color: white;
    border-radius: 50%;
    min-width: 18px;
    height: 18px;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    padding: 0 4px;
  }
</style> 