import { writable } from 'svelte/store';

export const onboardingComplete = writable(false);
export const currentSlide = writable(0);
export const locationPermissionGranted = writable(false);
export const notificationPermissionGranted = writable(false);

// Function to check if onboarding has been completed before
export const checkOnboardingStatus = () => {
    try {
        console.log('Checking onboarding status...');
        const completed = localStorage.getItem('onboardingComplete');
        console.log('Onboarding status from localStorage:', completed);
        
        if (completed === 'true') {
            console.log('Onboarding was previously completed, setting store to true');
            onboardingComplete.set(true);
        } else {
            console.log('Onboarding not completed, resetting to initial state');
            // Reset to initial state if not completed
            resetOnboarding();
        }
    } catch (error) {
        console.error('Error checking onboarding status:', error);
        // If there's an error accessing localStorage, assume onboarding is needed
        resetOnboarding();
    }
};

// Function to mark onboarding as complete
export const completeOnboarding = () => {
    try {
        console.log('Marking onboarding as complete...');
        localStorage.setItem('onboardingComplete', 'true');
        onboardingComplete.set(true);
        console.log('Onboarding marked as complete successfully');
    } catch (error) {
        console.error('Error completing onboarding:', error);
        throw error; // Rethrow to allow caller to handle
    }
};

// Function to reset onboarding state
export const resetOnboarding = () => {
    try {
        console.log('Resetting onboarding state...');
        localStorage.removeItem('onboardingComplete');
        onboardingComplete.set(false);
        currentSlide.set(0);
        locationPermissionGranted.set(false);
        notificationPermissionGranted.set(false);
        console.log('Onboarding state reset successfully');
    } catch (error) {
        console.error('Error resetting onboarding:', error);
    }
}; 