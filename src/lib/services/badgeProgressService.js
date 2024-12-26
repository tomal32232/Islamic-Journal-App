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
    // Consider both completed and excused prayers
    const completedAll = dayPrayers.length === 5 && 
      dayPrayers.every(p => p.status === 'ontime' || p.status === 'late' || p.status === 'excused');
    
    if (!completedAll) break;
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  // Update streak progress with the correct badge type
  badgeStore.updateProgress('streak', streak);
  
  // Calculate Fajr streak
  let fajrStreak = 0;
  currentDate = new Date(today);
  
  // Skip today if Fajr hasn't been marked yet
  const todayFajr = history.find(p => p.date === today && p.prayerName === 'Fajr');
  
  if (!todayFajr || (todayFajr.status !== 'ontime' && todayFajr.status !== 'excused')) {
    currentDate.setDate(currentDate.getDate() - 1);
  }

  while (true) {
    const dateStr = currentDate.toLocaleDateString('en-CA');
    const fajrPrayer = history.find(p => 
      p.date === dateStr && 
      p.prayerName === 'Fajr'
    );
    
    // Break if no Fajr prayer found
    if (!fajrPrayer) break;
    
    // Count both ontime and excused prayers for the streak
    if (fajrPrayer.status === 'ontime' || fajrPrayer.status === 'excused') {
      fajrStreak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  // Update Fajr streak progress with the correct badge type
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