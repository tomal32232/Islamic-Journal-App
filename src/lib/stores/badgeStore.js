import { writable, derived, get } from 'svelte/store';
import { badges } from '../data/badges';
import { auth } from '../firebase';
import { db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { achievementStore } from './achievementStore';
import { notificationStore } from './notificationStore';

// Debounce helper function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 1000; // 1 second
const UPDATE_DEBOUNCE_TIME = 2000; // 2 seconds
let lastUpdate = 0;

// Create a toast store for badge notifications
const createToastStore = () => {
  const { subscribe, set, update } = writable([]);
  
  return {
    subscribe,
    addToast: (message) => {
      update(toasts => [...toasts, message]);
      setTimeout(() => {
        update(toasts => toasts.slice(1));
      }, 3000);
    }
  };
};

export const toastStore = createToastStore();

function createBadgeStore() {
  const { subscribe, set, update } = writable({
    earnedBadges: [],
    progress: {},
    lastUpdated: null
  });

  let initialized = false;

  // Helper function to check if a badge should be earned
  const checkBadgeEarned = (badge, progress) => {
    const currentValue = progress[badge.requirement.type] || 
                        progress[`${badge.requirement.type}_progress`] || 0;
    
    switch (badge.requirement.type) {
      case 'streak':
        return currentValue >= badge.requirement.count;
      case 'ontime_fajr':
        return currentValue >= badge.requirement.count;
      case 'daily_reading':
        return currentValue >= badge.requirement.minutes;
      case 'juz_completion':
        return currentValue >= badge.requirement.count;
      case 'daily_dhikr':
        return currentValue >= badge.requirement.count;
      case 'dhikr_streak':
        return currentValue >= badge.requirement.days;
      case 'journal_entries':
        return currentValue >= badge.requirement.count;
      case 'journal_streak':
        return currentValue >= badge.requirement.days;
      default:
        return false;
    }
  };

  // Function to verify and update earned badges based on progress
  const verifyEarnedBadges = (progress, currentEarnedBadges = []) => {
    const earnedBadges = [...currentEarnedBadges];
    const newlyEarnedBadges = [];

    Object.values(badges).forEach(category => {
      Object.values(category).forEach(badgeList => {
        badgeList.forEach(badge => {
          if (!earnedBadges.includes(badge.id) && checkBadgeEarned(badge, progress)) {
            // console.log(`Verifying badge ${badge.id} - should be earned`);
            earnedBadges.push(badge.id);
            newlyEarnedBadges.push(badge);
          }
        });
      });
    });

    return { earnedBadges, newlyEarnedBadges };
  };

  // Create debounced update function
  const debouncedUpdate = debounce(async (updatedData, userDoc) => {
    await setDoc(userDoc, updatedData, { merge: true });
  }, UPDATE_DEBOUNCE_TIME);

  return {
    subscribe,
    
    init: async (userId) => {
      if (!userId) {
        set({ earnedBadges: [], progress: {}, lastUpdated: null });
        return;
      }

      console.log('Initializing badge store for user:', userId);
      
      try {
        // Get initial badge data
        const userDoc = doc(db, 'users', userId, 'achievements', 'badges');
        const docSnap = await getDoc(userDoc);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          set({
            earnedBadges: data.earnedBadges || [],
            progress: data.progress || {},
            lastUpdated: data.lastUpdated || null
          });
        }

        // Set up real-time listener for badge updates
        const unsubscribe = onSnapshot(userDoc, (doc) => {
          if (!doc.exists()) return;
          
          const data = doc.data();
          console.log('Badge data updated:', data);
          
          set({
            earnedBadges: data.earnedBadges || [],
            progress: data.progress || {},
            lastUpdated: data.lastUpdated || null
          });
        });

        initialized = true;
        return unsubscribe;
      } catch (error) {
        console.error('Error initializing badge store:', error);
      }
    },
    
    // Update progress for a specific badge type with rate limiting
    async updateProgress(type, value, silent = false) {
      const now = Date.now();
      if (now - lastUpdate < RATE_LIMIT_WINDOW) {
        console.log('Skipping update due to rate limiting');
        return;
      }
      lastUpdate = now;

      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('No user ID found for badge update');
        return;
      }

      const userDoc = doc(db, 'users', userId, 'achievements', 'badges');
      
      try {
        console.log(`Updating badge progress for ${type}:`, value);
        const docSnap = await getDoc(userDoc);
        const exists = docSnap.exists();
        const currentData = exists ? docSnap.data() : { earnedBadges: [], progress: {} };
        
        // Update progress
        const updatedProgress = {
          ...currentData.progress,
          [type]: value
        };
        
        // Check for newly earned badges
        const { earnedBadges, newlyEarnedBadges } = verifyEarnedBadges(
          updatedProgress,
          currentData.earnedBadges || []
        );

        // Log badge verification results
        console.log('Badge verification results:', {
          currentBadges: currentData.earnedBadges || [],
          newBadges: newlyEarnedBadges.map(b => b.id),
          totalEarned: earnedBadges.length
        });

        // Update Firestore
        const updatedData = {
          earnedBadges,
          progress: updatedProgress,
          lastUpdated: new Date()
        };

        await setDoc(userDoc, updatedData, { merge: true });
        
        // Update local store
        set(updatedData);

        // Trigger notifications for newly earned badges
        if (newlyEarnedBadges.length > 0 && !silent) {
          console.log('Triggering notifications for new badges:', 
            newlyEarnedBadges.map(badge => ({
              id: badge.id,
              name: badge.name,
              notification: badge.notification
            }))
          );
          newlyEarnedBadges.forEach(badge => {
            const message = badge.notification || `🎉 New achievement unlocked: ${badge.name}!`;
            console.log('Showing notification with message:', message);
            notificationStore.showNotification(message, 'achievement');
          });
        }

        return newlyEarnedBadges;
      } catch (error) {
        console.error('Error updating badge progress:', error);
      }
    },

    // Get all available badges
    getAllBadges() {
      return badges;
    },

    // Get earned badges with details
    getEarnedBadges(earnedBadgeIds) {
      // console.log('Getting earned badges for IDs:', earnedBadgeIds);
      const earnedBadges = [];
      
      // Map legacy badge IDs to new format
      const mappedBadgeIds = earnedBadgeIds.map(id => {
        // Map "total_prayers_1" to "prayer_streak_1"
        if (id === 'total_prayers_1') return 'prayer_streak_1';
        return id;
      });
      
      Object.values(badges).forEach(category => {
        Object.values(category).forEach(badgeList => {
          badgeList.forEach(badge => {
            if (mappedBadgeIds.includes(badge.id)) {
              earnedBadges.push(badge);
            }
          });
        });
      });
      // console.log('Processed earned badges:', earnedBadges);
      return earnedBadges;
    },

    // Get badge progress for a specific type
    getProgress(type) {
      return get(this)?.progress?.[type] || 0;
    },

    // Reset store
    reset() {
      set({ earnedBadges: [], progress: {}, lastUpdated: new Date() });
    }
  };
}

export const badgeStore = createBadgeStore(); 