<script lang="ts">
  import { fade } from 'svelte/transition';
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
    onClose(guidance);
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
  <div class="modal-backdrop" on:click={handleClose} transition:fade>
    <div class="modal-content" on:click|stopPropagation>
      <button class="close-button" on:click={handleClose}>×</button>
      
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
        <div class="loading">Loading...</div>
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
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .close-button:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .title {
    font-size: 1.25rem;
    color: #216974;
    margin-bottom: 1.5rem;
    text-align: center;
    font-weight: 500;
  }

  .loading {
    text-align: center;
    color: #666;
    padding: 2rem 0;
  }

  .guidance-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
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
    color: #666;
    padding: 2rem 0;
  }

  @media (max-width: 480px) {
    .modal-content {
      width: 95%;
      padding: 1rem;
    }

    .arabic-text {
      font-size: 1.25rem;
    }
  }
</style> 