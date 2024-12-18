import { writable } from 'svelte/store';

export const prayerTimesStore = writable([]);
export const loadingStore = writable(true);
export const errorStore = writable(null);
export const locationStore = writable('');

function formatTo12Hour(time24) {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export async function getCurrentLocation() {
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

export async function fetchPrayerTimes() {
  try {
    loadingStore.set(true);
    errorStore.set(null);
    
    const coords = await getCurrentLocation();
    
    // Get location name
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`
    );
    const locationData = await response.json();
    locationStore.set(`${locationData.city}, ${locationData.countryName}`);
    
    // Get prayer times
    const date = new Date();
    const timestamp = Math.floor(date.getTime() / 1000);
    
    const prayerResponse = await fetch(
      `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${coords.latitude}&longitude=${coords.longitude}&method=2`
    );
    
    if (!prayerResponse.ok) {
      throw new Error('Failed to fetch prayer times');
    }
    
    const data = await prayerResponse.json();
    const timings = data.data.timings;
    
    const prayers = [
      { 
        name: 'Fajr', 
        time: formatTo12Hour(timings.Fajr), 
        done: false, 
        icon: 'SunDim', 
        weight: 'regular',
        isPast: isPrayerPast(timings.Fajr)
      },
      { name: 'Dhuhr', time: formatTo12Hour(timings.Dhuhr), done: false, icon: 'Sun', weight: 'fill', isPast: isPrayerPast(timings.Dhuhr) },
      { name: 'Asr', time: formatTo12Hour(timings.Asr), done: false, icon: 'CloudSun', weight: 'regular', isPast: isPrayerPast(timings.Asr) },
      { name: 'Maghrib', time: formatTo12Hour(timings.Maghrib), done: false, icon: 'SunHorizon', weight: 'regular', isPast: isPrayerPast(timings.Maghrib) },
      { name: 'Isha', time: formatTo12Hour(timings.Isha), done: false, icon: 'MoonStars', weight: 'regular', isPast: isPrayerPast(timings.Isha) }
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

function isPrayerPast(time24) {
  const now = new Date();
  const [hours, minutes] = time24.split(':');
  const prayerDate = new Date();
  prayerDate.setHours(parseInt(hours), parseInt(minutes), 0);
  return now > prayerDate;
}
