import { badgeStore } from '../stores/badgeStore';
import { prayerHistoryStore } from '../stores/prayerHistoryStore';
import { get } from 'svelte/store';

// Update prayer streak progress
export function updatePrayerProgress() {
  const history = get(prayerHistoryStore)?.history || [];
  const today = new Date().toLocaleDateString('en-CA');
  
  // Calculate streak
  let streak = 0;
  let currentDate = new Date(today);
  
  while (true) {
    const dateStr = currentDate.toLocaleDateString('en-CA');
    const dayPrayers = history.filter(p => p.date === dateStr);
    
    // Check if all 5 prayers were completed for this day
    const completedAll = dayPrayers.length === 5 && 
      dayPrayers.every(p => p.status === 'ontime' || p.status === 'late');
    
    if (!completedAll) break;
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  // Update streak progress with the correct badge type
  badgeStore.updateProgress('streak', streak);
  
  // Calculate Fajr streak
  let fajrStreak = 0;
  currentDate = new Date(today);
  
  console.log('=== Calculating Fajr Streak ===');
  console.log('Today:', today);
  console.log('Prayer History:', history);
  
  // Skip today if Fajr hasn't been marked yet
  const todayFajr = history.find(p => p.date === today && p.prayerName === 'Fajr');
  console.log('Today\'s Fajr prayer:', todayFajr);
  
  if (!todayFajr || todayFajr.status !== 'ontime') {
    console.log('Skipping today as Fajr is not marked as on time');
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  while (true) {
    const dateStr = currentDate.toLocaleDateString('en-CA');
    const fajrPrayer = history.find(p => 
      p.date === dateStr && 
      p.prayerName === 'Fajr'
    );
    
    console.log('\nChecking date:', dateStr);
    console.log('Found Fajr prayer:', fajrPrayer);
    
    // Break if no Fajr prayer or not prayed on time
    if (!fajrPrayer || fajrPrayer.status !== 'ontime') {
      console.log('Breaking streak:', !fajrPrayer ? 'No Fajr prayer found' : `Status is ${fajrPrayer.status}`);
      break;
    }
    
    console.log('Adding to streak - prayer was on time');
    fajrStreak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  console.log('\nFinal Fajr streak:', fajrStreak);
  
  // Update Fajr streak progress with the correct badge type
  console.log('Updating badge progress for ontime_fajr:', fajrStreak);
  badgeStore.updateProgress('ontime_fajr', fajrStreak);
}

// Update dhikr progress
export function updateDhikrProgress(count) {
  // Update daily dhikr count
  badgeStore.updateProgress('daily_dhikr', count);
}

// Update dhikr streak
export function updateDhikrStreak(streak) {
  badgeStore.updateProgress('dhikr_streak', streak);
}

// Update Quran reading progress
export function updateQuranProgress(minutes) {
  badgeStore.updateProgress('daily_reading', minutes);
}

// Update Juz completion progress
export function updateJuzProgress(count) {
  badgeStore.updateProgress('juz_completion', count);
}

// Update journal entries progress
export function updateJournalProgress(count) {
  badgeStore.updateProgress('journal_entries', count);
}

// Update journal streak
export function updateJournalStreak(streak) {
  badgeStore.updateProgress('journal_streak', streak);
} 