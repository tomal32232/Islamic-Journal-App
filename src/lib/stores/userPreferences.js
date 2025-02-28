import { writable } from 'svelte/store';

// Check localStorage for first-time visit status
const getInitialFirstTimeStatus = () => {
  if (typeof window !== 'undefined') {
    const visited = localStorage.getItem('hasVisitedBefore');
    return visited === null; // true if never visited before
  }
  return true; // Default to true for SSR
};

// Create a store for first-time visitor status
export const isFirstTimeVisitor = writable(getInitialFirstTimeStatus());

// Function to mark user as no longer a first-time visitor
export function markAsReturningVisitor() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('hasVisitedBefore', 'true');
    isFirstTimeVisitor.set(false);
  }
} 