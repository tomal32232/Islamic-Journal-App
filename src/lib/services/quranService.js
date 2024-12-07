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
  currentReciter: 'ar.alafasy' // Default reciter (Mishary Rashid Alafasy)
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

export async function fetchSurahList() {
  quranStore.update(s => ({ ...s, loading: true, error: null }));

  try {
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
    quranStore.update(s => ({
      ...s,
      loading: false,
      error: 'Failed to load Surah list. Please try again.'
    }));
  }
}

export async function fetchSurahDetails(surahNumber) {
  const currentState = get(quranStore);
  quranStore.update(s => ({ ...s, loading: true, error: null }));

  try {
    // Fetch both Arabic and English translations
    const [arabicResponse, translationResponse, audioResponse] = await Promise.all([
      fetch(`${BASE_URL}/surah/${surahNumber}`),
      fetch(`${BASE_URL}/surah/${surahNumber}/en.asad`),
      fetch(`${BASE_URL}/surah/${surahNumber}/${currentState.currentReciter}`)
    ]);

    const arabicData = await arabicResponse.json();
    const translationData = await translationResponse.json();
    const audioData = await audioResponse.json();

    if (arabicData.code === 200 && translationData.code === 200 && audioData.code === 200) {
      // Combine Arabic, English translations, and audio
      const verses = arabicData.data.ayahs.map((ayah, index) => ({
        number: ayah.numberInSurah,
        arabic: ayah.text,
        translation: translationData.data.ayahs[index].text,
        audio: audioData.data.ayahs[index].audio
      }));

      quranStore.update(s => ({
        ...s,
        currentSurahDetails: {
          number: arabicData.data.number,
          name: arabicData.data.name,
          englishName: arabicData.data.englishName,
          verses
        },
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

// Audio control functions
export function playAudio(audioUrl, verseNumber) {
  quranStore.update(s => {
    // Stop current audio if playing
    if (s.currentAudio) {
      s.currentAudio.pause();
      s.currentAudio.currentTime = 0;
    }

    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      quranStore.update(state => ({
        ...state,
        audioPlaying: false,
        currentVerse: null
      }));
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