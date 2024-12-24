import { writable } from 'svelte/store';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

export const quoteStore = writable({
  text: "Indeed, with hardship comes ease.",
  source: "Surah Ash-Sharh [94:5-6]",
  loading: false
});

// Helper function to determine if we need a new quote
function needsNewQuote() {
  const savedQuote = localStorage.getItem('dailyQuote');
  if (!savedQuote) return true;

  const { timestamp } = JSON.parse(savedQuote);
  const lastQuoteTime = new Date(timestamp);
  const currentTime = new Date();

  // Check if it's a different day
  if (lastQuoteTime.getDate() !== currentTime.getDate() ||
      lastQuoteTime.getMonth() !== currentTime.getMonth() ||
      lastQuoteTime.getFullYear() !== currentTime.getFullYear()) {
    return true;
  }

  // Check if we've crossed the AM/PM boundary
  const wasAM = lastQuoteTime.getHours() < 12;
  const isAM = currentTime.getHours() < 12;
  
  return wasAM !== isAM;
}

export async function getRandomQuote() {
  quoteStore.update(q => ({ ...q, loading: true }));
  
  try {
    // Always get fresh quotes from Firestore
    const quotesRef = collection(db, 'daily_quotes');
    const quotesSnapshot = await getDocs(quotesRef);
    
    console.log('Fetching quotes from Firestore...');
    
    if (quotesSnapshot.empty) {
      console.log('No quotes found in database');
      // If no quotes in database, use fallback
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

    // Convert snapshot to array of quotes
    const quotes = [];
    quotesSnapshot.forEach(doc => {
      console.log('Found quote:', doc.data());
      quotes.push(doc.data());
    });

    console.log('Total quotes found:', quotes.length);

    // Get a random quote from the array
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    console.log('Selected quote:', randomQuote);
    
    // Save the quote with current timestamp
    localStorage.setItem('dailyQuote', JSON.stringify({
      quote: randomQuote,
      timestamp: new Date().toISOString()
    }));

    quoteStore.set({
      ...randomQuote,
      loading: false
    });

    return randomQuote;
  } catch (error) {
    console.error('Error fetching quote:', error);
    
    // Use a fallback quote
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