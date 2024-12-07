import { writable } from 'svelte/store';

export const quoteStore = writable({
  text: "Indeed, with hardship comes ease.",
  source: "Surah Ash-Sharh [94:5-6]",
  loading: false
});

const MAX_QUOTE_LENGTH = 150; // Maximum characters for quote

export async function getRandomQuote() {
  quoteStore.update(q => ({ ...q, loading: true }));
  
  try {
    let quote = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (!quote && attempts < maxAttempts) {
      // Get a random verse number (total verses in Quran: 6236)
      const randomVerseNumber = Math.floor(Math.random() * 6236) + 1;
      
      // Fetch the verse from the API
      const response = await fetch(
        `https://api.alquran.cloud/v1/ayah/${randomVerseNumber}/en.sahih`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch quote');
      }

      const data = await response.json();
      
      if (data.code === 200 && data.data) {
        const verse = data.data;
        const text = verse.text.replace(/\[.*?\]/g, '').trim();
        
        // Only use the quote if it's not too long
        if (text.length <= MAX_QUOTE_LENGTH) {
          quote = {
            text,
            source: `Surah ${verse.surah.englishName} [${verse.surah.number}:${verse.numberInSurah}]`
          };
        }
      }
      
      attempts++;
    }

    // If we couldn't find a suitable quote, use a fallback
    if (!quote) {
      quote = {
        text: "Indeed, with hardship comes ease.",
        source: "Surah Ash-Sharh [94:5-6]"
      };
    }

    quoteStore.set({
      ...quote,
      loading: false
    });

    return quote;
  } catch (error) {
    console.error('Error fetching quote:', error);
    // Fallback to a default quote if API fails
    const fallbackQuote = {
      text: "Indeed, with hardship comes ease.",
      source: "Surah Ash-Sharh [94:5-6]"
    };
    
    quoteStore.set({
      ...fallbackQuote,
      loading: false
    });
    
    return fallbackQuote;
  }
} 