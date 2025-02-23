<script>
  import { onMount } from 'svelte';
  import Subscription from '../components/Subscription.svelte';
  import { subscriptionStore } from '../services/revenuecat';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  
  function handleBack() {
    dispatch('back');
  }
</script>

<div class="subscription-page">
  <div class="header">
    <button class="back-button" on:click={handleBack}>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
  </div>

  <Subscription />
</div>

<style>
  .subscription-page {
    width: 100%;
    min-height: 100vh;
    background: #F8FAFC;
    padding: 1rem;
  }

  .header {
    display: flex;
    align-items: center;
    margin-bottom: 2rem;
  }

  .back-button {
    background: none;
    border: none;
    padding: 0.5rem;
    color: #1a237e;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
  }

  .back-button:hover {
    background-color: rgba(26, 35, 126, 0.1);
  }
</style> 