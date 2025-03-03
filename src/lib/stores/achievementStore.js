import { writable } from 'svelte/store';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { notificationStore } from './notificationStore';

function createAchievementStore() {
    const { subscribe, set } = writable([]);
    let lastKnownBadges = new Set();
    let unsubscribe = null;

    // Badge message mapping
    const badgeMessages = {
        // Prayer Badges
        'prayer_streak_1': '🕌 MashaAllah! You\'ve achieved Prayer Guardian I - 3 days of consistent prayers!',
        'prayer_streak_2': '🕌 Amazing! Prayer Guardian II unlocked - A week of dedication!',
        'prayer_streak_3': '🕌 SubhanAllah! Prayer Guardian III achieved - 30 days of devotion!',
        
        'prayer_ontime_1': '☀️ Early Riser I achieved! 3 days of on-time Fajr prayers!',
        'prayer_ontime_2': '☀️ Early Riser II unlocked! A week of punctual Fajr prayers!',
        'prayer_ontime_3': '☀️ Early Riser III mastered! 30 days of blessed mornings!',
        
        // Quran Badges
        'quran_time_1': '📖 Quran Reader I unlocked! 15 minutes daily for 3 days!',
        'quran_time_2': '📖 Quran Reader II achieved! 30 minutes daily for a week!',
        'quran_time_3': '📖 Quran Reader III mastered! An hour daily for a month!',
        
        'quran_completion_1': '🌙 First Juz completed! Your Quran journey begins!',
        'quran_completion_2': '🌙 5 Juz milestone reached! Keep going strong!',
        'quran_completion_3': '🌙 All 30 Juz completed! An incredible achievement!',
        
        // Dhikr Badges
        'dhikr_daily_1': '📿 Daily Dhikr I achieved! 100 dhikr in one day!',
        'dhikr_daily_2': '📿 Daily Dhikr II unlocked! 500 dhikr milestone reached!',
        'dhikr_daily_3': '📿 Daily Dhikr III mastered! 1000 dhikr in a day!',
        
        'dhikr_streak_1': '🤲 Dhikr Streak I - 3 days of consistent remembrance!',
        'dhikr_streak_2': '🤲 Dhikr Streak II - A week of dedication to dhikr!',
        'dhikr_streak_3': '🤲 Dhikr Streak III - 30 days of divine connection!',
        
        // Journal Badges
        'journal_entries_1': '✍️ Journal Keeper I - Your first 3 reflections!',
        'journal_entries_2': '✍️ Journal Keeper II - 7 thoughtful entries completed!',
        'journal_entries_3': '✍️ Journal Keeper III - 30 days of self-reflection!',
        
        'journal_streak_1': '📝 Journal Streak I - 3 days of consistent writing!',
        'journal_streak_2': '📝 Journal Streak II - A week of daily journaling!',
        'journal_streak_3': '📝 Journal Streak III - 30 days of dedicated reflection!'
    };

    return {
        subscribe,
        init: (userId) => {
            if (unsubscribe) {
                unsubscribe();
            }

            if (!userId) {
                set([]);
                return;
            }

            // Watch the user's document for badge changes
            unsubscribe = onSnapshot(doc(db, 'users', userId), (doc) => {
                const userData = doc.data();
                if (!userData) return;

                const currentBadges = new Set(userData.earnedBadges || []);
                
                // Find new badges by comparing with last known badges
                const newBadges = [...currentBadges].filter(badge => !lastKnownBadges.has(badge));
                
                console.log('Achievement check:', {
                    currentBadges: [...currentBadges],
                    lastKnownBadges: [...lastKnownBadges],
                    newBadges
                });

                // Show notifications for new badges
                newBadges.forEach(badge => {
                    const message = badgeMessages[badge] || '✨ New achievement unlocked!';
                    console.log('Showing notification for badge:', badge);
                    notificationStore.showNotification(message, 'achievement');
                });

                // Update last known badges
                lastKnownBadges = currentBadges;
                set([...currentBadges]);
            });
        },
        cleanup: () => {
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
            }
        }
    };
}

export const achievementStore = createAchievementStore(); 