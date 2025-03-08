import { writable, get } from 'svelte/store';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { auth } from '../services/firebase';
import { fetchRandomGuidanceForMood } from '../services/moodGuidanceService';

export const moodHistoryStore = writable([]);

export async function saveMood(mood, guidance = null, period = 'morning') {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to save mood');
    }

    console.log('saveMood called with mood:', mood);
    console.log('Mood type:', typeof mood);
    console.log('Mood value:', mood.value);
    console.log('Period:', period);
    console.log('Mood value characters:', [...mood.value].map(c => `'${c}' (${c.charCodeAt(0)})`));

    // Keep the original mood value format (with underscores)
    // This ensures consistency with the mood values in the moods array
    const moodValue = mood.value;
    console.log('Using original mood value for database:', moodValue);

    // Fetch random guidance for this mood if not provided
    const moodGuidance = guidance || await fetchRandomGuidanceForMood(mood.value);
    console.log('Fetched guidance:', moodGuidance);

    const today = new Date().toLocaleDateString();
    console.log('Today\'s date for mood record:', today);

    const moodData = {
      userId: user.uid,
      mood: moodValue, // Use the original value with underscores
      period, // 'morning' or 'evening'
      timestamp: new Date().toISOString(),
      date: today,
      guidance: moodGuidance
    };

    console.log('Saving mood data:', moodData);
    
    // Check if we already have a mood for this date and period
    const existingMoods = get(moodHistoryStore);
    const existingMood = existingMoods.find(m => 
      m.date === today && 
      m.period === period && 
      m.userId === user.uid
    );
    
    if (existingMood) {
      console.log(`Found existing mood for ${today}, period ${period}:`, existingMood);
      console.log('Will overwrite with new mood data');
    }

    const docRef = await addDoc(collection(db, 'moods'), moodData);
    console.log('Mood saved with ID:', docRef.id);

    // Update the store
    const currentMoods = get(moodHistoryStore);
    
    // Remove any existing mood for the same date and period
    const filteredMoods = currentMoods.filter(m => 
      !(m.date === today && m.period === period && m.userId === user.uid)
    );
    
    // Add the new mood
    moodHistoryStore.set([...filteredMoods, moodData]);
    console.log('Updated mood store with new mood');

    return docRef.id;
  } catch (error) {
    console.error('Error saving mood:', error);
    throw error;
  }
}

export async function getMoodHistory(days = 30) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    console.log(`Getting mood history for the last ${days} days, starting from ${startDate.toLocaleDateString()}`);

    const moodsRef = collection(db, 'moods');
    const q = query(
      moodsRef,
      where('userId', '==', user.uid),
      where('timestamp', '>=', startDate.toISOString()),
      orderBy('timestamp', 'desc')
    );

    console.log('Executing Firestore query for mood history');
    const querySnapshot = await getDocs(q);
    console.log(`Retrieved ${querySnapshot.docs.length} mood records from Firestore`);
    
    const moods = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Log each mood record for debugging
    moods.forEach((mood, index) => {
      console.log(`Mood ${index + 1}:`, {
        id: mood.id,
        date: mood.date,
        period: mood.period,
        mood: mood.mood,
        timestamp: mood.timestamp
      });
    });

    // Group moods by date for easier debugging
    const moodsByDate = moods.reduce((acc, mood) => {
      if (!acc[mood.date]) {
        acc[mood.date] = [];
      }
      acc[mood.date].push({
        period: mood.period,
        mood: mood.mood
      });
      return acc;
    }, {});
    
    console.log('Moods grouped by date:', moodsByDate);
    console.log('Retrieved moods from database:', moods);
    moodHistoryStore.set(moods);
    return moods;
  } catch (error) {
    console.error('Error getting mood history:', error);
    throw error;
  }
}

export async function getMoodForDate(date, period = 'morning') {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    const moodsRef = collection(db, 'moods');
    const q = query(
      moodsRef,
      where('userId', '==', user.uid),
      where('date', '==', date),
      where('period', '==', period),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;

    return {
      id: querySnapshot.docs[0].id,
      ...querySnapshot.docs[0].data()
    };
  } catch (error) {
    console.error('Error getting mood for date:', error);
    return null;
  }
}

// Helper function to determine if it's time to show the mood selector
export function shouldShowMoodSelector(prayerTimes) {
  if (!prayerTimes || prayerTimes.length === 0) return false;

  const now = new Date();
  const currentTime = now.getTime();

  // Get Fajr, Dhuhr and Maghrib times
  const fajrPrayer = prayerTimes.find(p => p.name === 'Fajr');
  const dhuhrPrayer = prayerTimes.find(p => p.name === 'Dhuhr');
  const maghribPrayer = prayerTimes.find(p => p.name === 'Maghrib');

  if (!fajrPrayer || !dhuhrPrayer || !maghribPrayer) return false;

  // Convert prayer times to Date objects
  const fajrTime = convertPrayerTimeToDate(fajrPrayer.time);
  const dhuhrTime = convertPrayerTimeToDate(dhuhrPrayer.time);
  const maghribTime = convertPrayerTimeToDate(maghribPrayer.time);
  
  // Set end time for morning mood (before Dhuhr)
  const morningEndTime = dhuhrTime;
  
  // Set end time for evening mood (11:59 PM)
  const eveningEndTime = new Date(now);
  eveningEndTime.setHours(23, 59, 59, 999);

  // Check if we're in the morning window (after Fajr, before Dhuhr)
  const isMorningWindow = currentTime >= fajrTime.getTime() && currentTime < morningEndTime.getTime();
  
  // Check if we're in the evening window (after Maghrib, before midnight)
  const isEveningWindow = currentTime >= maghribTime.getTime() && currentTime < eveningEndTime.getTime();

  return {
    showMorningMood: isMorningWindow,
    showEveningMood: isEveningWindow
  };
}

// Helper function to convert prayer time string to Date object
function convertPrayerTimeToDate(timeStr) {
  const now = new Date();
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  
  return date;
} 