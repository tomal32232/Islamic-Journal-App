import { writable } from 'svelte/store';

export const onboardingComplete = writable(false);
export const currentSlide = writable(0);
export const locationPermissionGranted = writable(false);
export const notificationPermissionGranted = writable(false);

// Function to check if onboarding has been completed before
export const checkOnboardingStatus = () => {
    const completed = localStorage.getItem('onboardingComplete');
    if (completed === 'true') {
        onboardingComplete.set(true);
    }
};

// Function to mark onboarding as complete
export const completeOnboarding = () => {
    localStorage.setItem('onboardingComplete', 'true');
    onboardingComplete.set(true);
}; 