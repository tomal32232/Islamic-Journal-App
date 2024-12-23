import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { updateQuranProgress } from './badgeProgressService';

const READING_SESSIONS_COLLECTION = 'readingSessions';

export async function startReadingSession(surahNumber, surahName) {
  const auth = getAuth();
  if (!auth.currentUser) return null;

  const db = getFirestore();
  const session = {
    userId: auth.currentUser.uid,
    surahNumber,
    surahName,
    startTime: new Date().toISOString(),
    endTime: null,
    duration: 0
  };

  try {
    const docRef = await addDoc(collection(db, READING_SESSIONS_COLLECTION), session);
    return docRef.id;
  } catch (error) {
    console.error('Error starting reading session:', error);
    return null;
  }
}

export async function endReadingSession(sessionId) {
  if (!sessionId) return;

  const auth = getAuth();
  if (!auth.currentUser) return;

  const db = getFirestore();
  const endTime = new Date();
  
  try {
    const sessionRef = doc(db, READING_SESSIONS_COLLECTION, sessionId);
    const sessionDoc = await getDoc(sessionRef);
    
    if (sessionDoc.exists()) {
      const sessionData = sessionDoc.data();
      const startTime = new Date(sessionData.startTime);
      const duration = Math.floor((endTime - startTime) / 1000); // Duration in seconds
      const minutes = Math.floor(duration / 60); // Convert to minutes

      await updateDoc(sessionRef, {
        endTime: endTime.toISOString(),
        duration
      });

      // Update badge progress with reading minutes
      await updateQuranProgress(minutes);
    }
  } catch (error) {
    console.error('Error ending reading session:', error);
  }
}

export async function getReadingStats(userId) {
  const db = getFirestore();
  const stats = {
    totalTime: 0,
    sessionsCount: 0,
    surahsRead: new Set()
  };

  try {
    const q = query(
      collection(db, READING_SESSIONS_COLLECTION),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      const session = doc.data();
      if (session.duration) {
        stats.totalTime += session.duration;
        stats.sessionsCount++;
        stats.surahsRead.add(session.surahNumber);
      }
    });

    return {
      ...stats,
      surahsRead: Array.from(stats.surahsRead)
    };
  } catch (error) {
    console.error('Error fetching reading stats:', error);
    return stats;
  }
}

export async function getTodayReadingTime() {
  const auth = getAuth();
  if (!auth.currentUser) return 0;

  const db = getFirestore();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const q = query(
      collection(db, READING_SESSIONS_COLLECTION),
      where('userId', '==', auth.currentUser.uid),
      where('startTime', '>=', today.toISOString())
    );
    
    const querySnapshot = await getDocs(q);
    let totalSeconds = 0;

    querySnapshot.forEach((doc) => {
      const session = doc.data();
      if (session.duration) {
        totalSeconds += session.duration;
      }
    });

    return totalSeconds;
  } catch (error) {
    console.error('Error fetching today\'s reading time:', error);
    return 0;
  }
}

// Helper function to format seconds into readable time
export function formatReadingTime(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  // If over an hour
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  
  // If under an hour
  if (remainingSeconds > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${minutes}m`;
} 