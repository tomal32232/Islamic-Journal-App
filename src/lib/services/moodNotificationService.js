import { LocalNotifications } from '@capacitor/local-notifications';
import { prayerTimesStore } from '../stores/prayerTimesStore';
import { get } from 'svelte/store';
import { getPrayerTimeAsDate } from './prayerTimes';

// Minutes to wait after prayer time before sending mood notification
const NOTIFICATION_DELAY = 10;

export async function scheduleMoodNotifications(enabled = true) {
    try {
        console.log('=== Starting Mood Notification Setup ===');
        console.log('Mood notifications enabled:', enabled);
        
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

        // Try to get prayer times with retries
        let retries = 0;
        let prayerTimes = get(prayerTimesStore);
        
        while ((!prayerTimes || prayerTimes.length === 0) && retries < 3) {
            console.log(`Attempt ${retries + 1} to get prayer times...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between retries
            prayerTimes = get(prayerTimesStore);
            retries++;
        }

        if (!prayerTimes || prayerTimes.length === 0) {
            console.log('Using fallback fixed times for mood notifications');
            // Schedule default notifications at fixed times if prayer times aren't available
            const morningTime = new Date();
            morningTime.setHours(6, 0, 0); // 6:00 AM
            
            const eveningTime = new Date();
            eveningTime.setHours(19, 0, 0); // 7:00 PM

            console.log('Scheduling fixed morning notification for:', morningTime.toLocaleString());
            // Schedule morning notification
            await LocalNotifications.schedule({
                notifications: [{
                    title: 'Morning Reflection Time',
                    body: 'Take a moment to reflect and record your mood.',
                    id: 2001,
                    schedule: { at: morningTime, every: 'day', allowWhileIdle: true },
                    smallIcon: 'ic_launcher_foreground',
                    channelId: 'mood_notifications',
                    sound: 'notification_sound',
                    ongoing: false,
                    autoCancel: true
                }]
            });
            console.log('Fixed morning mood notification scheduled successfully');

            console.log('Scheduling fixed evening notification for:', eveningTime.toLocaleString());
            // Schedule evening notification
            await LocalNotifications.schedule({
                notifications: [{
                    title: 'Evening Reflection Time',
                    body: 'Take a moment to reflect on your day and record your mood.',
                    id: 2002,
                    schedule: { at: eveningTime, every: 'day', allowWhileIdle: true },
                    smallIcon: 'ic_launcher_foreground',
                    channelId: 'mood_notifications',
                    sound: 'notification_sound',
                    ongoing: false,
                    autoCancel: true
                }]
            });
            console.log('Fixed evening mood notification scheduled successfully');
            
            // Log all scheduled mood notifications
            const pending = await LocalNotifications.getPending();
            console.log('Currently scheduled mood notifications:', 
                pending.notifications
                    .filter(n => n.id === 2001 || n.id === 2002)
                    .map(n => ({
                        id: n.id,
                        title: n.title,
                        scheduledTime: new Date(n.schedule.at).toLocaleString()
                    }))
            );
            console.log('=== Mood Notification Setup Complete (Fixed Times) ===');
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

        // After scheduling both notifications, log the final status
        const finalPending = await LocalNotifications.getPending();
        console.log('All scheduled mood notifications:', 
            finalPending.notifications
                .filter(n => n.id === 2001 || n.id === 2002)
                .map(n => ({
                    id: n.id,
                    title: n.title,
                    scheduledTime: new Date(n.schedule.at).toLocaleString()
                }))
        );
        console.log('=== Mood Notification Setup Complete (Prayer-based Times) ===');

    } catch (error) {
        console.error('=== Error in Mood Notification Setup ===');
        console.error('Error details:', error);
        throw error;
    }
} 