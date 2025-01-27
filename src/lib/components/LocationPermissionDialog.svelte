<script>
  import { createEventDispatcher } from 'svelte';
  import { Geolocation } from '@capacitor/geolocation';
  
  const dispatch = createEventDispatcher();
  
  async function handleAllowClick() {
    try {
      const permission = await Geolocation.requestPermissions();
      const wasGranted = permission.location === 'granted' || permission.coarseLocation === 'granted';
      dispatch('permissionResult', wasGranted ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error requesting location permission:', error);
      dispatch('permissionResult', 'denied');
    }
  }
  
  function handleSkipClick() {
    dispatch('permissionResult', 'denied');
  }
</script>

<div class="permission-dialog">
  <div class="dialog-content">
    <div class="icon">📍</div>
    <h2>Enable Location Services</h2>
    <p>We need your location to provide accurate prayer times based on your exact position. This helps ensure you get the right prayer schedule for your area.</p>
    <div class="buttons">
      <button class="allow-btn" on:click={handleAllowClick}>
        Allow Location Access
      </button>
      <button class="skip-btn" on:click={handleSkipClick}>
        Skip for Now
      </button>
    </div>
  </div>
</div>

<style>
  .permission-dialog {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1000;
  }

  .dialog-content {
    background: white;
    padding: 24px;
    border-radius: 12px;
    max-width: 320px;
    width: 100%;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  h2 {
    color: #216974;
    font-size: 20px;
    margin: 0 0 12px 0;
    font-weight: 500;
  }

  p {
    color: #666;
    font-size: 14px;
    line-height: 1.5;
    margin: 0 0 24px 0;
  }

  .buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  button {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .allow-btn {
    background-color: #216974;
    color: white;
  }

  .allow-btn:hover {
    background-color: #1a545d;
  }

  .skip-btn {
    background-color: #f5f5f5;
    color: #666;
  }

  .skip-btn:hover {
    background-color: #e5e5e5;
  }
</style> 