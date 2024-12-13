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

      const userDoc = doc(db, 'users', userId, 'achievements', 'badges');
      
      update(state => {
        const progress = { ...state.progress };
        const previousValue = progress[type] || 0;
        progress[type] = value;
        
        // Check if any new badges should be earned
        const earnedBadges = [...state.earnedBadges];
        const newlyEarnedBadges = [];
        
        // Helper function to check if badge should be earned
        const checkAndAddBadge = (badge) => {
          if (earnedBadges.includes(badge.id)) return;
          
          let earned = false;
          switch (badge.requirement.type) {
            case 'streak':
              earned = value >= badge.requirement.count;
              break;
            case 'ontime_fajr':
              earned = value >= badge.requirement.count;
              break;
            case 'daily_reading':
              earned = value >= badge.requirement.minutes;
              break;
            case 'juz_completion':
              earned = value >= badge.requirement.count;
              break;
            case 'daily_dhikr':
              earned = value >= badge.requirement.count;
              break;
            case 'dhikr_streak':
              earned = value >= badge.requirement.days;
              break;
            case 'journal_entries':
              earned = value >= badge.requirement.count;
              break;
            case 'journal_streak':
              earned = value >= badge.requirement.days;
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
      Object.values(badges).forEach(category => {
        Object.values(category).forEach(badgeList => {
          badgeList.forEach(badge => {
            if (earnedBadgeIds.includes(badge.id)) {
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