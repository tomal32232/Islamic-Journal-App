import { LocalNotifications } from '@capacitor/local-notifications';
import { fetchPrayerTimes, prayerTimesStore, getNextPrayer } from './prayerTimes';
import { App } from '@capacitor/app';
import { writable } from 'svelte/store';
import { scheduleMoodNotifications } from './moodNotificationService';
import { scheduleEndOfDayReminders } from './prayerReminderService';

let prayerTimes = [];
prayerTimesStore.subscribe(value => {
    prayerTimes = value;
});

// Store to track notification permission status
export const notificationPermissionStore = writable('prompt');

// Load notification settings
function getNotificationSettings() {
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
        return JSON.parse(savedSettings);
    }
    return {
        prayerNotifications: true,
        journalNotifications: true,
        moodNotifications: true
    };
}

export async function checkNotificationPermission() {
    try {
        const permStatus = await LocalNotifications.checkPermissions();
        notificationPermissionStore.set(permStatus.display);
        return permStatus.display;
    } catch (error) {
        console.error('Error checking notification permission:', error);
        return 'denied';
    }
}

export async function requestNotificationPermission() {
    try {
        const result = await LocalNotifications.requestPermissions();
        notificationPermissionStore.set(result.display);
        
        if (result.display === 'granted') {
            // If permission granted, set up notifications
            await setupNotifications();
        }
        
        return result.display;
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return 'denied';
    }
}

// Minutes to wait after prayer time before sending mark prayer notification
const MARK_PRAYER_DELAY = 30;

async function scheduleMarkPrayerNotifications() {
    try {
        console.log('Starting to schedule mark prayer notifications...');
        // Schedule notifications for each prayer time
        for (const prayer of prayerTimes) {
            console.log(`Scheduling mark notification for ${prayer.name} prayer...`);
            const [time, period] = prayer.time.split(' ');
            const [hours, minutes] = time.split(':');
            let prayerHours = parseInt(hours);
            
            // Convert to 24-hour format
            if (period === 'PM' && prayerHours !== 12) {
                prayerHours += 12;
            } else if (period === 'AM' && prayerHours === 12) {
                prayerHours = 0;
            }

            // Create notification schedule time in local timezone
            const now = new Date();
            const scheduleTime = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                prayerHours,
                parseInt(minutes) + MARK_PRAYER_DELAY // 30 minutes after prayer time
            );

            // If the prayer time has passed for today, schedule for tomorrow
            if (scheduleTime < now) {
                scheduleTime.setDate(scheduleTime.getDate() + 1);
                console.log(`${prayer.name} prayer time has passed, scheduling for tomorrow`);
            }

            // Ensure we're working with local time
            scheduleTime.setMinutes(scheduleTime.getMinutes() - scheduleTime.getTimezoneOffset());
            
            console.log(`${prayer.name} mark notification scheduled for: ${scheduleTime.toLocaleString()}`);

            await LocalNotifications.schedule({
                notifications: [
                    {
                        title: 'Mark Your Prayer',
                        body: `Don't forget to mark your ${prayer.name} prayer in the app`,
                        id: Math.floor(Math.random() * 100000) + 5000, // Using 5000+ to avoid ID conflicts
                        schedule: { at: scheduleTime },
                        smallIcon: 'ic_launcher_foreground',
                        actionTypeId: '',
                        extra: null
                    }
                ]
            });
            console.log(`Successfully scheduled mark notification for ${prayer.name} prayer`);
        }
        console.log('Completed scheduling all mark prayer notifications');
    } catch (error) {
        console.error('Error scheduling mark prayer notifications:', error);
    }
}

// Update setupNotifications to include end-of-day reminders
export async function setupNotifications() {
    try {
        const permissionStatus = await checkNotificationPermission();
        if (permissionStatus !== 'granted') {
            return;
        }

        const settings = getNotificationSettings();

        // Set up app lifecycle listeners
        App.addListener('appStateChange', async ({ isActive }) => {
            if (isActive) {
                if (settings.prayerNotifications) {
                    await scheduleAllPrayerNotifications();
                    await scheduleMarkPrayerNotifications();
                    await scheduleEndOfDayReminders();
                }
                if (settings.moodNotifications) {
                    await scheduleMoodNotifications(true);
                }
            }
        });

        // Do initial scheduling
        if (settings.prayerNotifications) {
            await scheduleAllPrayerNotifications();
            await scheduleMarkPrayerNotifications();
            await scheduleEndOfDayReminders();
        }
        if (settings.moodNotifications) {
            await scheduleMoodNotifications(true);
        }

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

            // Create notification schedule time in local timezone
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

            // Ensure we're working with local time
            scheduleTime.setMinutes(scheduleTime.getMinutes() - scheduleTime.getTimezoneOffset());

            await scheduleNotification(prayer.name, scheduleTime);
        }
    } catch (error) {
        console.error('Error scheduling prayer notifications:', error);
    }
}

async function scheduleNotification(prayerName, scheduleTime) {
    try {
        // Convert the local time to UTC for the notification
        const utcScheduleTime = new Date(
            Date.UTC(
                scheduleTime.getFullYear(),
                scheduleTime.getMonth(),
                scheduleTime.getDate(),
                scheduleTime.getHours(),
                scheduleTime.getMinutes(),
                0
            )
        );

        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'Prayer Time',
                    body: `It's almost time for ${prayerName} prayer`,
                    id: Math.floor(Math.random() * 100000),
                    schedule: { at: utcScheduleTime },
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

// Function to test notification
async function testNotification() {
    const nextPrayer = getNextPrayer();
    if (!nextPrayer) return;
    
    try {
        // Schedule the notification for 1 second in the future
        const scheduleTime = new Date(Date.now() + 1000);
        
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'Prayer Time',
                    body: `It's almost time for ${nextPrayer.name} prayer`,
                    id: Math.floor(Math.random() * 100000),
                    schedule: { at: scheduleTime },
                    smallIcon: 'ic_launcher_foreground',
                    actionTypeId: '',
                    extra: null
                }
            ]
        });
    } catch (error) {
        console.error('Error scheduling test notification:', error);
    }
}
