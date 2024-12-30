<script>
  import { onMount } from 'svelte';
  import { favoritesStore, getFavorites, removeFavorite } from '../services/favoriteService';
  import { Book, ArrowLeft, Trash } from 'phosphor-svelte';
  import { currentPage } from '../stores/pageStore';

  let isLoading = false;
  let isDeleting = false;

  // Subscribe to favorites store
  $: favoriteVerses = $favoritesStore || [];

  onMount(async () => {
    isLoading = true;
    await getFavorites();
    isLoading = false;
  });

  async function handleDelete(verse) {
    if (isDeleting) return;
    
    try {
      isDeleting = true;
      await removeFavorite(verse.surahNumber, verse.verseNumber);
    } catch (error) {
      console.error('Error deleting favorite:', error);
    } finally {
      isDeleting = false;
    }
  }

  export let onBack;
</script>

<main class="favorites-container">
  <div class="favorites-content">
    <div class="header">
      <button class="back-button" on:click={onBack}>
        <ArrowLeft weight="bold" />
        Back
      </button>
      <h2>
        <Book weight="fill" />
        Favorite Verses
      </h2>
    </div>

    {#if isLoading}
      <div class="loading-state">Loading favorite verses...</div>
    {:else if favoriteVerses.length === 0}
      <div class="empty-state">
        <p>No favorite verses yet</p>
        <p class="empty-state-subtitle">Mark verses as favorites while reading Quran to see them here</p>
      </div>
    {:else}
      <div class="verses-grid">
        {#each favoriteVerses as verse}
          <div class="verse-card">
            <div class="verse-header">
              <div class="verse-info">
                <span class="surah-name">{verse.surahName}</span>
                <span class="verse-number">Verse {verse.verseNumber}</span>
              </div>
              <button 
                class="delete-button" 
                on:click={() => handleDelete(verse)}
                disabled={isDeleting}
              >
                <Trash weight="bold" />
              </button>
            </div>
            <p class="verse-text arabic">{verse.verseText}</p>
            <p class="verse-text translation">{verse.translation || 'Translation not available'}</p>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</main>

<style>
  .favorites-container {
    padding: 1rem;
    padding-bottom: 64px;
    background: #F8FAFC;
    min-height: 100vh;
    overflow-y: auto;
  }

  .favorites-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    color: #216974;
    font-weight: 500;
    padding: 0.5rem;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .back-button:hover {
    background: rgba(33, 105, 116, 0.1);
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1.25rem;
    color: #216974;
  }

  .verses-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .verse-card {
    background: white;
    padding: 1rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s ease;
  }

  .verse-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }

  .verse-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }

  .verse-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .surah-name {
    font-weight: 500;
    color: #216974;
  }

  .verse-number {
    font-size: 0.875rem;
    color: #666;
  }

  .delete-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #ef4444;
    padding: 0.5rem;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
    opacity: 0.6;
  }

  .delete-button:hover {
    background: rgba(239, 68, 68, 0.1);
    opacity: 1;
  }

  .delete-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .verse-text {
    margin: 0;
    line-height: 1.6;
  }

  .verse-text.arabic {
    font-size: 1.25rem;
    text-align: right;
    margin-bottom: 1rem;
    font-family: "Traditional Arabic", serif;
    direction: rtl;
  }

  .verse-text.translation {
    font-size: 0.875rem;
    color: #444;
  }

  .loading-state {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .empty-state p {
    margin: 0;
    color: #666;
  }

  .empty-state-subtitle {
    margin-top: 0.5rem !important;
    font-size: 0.875rem;
    color: #888;
  }

  @media (max-width: 640px) {
    .favorites-container {
      padding: 0.75rem;
    }

    .verses-grid {
      grid-template-columns: 1fr;
    }

    h2 {
      font-size: 1.125rem;
    }
  }
</style> 