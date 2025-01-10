import { writable } from 'svelte/store';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

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

  // Only change quote if it's a different day
  return lastQuoteTime.getDate() !== currentTime.getDate() ||
         lastQuoteTime.getMonth() !== currentTime.getMonth() ||
         lastQuoteTime.getFullYear() !== currentTime.getFullYear();
}

// Helper function to sync Google Sheets with Firestore
async function syncWithFirestore(sheetQuotes) {
  try {
    const quotesRef = collection(db, 'daily_quotes');
    const quotesSnapshot = await getDocs(quotesRef);
    
    // Create a map of existing quotes for easy comparison
    const existingQuotes = new Map();
    quotesSnapshot.forEach(doc => {
      const quote = doc.data();
      const key = `${quote.text}-${quote.source}`;
      existingQuotes.set(key, doc.id);
    });

    // Add new quotes and track which ones exist in the sheet
    const processedKeys = new Set();
    for (const quote of sheetQuotes) {
      const key = `${quote.text}-${quote.source}`;
      processedKeys.add(key);

      if (!existingQuotes.has(key)) {
        console.log('Adding new quote to Firestore:', quote);
        await addDoc(quotesRef, quote);
      }
    }

    // Delete quotes that are in Firestore but not in the sheet
    for (const [key, docId] of existingQuotes.entries()) {
      if (!processedKeys.has(key)) {
        console.log('Deleting quote from Firestore:', docId);
        await deleteDoc(doc(db, 'daily_quotes', docId));
      }
    }
  } catch (error) {
    console.error('Error syncing with Firestore:', error);
    throw error;
  }
}

// Function to force sync quotes with Firestore
export async function syncQuotes() {
  try {
    const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
    const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
    
    // Use Sheet1 as the default sheet name
    const sheetName = 'Sheet1';
    const range = `${sheetName}!A2:B`;
    
    console.log('Fetching quotes from sheet for sync:', SHEET_ID);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Sheets API Error:', errorData);
      throw new Error(`Google Sheets API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Received data from Google Sheets:', data);

    if (data.values && data.values.length > 0) {
      // Convert rows to quote objects
      const sheetQuotes = data.values.map(([text, source]) => ({
        text: text?.trim() || '',
        source: source?.trim() || ''
      })).filter(quote => quote.text && quote.source); // Filter out empty quotes

      console.log('Parsed quotes for sync:', sheetQuotes);

      // Sync with Firestore
      await syncWithFirestore(sheetQuotes);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error syncing quotes:', error);
    throw error;
  }
}

export async function getRandomQuote() {
  // Check if we have a valid cached quote
  const savedQuote = localStorage.getItem('dailyQuote');
  if (savedQuote && !needsNewQuote()) {
    const { quote } = JSON.parse(savedQuote);
    quoteStore.set({
      ...quote,
      loading: false
    });
    return quote;
  }

  quoteStore.update(q => ({ ...q, loading: true }));
  
  try {
    // First try to get quotes from Google Sheet
    const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
    const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
    
    // Use Sheet1 as the default sheet name
    const sheetName = 'Sheet1';
    const range = `${sheetName}!A2:B`;
    
    console.log('Fetching quotes from sheet:', SHEET_ID);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Sheets API Error:', errorData);
      throw new Error(`Google Sheets API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Received data from Google Sheets:', data);

    if (data.values && data.values.length > 0) {
      // Convert rows to quote objects
      const sheetQuotes = data.values.map(([text, source]) => ({
        text: text?.trim() || '',
        source: source?.trim() || ''
      })).filter(quote => quote.text && quote.source); // Filter out empty quotes

      console.log('Parsed quotes:', sheetQuotes);

      // Sync with Firestore
      await syncWithFirestore(sheetQuotes);

      // Get a random quote from the sheet
      const randomIndex = Math.floor(Math.random() * sheetQuotes.length);
      const quote = sheetQuotes[randomIndex];

      // Save to localStorage with current timestamp
      localStorage.setItem('dailyQuote', JSON.stringify({
        quote,
        timestamp: new Date().toISOString()
      }));

      quoteStore.set({
        ...quote,
        loading: false
      });

      return quote;
    } else {
      console.log('No values found in Google Sheet, falling back to Firestore');
      throw new Error('No values found in Google Sheet');
    }
  } catch (error) {
    console.error('Error fetching from Google Sheets:', error);
    
    try {
      // Fall back to Firestore
      console.log('Falling back to Firestore');
      const quotesRef = collection(db, 'daily_quotes');
      const quotesSnapshot = await getDocs(quotesRef);
      
      if (quotesSnapshot.empty) {
        console.log('No quotes found in Firestore, using fallback quote');
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
        quotes.push(doc.data());
      });

      console.log('Found quotes in Firestore:', quotes.length);

      // Get a random quote from the array
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
      
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
    } catch (firestoreError) {
      console.error('Error fetching from Firestore:', firestoreError);
      
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
} 