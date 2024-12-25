<script>
import { saveExcusedPeriod } from '../stores/prayerHistoryStore';
import { getPrayerHistory } from '../stores/prayerHistoryStore';
import { toast } from '../stores/toastStore';

let startDate = '';
let endDate = '';
let startPrayer = 'Fajr';
let endPrayer = 'Isha';
let isSubmitting = false;

const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

async function handleSubmit() {
  if (!startDate || !endDate || !startPrayer || !endPrayer) {
    toast.show('Please select all fields', 'error');
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start || (start.getTime() === end.getTime() && prayers.indexOf(endPrayer) < prayers.indexOf(startPrayer))) {
    toast.show('End time cannot be before start time', 'error');
    return;
  }

  isSubmitting = true;
  try {
    await saveExcusedPeriod(startDate, endDate, startPrayer, endPrayer);
    await getPrayerHistory();
    toast.show('Excused period saved successfully', 'success');
    startDate = '';
    endDate = '';
    startPrayer = 'Fajr';
    endPrayer = 'Isha';
  } catch (error) {
    console.error('Error saving excused period:', error);
    toast.show('Failed to save excused period', 'error');
  } finally {
    isSubmitting = false;
  }
}
</script>

<div class="excused-period-manager">
  <h3>Mark Excused Period</h3>
  <p class="description">
    Use this to mark days when you are excused from prayers. 
    Your prayer streaks and achievements will not be affected during this period.
  </p>

  <form on:submit|preventDefault={handleSubmit} class="excused-form">
    <div class="period-inputs">
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
        <label>End Time</label>
        <div class="datetime-input">
          <input 
            type="date" 
            bind:value={endDate}
            max={new Date().toLocaleDateString('en-CA')}
            required
          />
          <select bind:value={endPrayer} required>
            {#each prayers as prayer}
              <option value={prayer}>{prayer}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    <button 
      type="submit" 
      class="submit-button" 
      disabled={isSubmitting}
    >
      {isSubmitting ? 'Saving...' : 'Save Excused Period'}
    </button>
  </form>
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

  .excused-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .period-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
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
    background: white;
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
    .period-inputs {
      grid-template-columns: 1fr;
    }
  }
</style> 