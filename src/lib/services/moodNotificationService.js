import { LocalNotifications } from '@capacitor/local-notifications';
import { prayerTimesStore } from '../stores/prayerTimesStore';
import { get } from 'svelte/store';
import { getPrayerTimeAsDate } from './prayerTimes';

// Minutes to wait after prayer time before sending mood notification
const NOTIFICATION_DELAY = 10;

export async function scheduleMoodNotifications(enabled = true) {
    try {
        console.log('Starting mood notification scheduling, enabled:', enabled);
        
        if (!enabled) {
            console.log('Mood notifications disabled, cancelling existing notifications...');
            const pendingNotifications = await LocalNotifications.getPending();
            const moodNotifications = pendingNotifications.notifications.filter(n => 
                n.id === 2001 || n.id === 2002
            );
            if (moodNotifications.length > 0) {
                await LocalNotifications.cancel({ notifications: moodNotifications });
                console.log('Cancelled existing mood notifications');
            }
            return;
        }

        // Verify notification channel exists
        console.log('Checking mood notification channel...');
        const channels = await LocalNotifications.listChannels();
        console.log('Available notification channels:', channels.channels);
        
        const moodChannel = channels.channels.find(c => c.id === 'mood_notifications');
        if (!moodChannel) {
            console.log('Mood notification channel not found, creating it...');
            await LocalNotifications.createChannel({
                id: 'mood_notifications',
                name: 'Mood Tracking Reminders',
                description: 'Reminders for mood tracking',
                importance: 4,
                visibility: 1,
                sound: 'notification_sound',
                vibration: true,
                lights: true
            });
            console.log('Mood notification channel created');
        }

        // Cancel existing mood notifications first
        console.log('Cancelling any existing mood notifications...');
        const pendingNotifications = await LocalNotifications.getPending();
        const moodNotifications = pendingNotifications.notifications.filter(n => 
            n.id === 2001 || n.id === 2002
        );
        if (moodNotifications.length > 0) {
            await LocalNotifications.cancel({ notifications: moodNotifications });
            console.log('Cancelled existing mood notifications');
        }

        const prayerTimes = get(prayerTimesStore);
        if (!prayerTimes || prayerTimes.length === 0) {
            console.error('Prayer times not available, cannot schedule mood notifications');
            return;
        }

        // Find Fajr and Maghrib prayer times
        const fajrPrayer = prayerTimes.find(p => p.name === 'Fajr');
        const maghribPrayer = prayerTimes.find(p => p.name === 'Maghrib');

        if (!fajrPrayer || !maghribPrayer) {
            console.error('Could not find Fajr or Maghrib prayer times');
            return;
        }

        console.log('Found prayer times:', {
            fajr: fajrPrayer.time,
            maghrib: maghribPrayer.time
        });

        // Schedule morning mood notification (after Fajr)
        const morningTime = getPrayerTimeAsDate(fajrPrayer.originalTime);
        morningTime.setMinutes(morningTime.getMinutes() + NOTIFICATION_DELAY);
        console.log('Scheduling morning mood notification for:', morningTime.toLocaleString());
        
        await LocalNotifications.schedule({
            notifications: [{
                title: 'Morning Reflection Time',
                body: 'Take a moment to reflect and record your mood after Fajr prayer.',
                id: 2001,
                schedule: { at: morningTime, every: 'day', allowWhileIdle: true },
                smallIcon: 'ic_launcher_foreground',
                channelId: 'mood_notifications',
                sound: 'notification_sound',
                ongoing: false,
                autoCancel: true
            }]
        });
        console.log('Morning mood notification scheduled');

        // Schedule evening mood notification (after Maghrib)
        const eveningTime = getPrayerTimeAsDate(maghribPrayer.originalTime);
        eveningTime.setMinutes(eveningTime.getMinutes() + NOTIFICATION_DELAY);
        console.log('Scheduling evening mood notification for:', eveningTime.toLocaleString());
        
        await LocalNotifications.schedule({
            notifications: [{
                title: 'Evening Reflection Time',
                body: 'Take a moment to reflect on your day and record your mood after Maghrib prayer.',
                id: 2002,
                schedule: { at: eveningTime, every: 'day', allowWhileIdle: true },
                smallIcon: 'ic_launcher_foreground',
                channelId: 'mood_notifications',
                sound: 'notification_sound',
                ongoing: false,
                autoCancel: true
            }]
        });
        console.log('Evening mood notification scheduled');
        console.log('Successfully scheduled all mood notifications');

    } catch (error) {
        console.error('Error scheduling mood notifications:', error);
        throw error; // Re-throw to handle in the calling function
    }
} 