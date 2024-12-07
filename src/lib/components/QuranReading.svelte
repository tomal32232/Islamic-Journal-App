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
    
    setTimeout(() => {
      const verseElement = document.getElementById(`verse-${verseNumber}`);
      if (verseElement) {
        const containerHeight = versesContainer.offsetHeight;
        const verseTop = verseElement.offsetTop;
        const verseHeight = verseElement.offsetHeight;
        
        // Use the same offset for consistency
        const offset = 80;
        const scrollPosition = verseTop - (containerHeight / 2) + (verseHeight / 2) + offset;
        
        versesContainer.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }, 100);
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
      setTimeout(() => {
        const containerHeight = versesContainer.offsetHeight;
        const verseTop = verseElement.offsetTop;
        const verseHeight = verseElement.offsetHeight;
        
        // Adjust the offset to move the verse down
        const offset = 40; // Increase this value to move down, decrease to move up
        const scrollPosition = verseTop - (containerHeight / 2) + (verseHeight / 2) + offset;
        
        versesContainer.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }, 100);
    }
  }
</script>

<div class="quran-container">
  <div class="header-section">
    <div class="controls-section">
      <div class="select-wrapper">
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

      <div class="reciter-controls">
        <div class="select-wrapper">
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
        </div>
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

  <div class="reading-section">
    {#if loading}
      <div class="loading">Loading...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else if currentSurahDetails}
      <div class="surah-content">
        <div class="sticky-header">
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
    padding: 1rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .header-section {
    background: #fff;
    padding: 1rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 1rem;
  }

  .controls-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .sticky-header {
    position: sticky;
    top: 48px; /* Height of the tabs + padding */
    z-index: 10;
    background: white;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #eee;
    margin: -1rem -1rem 1rem -1rem;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.95);
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }

  .select-wrapper {
    position: relative;
    flex: 1;
  }

  .select-wrapper::after {
    content: '';
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid #216974;
    pointer-events: none;
  }

  .reciter-controls {
    display: flex;
    gap: 0.75rem;
  }

  .surah-select,
  .reciter-select {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 0.875rem;
    color: #216974;
    background: white;
    appearance: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .surah-select:hover,
  .reciter-select:hover {
    border-color: #216974;
  }

  .surah-select:focus,
  .reciter-select:focus {
    outline: none;
    border-color: #216974;
    box-shadow: 0 0 0 2px rgba(33, 105, 116, 0.1);
  }

  .auto-play-toggle {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    width: 42px;
    height: 42px;
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

  h3 {
    font-size: 1.125rem;
    color: #216974;
    margin: 0;
    font-weight: 500;
  }

  @media (min-width: 640px) {
    .controls-section {
      flex-direction: row;
      align-items: center;
    }
  }

  @media (max-width: 640px) {
    .quran-container {
      padding: 0.5rem;
    }

    .header-section {
      padding: 0.75rem;
    }

    .surah-select,
    .reciter-select {
      padding: 0.625rem 0.875rem;
      font-size: 0.8125rem;
    }

    .auto-play-toggle {
      width: 38px;
      height: 38px;
    }

    .sticky-header {
      padding: 0.5rem 0.75rem;
      top: 44px; /* Adjusted for smaller tabs on mobile */
    }

    h3 {
      font-size: 1rem;
    }
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

  .verses-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: calc(100vh - 280px);
    overflow-y: auto;
    padding: 1rem;
    padding-top: calc(50vh - 140px);
    padding-bottom: calc(50vh - 140px);
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
</style> 