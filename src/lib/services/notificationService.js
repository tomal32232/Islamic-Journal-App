import { LocalNotifications } from '@capacitor/local-notifications';
import { fetchPrayerTimes, prayerTimesStore } from './prayerTimes';
import { App } from '@capacitor/app';

let prayerTimes = [];
prayerTimesStore.subscribe(value => {
    prayerTimes = value;
});

export async function setupNotifications() {
    try {
        // Request permission for notifications
        const permissionStatus = await LocalNotifications.requestPermissions();
        if (permissionStatus.display !== 'granted') {
            throw new Error('Notification permission not granted');
        }

        // Set up app lifecycle listeners
        App.addListener('appStateChange', async ({ isActive }) => {
            if (isActive) {
                await scheduleAllPrayerNotifications();
            }
        });

        // Do initial scheduling
        await scheduleAllPrayerNotifications();

        console.log('Notification system setup complete');
    } catch (error) {
        console.error('Error setting up notifications:', error);
        throw error;
    }
}

async function scheduleAllPrayerNotifications() {
    try {
        // Fetch latest prayer times
        await fetchPrayerTimes();
        
        // Cancel any existing notifications
        const pendingNotifications = await LocalNotifications.getPending();
        if (pendingNotifications.notifications.length > 0) {
            await LocalNotifications.cancel(pendingNotifications);
        }

        // Schedule notifications for each prayer time
        for (const prayer of prayerTimes) {
            const [time, period] = prayer.time.split(' ');
            const [hours, minutes] = time.split(':');
            let prayerHours = parseInt(hours);
            
            // Convert to 24-hour format
            if (period === 'PM' && prayerHours !== 12) {
                prayerHours += 12;
            } else if (period === 'AM' && prayerHours === 12) {
                prayerHours = 0;
            }

            // Create notification schedule time
            const now = new Date();
            const scheduleTime = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                prayerHours,
                parseInt(minutes) - 5 // 5 minutes before prayer time
            );

            // If the prayer time has passed for today, schedule for tomorrow
            if (scheduleTime < now) {
                scheduleTime.setDate(scheduleTime.getDate() + 1);
            }

            await scheduleNotification(prayer.name, scheduleTime);
        }
    } catch (error) {
        console.error('Error scheduling prayer notifications:', error);
    }
}

async function scheduleNotification(prayerName, scheduleTime) {
    try {
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'Prayer Time',
                    body: `It's time for ${prayerName} prayer`,
                    id: Math.floor(Math.random() * 100000),
                    schedule: { at: scheduleTime },
                    smallIcon: 'ic_launcher_foreground',
                    actionTypeId: '',
                    extra: null
                }
            ]
        });
    } catch (error) {
        console.error('Error scheduling notification:', error);
    }
} 