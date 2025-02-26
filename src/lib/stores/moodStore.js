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

    // Fetch random guidance for this mood if not provided
    const moodGuidance = guidance || await fetchRandomGuidanceForMood(mood.value);

    const moodData = {
      userId: user.uid,
      mood: mood.value,
      period, // 'morning' or 'evening'
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      guidance: moodGuidance
    };

    const docRef = await addDoc(collection(db, 'moods'), moodData);
    console.log('Mood saved with ID:', docRef.id);

    // Update the store
    const currentMoods = get(moodHistoryStore);
    moodHistoryStore.set([...currentMoods, moodData]);

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

    const moodsRef = collection(db, 'moods');
    const q = query(
      moodsRef,
      where('userId', '==', user.uid),
      where('timestamp', '>=', startDate.toISOString()),
      orderBy('timestamp', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const moods = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

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

  // Get Fajr and Dhuhr times
  const fajrPrayer = prayerTimes.find(p => p.name === 'Fajr');
  const dhuhrPrayer = prayerTimes.find(p => p.name === 'Dhuhr');
  const ishaPrayer = prayerTimes.find(p => p.name === 'Isha');

  if (!fajrPrayer || !dhuhrPrayer || !ishaPrayer) return false;

  // Convert prayer times to Date objects
  const fajrTime = convertPrayerTimeToDate(fajrPrayer.time);
  const dhuhrTime = convertPrayerTimeToDate(dhuhrPrayer.time);
  const ishaTime = convertPrayerTimeToDate(ishaPrayer.time);
  
  // Set end time for morning mood (before Dhuhr)
  const morningEndTime = dhuhrTime;
  
  // Set end time for evening mood (11:59 PM)
  const eveningEndTime = new Date(now);
  eveningEndTime.setHours(23, 59, 59, 999);

  // Check if we're in the morning window (after Fajr, before Dhuhr)
  const isMorningWindow = currentTime >= fajrTime.getTime() && currentTime < morningEndTime.getTime();
  
  // Check if we're in the evening window (after Isha, before midnight)
  const isEveningWindow = currentTime >= ishaTime.getTime() && currentTime < eveningEndTime.getTime();

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