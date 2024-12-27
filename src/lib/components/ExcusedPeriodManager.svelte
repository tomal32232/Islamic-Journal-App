<script>
import { saveExcusedPeriod, getActiveExcusedPeriod, endExcusedPeriod } from '../stores/prayerHistoryStore';
import { getPrayerHistory } from '../stores/prayerHistoryStore';
import { toast } from '../stores/toastStore';
import { onMount } from 'svelte';
import { auth } from '../firebase';
import { Spinner } from 'phosphor-svelte';

let isSubmitting = false;
let activeExcusedPeriod = null;
let isToggled = false;
let showManualForm = false;

// Manual form fields
let startDate = '';
let endDate = '';
let startPrayer = 'Fajr';
let endPrayer = 'Isha';

const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

onMount(async () => {
  await checkActiveExcusedPeriod();
});

async function checkActiveExcusedPeriod() {
  activeExcusedPeriod = await getActiveExcusedPeriod();
  isToggled = !!activeExcusedPeriod;
  console.log('Active period:', activeExcusedPeriod);
  console.log('Toggle state:', isToggled);
}

async function handleToggle(event) {
  // Prevent the default toggle behavior
  event.preventDefault();
  
  if (isSubmitting) return;
  
  const newToggleState = !isToggled;
  console.log('Attempting to set toggle to:', newToggleState);
  
  isSubmitting = true;
  try {
    if (newToggleState) {
      // Starting new period
      const now = new Date();
      const today = now.toLocaleDateString('en-CA');
      
      // Find current prayer based on time
      const currentHour = now.getHours();
      let currentPrayer;
      if (currentHour < 5) currentPrayer = 'Fajr';
      else if (currentHour < 13) currentPrayer = 'Dhuhr';
      else if (currentHour < 16) currentPrayer = 'Asr';
      else if (currentHour < 19) currentPrayer = 'Maghrib';
      else currentPrayer = 'Isha';

      console.log('Starting new period from:', today, currentPrayer);
      await saveExcusedPeriod(today, null, currentPrayer, null);
      await getPrayerHistory();
      await checkActiveExcusedPeriod();
      toast.show('Excused period started', 'success');
    } else {
      // Ending current period
      if (!activeExcusedPeriod) {
        console.error('No active period found when trying to end');
        return;
      }

      const now = new Date();
      const today = now.toLocaleDateString('en-CA');
      
      // Find current prayer based on time
      const currentHour = now.getHours();
      let currentPrayer;
      if (currentHour < 5) currentPrayer = 'Fajr';
      else if (currentHour < 13) currentPrayer = 'Dhuhr';
      else if (currentHour < 16) currentPrayer = 'Asr';
      else if (currentHour < 19) currentPrayer = 'Maghrib';
      else currentPrayer = 'Isha';

      console.log('Ending period:', activeExcusedPeriod.id);
      await endExcusedPeriod(activeExcusedPeriod.id, today, currentPrayer);
      await getPrayerHistory();
      await checkActiveExcusedPeriod();
      toast.show('Excused period ended', 'success');
    }
  } catch (error) {
    console.error('Error toggling excused period:', error);
    // Reset toggle state on error by checking the current active period
    await checkActiveExcusedPeriod();
  } finally {
    isSubmitting = false;
  }
}

async function handleManualSubmit() {
  if (!startDate || !startPrayer || (endDate && !endPrayer)) {
    toast.show('Please fill in all required fields', 'success');
    return;
  }

  if (endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start || (start.getTime() === end.getTime() && prayers.indexOf(endPrayer) < prayers.indexOf(startPrayer))) {
      toast.show('End time cannot be before start time', 'success');
      return;
    }
  }

  isSubmitting = true;
  try {
    await saveExcusedPeriod(startDate, endDate || null, startPrayer, endPrayer || null);
    await getPrayerHistory();
    toast.show('Excused period saved successfully', 'success');
    resetManualForm();
    activeExcusedPeriod = await getActiveExcusedPeriod();
    isToggled = !!activeExcusedPeriod;
    showManualForm = false;
  } catch (error) {
    console.error('Error saving excused period:', error);
    await checkActiveExcusedPeriod();
  } finally {
    isSubmitting = false;
  }
}

function resetManualForm() {
  startDate = '';
  endDate = '';
  startPrayer = 'Fajr';
  endPrayer = 'Isha';
}
</script>

<div class="excused-period-manager">
  <h3>Excused Period Manager</h3>
  <p class="description">
    Use this to manage your excused prayer periods. 
    Your prayer streaks and achievements will not be affected during this period.
  </p>

  <div class="toggle-section">
    <label class="toggle-container" class:disabled={isSubmitting}>
      <span class="toggle-label">I'm on my excused period</span>
      <div class="toggle-wrapper">
        <input 
          type="checkbox"
          checked={isToggled}
          on:change={handleToggle}
          disabled={isSubmitting}
        />
        <div class="toggle-slider">
          {#if isSubmitting}
            <div class="loading-spinner">
              <Spinner size={16} weight="bold" />
            </div>
          {/if}
        </div>
      </div>
    </label>

    {#if activeExcusedPeriod}
      <div class="status-info">
        <p>Started: {new Date(activeExcusedPeriod.startDate).toLocaleDateString()} ({activeExcusedPeriod.startPrayer})</p>
      </div>
    {/if}
  </div>

  {#if !isToggled}
    <div class="manual-section">
      <button 
        class="manual-button" 
        on:click={() => showManualForm = !showManualForm}
        disabled={isSubmitting}
      >
        {showManualForm ? 'Hide manual entry' : 'Add time manually'}
      </button>

      {#if showManualForm}
        <form on:submit|preventDefault={handleManualSubmit} class="manual-form">
          <div class="input-group">
            <label>Start Time</label>
            <div class="datetime-input">
              <input 
                type="date" 
                bind:value={startDate}
                max={new Date().toLocaleDateString('en-CA')}
                required
              />
              <select bind:value={startPrayer} required>
                {#each prayers as prayer}
                  <option value={prayer}>{prayer}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="input-group">
            <label>End Time (Optional)</label>
            <div class="datetime-input">
              <input 
                type="date" 
                bind:value={endDate}
                min={startDate}
                max={new Date().toLocaleDateString('en-CA')}
              />
              <select bind:value={endPrayer}>
                {#each prayers as prayer}
                  <option value={prayer}>{prayer}</option>
                {/each}
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            class="submit-button" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Period'}
          </button>
        </form>
      {/if}
    </div>
  {/if}
</div>

<style>
  .excused-period-manager {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    margin-bottom: 1.5rem;
    border: 1px solid #E5E7EB;
  }

  h3 {
    color: #216974;
    font-size: 1.5rem;
    margin: 0 0 0.75rem 0;
    font-weight: 600;
    letter-spacing: -0.025em;
  }

  .description {
    color: #4B5563;
    font-size: 0.9375rem;
    margin-bottom: 2rem;
    line-height: 1.5;
  }

  .toggle-section {
    background: #F8FAFC;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    border: 1px solid #E5E7EB;
    transition: all 0.2s ease;
  }

  .toggle-section:hover {
    border-color: #216974;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .toggle-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    padding: 0.25rem 0;
  }

  .toggle-label {
    font-size: 1.125rem;
    color: #216974;
    font-weight: 500;
  }

  .toggle-wrapper {
    position: relative;
    width: 52px;
    height: 28px;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #E5E7EB;
    transition: .3s ease-in-out;
    border-radius: 34px;
    border: 2px solid transparent;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 4px;
    bottom: 2px;
    background-color: white;
    transition: .3s ease-in-out;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  input:checked + .toggle-slider {
    background-color: #216974;
  }

  input:checked + .toggle-slider:before {
    transform: translateX(24px);
  }

  .status-info {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid #E5E7EB;
  }

  .status-info p {
    color: #4B5563;
    font-size: 0.9375rem;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .manual-section {
    margin-top: 1.5rem;
  }

  .manual-button {
    background: none;
    border: 2px solid #216974;
    color: #216974;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9375rem;
  }

  .manual-button:hover {
    background: #216974;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .manual-form {
    margin-top: 1.5rem;
    padding: 1.5rem;
    background: #F8FAFC;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    border: 1px solid #E5E7EB;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .datetime-input {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.75rem;
  }

  label {
    font-size: 0.9375rem;
    color: #4B5563;
    font-weight: 500;
  }

  input[type="date"], select {
    padding: 0.75rem;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    font-size: 0.9375rem;
    background-color: white;
    transition: all 0.2s ease;
  }

  input[type="date"]:focus, select:focus {
    outline: none;
    border-color: #216974;
    box-shadow: 0 0 0 3px rgba(33, 105, 116, 0.1);
  }

  select {
    min-width: 100px;
    cursor: pointer;
  }

  .submit-button {
    background: #216974;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9375rem;
  }

  .submit-button:hover {
    background: #1a5259;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .toggle-container.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .toggle-container.disabled .toggle-label {
    color: #6B7280;
  }

  .loading-spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }

  @media (max-width: 640px) {
    .excused-period-manager {
      padding: 1.5rem;
    }

    .toggle-container {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .datetime-input {
      grid-template-columns: 1fr;
    }

    .manual-button {
      width: 100%;
    }
  }
</style> 