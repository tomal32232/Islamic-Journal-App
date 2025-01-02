import { writable } from 'svelte/store';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

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
  try {
    if (Capacitor.isNativePlatform()) {
      // Request permissions first
      const permissionStatus = await Geolocation.checkPermissions();
      
      // Check if we have any required permission
      const hasPermission = permissionStatus.location === 'granted' || permissionStatus.coarseLocation === 'granted';
      
      if (!hasPermission) {
        const requestResult = await Geolocation.requestPermissions();
        
        // Check if either permission was granted
        const wasGranted = requestResult.location === 'granted' || requestResult.coarseLocation === 'granted';
        if (!wasGranted) {
          throw new Error('Location permission was denied');
        }
      }
      
      // First try with high accuracy and longer timeout
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000, // 30 seconds timeout for GPS fix
          maximumAge: 0
        });
        
        // If accuracy is poor (> 100 meters), try again
        if (position.coords.accuracy > 100) {
          // Wait 2 seconds and try again
          await new Promise(resolve => setTimeout(resolve, 2000));
          const betterPosition = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
          
          // Use the more accurate position
          if (betterPosition.coords.accuracy < position.coords.accuracy) {
            return {
              latitude: betterPosition.coords.latitude,
              longitude: betterPosition.coords.longitude,
              accuracy: betterPosition.coords.accuracy
            };
          }
        }
        
        if (!position || !position.coords) {
          throw new Error('No location data received');
        }
        
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
      } catch (highAccuracyError) {
        // Fall back to low accuracy if high accuracy fails
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 0
        });
        
        if (!position || !position.coords) {
          throw new Error('No location data received');
        }
        
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
      }
    } else {
      // Web platform
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser'));
          return;
        }
        
        const options = {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0
        };
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          (error) => {
            reject(new Error(getGeolocationErrorMessage(error)));
          },
          options
        );
      });
    }
  } catch (error) {
    console.error('Location error:', error);
    throw new Error('Failed to get location: ' + error.message);
  }
}

function getGeolocationErrorMessage(error) {
  switch(error.code) {
    case 1:
      return 'Location permission denied';
    case 2:
      return 'Location unavailable. Please check your device settings';
    case 3:
      return 'Location request timed out';
    default:
      return 'Unable to get location';
  }
}

export async function fetchPrayerTimes() {
  try {
    loadingStore.set(true);
    errorStore.set(null);
    
    console.log('Fetching location...');
    const coords = await getCurrentLocation();
    console.log('Location received:', coords);
    console.log('Location accuracy (meters):', coords.accuracy);
    
    // Get location name
    console.log('Fetching location name...');
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`
    );
    const locationData = await response.json();
    console.log('Location data:', locationData);
    locationStore.set(`${locationData.city}, ${locationData.countryName}`);
    
    // Get prayer times
    const date = new Date();
    const timestamp = Math.floor(date.getTime() / 1000);
    
    console.log('Fetching prayer times...');
    const prayerResponse = await fetch(
      `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${coords.latitude}&longitude=${coords.longitude}&method=2`
    );
    
    if (!prayerResponse.ok) {
      throw new Error('Failed to fetch prayer times');
    }
    
    const data = await prayerResponse.json();
    console.log('Prayer times received:', data);
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
    errorStore.set(error.message || 'Unable to fetch prayer times. Please check your location settings.');
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
