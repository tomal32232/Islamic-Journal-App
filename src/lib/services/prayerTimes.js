import { writable } from 'svelte/store';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { get } from 'svelte/store';

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
    console.log('Starting location fetch...');
    if (Capacitor.isNativePlatform()) {
      console.log('Running on native platform (iOS/Android)');
      // Request permissions first
      const permissionStatus = await Geolocation.checkPermissions();
      console.log('Current permission status:', permissionStatus);
      
      // Check if we have any required permission
      const hasPermission = permissionStatus.location === 'granted' || permissionStatus.coarseLocation === 'granted';
      console.log('Has location permission:', hasPermission);
      
      if (!hasPermission) {
        console.log('Requesting location permission...');
        const requestResult = await Geolocation.requestPermissions();
        console.log('Permission request result:', requestResult);
        
        // Check if either permission was granted
        const wasGranted = requestResult.location === 'granted' || requestResult.coarseLocation === 'granted';
        if (!wasGranted) {
          throw new Error('Location permission was denied');
        }
      }
      
      // Clear any existing position cache
      try {
        console.log('Clearing any cached positions...');
        await Geolocation.clearWatch({ id: 'any' });
      } catch (e) {
        console.log('No cached positions to clear');
      }
      
      // First try with high accuracy and shorter timeout
      try {
        console.log('Attempting high accuracy GPS location...');
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000, // Increased timeout for better GPS fix
          maximumAge: 0 // Force fresh reading
        });

        // Extract coordinates from position object
        if (position && position.coords) {
          console.log('High accuracy GPS location obtained:', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(position.timestamp).toISOString()
          });
          return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
        }
        throw new Error('Invalid position data received');
      } catch (highAccuracyError) {
        console.log('High accuracy GPS failed:', highAccuracyError);
        console.log('Trying network-based location as fallback...');
        // Fall back to network location if GPS fails
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 0 // Force fresh reading
        });
        
        if (!position || !position.coords) {
          throw new Error('No location data received');
        }
        
        console.log('Network-based location obtained:', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString()
        });
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
      }
    } else {
      console.log('Running on web platform');
      // Web platform
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser'));
          return;
        }
        
        const options = {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        };
        
        console.log('Requesting web browser location...');
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('Web browser location obtained:', {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          (error) => {
            console.error('Web browser location error:', error);
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
    
    console.log('Starting prayer times fetch process...');
    const coords = await getCurrentLocation();
    console.log('Location coordinates received:', coords);
    
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
      console.error('Invalid coordinates:', coords);
      throw new Error('Invalid location data received');
    }
    
    console.log('Location accuracy (meters):', coords.accuracy);
    
    // Get location name with retry
    console.log('Fetching location name from BigDataCloud API...');
    let locationData;
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`;
      console.log('BigDataCloud API URL:', url);
      
      const response = await fetch(url);
      locationData = await response.json();
      console.log('Full BigDataCloud response:', JSON.stringify(locationData, null, 2));
      
      // Try to get the most accurate city name using multiple fields
      const cityName = locationData.locality || 
                      locationData.city || 
                      locationData.localityInfo?.administrative?.find(a => a.adminLevel === 8)?.name ||
                      'Unknown City';
                      
      // Simplify country name by removing "(the)" if present
      const countryName = locationData.countryName.replace(' (the)', '');
                       
      const locationString = `${cityName}, ${countryName}`;
        
      console.log('Available location fields:', {
        locality: locationData.locality,
        city: locationData.city,
        administrative: locationData.localityInfo?.administrative?.find(a => a.adminLevel === 8)?.name,
        countryName: locationData.countryName
      });
      
      console.log('Final location string:', locationString);
      locationStore.set(locationString);
    } catch (error) {
      console.error('Error fetching location name:', error);
      locationStore.set('Location name unavailable');
    }
    
    // Get prayer times with retry
    const date = new Date();
    const timestamp = Math.floor(date.getTime() / 1000);
    
    console.log('Fetching prayer times...');
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        const prayerResponse = await fetch(
          `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${coords.latitude}&longitude=${coords.longitude}&method=2`
        );
        
        if (!prayerResponse.ok) {
          throw new Error(`HTTP error! status: ${prayerResponse.status}`);
        }
        
        const data = await prayerResponse.json();
        console.log('Prayer times received:', data);
        
        if (!data || !data.data || !data.data.timings) {
          throw new Error('Invalid prayer times data format');
        }
        
        const timings = data.data.timings;
        
        const prayers = [
          { 
            name: 'Fajr', 
            time: formatTo12Hour(timings.Fajr), 
            done: false, 
            icon: 'SunDim', 
            weight: 'regular',
            isPast: isPrayerPast(timings.Fajr),
            fetchDate: date.toISOString()
          },
          { name: 'Dhuhr', time: formatTo12Hour(timings.Dhuhr), done: false, icon: 'Sun', weight: 'fill', isPast: isPrayerPast(timings.Dhuhr), fetchDate: date.toISOString() },
          { name: 'Asr', time: formatTo12Hour(timings.Asr), done: false, icon: 'CloudSun', weight: 'regular', isPast: isPrayerPast(timings.Asr), fetchDate: date.toISOString() },
          { name: 'Maghrib', time: formatTo12Hour(timings.Maghrib), done: false, icon: 'SunHorizon', weight: 'regular', isPast: isPrayerPast(timings.Maghrib), fetchDate: date.toISOString() },
          { name: 'Isha', time: formatTo12Hour(timings.Isha), done: false, icon: 'MoonStars', weight: 'regular', isPast: isPrayerPast(timings.Isha), fetchDate: date.toISOString() }
        ];
        
        prayerTimesStore.set(prayers);
        return;
      } catch (error) {
        console.error(`Prayer times fetch attempt ${4 - retries} failed:`, error);
        lastError = error;
        retries--;
        if (retries > 0) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Failed to fetch prayer times after all retries');
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    errorStore.set(error.message || 'Unable to fetch prayer times. Please check your internet connection.');
    locationStore.set('Location unavailable');
    prayerTimesStore.set([]);
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

export function getNextPrayer() {
  const prayers = get(prayerTimesStore);
  if (!prayers || prayers.length === 0) return null;

  const now = new Date();
  for (const prayer of prayers) {
    if (!prayer.time) continue;
    const [time, period] = prayer.time.split(' ');
    const [hours, minutes] = time.split(':');
    let prayerHours = parseInt(hours);
    
    // Convert to 24-hour format
    if (period === 'PM' && prayerHours !== 12) {
      prayerHours += 12;
    } else if (period === 'AM' && prayerHours === 12) {
      prayerHours = 0;
    }

    const prayerTime = new Date();
    prayerTime.setHours(prayerHours, parseInt(minutes), 0);

    if (prayerTime > now) {
      return prayer;
    }
  }

  // If no upcoming prayer found today, return the first prayer for tomorrow
  return prayers[0];
}
