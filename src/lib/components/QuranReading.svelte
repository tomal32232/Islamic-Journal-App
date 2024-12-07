<script>
  import { onMount } from 'svelte';
  
  let currentSurah = null;
  let currentVerse = null;
  let bookmarkedVerses = [];
  
  onMount(() => {
    // Load bookmarked verses from localStorage
    const savedBookmarks = localStorage.getItem('quranBookmarks');
    if (savedBookmarks) {
      bookmarkedVerses = JSON.parse(savedBookmarks);
    }
  });
</script>

<div class="quran-container">
  <div class="quran-header">
    <h2>Quran Reading</h2>
    <p class="subtitle">Track your daily Quran reading progress</p>
  </div>

  <div class="reading-section">
    <div class="current-reading">
      <h3>Continue Reading</h3>
      {#if currentSurah && currentVerse}
        <div class="current-verse">
          <span class="surah-name">Surah {currentSurah}</span>
          <span class="verse-number">Verse {currentVerse}</span>
        </div>
      {:else}
        <p class="no-reading">Start your Quran reading journey</p>
      {/if}
    </div>

    <div class="bookmarks-section">
      <h3>Bookmarked Verses</h3>
      {#if bookmarkedVerses.length > 0}
        <div class="bookmarks-list">
          {#each bookmarkedVerses as bookmark}
            <div class="bookmark-item">
              <span class="surah-name">{bookmark.surah}</span>
              <span class="verse-number">Verse {bookmark.verse}</span>
            </div>
          {/each}
        </div>
      {:else}
        <p class="no-bookmarks">No bookmarked verses yet</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .quran-container {
    padding: 1rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .quran-header {
    margin-bottom: 2rem;
    text-align: center;
  }

  h2 {
    font-size: 1.5rem;
    color: #216974;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .subtitle {
    color: #666;
    font-size: 0.875rem;
  }

  .reading-section {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  h3 {
    font-size: 1.125rem;
    color: #216974;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .current-reading {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .current-verse {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: #f8f8f8;
    border-radius: 8px;
  }

  .no-reading {
    color: #666;
    text-align: center;
    padding: 1rem;
    background: #f8f8f8;
    border-radius: 8px;
  }

  .bookmarks-section {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .bookmarks-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .bookmark-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f8f8f8;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .bookmark-item:hover {
    background: #eee;
  }

  .surah-name {
    font-weight: 500;
    color: #216974;
  }

  .verse-number {
    font-size: 0.875rem;
    color: #666;
  }

  .no-bookmarks {
    color: #666;
    text-align: center;
    padding: 1rem;
    background: #f8f8f8;
    border-radius: 8px;
  }

  @media (max-width: 640px) {
    .quran-container {
      padding: 0.5rem;
    }

    h2 {
      font-size: 1.25rem;
    }

    h3 {
      font-size: 1rem;
    }

    .current-reading,
    .bookmarks-section {
      padding: 1rem;
    }
  }
</style> 