import { writable } from 'svelte/store';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export const trialStore = writable({
    isInTrial: false,
    trialEndDate: null,
    hasTrialEnded: false
});

// Constants
const TRIAL_DURATION_DAYS = 3;
const TRIAL_COLLECTION = 'trials';

// Initialize trial status
export async function initializeTrialStatus(userId) {
    const db = getFirestore();
    const trialRef = doc(db, TRIAL_COLLECTION, userId);
    
    try {
        const trialDoc = await getDoc(trialRef);
        if (trialDoc.exists()) {
            const trialData = trialDoc.data();
            updateTrialStatus(trialData.trialEndDate);
            return trialData;
        }
        return null;
    } catch (error) {
        console.error('Error initializing trial status:', error);
        throw error;
    }
}

// Check if trial exists
export async function checkTrialExists(userId) {
    const db = getFirestore();
    const trialRef = doc(db, TRIAL_COLLECTION, userId);
    
    try {
        const trialDoc = await getDoc(trialRef);
        return trialDoc.exists();
    } catch (error) {
        console.error('Error checking trial existence:', error);
        return false;
    }
}

// Start trial
export async function startTrial(userId) {
    console.log('Starting trial creation process for user:', userId);
    const db = getFirestore();
    const trialRef = doc(db, TRIAL_COLLECTION, userId);
    
    try {
        // Check if trial already exists
        console.log('Checking if trial exists...');
        const trialDoc = await getDoc(trialRef);
        if (trialDoc.exists()) {
            console.log('Trial already exists:', trialDoc.data());
            const existingTrial = trialDoc.data();
            updateTrialStatus(existingTrial.trialEndDate);
            return existingTrial;
        }
        
        console.log('No existing trial found, creating new trial...');
        // Calculate trial end date
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);
        
        const trialData = {
            startDate: serverTimestamp(),
            trialEndDate: trialEndDate.toISOString(),
            userId,
            createdAt: serverTimestamp()
        };
        
        console.log('Saving trial data to Firestore:', trialData);
        // Save to Firestore
        await setDoc(trialRef, trialData);
        console.log('Trial data saved successfully');
        
        // Update store
        const status = {
            isInTrial: true,
            trialEndDate: trialEndDate.toISOString(),
            hasTrialEnded: false
        };
        trialStore.set(status);
        console.log('Trial store updated:', status);
        
        return trialData;
    } catch (error) {
        console.error('Error starting trial:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Check and update trial status
export function updateTrialStatus(trialEndDate) {
    if (!trialEndDate) return null;
    
    const now = new Date();
    const endDate = new Date(trialEndDate);
    const isInTrial = now < endDate;
    const hasTrialEnded = now >= endDate;
    
    const status = {
        isInTrial,
        trialEndDate,
        hasTrialEnded
    };
    
    trialStore.set(status);
    return status;
}

// Get remaining trial time
export function getTrialTimeRemaining() {
    let status;
    trialStore.subscribe(s => status = s)();
    
    if (!status.trialEndDate) return null;
    
    const now = new Date();
    const endDate = new Date(status.trialEndDate);
    const diffTime = endDate.getTime() - now.getTime();
    
    if (diffTime <= 0) return { days: 0, hours: 0, minutes: 0 };
    
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
}

// Format trial time remaining
export function formatTrialTimeRemaining(time) {
    if (!time) return '';
    
    if (time.days > 0) {
        return `${time.days}d ${time.hours}h remaining`;
    } else if (time.hours > 0) {
        return `${time.hours}h ${time.minutes}m remaining`;
    } else {
        return `${time.minutes}m remaining`;
    }
} 