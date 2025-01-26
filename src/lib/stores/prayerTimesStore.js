import { writable } from 'svelte/store';

// Create a writable store for prayer times
export const prayerTimesStore = writable([]);

// Initialize with empty array, will be populated when prayer times are fetched 