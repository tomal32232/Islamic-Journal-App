import { LocalNotifications } from '@capacitor/local-notifications';
import { fetchPrayerTimes, prayerTimesStore, getNextPrayer, getPrayerTimeAsDate } from './prayerTimes';
import { App } from '@capacitor/app';
import { writable, get } from 'svelte/store';
import { scheduleMoodNotifications } from './moodNotificationService';
import { scheduleEndOfDayReminders } from './prayerReminderService';
import { auth } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

let prayerTimes = [];
prayerTimesStore.subscribe(value => {
    prayerTimes = value;
});

// Initialize notification channels
export async function initializeNotificationChannels() {
    try {
        console.log('Initializing notification channels...');
        const channels = await LocalNotifications.listChannels();
        console.log('Existing channels:', channels.channels);

        // Android importance levels: 1 = low, 2 = medium, 3 = high, 4 = max
        /** @type {import('@capacitor/local-notifications').LocalNotificationChannel[]} */
        const requiredChannels = [
            {
                id: 'prayer_notifications',
                name: 'Prayer Times',
                description: 'Notifications for prayer times',
                importance: 4,
                sound: 'notification_sound.wav'
            },
            {
                id: 'prayer_mark_notifications',
                name: 'Prayer Marking',
                description: 'Reminders to mark your prayers',
                importance: 4,
                sound: 'notification_sound.wav'
            },
            {
                id: 'mood_notifications',
                name: 'Mood Tracking Reminders',
                description: 'Reminders for mood tracking',
                importance: 4,
                sound: 'notification_sound.wav'
            },
            {
                id: 'journal_notifications',
                name: 'Journal Reminders',
                description: 'Reminders for journal entries',
                importance: 4,
                sound: 'notification_sound.wav'
            }
        ];

        // Delete existing channels first to ensure clean state
        console.log('Deleting existing channels...');
        for (const existingChannel of channels.channels) {
            console.log(`Deleting channel: ${existingChannel.id}`);
            await LocalNotifications.deleteChannel({ id: existingChannel.id });
        }

        // Create channels one by one with error handling
        console.log('Creating new channels...');
        for (const channel of requiredChannels) {
            try {
                console.log(`Creating channel: ${channel.id}`);
                const createChannelResult = await LocalNotifications.createChannel({
                    id: channel.id,
                    name: channel.name,
                    description: channel.description,
                    importance: channel.importance,
                    visibility: 1,
                    vibration: true,
                    lights: true
                });
                console.log(`Channel creation result for ${channel.id}:`, createChannelResult);
            } catch (error) {
                console.error(`Error creating channel ${channel.id}:`, error);
            }
        }

        // Verify channels were created
        const newChannels = await LocalNotifications.listChannels();
        console.log('Newly created channels:', newChannels.channels);
        
        console.log('Notification channels initialization complete');
    } catch (error) {
        console.error('Error initializing notification channels:', error);
    }
}

// Store to track notification permission status
export const notificationPermissionStore = writable('prompt');

// Store for navigation events
export const navigationStore = writable(null);

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
            // Initialize channels first, then set up notifications
            await initializeNotificationChannels();
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
        const prayerTimes = get(prayerTimesStore);
        
        if (!prayerTimes || prayerTimes.length === 0) {
            console.error('No prayer times available for scheduling mark notifications');
            return;
        }

        // Cancel existing mark prayer notifications first
        console.log('Cancelling existing mark prayer notifications...');
        const pendingNotifications = await LocalNotifications.getPending();
        const markNotifications = pendingNotifications.notifications.filter(n => 
            n.extra && n.extra.type === 'mark_prayer'
        );
        if (markNotifications.length > 0) {
            await LocalNotifications.cancel({ notifications: markNotifications });
            console.log('Cancelled existing mark prayer notifications');
        }

        // Get user's timezone offset
        const userTimezoneOffset = new Date().getTimezoneOffset();
        console.log(`User's timezone offset for mark notifications: ${userTimezoneOffset} minutes`);

        // Schedule notifications for each prayer time
        for (const prayer of prayerTimes) {
            console.log(`Scheduling mark notification for ${prayer.name} prayer...`);
            
            // Check if we have timezone information for this prayer in the database
            let prayerTimezoneOffset = null;
            try {
                const user = auth.currentUser;
                if (user) {
                    const today = new Date().toLocaleDateString('en-CA');
                    const prayerId = `${today}-${prayer.name.toLowerCase()}`;
                    const prayerQuery = query(
                        collection(db, 'prayer_history'),
                        where('userId', '==', user.uid),
                        where('prayerId', '==', prayerId)
                    );
                    const querySnapshot = await getDocs(prayerQuery);
                    if (!querySnapshot.empty) {
                        const prayerData = querySnapshot.docs[0].data();
                        prayerTimezoneOffset = prayerData.timezoneOffset || null;
                        console.log(`Found timezone offset for ${prayer.name} mark notification: ${prayerTimezoneOffset}`);
                    }
                }
            } catch (error) {
                console.error('Error getting prayer timezone information for mark notification:', error);
            }
            
            // Use the getPrayerTimeAsDate function with timezone offset
            const prayerTime = getPrayerTimeAsDate(prayer.originalTime, prayerTimezoneOffset);
            const scheduleTime = new Date(prayerTime);
            scheduleTime.setMinutes(scheduleTime.getMinutes() + MARK_PRAYER_DELAY);

            console.log(`Scheduling ${prayer.name} mark notification for:`, scheduleTime.toLocaleString());

            // Generate a consistent ID for each prayer's mark notification
            const notificationId = 3000 + getPrayerIndex(prayer.name);

            await LocalNotifications.schedule({
                notifications: [
                    {
                        title: 'Mark Your Prayer',
                        body: `Don't forget to mark your ${prayer.name} prayer in the app`,
                        id: notificationId,
                        schedule: { 
                            at: scheduleTime,
                            every: 'day',
                            allowWhileIdle: true
                        },
                        smallIcon: 'ic_launcher_foreground',
                        channelId: 'prayer_mark_notifications',
                        sound: 'notification_sound',
                        ongoing: false,
                        autoCancel: true,
                        extra: {
                            type: 'mark_prayer',
                            prayerName: prayer.name
                        }
                    }
                ]
            });
            console.log(`Successfully scheduled mark notification for ${prayer.name} prayer at ${scheduleTime.toLocaleString()}`);
        }
        console.log('Completed scheduling all mark prayer notifications');
    } catch (error) {
        console.error('Error scheduling mark prayer notifications:', error);
        throw error;
    }
}

// Helper function to get consistent index for each prayer
function getPrayerIndex(prayerName) {
    const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    return prayerOrder.indexOf(prayerName);
}

// Add notification click handler
async function setupNotificationClickHandler() {
    LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        // Check if it's an unmarked prayer reminder
        if (notification.notification.extra?.type === 'unmarked_prayer_reminder') {
            // Trigger navigation to prayer page
            navigationStore.set('prayer');
        }
    });
}

// Update setupNotifications to include end-of-day reminders and click handler
export async function setupNotifications() {
    try {
        console.log('Setting up notification system...');
        const permissionStatus = await checkNotificationPermission();
        if (permissionStatus !== 'granted') {
            console.log('Notification permission not granted');
            return;
        }

        const settings = getNotificationSettings();
        console.log('Notification settings:', settings);

        // Initialize notification channels first
        await initializeNotificationChannels();
        console.log('Notification channels initialized');

        // Set up notification click handler
        await setupNotificationClickHandler();
        console.log('Notification click handler set up');

        // Fetch prayer times first
        console.log('Fetching prayer times...');
        await fetchPrayerTimes();
        const prayerTimes = get(prayerTimesStore);
        
        if (!prayerTimes || prayerTimes.length === 0) {
            console.log('Retrying prayer times fetch...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            await fetchPrayerTimes();
        }

        // Set up app lifecycle listeners
        App.addListener('appStateChange', async ({ isActive }) => {
            if (isActive) {
                console.log('App became active, rescheduling notifications...');
                // Fetch fresh prayer times when app becomes active
                await fetchPrayerTimes();
                
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
            console.log('Scheduling prayer notifications...');
            await scheduleAllPrayerNotifications();
            await scheduleMarkPrayerNotifications();
            await scheduleEndOfDayReminders();
        }
        if (settings.moodNotifications) {
            console.log('Scheduling mood notifications...');
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

        // Get user's timezone offset
        const userTimezoneOffset = new Date().getTimezoneOffset();
        console.log(`User's timezone offset: ${userTimezoneOffset} minutes`);

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

            // Check if we have timezone information for this prayer in the database
            let prayerTimezoneOffset = null;
            try {
                const user = auth.currentUser;
                if (user) {
                    const today = new Date().toLocaleDateString('en-CA');
                    const prayerId = `${today}-${prayer.name.toLowerCase()}`;
                    const prayerQuery = query(
                        collection(db, 'prayer_history'),
                        where('userId', '==', user.uid),
                        where('prayerId', '==', prayerId)
                    );
                    const querySnapshot = await getDocs(prayerQuery);
                    if (!querySnapshot.empty) {
                        const prayerData = querySnapshot.docs[0].data();
                        prayerTimezoneOffset = prayerData.timezoneOffset || null;
                        console.log(`Found timezone offset for ${prayer.name}: ${prayerTimezoneOffset}`);
                    }
                }
            } catch (error) {
                console.error('Error getting prayer timezone information:', error);
            }

            // Adjust for timezone if we have the information
            if (prayerTimezoneOffset !== null && prayerTimezoneOffset !== userTimezoneOffset) {
                const offsetDiff = userTimezoneOffset - prayerTimezoneOffset;
                scheduleTime.setMinutes(scheduleTime.getMinutes() + offsetDiff);
                console.log(`Adjusted notification time for ${prayer.name} by ${offsetDiff} minutes for timezone difference`);
            }

            await scheduleNotification(prayer.name, scheduleTime);
        }
    } catch (error) {
        console.error('Error scheduling prayer notifications:', error);
    }
}

async function scheduleNotification(prayerName, scheduleTime) {
    try {
        console.log(`Scheduling prayer notification for ${prayerName} at ${scheduleTime.toLocaleString()}`);
        
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
        
        console.log(`Converted to UTC time: ${utcScheduleTime.toISOString()}`);
        const notificationId = Math.floor(Math.random() * 100000);
        
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'Prayer Time',
                    body: `It's almost time for ${prayerName} prayer`,
                    id: notificationId,
                    schedule: { at: utcScheduleTime },
                    smallIcon: 'ic_launcher_foreground',
                    channelId: 'prayer_notifications',
                    sound: 'notification_sound',
                    actionTypeId: '',
                    extra: null
                }
            ]
        });
        
        console.log(`Successfully scheduled ${prayerName} prayer notification (ID: ${notificationId})`);
        
        // Log next 24 hours of scheduled notifications
        const pending = await LocalNotifications.getPending();
        console.log('Currently scheduled prayer notifications:', 
            pending.notifications
                .filter(n => n.channelId === 'prayer_notifications')
                .map(n => ({
                    id: n.id,
                    title: n.title,
                    scheduledTime: new Date(n.schedule.at).toLocaleString()
                }))
        );
    } catch (error) {
        console.error(`Error scheduling notification for ${prayerName}:`, error);
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

// Test notification functions
export async function testPrayerNotification() {
    try {
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'Prayer Time',
                    body: `It's almost time for Fajr prayer`,
                    id: 1001,
                    schedule: { at: new Date(Date.now() + 5000) }, // 5 seconds from now
                    smallIcon: 'ic_launcher_foreground',
                    actionTypeId: '',
                    extra: null
                }
            ]
        });
        console.log('Test prayer notification scheduled');
    } catch (error) {
        console.error('Error scheduling test prayer notification:', error);
    }
}

export async function testMarkPrayerNotification() {
    try {
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'Mark Your Prayer',
                    body: `Don't forget to mark your Fajr prayer in the app`,
                    id: 1002,
                    schedule: { at: new Date(Date.now() + 5000) }, // 5 seconds from now
                    smallIcon: 'ic_launcher_foreground',
                    actionTypeId: '',
                    extra: null
                }
            ]
        });
        console.log('Test mark prayer notification scheduled');
    } catch (error) {
        console.error('Error scheduling test mark prayer notification:', error);
    }
}

export async function testMoodNotification() {
    try {
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'Mood Check',
                    body: `Time to track your mood after Fajr prayer`,
                    id: 1003,
                    schedule: { at: new Date(Date.now() + 5000) }, // 5 seconds from now
                    smallIcon: 'ic_launcher_foreground',
                    actionTypeId: '',
                    extra: null
                }
            ]
        });
        console.log('Test mood notification scheduled');
    } catch (error) {
        console.error('Error scheduling test mood notification:', error);
    }
}

export async function testJournalNotification() {
    try {
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'Journal Reminder',
                    body: `Time for your morning reflection`,
                    id: 1004,
                    schedule: { at: new Date(Date.now() + 5000) }, // 5 seconds from now
                    smallIcon: 'ic_launcher_foreground',
                    actionTypeId: '',
                    extra: null
                }
            ]
        });
        console.log('Test journal notification scheduled');
    } catch (error) {
        console.error('Error scheduling test journal notification:', error);
    }
}
