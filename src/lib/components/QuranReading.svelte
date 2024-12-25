<script>
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { quranStore, fetchSurahList, fetchSurahDetails, saveReadingProgress, loadReadingProgress, saveBookmark, removeBookmark, loadBookmarks, playAudio, pauseAudio, setReciter, RECITERS, toggleAutoPlay } from '../services/quranService';
  import { startReadingSession, endReadingSession } from '../services/readingTimeService';
  import { BookmarkSimple, Play, Pause, SpeakerHigh, Repeat, Star } from 'phosphor-svelte';
  import { getBookmarks, saveBookmark as saveFirebaseBookmark, removeBookmark as removeFirebaseBookmark, bookmarksStore } from '../services/bookmarkService';
  import { addFavorite, removeFavorite, getFavorites, isFavorite, favoritesStore } from '../services/favoriteService';
  
  let selectedSurah = null;
  let selectedReciter = RECITERS[0].id;
  let versesContainer;
  let currentSessionId = null;
  let selectedBookmark = null;
  
  // Subscribe to quranStore
  $: ({ currentSurah, currentVerse, surahList, currentSurahDetails, loading, error, audioPlaying, autoPlay } = $quranStore);

  // Subscribe to favorites and bookmarks stores
  $: favoriteVerses = $favoritesStore;
  $: bookmarkedVerses = $bookmarksStore;

  async function handleSurahSelect(event) {
    const surahNumber = parseInt(event.target.value);
    if (surahNumber) {
      // End previous reading session if exists
      if (currentSessionId) {
        await endReadingSession(currentSessionId);
        currentSessionId = null;
      }

      // Reset current verse when changing surah
      quranStore.update(s => ({ ...s, currentVerse: null }));
      await fetchSurahDetails(surahNumber);
      selectedSurah = surahNumber;

      // Get the current state after fetching details
      const state = get(quranStore);
      if (state.currentSurahDetails) {
        currentSessionId = await startReadingSession(
          surahNumber,
          state.currentSurahDetails.englishName
        );
      }
    }
  }

  async function handleBookmarkSelect(event) {
    const value = event.target.value;
    if (!value) return;
    
    const [surahNumber, verseNumber] = value.split('-').map(Number);
    selectedSurah = surahNumber;
    await fetchSurahDetails(surahNumber);
    quranStore.update(s => ({ ...s, currentVerse: verseNumber }));
    handleVerseClick(verseNumber);
    selectedBookmark = null;
    event.target.value = '';
  }

  function handleVerseClick(verseNumber) {
    // Toggle verse selection - if clicking the same verse, deselect it
    if (currentVerse === verseNumber) {
      quranStore.update(s => ({ ...s, currentVerse: null }));
      return;
    }
    
    quranStore.update(s => ({ ...s, currentVerse: verseNumber }));
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

  async function toggleBookmark(verseNumber) {
    const surahName = currentSurahDetails?.englishName;
    const verseText = currentSurahDetails?.verses[verseNumber - 1]?.arabic;
    const exists = isVerseBookmarked(verseNumber);
    
    try {
      console.log('Toggling bookmark for verse:', verseNumber, 'Current state:', exists);
      
      if (exists) {
        await removeFirebaseBookmark(selectedSurah, verseNumber);
      } else {
        await saveFirebaseBookmark(selectedSurah, verseNumber, surahName, verseText);
      }
      
      // Update verse selection state
      if (exists) {
        // If we're removing the bookmark from the current verse, deselect it
        if (currentVerse === verseNumber) {
          quranStore.update(s => ({ ...s, currentVerse: null }));
        }
      } else {
        // When adding a bookmark, select the verse
        quranStore.update(s => ({ ...s, currentVerse: verseNumber }));
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  }

  function isVerseBookmarked(verseNumber) {
    return bookmarkedVerses?.some(b => 
      parseInt(b.surahNumber) === parseInt(selectedSurah) && 
      parseInt(b.verseNumber) === parseInt(verseNumber)
    ) || false;
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

  function isVerseFavorite(verseNumber) {
    return favoriteVerses?.some(f => 
      parseInt(f.surahNumber) === parseInt(selectedSurah) && 
      parseInt(f.verseNumber) === parseInt(verseNumber)
    ) || false;
  }

  async function toggleFavorite(verseNumber) {
    const surahName = currentSurahDetails?.englishName;
    const verseText = currentSurahDetails?.verses[verseNumber - 1]?.arabic;
    const exists = isVerseFavorite(verseNumber);
    
    try {
      console.log('Toggling favorite for verse:', verseNumber, 'Current state:', exists);
      
      if (exists) {
        await removeFavorite(selectedSurah, verseNumber);
      } else {
        await addFavorite(selectedSurah, verseNumber, surahName, verseText);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  onMount(async () => {
    // Load surah list
    await fetchSurahList();
    
    // Load reading progress
    const progress = loadReadingProgress();
    if (progress) {
      selectedSurah = progress.surah;
      await fetchSurahDetails(progress.surah);
      
      // Get the current state after fetching details
      const state = get(quranStore);
      if (state.currentSurahDetails) {
        currentSessionId = await startReadingSession(
          progress.surah,
          state.currentSurahDetails.englishName
        );
      }
    }
    
    // Load bookmarks from Firebase
    try {
      bookmarkedVerses = await getBookmarks();
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
    
    // Load favorites from Firebase
    try {
      await getFavorites();
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  });

  // End reading session when component is destroyed
  onDestroy(async () => {
    if (currentSessionId) {
      await endReadingSession(currentSessionId);
    }
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

      <div class="select-wrapper">
        <select 
          class="bookmark-select" 
          on:change={handleBookmarkSelect}
          disabled={loading}
        >
          <option value="" disabled selected>Go to Bookmark</option>
          {#if bookmarkedVerses.length === 0}
            <option value="" disabled>No bookmarks available</option>
          {:else}
            {#each bookmarkedVerses as bookmark}
              <option value="{bookmark.surahNumber}-{bookmark.verseNumber}">
                {bookmark.surahName} - Verse {bookmark.verseNumber}
              </option>
            {/each}
          {/if}
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
              class="verse-card {verse.number === currentVerse && selectedSurah === currentSurah ? 'current' : ''}"
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
                  <button 
                    class="favorite-button {isVerseFavorite(verse.number) ? 'active' : ''}"
                    on:click|stopPropagation={() => toggleFavorite(verse.number)}
                  >
                    <Star
                      size={20}
                      weight={isVerseFavorite(verse.number) ? "fill" : "regular"}
                      class="verse-icon favorite-icon"
                      style={isVerseFavorite(verse.number) ? "color: #D4AF37;" : ""}
                      on:click={() => toggleFavorite(verse.number)}
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
                selectedSurah = bookmark.surahNumber;
                await fetchSurahDetails(bookmark.surahNumber);
                handleVerseClick(bookmark.verseNumber);
              }}
            >
              <div class="bookmark-info">
                <span class="surah-name">{bookmark.surahName}</span>
                <span class="verse-number">Verse {bookmark.verseNumber}</span>
              </div>
              <button 
                class="remove-bookmark"
                on:click|stopPropagation={async (event) => {
                  event.preventDefault();
                  try {
                    await removeFirebaseBookmark(bookmark.surahNumber, bookmark.verseNumber);
                    // Refresh bookmarks list
                    bookmarkedVerses = await getBookmarks();
                  } catch (error) {
                    console.error('Error removing bookmark:', error);
                  }
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
    top: 48px;
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
    width: 100%;
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
    align-items: center;
  }

  .surah-select,
  .reciter-select,
  .bookmark-select {
    width: 100%;
    padding: 0.75rem 2rem 0.75rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background-color: white;
    font-size: 0.875rem;
    color: #1a202c;
    cursor: pointer;
    transition: all 0.2s ease;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }

  .surah-select:hover,
  .reciter-select:hover,
  .bookmark-select:hover {
    border-color: #216974;
  }

  .surah-select:focus,
  .reciter-select:focus,
  .bookmark-select:focus {
    outline: none;
    border-color: #216974;
    box-shadow: 0 0 0 2px rgba(33, 105, 116, 0.1);
  }

  .surah-select:disabled,
  .reciter-select:disabled,
  .bookmark-select:disabled {
    background-color: #f7fafc;
    cursor: not-allowed;
    opacity: 0.7;
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
      align-items: stretch;
      gap: 1rem;
    }

    .select-wrapper {
      flex: 1;
      min-width: 0;
    }

    .reciter-controls {
      width: auto;
      flex: 0 0 auto;
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
    .reciter-select,
    .bookmark-select {
      padding: 0.625rem 2rem 0.625rem 0.875rem;
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
  .bookmark-button,
  .favorite-button {
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

  .bookmark-button:hover {
    color: #E09453;
  }

  .bookmark-button.active {
    color: #E09453 !important;
  }

  .favorite-button:hover {
    color: #FFD700;
  }

  .favorite-button.active {
    color: #FFD700 !important;
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