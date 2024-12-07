import { writable } from 'svelte/store';

export const quranStore = writable({
  currentSurah: null,
  currentVerse: null,
  surahList: [],
  currentSurahDetails: null,
  loading: false,
  error: null
});

const BASE_URL = 'https://api.alquran.cloud/v1';

export async function fetchSurahList() {
  const store = quranStore;
  store.update(s => ({ ...s, loading: true, error: null }));

  try {
    const response = await fetch(`${BASE_URL}/surah`);
    const data = await response.json();
    
    if (data.code === 200) {
      store.update(s => ({
        ...s,
        surahList: data.data,
        loading: false
      }));
    } else {
      throw new Error('Failed to fetch surah list');
    }
  } catch (error) {
    store.update(s => ({
      ...s,
      loading: false,
      error: 'Failed to load Surah list. Please try again.'
    }));
  }
}

export async function fetchSurahDetails(surahNumber) {
  const store = quranStore;
  store.update(s => ({ ...s, loading: true, error: null }));

  try {
    // Fetch both Arabic and English translations
    const [arabicResponse, translationResponse] = await Promise.all([
      fetch(`${BASE_URL}/surah/${surahNumber}`),
      fetch(`${BASE_URL}/surah/${surahNumber}/en.asad`)
    ]);

    const arabicData = await arabicResponse.json();
    const translationData = await translationResponse.json();

    if (arabicData.code === 200 && translationData.code === 200) {
      // Combine Arabic and English translations
      const verses = arabicData.data.ayahs.map((ayah, index) => ({
        number: ayah.numberInSurah,
        arabic: ayah.text,
        translation: translationData.data.ayahs[index].text
      }));

      store.update(s => ({
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
    store.update(s => ({
      ...s,
      loading: false,
      error: 'Failed to load Surah details. Please try again.'
    }));
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