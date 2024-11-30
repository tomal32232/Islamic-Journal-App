import { writable } from 'svelte/store';

export const prayerTimesCache = writable({
  data: null,
  timestamp: null
});

export function setCachedPrayerTimes(data) {
  prayerTimesCache.set({
    data,
    timestamp: new Date().getTime()
  });
}

export function getCachedPrayerTimes() {
  let cache;
  prayerTimesCache.subscribe(value => cache = value)();
  
  if (!cache?.data || !cache?.timestamp) return null;
  
  // Cache expires after 12 hours
  const now = new Date().getTime();
  const expired = now - cache.timestamp > 12 * 60 * 60 * 1000;
  
  return expired ? null : cache.data;
} 