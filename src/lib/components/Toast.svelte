<script>
import { toast } from '../stores/toastStore';
import { fade } from 'svelte/transition';
import { X } from 'phosphor-svelte';

function getTypeStyles(type) {
  switch (type) {
    case 'success':
      return 'bg-green-50 text-green-800 border-green-200';
    case 'error':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'warning':
      return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    default:
      return 'bg-blue-50 text-blue-800 border-blue-200';
  }
}
</script>

{#if $toast.visible}
  <div 
    class="toast-container"
    transition:fade={{ duration: 200 }}
  >
    <div class="toast {getTypeStyles($toast.type)}">
      <span>{$toast.message}</span>
      <button 
        class="close-button"
        on:click={() => toast.hide()}
      >
        <X size={16} weight="bold" />
      </button>
    </div>
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    width: auto;
    max-width: 90%;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    border: 1px solid;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    pointer-events: auto;
    background: white;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border-radius: 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .close-button:hover {
    opacity: 1;
  }
</style> 