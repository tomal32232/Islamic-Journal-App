import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth } from '../firebase';
import { writable } from 'svelte/store';

export const favoritesStore = writable([]);

export async function addFavorite(surahNumber, verseNumber, surahName, verseText) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to add favorites');
    }

    const favoriteData = {
      userId: user.uid,
      surahNumber,
      verseNumber,
      surahName,
      verseText,
      timestamp: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'favorites'), favoriteData);
    console.log('Favorite added with ID:', docRef.id);
    
    // Update store
    const updatedFavorites = await getFavorites();
    favoritesStore.set(updatedFavorites);
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding favorite:', error);
    throw error;
  }
}

export async function removeFavorite(surahNumber, verseNumber) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to remove favorites');
    }

    const favoritesRef = collection(db, 'favorites');
    const q = query(
      favoritesRef,
      where('userId', '==', user.uid),
      where('surahNumber', '==', surahNumber),
      where('verseNumber', '==', verseNumber)
    );

    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    // Update store
    const updatedFavorites = await getFavorites();
    favoritesStore.set(updatedFavorites);
  } catch (error) {
    console.error('Error removing favorite:', error);
    throw error;
  }
}

export async function getFavorites() {
  try {
    const user = auth.currentUser;
    if (!user) return [];

    const favoritesRef = collection(db, 'favorites');
    const q = query(
      favoritesRef,
      where('userId', '==', user.uid)
    );

    const querySnapshot = await getDocs(q);
    const favorites = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Update store
    favoritesStore.set(favorites);
    return favorites;
  } catch (error) {
    console.error('Error getting favorites:', error);
    return [];
  }
}

export async function isFavorite(surahNumber, verseNumber) {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const favoritesRef = collection(db, 'favorites');
    const q = query(
      favoritesRef,
      where('userId', '==', user.uid),
      where('surahNumber', '==', surahNumber),
      where('verseNumber', '==', verseNumber)
    );

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return false;
  }
} 