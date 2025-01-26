<script>
  import { ArrowLeft, Bell } from 'phosphor-svelte';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  export let onBack;
  
  const notificationSettings = writable({
    prayerNotifications: true,
    journalNotifications: true
  });

  // Load settings from localStorage on mount
  onMount(() => {
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      notificationSettings.set(JSON.parse(savedSettings));
    }
  });

  // Save settings when they change
  $: if ($notificationSettings) {
    localStorage.setItem('notificationSettings', JSON.stringify($notificationSettings));
  }

  function toggleSetting(setting) {
    notificationSettings.update(settings => ({
      ...settings,
      [setting]: !settings[setting]
    }));
  }
</script>

<div class="notifications-page">
  <header>
    <button class="back-button" on:click={onBack}>
      <ArrowLeft weight="bold" />
    </button>
    <h1>Notifications</h1>
  </header>

  <div class="settings-container">
    <div class="settings-group">
      <h2>Prayer Notifications</h2>
      <div class="setting-item">
        <div class="setting-info">
          <h3>Prayer Time Reminders</h3>
          <p>Get notified when it's time for prayer</p>
        </div>
        <button 
          class="toggle-button" 
          class:active={$notificationSettings.prayerNotifications}
          on:click={() => toggleSetting('prayerNotifications')}
        >
          <div class="toggle-slider"></div>
        </button>
      </div>
    </div>

    <div class="settings-group">
      <h2>Journal Notifications</h2>
      <div class="setting-item">
        <div class="setting-info">
          <h3>Journal Reminders</h3>
          <p>Get reminded to write your morning and evening reflections</p>
        </div>
        <button 
          class="toggle-button" 
          class:active={$notificationSettings.journalNotifications}
          on:click={() => toggleSetting('journalNotifications')}
        >
          <div class="toggle-slider"></div>
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .notifications-page {
    height: 100%;
    background: #f8f9fa;
    padding: 1rem;
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

  .settings-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .settings-group {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .settings-group h2 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #212529;
    margin: 0 0 1rem 0;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .setting-info {
    flex: 1;
    min-width: 0;
    padding-right: 1rem;
  }

  .setting-info h3 {
    font-size: 1rem;
    font-weight: 500;
    color: #212529;
    margin: 0;
  }

  .setting-info p {
    font-size: 0.875rem;
    color: #6c757d;
    margin: 0.25rem 0 0;
  }

  .toggle-button {
    flex-shrink: 0;
    width: 52px;
    height: 28px;
    background: #e9ecef;
    border: none;
    border-radius: 14px;
    padding: 2px;
    cursor: pointer;
    transition: background-color 0.3s;
    position: relative;
  }

  .toggle-button.active {
    background: #216974;
  }

  .toggle-slider {
    width: 24px;
    height: 24px;
    background: white;
    border-radius: 50%;
    transition: transform 0.3s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .toggle-button.active .toggle-slider {
    transform: translateX(24px);
  }
</style> 