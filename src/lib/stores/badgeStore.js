import { writable, derived, get } from 'svelte/store';
import { badges } from '../data/badges';
import { auth } from '../firebase';
import { db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

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
    
    // Initialize the store with user's badges from Firestore
    async init(userId) {
      const userDoc = doc(db, 'users', userId, 'achievements', 'badges');
      
      // Set up real-time listener with rate limiting
      onSnapshot(userDoc, (doc) => {
        const now = Date.now();
        if (now - lastUpdate < RATE_LIMIT_WINDOW) {
          return; // Skip update if within rate limit window
        }
        lastUpdate = now;

        if (doc.exists()) {
          const data = doc.data();
          const { earnedBadges, newlyEarnedBadges } = verifyEarnedBadges(data.progress || {}, data.earnedBadges || []);
          
          if (newlyEarnedBadges.length > 0) {
            const updatedData = {
              ...data,
              earnedBadges,
              progress: data.progress || {},
              lastUpdated: new Date()
            };
            
            // Use debounced update
            debouncedUpdate(updatedData, userDoc);
            
            set(updatedData);
          } else {
            set({ 
              earnedBadges: data.earnedBadges || [], 
              progress: data.progress || {}, 
              lastUpdated: new Date() 
            });
          }
        } else {
          const initialData = { earnedBadges: [], progress: {}, lastUpdated: new Date() };
          debouncedUpdate(initialData, userDoc);
          set(initialData);
        }
      });
    },
    
    // Update progress for a specific badge type with rate limiting
    async updateProgress(type, value, silent = false) {
      const now = Date.now();
      if (now - lastUpdate < RATE_LIMIT_WINDOW) {
        return; // Skip update if within rate limit window
      }
      lastUpdate = now;

      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userDoc = doc(db, 'users', userId, 'achievements', 'badges');
      const docSnap = await getDoc(userDoc);
      const exists = docSnap.exists();

      update(state => {
        const progress = exists ? { ...docSnap.data().progress } : {};
        const earnedBadges = exists ? [...docSnap.data().earnedBadges] : [];
        
        progress[type] = value;
        
        const newlyEarnedBadges = [];
        
        // Helper function to check if badge should be earned
        const checkAndAddBadge = (badge) => {
          if (earnedBadges.includes(badge.id)) {
            // console.log(`Badge ${badge.id} already earned`);
            return;
          }
          
          let earned = false;
          // Try both formats for progress value
          const currentValue = progress[badge.requirement.type] || 
                           progress[`${badge.requirement.type}_progress`] || 0;
          
          // console.log(`Checking badge ${badge.id}:`, {
          //   currentValue,
          //   requirement: badge.requirement
          // });

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
            // console.log(`Badge ${badge.id} earned!`);
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
          // console.log('New badges earned:', newlyEarnedBadges);
          newlyEarnedBadges.forEach(badge => {
            toastStore.addToast({
              type: 'badge',
              title: 'New Badge Earned!',
              message: `Congratulations! You've earned the "${badge.name}" badge!`,
              badge: badge
            });
          });
        }

        // Use debounced update for Firestore
        const updatedData = { 
          earnedBadges, 
          progress,
          lastUpdated: new Date()
        };
        debouncedUpdate(updatedData, userDoc);

        return updatedData;
      });
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