import { writable } from 'svelte/store';

export const nearbyMosquesStore = writable([]);
export const mosqueLoadingStore = writable(false);
export const mosqueErrorStore = writable(null);

const FOURSQUARE_API_KEY = 'fsq3fkMu9XEbWyGt1NpQQRQvEEIxi1CyoolUFG3kwaG8ymk=';

export async function fetchNearbyMosques(latitude, longitude) {
  try {
    mosqueLoadingStore.set(true);
    mosqueErrorStore.set(null);

    const response = await fetch(
      `https://api.foursquare.com/v3/places/search?query=mosque&ll=${latitude},${longitude}&radius=5000&limit=5`,
      {
        headers: {
          'Authorization': FOURSQUARE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) throw new Error('Failed to fetch mosques');

    const data = await response.json();
    const mosques = data.results.map(mosque => ({
      name: mosque.name,
      distance: Math.round(mosque.distance) + 'm',
      address: mosque.location.address
    }));

    nearbyMosquesStore.set(mosques);
  } catch (error) {
    mosqueErrorStore.set('Unable to fetch nearby mosques');
    console.error('Error fetching mosques:', error);
  } finally {
    mosqueLoadingStore.set(false);
  }
} 