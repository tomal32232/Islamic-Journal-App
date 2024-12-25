import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth } from '../firebase';
import { writable } from 'svelte/store';

export const bookmarksStore = writable([]);

export async function saveBookmark(surahNumber, verseNumber, surahName, verseText) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to add bookmarks');
    }

    const bookmarkData = {
      userId: user.uid,
      surahNumber,
      verseNumber,
      surahName,
      verseText,
      timestamp: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'bookmarks'), bookmarkData);
    console.log('Bookmark added with ID:', docRef.id);
    
    // Update store
    const updatedBookmarks = await getBookmarks();
    bookmarksStore.set(updatedBookmarks);
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding bookmark:', error);
    throw error;
  }
}

export async function removeBookmark(surahNumber, verseNumber) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to remove bookmarks');
    }

    const bookmarksRef = collection(db, 'bookmarks');
    const q = query(
      bookmarksRef,
      where('userId', '==', user.uid),
      where('surahNumber', '==', surahNumber),
      where('verseNumber', '==', verseNumber)
    );

    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    // Update store
    const updatedBookmarks = await getBookmarks();
    bookmarksStore.set(updatedBookmarks);
  } catch (error) {
    console.error('Error removing bookmark:', error);
    throw error;
  }
}

export async function getBookmarks() {
  try {
    const user = auth.currentUser;
    if (!user) return [];

    const bookmarksRef = collection(db, 'bookmarks');
    const q = query(
      bookmarksRef,
      where('userId', '==', user.uid)
    );

    const querySnapshot = await getDocs(q);
    const bookmarks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Update store
    bookmarksStore.set(bookmarks);
    return bookmarks;
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    return [];
  }
} 