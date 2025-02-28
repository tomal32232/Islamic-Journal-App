<script lang="ts">
  import { db } from '../services/firebase';
  import { collection, query, where, getDocs } from 'firebase/firestore';
  import { onMount } from 'svelte';
  import { fetchMoodGuidance } from '../services/moodGuidanceService';

  interface Mood {
    value: string;
    name: string;
    description: string;
    icon: string;
  }

  interface Guidance {
    id: string;
    mood: string;
    arabicVerse: string;
    translation: string;
    guidance: string;
  }

  export let mood: Mood | null = null;
  export let onClose = () => {};

  let loading = true;
  let guidance: Guidance | null = null;

  async function fetchRandomGuidance() {
    if (!mood) return;
    
    try {
      // First try to refresh guidance data from Google Sheets
      await fetchMoodGuidance();
      
      // Then fetch from Firestore
      const guidanceRef = collection(db, 'moodGuidance');
      const q = query(guidanceRef, where('mood', '==', mood.value));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Get all documents for this mood
        const guidances = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Guidance[];
        // Select a random guidance
        guidance = guidances[Math.floor(Math.random() * guidances.length)];
      }
    } catch (error) {
      console.error('Error fetching guidance:', error);
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    onClose();
  }

  $: if (mood) {
    loading = true;
    fetchRandomGuidance();
  }

  onMount(async () => {
    // Initial fetch of guidance data
    await fetchMoodGuidance();
  });
</script>

{#if mood}
  <div class="modal-backdrop" on:click={handleClose}>
    <div class="modal-content" on:click|stopPropagation>
      <button class="close-button" on:click={handleClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      
      <div class="mood-icon-container">
        <div class="mood-icon">
          {@html mood.icon}
        </div>
      </div>
      
      <h2 class="title">
        {#if mood.value === 'grateful'}
          Express Gratitude
        {:else if mood.value === 'seeking_peace'}
          Find Inner Peace
        {:else if mood.value === 'hopeful'}
          Nurture Hope
        {:else if mood.value === 'anxious'}
          Ease Your Heart
        {:else if mood.value === 'reflecting'}
          Moment of Reflection
        {:else if mood.value === 'blessed'}
          Count Your Blessings
        {/if}
      </h2>

      {#if loading}
        <div class="loading">
          <div class="loading-spinner"></div>
          <span>Loading guidance...</span>
        </div>
      {:else if guidance}
        <div class="guidance-content">
          <div class="arabic-text">{guidance.arabicVerse}</div>
          <div class="translation">{guidance.translation}</div>
          <div class="guidance-text">
            <h3>Guidance</h3>
            <ol class="guidance-list">
              {#each guidance.guidance.split('\n').filter(line => line.trim()) as point}
                <li>{point.replace(/^\d+\.\s*/, '')}</li>
              {/each}
            </ol>
          </div>
        </div>
      {:else}
        <div class="no-content">No guidance available at the moment.</div>
      {/if}
      
      <button class="done-button" on:click={handleClose}>
        Done
      </button>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    padding: 0;
    box-sizing: border-box;
  }

  .modal-content {
    background: white;
    border-radius: 24px 24px 0 0;
    padding: 2rem 1.5rem;
    width: 100%;
    max-width: 100%;
    height: 90vh;
    overflow-y: auto;
    position: absolute;
    bottom: 0;
    box-shadow: 0 -10px 25px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
  }

  .close-button {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    background: none;
    border: none;
    cursor: pointer;
    color: #718096;
    padding: 0.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-button svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .close-button:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .mood-icon-container {
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .mood-icon {
    width: 4rem;
    height: 4rem;
    color: #216974;
    background: rgba(33, 105, 116, 0.1);
    padding: 1.25rem;
    border-radius: 50%;
  }

  .title {
    font-size: 1.5rem;
    color: #216974;
    margin-bottom: 1.5rem;
    text-align: center;
    font-weight: 500;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 0;
    gap: 1rem;
    color: #718096;
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid rgba(33, 105, 116, 0.1);
    border-top-color: #216974;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .guidance-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    flex: 1;
    overflow-y: auto;
  }

  .arabic-text {
    font-family: 'Traditional Arabic', serif;
    font-size: 1.5rem;
    text-align: center;
    color: #2D3748;
    line-height: 1.8;
    direction: rtl;
  }

  .translation {
    font-size: 0.875rem;
    color: #4A5568;
    text-align: center;
    font-style: italic;
    padding: 0 1rem;
  }

  .guidance-text {
    border-top: 1px solid #E2E8F0;
    padding-top: 1rem;
  }

  .guidance-text h3 {
    font-size: 1rem;
    color: #2D3748;
    margin-bottom: 0.75rem;
    font-weight: 500;
  }

  .guidance-list {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.875rem;
    color: #4A5568;
    line-height: 1.6;
  }

  .guidance-list li {
    margin-bottom: 0.5rem;
  }

  .guidance-list li:last-child {
    margin-bottom: 0;
  }

  .no-content {
    text-align: center;
    color: #718096;
    padding: 2rem 0;
  }

  .done-button {
    background: #216974;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 0.75rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 2rem;
  }

  .done-button:hover {
    background: #184f58;
  }

  @media (min-width: 768px) {
    .modal-content {
      max-width: 500px;
      height: auto;
      max-height: 90vh;
      border-radius: 24px;
      bottom: auto;
    }
  }

  @media (max-width: 480px) {
    .modal-content {
      padding: 1.5rem 1rem;
    }

    .arabic-text {
      font-size: 1.25rem;
    }
  }
</style> 