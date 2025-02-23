import { writable } from 'svelte/store';

export const trialStore = writable({
    isInTrial: false,
    trialEndDate: null,
    hasTrialEnded: false
});

// Constants
const TRIAL_DURATION_DAYS = 3;
const TRIAL_STATUS_KEY = 'trial_status';

// Initialize trial status
export function initializeTrialStatus(userId) {
    const savedStatus = localStorage.getItem(`${TRIAL_STATUS_KEY}_${userId}`);
    if (savedStatus) {
        const status = JSON.parse(savedStatus);
        updateTrialStatus(status.trialEndDate);
    }
}

// Start trial
export function startTrial(userId) {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);
    
    const status = {
        isInTrial: true,
        trialEndDate: trialEndDate.toISOString(),
        hasTrialEnded: false
    };
    
    // Save to localStorage
    localStorage.setItem(`${TRIAL_STATUS_KEY}_${userId}`, JSON.stringify(status));
    
    // Update store
    trialStore.set(status);
    
    return status;
}

// Check and update trial status
export function updateTrialStatus(trialEndDate) {
    if (!trialEndDate) return;
    
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