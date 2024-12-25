<script>
import { saveExcusedPeriod } from '../stores/prayerHistoryStore';
import { getPrayerHistory } from '../stores/prayerHistoryStore';
import { toast } from '../stores/toastStore';

let startDate = '';
let endDate = '';
let isSubmitting = false;

async function handleSubmit() {
  if (!startDate || !endDate) {
    toast.show('Please select both start and end dates', 'error');
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    toast.show('End date cannot be before start date', 'error');
    return;
  }

  isSubmitting = true;
  try {
    await saveExcusedPeriod(startDate, endDate);
    await getPrayerHistory();
    toast.show('Excused period saved successfully', 'success');
    startDate = '';
    endDate = '';
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
    <div class="date-inputs">
      <div class="input-group">
        <label for="start-date">Start Date</label>
        <input 
          type="date" 
          id="start-date"
          bind:value={startDate}
          max={new Date().toLocaleDateString('en-CA')}
          required
        />
      </div>

      <div class="input-group">
        <label for="end-date">End Date</label>
        <input 
          type="date" 
          id="end-date"
          bind:value={endDate}
          max={new Date().toLocaleDateString('en-CA')}
          required
        />
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

  .date-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 0.875rem;
    color: #4B5563;
  }

  input[type="date"] {
    padding: 0.5rem;
    border: 1px solid #E5E7EB;
    border-radius: 6px;
    font-size: 0.875rem;
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
    .date-inputs {
      grid-template-columns: 1fr;
    }
  }
</style> 