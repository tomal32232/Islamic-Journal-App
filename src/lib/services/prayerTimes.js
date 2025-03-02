import { writable } from 'svelte/store';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { get } from 'svelte/store';

export const prayerTimesStore = writable([]);
export const loadingStore = writable(true);
export const errorStore = writable(null);
export const locationStore = writable('');

function formatTo12Hour(time24) {
  try {
    console.log('Converting time to 12-hour format:', time24);
    const [hours, minutes] = time24.split(':').map(num => parseInt(num, 10));
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    // Ensure minutes are padded with leading zero if needed
    const paddedMinutes = minutes.toString().padStart(2, '0');
    const formattedTime = `${hour12}:${paddedMinutes} ${ampm}`;
    console.log('Converted time:', formattedTime);
    return formattedTime;
  } catch (error) {
    console.error('Error formatting time:', error);
    throw error;
  }
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
    
    // Get location name using reverse geocoding
    try {
      const geocodeResponse = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`
      );
      if (geocodeResponse.ok) {
        const locationData = await geocodeResponse.json();
        
        // Add detailed logging of the entire location data
        console.log('LOCATION DATA RECEIVED:', JSON.stringify(locationData, null, 2));
        
        // Try to get the most specific location name available
        let locality = locationData.locality || locationData.city;
        const district = locationData.localityInfo?.administrative?.find(a => a.adminLevel === 2)?.name;
        const state = locationData.principalSubdivision;
        const country = locationData.countryName;
        
        // Log individual fields we're using
        console.log('Locality/City:', locality);
        console.log('District:', district);
        console.log('State/Province:', state);
        console.log('Country:', country);
        
        // If locality contains "District", use state/province instead
        if (locality && locality.toLowerCase().includes('district') && state) {
          console.log('Replacing district with state/province');
          locality = state;
        }
        // If locality is empty but we have district, use that instead
        else if (!locality && district) {
          locality = district;
        }
        
        let locationString = '';
        if (locality) {
          locationString = locality;
          if (country) {
            // Simplify country name if it has parentheses
            let displayCountry = country;
            if (country.includes('(')) {
              displayCountry = country.split('(')[0].trim();
            }
            locationString += `, ${displayCountry}`;
          }
        } else if (state) {
          locationString = state;
          if (country) {
            // Simplify country name if it has parentheses
            let displayCountry = country;
            if (country.includes('(')) {
              displayCountry = country.split('(')[0].trim();
            }
            locationString += `, ${displayCountry}`;
          }
        } else if (country) {
          // Simplify country name if it has parentheses
          let displayCountry = country;
          if (country.includes('(')) {
            displayCountry = country.split('(')[0].trim();
          }
          locationString = displayCountry;
        }
        
        console.log('Final location string:', locationString);
        
        if (locationString) {
          locationStore.set(locationString);
        }
      }
    } catch (error) {
      console.error('Error getting location name:', error);
      // Don't throw here, we can still get prayer times even if location name fails
    }
    
    // Get prayer times with retry
    const date = new Date();
    const timestamp = Math.floor(date.getTime() / 1000);
    
    console.log('Fetching prayer times from API...');
    console.log('Using coordinates:', {
      latitude: coords.latitude,
      longitude: coords.longitude,
      timestamp: timestamp,
      date: date.toISOString()
    });
    
    const prayerResponse = await fetch(
      `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${coords.latitude}&longitude=${coords.longitude}&method=2&adjustment=1`
    );
    
    if (!prayerResponse.ok) {
      throw new Error(`HTTP error! status: ${prayerResponse.status}`);
    }
    
    const data = await prayerResponse.json();
    console.log('Raw prayer times received:', data);
    
    if (!data || !data.data || !data.data.timings) {
      throw new Error('Invalid prayer times data format');
    }
    
    const timings = data.data.timings;
    console.log('Processing prayer times:', timings);
    
    const prayers = [
      { 
        name: 'Fajr', 
        time: formatTo12Hour(timings.Fajr), 
        originalTime: timings.Fajr,
        done: false, 
        icon: 'SunDim', 
        weight: 'regular',
        isPast: isPrayerPast(timings.Fajr),
        fetchDate: date.toISOString()
      },
      { 
        name: 'Dhuhr', 
        time: formatTo12Hour(timings.Dhuhr), 
        originalTime: timings.Dhuhr,
        done: false, 
        icon: 'Sun', 
        weight: 'fill', 
        isPast: isPrayerPast(timings.Dhuhr), 
        fetchDate: date.toISOString() 
      },
      { 
        name: 'Asr', 
        time: formatTo12Hour(timings.Asr), 
        originalTime: timings.Asr,
        done: false, 
        icon: 'CloudSun', 
        weight: 'regular', 
        isPast: isPrayerPast(timings.Asr), 
        fetchDate: date.toISOString() 
      },
      { 
        name: 'Maghrib', 
        time: formatTo12Hour(timings.Maghrib), 
        originalTime: timings.Maghrib,
        done: false, 
        icon: 'SunHorizon', 
        weight: 'regular', 
        isPast: isPrayerPast(timings.Maghrib), 
        fetchDate: date.toISOString() 
      },
      { 
        name: 'Isha', 
        time: formatTo12Hour(timings.Isha), 
        originalTime: timings.Isha,
        done: false, 
        icon: 'MoonStars', 
        weight: 'regular', 
        isPast: isPrayerPast(timings.Isha), 
        fetchDate: date.toISOString() 
      }
    ];
    
    console.log('Processed prayer times:', prayers);
    prayerTimesStore.set(prayers);
    loadingStore.set(false);
    return prayers;
    
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    errorStore.set(error.message);
    loadingStore.set(false);
    throw error;
  }
}

function isPrayerPast(time24) {
  try {
    const now = new Date();
    const [hours, minutes] = time24.split(':').map(num => parseInt(num, 10));
    const prayerTime = new Date();
    prayerTime.setHours(hours, minutes, 0, 0);

    // If prayer time is in the past for today, consider it as tomorrow's prayer
    if (prayerTime < now) {
      prayerTime.setDate(prayerTime.getDate() + 1);
    }

    return now >= prayerTime;
  } catch (error) {
    console.error('Error checking if prayer is past:', error);
    return false;
  }
}

// Helper function to get prayer time as Date object
export function getPrayerTimeAsDate(time24, timezoneOffset = null) {
  try {
    const [hours, minutes] = time24.split(':').map(num => parseInt(num, 10));
    const prayerTime = new Date();
    prayerTime.setHours(hours, minutes, 0, 0);

    // If we have timezone offset information, adjust the date
    if (timezoneOffset !== null) {
      const currentOffset = new Date().getTimezoneOffset();
      const offsetDiff = currentOffset - timezoneOffset; // Difference in minutes
      
      if (offsetDiff !== 0) {
        prayerTime.setMinutes(prayerTime.getMinutes() + offsetDiff);
        console.log(`Adjusted prayer notification time by ${offsetDiff} minutes for timezone difference`);
      }
    }

    // If prayer time has passed for today, set it for tomorrow
    if (prayerTime < new Date()) {
      prayerTime.setDate(prayerTime.getDate() + 1);
    }

    return prayerTime;
  } catch (error) {
    console.error('Error converting prayer time to Date:', error);
    throw error;
  }
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

  // If no prayer is found for today, only return Fajr if it's after midnight
  const fajr = prayers[0]; // Fajr is always the first prayer
  const [fajrTime, fajrPeriod] = fajr.time.split(' ');
  const [fajrHours] = fajrTime.split(':');
  let fajrHour = parseInt(fajrHours);
  if (fajrPeriod === 'AM' && fajrHour === 12) fajrHour = 0;
  
  // Only show Fajr as next prayer if current time is after midnight and before Fajr
  if (now.getHours() >= 0 && now.getHours() < fajrHour) {
    return fajr;
  }
  
  return null; // No next prayer to show
}
