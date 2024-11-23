import { writable } from 'svelte/store';

export const prayerTimesStore = writable([]);
export const loadingStore = writable(true);
export const errorStore = writable(null);
export const locationStore = writable('');

async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (error) => reject(error)
    );
  });
}

async function getLocationName(latitude, longitude) {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );
    const data = await response.json();
    return `${data.city}, ${data.countryName}`;
  } catch (error) {
    console.error('Error fetching location name:', error);
    return 'Location unavailable';
  }
}

export async function fetchPrayerTimes() {
  try {
    loadingStore.set(true);
    errorStore.set(null);
    
    const coords = await getCurrentLocation();
    const locationName = await getLocationName(coords.latitude, coords.longitude);
    locationStore.set(locationName);
    
    const date = new Date();
    const timestamp = Math.floor(date.getTime() / 1000);
    
    const response = await fetch(
      `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${coords.latitude}&longitude=${coords.longitude}&method=2`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch prayer times');
    }
    
    const data = await response.json();
    const timings = data.data.timings;
    
    const prayers = [
      { name: 'Fajr', time: timings.Fajr, done: false, icon: 'SunDim', weight: 'regular' },
      { name: 'Dhuhr', time: timings.Dhuhr, done: false, icon: 'Sun', weight: 'fill' },
      { name: 'Asr', time: timings.Asr, done: false, icon: 'CloudSun', weight: 'regular' },
      { name: 'Maghrib', time: timings.Maghrib, done: false, icon: 'SunHorizon', weight: 'regular' },
      { name: 'Isha', time: timings.Isha, done: false, icon: 'MoonStars', weight: 'regular' }
    ];
    
    prayerTimesStore.set(prayers);
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    errorStore.set('Unable to fetch prayer times. Please check your location settings.');
    locationStore.set('Location unavailable');
  } finally {
    loadingStore.set(false);
  }
} 