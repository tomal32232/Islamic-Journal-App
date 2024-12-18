import { writable, derived } from 'svelte/store';
import { badges } from '../data/badges';
import { auth } from '../firebase';
import { db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

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

  return {
    subscribe,
    
    // Initialize the store with user's badges from Firestore
    async init(userId) {
      const userDoc = doc(db, 'users', userId, 'achievements', 'badges');
      
      // Set up real-time listener
      onSnapshot(userDoc, (doc) => {
        if (doc.exists()) {
          set({ ...doc.data(), lastUpdated: new Date() });
        } else {
          // Initialize with empty data if no document exists
          const initialData = { earnedBadges: [], progress: {}, lastUpdated: new Date() };
          setDoc(userDoc, initialData);
          set(initialData);
        }
      });
    },

    // Update progress for a specific badge type
    async updateProgress(type, value, silent = false) {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      console.log('=== Updating Badge Progress ===');
      console.log('Type:', type);
      console.log('Value:', value);

      const userDoc = doc(db, 'users', userId, 'achievements', 'badges');
      
      update(state => {
        console.log('Current state:', state);
        const progress = { ...state.progress };
        
        // Store progress with both formats for backward compatibility
        progress[type] = value;
        progress[`${type}_progress`] = value;
        
        console.log('Updated progress:', progress);

        // Check if any new badges should be earned
        const earnedBadges = [...state.earnedBadges];
        const newlyEarnedBadges = [];
        
        // Helper function to check if badge should be earned
        const checkAndAddBadge = (badge) => {
          if (earnedBadges.includes(badge.id)) return;
          
          let earned = false;
          // Try both formats for progress value
          const currentValue = progress[badge.requirement.type] || 
                             progress[`${badge.requirement.type}_progress`] || 0;
          
          switch (badge.requirement.type) {
            case 'streak':
              earned = currentValue >= badge.requirement.count;
              break;
            case 'ontime_fajr':
              earned = currentValue >= badge.requirement.count;
              break;
            case 'daily_reading':
              earned = currentValue >= badge.requirement.minutes;
              break;
            case 'juz_completion':
              earned = currentValue >= badge.requirement.count;
              break;
            case 'daily_dhikr':
              earned = currentValue >= badge.requirement.count;
              break;
            case 'dhikr_streak':
              earned = currentValue >= badge.requirement.days;
              break;
            case 'journal_entries':
              earned = currentValue >= badge.requirement.count;
              break;
            case 'journal_streak':
              earned = currentValue >= badge.requirement.days;
              break;
          }

          if (earned) {
            earnedBadges.push(badge.id);
            newlyEarnedBadges.push(badge);
          }
        };

        // Check all badge categories
        Object.values(badges).forEach(category => {
          Object.values(category).forEach(badgeList => {
            badgeList.forEach(badge => {
              if (badge.requirement.type === type) {
                checkAndAddBadge(badge);
              }
            });
          });
        });

        // Show notifications for newly earned badges
        if (!silent && newlyEarnedBadges.length > 0) {
          newlyEarnedBadges.forEach(badge => {
            toastStore.addToast({
              type: 'badge',
              title: 'New Badge Earned!',
              message: `Congratulations! You've earned the "${badge.name}" badge!`,
              badge: badge
            });
          });
        }

        // Update Firestore
        const updatedData = { 
          earnedBadges, 
          progress,
          lastUpdated: new Date()
        };
        console.log('Saving to Firestore:', updatedData);
        setDoc(userDoc, updatedData, { merge: true });

        return updatedData;
      });
    },

    // Get all available badges
    getAllBadges() {
      return badges;
    },

    // Get earned badges with details
    getEarnedBadges(earnedBadgeIds) {
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