<script>
import { saveExcusedPeriod, getActiveExcusedPeriod, endExcusedPeriod } from '../stores/prayerHistoryStore';
import { getPrayerHistory } from '../stores/prayerHistoryStore';
import { toast } from '../stores/toastStore';
import { onMount } from 'svelte';
import { auth } from '../firebase';

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
      toast.show('Excused period started', 'success');
      await checkActiveExcusedPeriod();
    } else {
      // Ending current period
      if (!activeExcusedPeriod) {
        console.error('No active period found when trying to end');
        toast.show('No active period to end', 'error');
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
      toast.show('Excused period ended', 'success');
      activeExcusedPeriod = null;
      isToggled = false;
    }
  } catch (error) {
    console.error('Error toggling excused period:', error);
    toast.show('Failed to update excused period', 'error');
  } finally {
    isSubmitting = false;
  }
}

async function handleManualSubmit() {
  if (!startDate || !startPrayer || (endDate && !endPrayer)) {
    toast.show('Please fill in all required fields', 'error');
    return;
  }

  if (endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start || (start.getTime() === end.getTime() && prayers.indexOf(endPrayer) < prayers.indexOf(startPrayer))) {
      toast.show('End time cannot be before start time', 'error');
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
    toast.show('Failed to save excused period', 'error');
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
    <label class="toggle-container">
      <span class="toggle-label">I'm on my excused period</span>
      <div class="toggle-wrapper">
        <input 
          type="checkbox"
          checked={isToggled}
          on:change={handleToggle}
          disabled={isSubmitting}
        />
        <div class="toggle-slider"></div>
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
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 1rem;
  }

  h3 {
    color: #216974;
    font-size: 1.25rem;
    margin: 0 0 0.5rem 0;
  }

  .description {
    color: #666;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .toggle-section {
    background: #F8FAFC;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .toggle-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
  }

  .toggle-label {
    font-size: 1rem;
    color: #216974;
    font-weight: 500;
  }

  .toggle-wrapper {
    position: relative;
    width: 50px;
    height: 26px;
  }

  .toggle-wrapper input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #E5E7EB;
    transition: .4s;
    border-radius: 34px;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }

  input:checked + .toggle-slider {
    background-color: #216974;
  }

  input:disabled + .toggle-slider {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input:checked + .toggle-slider:before {
    transform: translateX(24px);
  }

  .status-info {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #E5E7EB;
  }

  .status-info p {
    color: #666;
    font-size: 0.875rem;
    margin: 0;
  }

  .manual-section {
    margin-top: 1rem;
  }

  .manual-button {
    background: none;
    border: 2px solid #216974;
    color: #216974;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .manual-button:hover {
    background: #216974;
    color: white;
  }

  .manual-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .manual-form {
    margin-top: 1rem;
    padding: 1rem;
    background: #F8FAFC;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .datetime-input {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
  }

  label {
    font-size: 0.875rem;
    color: #4B5563;
  }

  input[type="date"], select {
    padding: 0.5rem;
    border: 1px solid #E5E7EB;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  select {
    min-width: 90px;
  }

  .submit-button {
    background: #216974;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .submit-button:hover {
    background: #1a5259;
  }

  .submit-button:disabled {
    background: #94A3B8;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .toggle-container {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .datetime-input {
      grid-template-columns: 1fr;
    }
  }
</style> 