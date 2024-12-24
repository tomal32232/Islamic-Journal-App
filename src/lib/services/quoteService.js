import { writable } from 'svelte/store';

export const quoteStore = writable({
  text: "Indeed, with hardship comes ease.",
  source: "Surah Ash-Sharh [94:5-6]",
  loading: false
});

const MAX_QUOTE_LENGTH = 150; // Maximum characters for quote

// Curated list of inspiring verses with their Surah number and verse range
const INSPIRING_VERSES = [
  // Original verses
  { surah: 94, verses: [5, 6] },     // Ash-Sharh - With hardship comes ease
  { surah: 2, verses: [286] },       // Al-Baqarah - Allah does not burden a soul beyond its capacity
  { surah: 3, verses: [139] },       // Ali 'Imran - Do not lose heart nor fall into despair
  { surah: 93, verses: [5] },        // Ad-Duha - Your Lord will give you, and you will be satisfied
  { surah: 65, verses: [7] },        // At-Talaq - Allah will bring about ease after hardship
  { surah: 2, verses: [153] },       // Al-Baqarah - Seek help through patience and prayer
  { surah: 3, verses: [200] },       // Ali 'Imran - O believers! Be patient, persevering, and vigilant
  { surah: 94, verses: [7, 8] },     // Ash-Sharh - When you have finished, then stand up. And to your Lord direct your longing
  { surah: 2, verses: [186] },       // Al-Baqarah - I am near, I respond to the call of the caller
  { surah: 21, verses: [87, 88] },   // Al-Anbya - And We delivered him from distress, thus We deliver the believers
  { surah: 8, verses: [46] },        // Al-Anfal - Be patient, Allah is with those who are patient
  { surah: 39, verses: [53] },       // Az-Zumar - Do not despair of Allah's mercy
  { surah: 2, verses: [216] },       // Al-Baqarah - Perhaps you hate something while it is good for you
  { surah: 49, verses: [13] },       // Al-Hujurat - The most noble among you is the most righteous
  { surah: 3, verses: [160] },       // Ali 'Imran - If Allah helps you, none can overcome you
  
  // First expansion
  { surah: 93, verses: [3] },        // Ad-Duha - Your Lord has not forsaken you
  { surah: 2, verses: [152] },       // Al-Baqarah - Remember Me, I will remember you
  { surah: 20, verses: [44] },       // Ta-Ha - Speak to him with gentle speech
  { surah: 3, verses: [159] },       // Ali 'Imran - By mercy from Allah, you were lenient with them
  { surah: 25, verses: [70] },       // Al-Furqan - Allah will replace their evil deeds with good
  { surah: 17, verses: [82] },       // Al-Isra - We send down of the Quran that which is healing and mercy
  { surah: 2, verses: [185] },       // Al-Baqarah - Allah intends for you ease
  { surah: 94, verses: [1, 2, 3] },  // Ash-Sharh - Have We not expanded for you your breast?
  { surah: 3, verses: [146] },       // Ali 'Imran - And Allah loves the steadfast
  { surah: 103, verses: [1, 2, 3] }, // Al-Asr - Indeed, mankind is in loss, except those who believe and do righteous deeds
  { surah: 2, verses: [155] },       // Al-Baqarah - We will surely test you with something of fear and hunger
  { surah: 29, verses: [69] },       // Al-Ankabut - Those who strive for Us, We will guide them to Our ways
  { surah: 16, verses: [97] },       // An-Nahl - Whoever does righteousness, We will give them a good life
  { surah: 3, verses: [173] },       // Ali 'Imran - Sufficient for us is Allah, and He is the best Disposer of affairs
  { surah: 9, verses: [51] },        // At-Tawbah - Nothing will happen to us except what Allah has decreed
  { surah: 2, verses: [255] },       // Al-Baqarah - Allah, there is no deity except Him, the Ever-Living, the Sustainer of existence
  { surah: 33, verses: [70] },       // Al-Ahzab - Speak words of appropriate justice
  { surah: 55, verses: [60] },       // Ar-Rahman - Is the reward for good anything but good?
  { surah: 28, verses: [77] },       // Al-Qasas - But seek, through what Allah has given you, the home of the Hereafter
  { surah: 23, verses: [1, 2] },     // Al-Muminun - Successful indeed are the believers who are humble in their prayers
  { surah: 13, verses: [28] },       // Ar-Ra'd - In the remembrance of Allah do hearts find rest
  { surah: 2, verses: [195] },       // Al-Baqarah - And do good; indeed, Allah loves the doers of good
  { surah: 48, verses: [4] },        // Al-Fath - It is He who sent down tranquility into the hearts of the believers
  { surah: 57, verses: [23] },       // Al-Hadid - So that you not despair over what has eluded you
  { surah: 3, verses: [133] },       // Ali 'Imran - And hasten to forgiveness from your Lord
  { surah: 4, verses: [147] },       // An-Nisa - What would Allah do with your punishment if you are grateful and believe?
  { surah: 64, verses: [11] },       // At-Taghabun - No disaster strikes except by permission of Allah
  { surah: 87, verses: [8] },        // Al-A'la - And We will ease you toward ease
  { surah: 2, verses: [45] },        // Al-Baqarah - Seek help through patience and prayer
  { surah: 3, verses: [31] },        // Ali 'Imran - If you love Allah, then follow me, Allah will love you

  // Additional inspiring verses
  { surah: 93, verses: [4] },        // Ad-Duha - And the Hereafter is better for you than the first [life]
  { surah: 2, verses: [257] },       // Al-Baqarah - Allah is the ally of those who believe
  { surah: 47, verses: [7] },        // Muhammad - If you support Allah, He will support you
  { surah: 21, verses: [83, 84] },   // Al-Anbya - Indeed, adversity has touched me, and you are the Most Merciful of the merciful
  { surah: 3, verses: [145] },       // Ali 'Imran - And whoever desires the reward of this world - We will give him thereof
  { surah: 65, verses: [3] },        // At-Talaq - And whoever relies upon Allah - then He is sufficient for him
  { surah: 2, verses: [148] },       // Al-Baqarah - So race to [all that is] good
  { surah: 3, verses: [134] },       // Ali 'Imran - Who spend [in the cause of Allah] during ease and hardship
  { surah: 25, verses: [63] },       // Al-Furqan - The servants of the Most Merciful are those who walk upon the earth easily
  { surah: 17, verses: [80] },       // Al-Isra - And say, "My Lord, cause me to enter a sound entrance and to exit a sound exit"
  { surah: 3, verses: [102] },       // Ali 'Imran - O you who have believed, fear Allah as He should be feared
  { surah: 39, verses: [10] },       // Az-Zumar - Indeed, the patient will be given their reward without account
  { surah: 5, verses: [8] },         // Al-Ma'idah - Be just; that is nearer to righteousness
  { surah: 31, verses: [17] },       // Luqman - O my son, establish prayer, enjoin what is right, forbid what is wrong
  { surah: 2, verses: [110] },       // Al-Baqarah - And whatever good you put forward for yourselves - you will find it with Allah
  { surah: 41, verses: [30] },       // Fussilat - Indeed, those who have said, "Our Lord is Allah" and then remained on a right course
  { surah: 11, verses: [115] },      // Hud - And be patient, for indeed, Allah does not allow to be lost the reward of those who do good
  { surah: 2, verses: [269] },       // Al-Baqarah - He gives wisdom to whom He wills, and whoever has been given wisdom
  { surah: 35, verses: [29] },       // Fatir - Indeed, those who recite the Book of Allah and establish prayer
  { surah: 58, verses: [11] },       // Al-Mujadila - Allah will raise those who have believed among you and those who were given knowledge
  { surah: 20, verses: [114] },      // Ta-Ha - My Lord, increase me in knowledge
  { surah: 3, verses: [92] },        // Ali 'Imran - Never will you attain the good [reward] until you spend [in the way of Allah] from that which you love
  { surah: 33, verses: [35] },       // Al-Ahzab - Indeed, the Muslim men and Muslim women, the believing men and believing women
  { surah: 103, verses: [3] },       // Al-Asr - Except those who have believed and done righteous deeds
  { surah: 2, verses: [201] },       // Al-Baqarah - Our Lord, give us in this world [that which is] good and in the Hereafter
  { surah: 28, verses: [24] },       // Al-Qasas - My Lord, indeed I am, for whatever good You would send down to me, in need
  { surah: 25, verses: [74] },       // Al-Furqan - Our Lord, grant us from among our wives and offspring comfort to our eyes
  { surah: 3, verses: [8] },         // Ali 'Imran - Our Lord, let not our hearts deviate after You have guided us
  { surah: 2, verses: [128] },       // Al-Baqarah - Our Lord, and make us Muslims [in submission] to You
  { surah: 7, verses: [23] }         // Al-A'raf - Our Lord, we have wronged ourselves, and if You do not forgive us
];

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
  // Check if we have a cached quote that's still valid
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
    let quote = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (!quote && attempts < maxAttempts) {
      // Get a random verse from our curated list
      const randomVerse = INSPIRING_VERSES[Math.floor(Math.random() * INSPIRING_VERSES.length)];
      const verseNumber = randomVerse.verses[Math.floor(Math.random() * randomVerse.verses.length)];
      
      // Fetch the verse from the API
      const response = await fetch(
        `https://api.alquran.cloud/v1/ayah/${verseNumber}/en.sahih`
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

    // Save the quote with current timestamp
    localStorage.setItem('dailyQuote', JSON.stringify({
      quote,
      timestamp: new Date().toISOString()
    }));

    quoteStore.set({
      ...quote,
      loading: false
    });

    return quote;
  } catch (error) {
    console.error('Error fetching quote:', error);
    
    // Try to use cached quote if available, even if it's old
    const savedQuote = localStorage.getItem('dailyQuote');
    if (savedQuote) {
      const { quote } = JSON.parse(savedQuote);
      quoteStore.set({
        ...quote,
        loading: false
      });
      return quote;
    }

    // Fallback to a default quote if no cached quote available
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