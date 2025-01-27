import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { setupNotifications } from './notificationService';
import { fetchPrayerTimes } from './prayerTimes';

let wakeLock = null;
let refreshInterval = null;

export async function initializeBackgroundService() {
    // Set up periodic wake-up
    refreshInterval = setInterval(async () => {
        await refreshNotifications();
    }, 15 * 60 * 1000); // 15 minutes

    // Handle app state changes
    App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
            await acquireWakeLock();
            // Refresh notifications when app becomes active
            await refreshNotifications();
        } else {
            await releaseWakeLock();
        }
    });

    // Initial setup
    await acquireWakeLock();
    await refreshNotifications();
}

async function acquireWakeLock() {
    try {
        const info = await Device.getInfo();
        if (info.platform === 'android') {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock acquired');
            }
        }
    } catch (err) {
        console.error('Failed to acquire wake lock:', err);
    }
}

async function releaseWakeLock() {
    try {
        if (wakeLock !== null) {
            await wakeLock.release();
            wakeLock = null;
            console.log('Wake lock released');
        }
    } catch (err) {
        console.error('Failed to release wake lock:', err);
    }
}

async function refreshNotifications() {
    try {
        await fetchPrayerTimes();
        await setupNotifications();
    } catch (err) {
        console.error('Error refreshing notifications:', err);
    }
} 