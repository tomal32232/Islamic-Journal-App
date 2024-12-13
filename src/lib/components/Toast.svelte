<script>
  import { toastStore } from '../stores/badgeStore';
  import { fly } from 'svelte/transition';
  import { Trophy } from 'phosphor-svelte';
</script>

{#if $toastStore.length > 0}
  <div class="toast-container">
    {#each $toastStore as toast (toast)}
      <div 
        class="toast" 
        class:badge={toast.type === 'badge'}
        transition:fly={{ y: 50, duration: 300 }}
      >
        {#if toast.type === 'badge'}
          <div class="badge-toast">
            <div class="badge-icon">
              <Trophy weight="fill" />
            </div>
            <div class="badge-content">
              <h4>{toast.title}</h4>
              <p>{toast.message}</p>
            </div>
            {#if toast.badge?.image}
              <div class="badge-image">
                {toast.badge.image}
              </div>
            {/if}
          </div>
        {:else}
          <p>{toast.message}</p>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
  }

  .toast {
    background: white;
    color: #216974;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    min-width: 300px;
    max-width: 90vw;
    pointer-events: auto;
  }

  .toast.badge {
    background: #216974;
    color: white;
  }

  .badge-toast {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .badge-icon {
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .badge-content {
    flex: 1;
  }

  .badge-content h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .badge-content p {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    opacity: 0.9;
  }

  .badge-image {
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style> 