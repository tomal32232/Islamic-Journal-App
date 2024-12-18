import { auth, db } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  deleteDoc,
  orderBy,
  Timestamp 
} from 'firebase/firestore';

export async function saveBookmark(surahNumber, verseNumber, surahName, verseText) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // Check if bookmark already exists
    const bookmarksRef = collection(db, 'bookmarks');
    const q = query(
      bookmarksRef,
      where('userId', '==', user.uid),
      where('surahNumber', '==', surahNumber),
      where('verseNumber', '==', verseNumber)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      console.log('Bookmark already exists');
      return;
    }

    // Add new bookmark
    const bookmark = {
      userId: user.uid,
      surahNumber,
      verseNumber,
      surahName,
      verseText,
      timestamp: Timestamp.now()
    };

    await addDoc(collection(db, 'bookmarks'), bookmark);
    console.log('Bookmark saved successfully');
  } catch (error) {
    console.error('Error saving bookmark:', error);
    throw error;
  }
}

export async function removeBookmark(surahNumber, verseNumber) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const bookmarksRef = collection(db, 'bookmarks');
    const q = query(
      bookmarksRef,
      where('userId', '==', user.uid),
      where('surahNumber', '==', surahNumber),
      where('verseNumber', '==', verseNumber)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      await deleteDoc(querySnapshot.docs[0].ref);
      console.log('Bookmark removed successfully');
    }
  } catch (error) {
    console.error('Error removing bookmark:', error);
    throw error;
  }
}

export async function getBookmarks() {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const bookmarksRef = collection(db, 'bookmarks');
    const q = query(
      bookmarksRef,
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    throw error;
  }
} 