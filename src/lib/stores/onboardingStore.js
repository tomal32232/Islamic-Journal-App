import { writable } from 'svelte/store';

export const onboardingComplete = writable(false);
export const currentSlide = writable(0);
export const locationPermissionGranted = writable(false);
export const notificationPermissionGranted = writable(false);

// Function to check if onboarding has been completed before
export const checkOnboardingStatus = () => {
    try {
        const completed = localStorage.getItem('onboardingComplete');
        if (completed === 'true') {
            onboardingComplete.set(true);
        } else {
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
        localStorage.setItem('onboardingComplete', 'true');
        onboardingComplete.set(true);
    } catch (error) {
        console.error('Error completing onboarding:', error);
    }
};

// Function to reset onboarding state
export const resetOnboarding = () => {
    try {
        localStorage.removeItem('onboardingComplete');
        onboardingComplete.set(false);
        currentSlide.set(0);
        locationPermissionGranted.set(false);
        notificationPermissionGranted.set(false);
    } catch (error) {
        console.error('Error resetting onboarding:', error);
    }
}; 