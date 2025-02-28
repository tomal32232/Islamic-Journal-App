<script>
  import { fade } from 'svelte/transition';
  import { markAsReturningVisitor } from '../stores/userPreferences';

  export let onClose = () => {};

  function handleClose() {
    markAsReturningVisitor();
    onClose();
  }
</script>

<div class="guide-overlay" transition:fade={{ duration: 300 }} on:click={handleClose}>
  <div class="guide-content" on:click|stopPropagation>
    <h2>Welcome to Islamic Journal</h2>
    <p>Track your mood and receive spiritual guidance throughout your day</p>
    
    <div class="guide-items">
      <div class="guide-item">
        <div class="time-indicator morning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" stroke-linecap="round" />
            <path d="M12 20v2" stroke-linecap="round" />
            <path d="M4.93 4.93l1.41 1.41" stroke-linecap="round" />
            <path d="M17.66 17.66l1.41 1.41" stroke-linecap="round" />
            <path d="M2 12h2" stroke-linecap="round" />
            <path d="M20 12h2" stroke-linecap="round" />
            <path d="M6.34 17.66l-1.41 1.41" stroke-linecap="round" />
            <path d="M19.07 4.93l-1.41 1.41" stroke-linecap="round" />
          </svg>
        </div>
        <div class="guide-text">
          <h3>Morning Reflection</h3>
          <p>After Fajr prayer until Dhuhr, reflect on how you want to approach your day</p>
        </div>
      </div>
      
      <div class="guide-item">
        <div class="time-indicator evening">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3a9 9 0 1 0 9 9" />
            <path d="M12 3v9l5.2 3.2" />
            <path d="M21 12h-9" />
          </svg>
        </div>
        <div class="guide-text">
          <h3>Evening Reflection</h3>
          <p>After Maghrib prayer until midnight, reflect on your day and prepare for tomorrow</p>
        </div>
      </div>
    </div>
    
    <button class="start-button" on:click={handleClose}>
      Get Started
    </button>
  </div>
</div>

<style>
  .guide-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
    padding: 1rem;
    box-sizing: border-box;
  }
  
  .guide-content {
    background: white;
    border-radius: 24px;
    padding: 2rem;
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  }
  
  h2 {
    color: #216974;
    font-size: 1.5rem;
    margin: 0 0 0.5rem 0;
  }
  
  p {
    color: #718096;
    font-size: 0.875rem;
    margin: 0 0 2rem 0;
  }
  
  .guide-items {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    margin-bottom: 2rem;
  }
  
  .guide-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    text-align: left;
    padding: 1rem;
    border-radius: 12px;
    background: #f8f9fa;
  }
  
  .time-indicator {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .time-indicator svg {
    width: 1.5rem;
    height: 1.5rem;
  }
  
  .morning {
    background: #FFF8E1;
    color: #F59E0B;
  }
  
  .evening {
    background: #E8F5E9;
    color: #10B981;
  }
  
  .guide-text h3 {
    font-size: 1rem;
    margin: 0 0 0.25rem 0;
    color: #2D3748;
  }
  
  .guide-text p {
    font-size: 0.75rem;
    margin: 0;
    color: #718096;
  }
  
  .start-button {
    background: #216974;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 0.75rem 2rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .start-button:hover {
    background: #184f58;
    transform: translateY(-2px);
  }
  
  @media (max-width: 480px) {
    .guide-content {
      padding: 1.5rem;
    }
    
    .time-indicator {
      width: 2.5rem;
      height: 2.5rem;
    }
  }
</style> 