import { writable, get } from 'svelte/store';

export const quranStore = writable({
  currentSurah: null,
  currentVerse: null,
  surahList: [],
  currentSurahDetails: null,
  loading: false,
  error: null,
  audioPlaying: false,
  currentAudio: null,
  currentReciter: 'ar.alafasy',
  autoPlay: true,
  completeQuran: null
});

const BASE_URL = 'https://api.alquran.cloud/v1';

// List of available reciters
export const RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' },
  { id: 'ar.abdurrahmaansudais', name: 'Abdul Rahman Al-Sudais' },
  { id: 'ar.hudhaify', name: 'Ali Al-Hudhaify' },
  { id: 'ar.minshawi', name: 'Mohamed Siddiq El-Minshawi' },
  { id: 'ar.muhammadayyoub', name: 'Muhammad Ayyoub' }
];

// Function to fetch and store complete Quran
export async function fetchCompleteQuran() {
  quranStore.update(s => ({ ...s, loading: true, error: null }));

  try {
    // First check if we already have the complete Quran in localStorage
    const cachedQuran = localStorage.getItem('completeQuran');
    if (cachedQuran) {
      const parsedQuran = JSON.parse(cachedQuran);
      quranStore.update(s => ({
        ...s,
        completeQuran: parsedQuran,
        loading: false
      }));
      return parsedQuran;
    }

    // If not in cache, fetch from API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${BASE_URL}/quran/ar.alafasy`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    if (data.code === 200) {
      // Process the data to organize by surah
      const quranData = {};
      data.data.surahs.forEach(surah => {
        quranData[surah.number] = {
          ...surah,
          verses: surah.ayahs.map(ayah => ({
            number: ayah.numberInSurah,
            arabic: ayah.text,
            audio: ayah.audio,
            translation: '' // We'll fetch translations separately
          }))
        };
      });

      // Store in localStorage for future use
      try {
        localStorage.setItem('completeQuran', JSON.stringify(quranData));
      } catch (e) {
        console.warn('Failed to cache complete Quran:', e);
      }
      
      quranStore.update(s => ({
        ...s,
        completeQuran: quranData,
        loading: false
      }));
      
      return quranData;
    } else {
      throw new Error('Failed to fetch complete Quran');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Quran fetch timeout');
      quranStore.update(s => ({
        ...s,
        loading: false,
        error: 'Request timed out. Please check your connection and try again.'
      }));
    } else {
      console.error('Error fetching complete Quran:', error);
      quranStore.update(s => ({
        ...s,
        loading: false,
        error: 'Failed to load Quran data. Please try again.'
      }));
    }
    return null;
  }
}

// Function to fetch translations for a surah
async function fetchTranslations(surahNumber) {
  try {
    // Check cache first
    const cachedTranslations = localStorage.getItem(`translations_${surahNumber}`);
    if (cachedTranslations) {
      return JSON.parse(cachedTranslations);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${BASE_URL}/surah/${surahNumber}/en.sahih`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    if (data.code === 200) {
      const translations = data.data.ayahs.map(ayah => ({
        number: ayah.numberInSurah,
        translation: ayah.text
      }));
      
      // Cache the translations
      try {
        localStorage.setItem(`translations_${surahNumber}`, JSON.stringify(translations));
      } catch (e) {
        console.warn('Failed to cache translations:', e);
      }
      return translations;
    }
    return null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Translations fetch timeout');
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    console.error('Error fetching translations:', error);
    return null;
  }
}

// Modified fetchSurahDetails to use local data when available
export async function fetchSurahDetails(surahNumber) {
  quranStore.update(s => ({ ...s, loading: true, error: null }));

  try {
    const state = get(quranStore);
    
    // Check if we have the complete Quran data
    if (state.completeQuran && state.completeQuran[surahNumber]) {
      // Show Arabic text immediately while fetching translations
      quranStore.update(s => ({
        ...s,
        currentSurahDetails: state.completeQuran[surahNumber],
        currentSurah: surahNumber,
        currentVerse: null, // Reset current verse when changing surah
        loading: false
      }));

      // Fetch translations asynchronously
      const translations = await fetchTranslations(surahNumber);
      
      if (translations) {
        // Update verses with translations
        const updatedVerses = state.completeQuran[surahNumber].verses.map(verse => {
          const translation = translations.find(t => t.number === verse.number);
          return {
            ...verse,
            translation: translation?.translation || ''
          };
        });

        quranStore.update(s => ({
          ...s,
          currentSurahDetails: {
            ...state.completeQuran[surahNumber],
            verses: updatedVerses
          }
        }));
      }
      return;
    }

    // If not in local state, fetch from API
    const [surahResponse, translationsResponse] = await Promise.all([
      fetch(`${BASE_URL}/surah/${surahNumber}/ar.alafasy`),
      fetch(`${BASE_URL}/surah/${surahNumber}/en.sahih`)
    ]);
    
    const [surahData, translationsData] = await Promise.all([
      surahResponse.json(),
      translationsResponse.json()
    ]);
    
    if (surahData.code === 200 && translationsData.code === 200) {
      // Cache translations
      const translations = translationsData.data.ayahs.map(ayah => ({
        number: ayah.numberInSurah,
        translation: ayah.text
      }));
      localStorage.setItem(`translations_${surahNumber}`, JSON.stringify(translations));

      const surahDetails = {
        ...surahData.data,
        verses: surahData.data.ayahs.map(ayah => {
          const translation = translationsData.data.ayahs.find(
            t => t.numberInSurah === ayah.numberInSurah
          );
          return {
            number: ayah.numberInSurah,
            arabic: ayah.text,
            audio: ayah.audio,
            translation: translation?.text || ''
          };
        })
      };

      quranStore.update(s => ({
        ...s,
        currentSurahDetails: surahDetails,
        currentSurah: surahNumber,
        currentVerse: null, // Reset current verse when changing surah
        loading: false
      }));
    } else {
      throw new Error('Failed to fetch surah details');
    }
  } catch (error) {
    console.error('Error fetching surah details:', error);
    quranStore.update(s => ({
      ...s,
      loading: false,
      error: 'Failed to load Surah details. Please try again.'
    }));
  }
}

// Modified fetchSurahList to use local data when available
export async function fetchSurahList() {
  quranStore.update(s => ({ ...s, loading: true, error: null }));

  try {
    const state = get(quranStore);
    
    // If we have complete Quran data, use it to create the surah list
    if (state.completeQuran) {
      const surahList = Object.values(state.completeQuran).map(surah => ({
        number: surah.number,
        name: surah.name,
        englishName: surah.englishName,
        englishNameTranslation: surah.englishNameTranslation,
        numberOfAyahs: surah.numberOfAyahs
      }));

      quranStore.update(s => ({
        ...s,
        surahList,
        loading: false
      }));
      return;
    }

    // If not in local state, fetch from API
    const response = await fetch(`${BASE_URL}/surah`);
    const data = await response.json();
    
    if (data.code === 200) {
      quranStore.update(s => ({
        ...s,
        surahList: data.data,
        loading: false
      }));
    } else {
      throw new Error('Failed to fetch surah list');
    }
  } catch (error) {
    console.error('Error fetching surah list:', error);
    quranStore.update(s => ({
      ...s,
      loading: false,
      error: 'Failed to load Surah list. Please try again.'
    }));
  }
}

// Audio control functions
export function playAudio(audioUrl, verseNumber) {
  const state = get(quranStore);
  quranStore.update(s => {
    // Stop current audio if playing
    if (s.currentAudio) {
      s.currentAudio.pause();
      s.currentAudio.currentTime = 0;
    }

    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      const currentState = get(quranStore);
      if (currentState.autoPlay && currentState.currentSurahDetails) {
        // Find the next verse
        const currentVerseIndex = currentState.currentSurahDetails.verses.findIndex(v => v.number === verseNumber);
        const nextVerse = currentState.currentSurahDetails.verses[currentVerseIndex + 1];
        
        if (nextVerse) {
          // Play next verse
          playAudio(nextVerse.audio, nextVerse.number);
        } else {
          // Reset if it was the last verse
          quranStore.update(state => ({
            ...state,
            audioPlaying: false,
            currentVerse: null
          }));
        }
      } else {
        quranStore.update(state => ({
          ...state,
          audioPlaying: false,
          currentVerse: null
        }));
      }
    };

    audio.onerror = (e) => {
      console.error('Audio playback error:', e);
      quranStore.update(state => ({
        ...state,
        audioPlaying: false,
        error: 'Failed to play audio. Please try again.'
      }));
    };

    // Start playing
    audio.play().catch(error => {
      console.error('Audio play error:', error);
      quranStore.update(state => ({
        ...state,
        audioPlaying: false,
        error: 'Failed to play audio. Please try again.'
      }));
    });

    return {
      ...s,
      currentAudio: audio,
      audioPlaying: true,
      currentVerse: verseNumber
    };
  });
}

export function pauseAudio() {
  quranStore.update(s => {
    if (s.currentAudio) {
      s.currentAudio.pause();
      s.currentAudio.currentTime = 0;
    }
    return {
      ...s,
      audioPlaying: false,
      currentVerse: null
    };
  });
}

export function setReciter(reciterId) {
  quranStore.update(s => {
    // Stop current audio if playing
    if (s.currentAudio) {
      s.currentAudio.pause();
      s.currentAudio.currentTime = 0;
    }
    return {
      ...s,
      currentReciter: reciterId,
      audioPlaying: false,
      currentVerse: null
    };
  });
  
  // If a surah is currently loaded, reload it with the new reciter
  const currentState = get(quranStore);
  if (currentState.currentSurahDetails) {
    fetchSurahDetails(currentState.currentSurahDetails.number);
  }
}

// Save reading progress
export function saveReadingProgress(surahNumber, verseNumber) {
  localStorage.setItem('quranProgress', JSON.stringify({
    surah: surahNumber,
    verse: verseNumber,
    timestamp: new Date().toISOString()
  }));

  quranStore.update(s => ({
    ...s,
    currentSurah: surahNumber,
    currentVerse: verseNumber
  }));
}

// Load reading progress
export function loadReadingProgress() {
  const progress = localStorage.getItem('quranProgress');
  if (progress) {
    const { surah, verse } = JSON.parse(progress);
    quranStore.update(s => ({
      ...s,
      currentSurah: surah,
      currentVerse: verse
    }));
    return { surah, verse };
  }
  return null;
}

// Save bookmark
export function saveBookmark(surahNumber, verseNumber, surahName) {
  const bookmarks = JSON.parse(localStorage.getItem('quranBookmarks') || '[]');
  const newBookmark = {
    surah: surahNumber,
    verse: verseNumber,
    surahName,
    timestamp: new Date().toISOString()
  };

  // Check if bookmark already exists
  const exists = bookmarks.some(b => b.surah === surahNumber && b.verse === verseNumber);
  if (!exists) {
    bookmarks.push(newBookmark);
    localStorage.setItem('quranBookmarks', JSON.stringify(bookmarks));
  }

  return bookmarks;
}

// Remove bookmark
export function removeBookmark(surahNumber, verseNumber) {
  const bookmarks = JSON.parse(localStorage.getItem('quranBookmarks') || '[]');
  const filtered = bookmarks.filter(
    b => !(b.surah === surahNumber && b.verse === verseNumber)
  );
  localStorage.setItem('quranBookmarks', JSON.stringify(filtered));
  return filtered;
}

// Load bookmarks
export function loadBookmarks() {
  return JSON.parse(localStorage.getItem('quranBookmarks') || '[]');
}

// Toggle auto-play feature
export function toggleAutoPlay() {
  quranStore.update(s => ({
    ...s,
    autoPlay: !s.autoPlay
  }));
} 