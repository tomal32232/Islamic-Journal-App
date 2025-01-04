import { writable, derived, get } from 'svelte/store';
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

  return {
    subscribe,
    
    // Initialize the store with user's badges from Firestore
    async init(userId) {
      // console.log('Initializing badge store for user:', userId);
      const userDoc = doc(db, 'users', userId, 'achievements', 'badges');
      
      // Set up real-time listener
      onSnapshot(userDoc, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          // console.log('Loaded badge data from Firestore:', data);
          
          // Verify earned badges based on progress
          const { earnedBadges, newlyEarnedBadges } = verifyEarnedBadges(data.progress || {}, data.earnedBadges || []);
          
          // If we found badges that should be earned but aren't recorded
          if (newlyEarnedBadges.length > 0) {
            // console.log('Found unrecorded earned badges:', newlyEarnedBadges);
            const updatedData = {
              ...data,
              earnedBadges,
              progress: data.progress || {},
              lastUpdated: new Date()
            };
            
            // Update Firestore with the corrected earned badges
            setDoc(userDoc, updatedData, { merge: true })
              // .then(() => console.log('Updated earned badges in Firestore'))
              // .catch(error => console.error('Error updating earned badges:', error));
            
            set(updatedData);
          } else {
            set({ 
              earnedBadges: data.earnedBadges || [], 
              progress: data.progress || {}, 
              lastUpdated: new Date() 
            });
          }
        } else {
          // console.log('No badge document exists, creating initial data');
          const initialData = { earnedBadges: [], progress: {}, lastUpdated: new Date() };
          setDoc(userDoc, initialData);
          set(initialData);
        }
      });
    },

    // Update progress for a specific badge type
    async updateProgress(type, value, silent = false) {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        // console.error('No user ID available for updating badge progress');
        return;
      }

      // console.log('=== Updating Badge Progress ===');
      // console.log('Type:', type);
      // console.log('Value:', value);

      const userDoc = doc(db, 'users', userId, 'achievements', 'badges');
      
      // First check if the document exists
      const docSnap = await getDoc(userDoc);
      const exists = docSnap.exists();
      // console.log('Document exists:', exists);

      update(state => {
        // console.log('Current state before update:', {
        //   earnedBadges: state.earnedBadges,
        //   progress: state.progress,
        //   lastUpdated: state.lastUpdated
        // });
        const progress = exists ? { ...docSnap.data().progress } : {};
        const earnedBadges = exists ? [...docSnap.data().earnedBadges] : [];
        
        // Store progress with both formats for backward compatibility
        progress[type] = value;
        progress[`${type}_progress`] = value;
        
        // console.log('Updated progress:', progress);

        // Check if any new badges should be earned
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

        // Update Firestore
        const updatedData = { 
          earnedBadges, 
          progress,
          lastUpdated: new Date()
        };
        // console.log('=== Saving to Firestore ===');
        // console.log('Document path:', `users/${userId}/achievements/badges`);
        // console.log('Updated data:', JSON.stringify(updatedData, null, 2));
        // console.log('Changed fields:', Object.keys(updatedData));
        // console.log('Document exists:', exists);
        // console.log('Previous earnedBadges:', exists ? docSnap.data().earnedBadges : []);
        // console.log('New earnedBadges:', earnedBadges);
        
        if (!exists) {
          // If document doesn't exist, create it
          // console.log('Creating new badge document');
          setDoc(userDoc, updatedData)
            // .then(() => console.log('Successfully created badge document'))
            // .catch(error => {
            //   console.error('Error creating badge document:', error);
            //   console.error('Error details:', {
            //     code: error.code,
            //     message: error.message,
            //     details: error.details
            //   });
            // });
        } else {
          // If document exists, update it
          // console.log('Updating existing badge document');
          setDoc(userDoc, updatedData, { merge: true })
            // .then(() => console.log('Successfully updated badge document'))
            // .catch(error => {
            //   console.error('Error updating badge document:', error);
            //   console.error('Error details:', {
            //     code: error.code,
            //     message: error.message,
            //     details: error.details
            //   });
            // });
        }

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