<script>
  import { onMount } from 'svelte';
  import { quranStore, fetchSurahList, fetchSurahDetails, saveReadingProgress, loadReadingProgress, saveBookmark, removeBookmark, loadBookmarks } from '../services/quranService';
  import { BookmarkSimple } from 'phosphor-svelte';
  
  let selectedSurah = null;
  let bookmarkedVerses = [];
  
  // Subscribe to quranStore
  $: ({ currentSurah, currentVerse, surahList, currentSurahDetails, loading, error } = $quranStore);

  async function handleSurahSelect(event) {
    const surahNumber = parseInt(event.target.value);
    if (surahNumber) {
      await fetchSurahDetails(surahNumber);
      selectedSurah = surahNumber;
    }
  }

  function handleVerseClick(verseNumber) {
    saveReadingProgress(selectedSurah, verseNumber);
  }

  function toggleBookmark(verseNumber) {
    const surahName = currentSurahDetails?.englishName;
    const exists = bookmarkedVerses.some(b => b.surah === selectedSurah && b.verse === verseNumber);
    
    if (exists) {
      bookmarkedVerses = removeBookmark(selectedSurah, verseNumber);
    } else {
      bookmarkedVerses = saveBookmark(selectedSurah, verseNumber, surahName);
    }
  }

  function isVerseBookmarked(verseNumber) {
    return bookmarkedVerses.some(b => b.surah === selectedSurah && b.verse === verseNumber);
  }

  onMount(async () => {
    // Load surah list
    await fetchSurahList();
    
    // Load reading progress
    const progress = loadReadingProgress();
    if (progress) {
      selectedSurah = progress.surah;
      await fetchSurahDetails(progress.surah);
    }
    
    // Load bookmarks
    bookmarkedVerses = loadBookmarks();
  });
</script>

<div class="quran-container">
  <div class="quran-header">
    <h2>Quran Reading</h2>
    <p class="subtitle">Read, reflect, and track your progress</p>
  </div>

  <div class="reading-section">
    <div class="surah-selector">
      <h3>Select Surah</h3>
      <select 
        class="surah-select" 
        value={selectedSurah} 
        on:change={handleSurahSelect}
        disabled={loading}
      >
        <option value="">Select a Surah</option>
        {#each surahList as surah}
          <option value={surah.number}>
            {surah.number}. {surah.englishName} ({surah.name})
          </option>
        {/each}
      </select>
    </div>

    {#if loading}
      <div class="loading">Loading...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else if currentSurahDetails}
      <div class="surah-content">
        <div class="surah-header">
          <h3>{currentSurahDetails.englishName} ({currentSurahDetails.name})</h3>
          {#if currentVerse}
            <div class="current-verse-indicator">
              Currently at: Verse {currentVerse}
            </div>
          {/if}
        </div>

        <div class="verses-container">
          {#each currentSurahDetails.verses as verse}
            <div 
              class="verse-card {verse.number === currentVerse ? 'current' : ''}"
              on:click={() => handleVerseClick(verse.number)}
            >
              <div class="verse-header">
                <span class="verse-number">Verse {verse.number}</span>
                <button 
                  class="bookmark-button {isVerseBookmarked(verse.number) ? 'active' : ''}"
                  on:click|stopPropagation={() => toggleBookmark(verse.number)}
                >
                  <BookmarkSimple 
                    size={20} 
                    weight={isVerseBookmarked(verse.number) ? "fill" : "regular"}
                  />
                </button>
              </div>
              <div class="verse-text arabic">{verse.arabic}</div>
              <div class="verse-text translation">{verse.translation}</div>
            </div>
          {/each}
        </div>
      </div>
    {:else if !selectedSurah}
      <div class="empty-state">
        <p>Select a Surah to start reading</p>
      </div>
    {/if}

    <div class="bookmarks-section">
      <h3>Bookmarked Verses</h3>
      {#if bookmarkedVerses.length > 0}
        <div class="bookmarks-list">
          {#each bookmarkedVerses as bookmark}
            <div 
              class="bookmark-item"
              on:click={async () => {
                selectedSurah = bookmark.surah;
                await fetchSurahDetails(bookmark.surah);
                handleVerseClick(bookmark.verse);
              }}
            >
              <div class="bookmark-info">
                <span class="surah-name">{bookmark.surahName}</span>
                <span class="verse-number">Verse {bookmark.verse}</span>
              </div>
              <button 
                class="remove-bookmark"
                on:click|stopPropagation={() => {
                  bookmarkedVerses = removeBookmark(bookmark.surah, bookmark.verse);
                }}
              >
                Remove
              </button>
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

  .surah-selector {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .surah-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #eee;
    border-radius: 8px;
    font-size: 1rem;
    color: #216974;
    background: white;
  }

  .surah-content {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .surah-header {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #eee;
  }

  .current-verse-indicator {
    font-size: 0.875rem;
    color: #E09453;
    margin-top: 0.5rem;
  }

  .verses-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .verse-card {
    padding: 1rem;
    background: #f8f8f8;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .verse-card:hover {
    background: #f0f0f0;
  }

  .verse-card.current {
    border: 2px solid #E09453;
    background: rgba(224, 148, 83, 0.05);
  }

  .verse-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .verse-number {
    font-size: 0.875rem;
    color: #666;
  }

  .bookmark-button {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    color: #666;
    transition: all 0.2s ease;
  }

  .bookmark-button.active {
    color: #E09453;
  }

  .verse-text {
    margin-bottom: 0.5rem;
    line-height: 1.6;
  }

  .verse-text.arabic {
    font-size: 1.25rem;
    text-align: right;
    margin-bottom: 1rem;
    font-family: "Traditional Arabic", serif;
  }

  .verse-text.translation {
    font-size: 0.875rem;
    color: #444;
  }

  .loading, .error, .empty-state {
    text-align: center;
    padding: 2rem;
    background: #f8f8f8;
    border-radius: 8px;
    color: #666;
  }

  .error {
    color: #EF4444;
    background: rgba(239, 68, 68, 0.1);
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
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .bookmark-item:hover {
    background: #f0f0f0;
  }

  .bookmark-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .remove-bookmark {
    background: none;
    border: none;
    color: #EF4444;
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
  }

  .remove-bookmark:hover {
    text-decoration: underline;
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

    .surah-selector,
    .surah-content,
    .bookmarks-section {
      padding: 1rem;
    }

    .verse-text.arabic {
      font-size: 1.125rem;
    }

    .verse-text.translation {
      font-size: 0.8125rem;
    }
  }
</style> 