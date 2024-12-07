<script>
  import { onMount } from 'svelte';
  import { quranStore, fetchSurahList, fetchSurahDetails, saveReadingProgress, loadReadingProgress, saveBookmark, removeBookmark, loadBookmarks, playAudio, pauseAudio, setReciter, RECITERS, toggleAutoPlay } from '../services/quranService';
  import { BookmarkSimple, Play, Pause, SpeakerHigh, Repeat } from 'phosphor-svelte';
  
  let selectedSurah = null;
  let bookmarkedVerses = [];
  let selectedReciter = RECITERS[0].id;
  let versesContainer;
  
  // Subscribe to quranStore
  $: ({ currentSurah, currentVerse, surahList, currentSurahDetails, loading, error, audioPlaying, autoPlay } = $quranStore);

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

  function handleReciterChange(event) {
    selectedReciter = event.target.value;
    setReciter(selectedReciter);
  }

  function toggleAudio(audioUrl, verseNumber) {
    if (audioPlaying && currentVerse === verseNumber) {
      pauseAudio();
    } else {
      playAudio(audioUrl, verseNumber);
    }
  }

  function handleAutoPlayToggle() {
    toggleAutoPlay();
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

  // Watch for changes in currentVerse and scroll to it
  $: if (currentVerse && versesContainer) {
    const verseElement = document.getElementById(`verse-${currentVerse}`);
    if (verseElement) {
      const containerHeight = versesContainer.offsetHeight;
      const verseTop = verseElement.offsetTop;
      const verseHeight = verseElement.offsetHeight;
      
      // Calculate scroll position to center the verse
      const scrollPosition = verseTop - (containerHeight / 2) + (verseHeight / 2);
      
      versesContainer.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    }
  }
</script>

<div class="quran-container">
  <div class="top-section">
    <div class="quran-header">
      <h2>Quran Reading</h2>
      <div class="controls-section">
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

        <div class="reciter-controls">
          <select 
            class="reciter-select" 
            value={selectedReciter} 
            on:change={handleReciterChange}
            disabled={loading}
          >
            {#each RECITERS as reciter}
              <option value={reciter.id}>{reciter.name}</option>
            {/each}
          </select>
          <button 
            class="auto-play-toggle {autoPlay ? 'active' : ''}"
            on:click={handleAutoPlayToggle}
            title="Auto-play next verse"
          >
            <Repeat size={20} />
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="reading-section">
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
              Verse {currentVerse}
            </div>
          {/if}
        </div>

        <div class="verses-container" bind:this={versesContainer}>
          {#each currentSurahDetails.verses as verse}
            <div 
              id="verse-{verse.number}"
              class="verse-card {verse.number === currentVerse ? 'current' : ''}"
              on:click={() => handleVerseClick(verse.number)}
            >
              <div class="verse-header">
                <span class="verse-number">Verse {verse.number}</span>
                <div class="verse-actions">
                  <button 
                    class="audio-button {audioPlaying && verse.number === currentVerse ? 'playing' : ''}"
                    on:click|stopPropagation={() => toggleAudio(verse.audio, verse.number)}
                  >
                    {#if audioPlaying && verse.number === currentVerse}
                      <Pause size={20} />
                    {:else}
                      <Play size={20} />
                    {/if}
                  </button>
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
    padding: 0.5rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .top-section {
    position: sticky;
    top: 0;
    z-index: 10;
    background: #fff;
    padding: 0.5rem;
    border-bottom: 1px solid #eee;
    margin-bottom: 1rem;
  }

  .quran-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  h2 {
    font-size: 1.25rem;
    color: #216974;
    margin: 0;
    font-weight: 500;
  }

  .controls-section {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 0.5rem;
    align-items: start;
  }

  .reciter-controls {
    display: flex;
    gap: 0.5rem;
  }

  .surah-select,
  .reciter-select {
    padding: 0.5rem;
    border: 1px solid #eee;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #216974;
    background: white;
    height: 36px;
  }

  .auto-play-toggle {
    background: none;
    border: 1px solid #eee;
    border-radius: 6px;
    width: 36px;
    height: 36px;
    padding: 0;
    color: #666;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .auto-play-toggle:hover {
    border-color: #216974;
    color: #216974;
  }

  .auto-play-toggle.active {
    background: #216974;
    border-color: #216974;
    color: white;
  }

  .reading-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .surah-content {
    background: white;
    padding: 1rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .surah-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
  }

  h3 {
    font-size: 1rem;
    color: #216974;
    margin: 0;
    font-weight: 500;
  }

  .current-verse-indicator {
    font-size: 0.875rem;
    color: #E09453;
  }

  .verses-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: calc(100vh - 180px);
    overflow-y: auto;
    padding: 0.5rem;
    scroll-behavior: smooth;
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
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
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

  .verse-actions {
    display: flex;
    gap: 0.25rem;
  }

  .audio-button,
  .bookmark-button {
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: #666;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .audio-button:hover,
  .audio-button.playing {
    color: #216974;
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
    padding: 1rem;
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
    padding: 1rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .bookmarks-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .bookmark-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: #f8f8f8;
    border-radius: 6px;
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
    padding: 0.75rem;
    background: #f8f8f8;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  @media (max-width: 640px) {
    .quran-container {
      padding: 0.25rem;
    }

    .top-section {
      padding: 0.25rem;
    }

    .controls-section {
      grid-template-columns: 1fr;
      gap: 0.25rem;
    }

    .reciter-controls {
      flex-direction: row;
    }

    .surah-select,
    .reciter-select {
      font-size: 0.8125rem;
    }

    .verses-container {
      max-height: calc(100vh - 200px);
    }

    .verse-text.arabic {
      font-size: 1.125rem;
    }

    .verse-text.translation {
      font-size: 0.8125rem;
    }
  }
</style> 