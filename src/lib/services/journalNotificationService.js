import { LocalNotifications } from '@capacitor/local-notifications';
import { prayerTimesStore } from '../stores/prayerTimesStore';
import { get } from 'svelte/store';

// Minutes to wait after prayer time before sending journal notification
const NOTIFICATION_DELAY = 15; // 15 minutes after prayer

export async function scheduleJournalNotifications(enabled = true) {
    console.log('=== Starting Journal Notification Setup ===');
    console.log('Journal notifications enabled:', enabled);
    
    if (!enabled) {
        console.log('Journal notifications disabled, cancelling existing notifications...');
        // Cancel any existing journal notifications
        const pendingNotifications = await LocalNotifications.getPending();
        if (pendingNotifications.notifications.length > 0) {
            await LocalNotifications.cancel(pendingNotifications);
            console.log('Existing journal notifications cancelled');
        }
        return;
    }

    try {
        // Verify notification channel exists
        console.log('Checking journal notification channel...');
        const channels = await LocalNotifications.listChannels();
        console.log('Available notification channels:', channels.channels);
        
        const journalChannel = channels.channels.find(c => c.id === 'journal_notifications');
        if (!journalChannel) {
            console.log('Journal notification channel not found, creating it...');
            await LocalNotifications.createChannel({
                id: 'journal_notifications',
                name: 'Journal Reminders',
                description: 'Reminders for journal entries',
                importance: 4,
                visibility: 1,
                sound: 'notification_sound',
                vibration: true,
                lights: true
            });
            console.log('Journal notification channel created');
        } else {
            console.log('Found existing journal notification channel:', journalChannel);
        }

        // Cancel existing notifications first
        const pendingNotifications = await LocalNotifications.getPending();
        if (pendingNotifications.notifications.length > 0) {
            await LocalNotifications.cancel(pendingNotifications);
        }

        const prayerTimes = get(prayerTimesStore);
        if (!prayerTimes || prayerTimes.length === 0) {
            console.error('Prayer times not available for journal notifications');
            // Schedule default times
            const morningTime = new Date();
            morningTime.setHours(7, 0, 0); // 7:00 AM
            
            const eveningTime = new Date();
            eveningTime.setHours(21, 0, 0); // 9:00 PM

            console.log('Using fallback times for journal notifications:',
                `Morning: ${morningTime.toLocaleString()}, Evening: ${eveningTime.toLocaleString()}`);

            // Schedule morning notification
            await LocalNotifications.schedule({
                notifications: [{
                    title: 'Morning Journal',
                    body: 'Time for your morning reflection. Start your day mindfully!',
                    id: 1001,
                    schedule: { at: morningTime, every: 'day' },
                    smallIcon: 'ic_launcher_foreground',
                    channelId: 'journal_notifications',
                    sound: 'notification_sound',
                    actionTypeId: '',
                    extra: null
                }]
            });
            console.log('Fixed morning journal notification scheduled');

            // Schedule evening notification
            await LocalNotifications.schedule({
                notifications: [{
                    title: 'Evening Journal',
                    body: 'Time for your evening reflection. How was your day?',
                    id: 1002,
                    schedule: { at: eveningTime, every: 'day' },
                    smallIcon: 'ic_launcher_foreground',
                    channelId: 'journal_notifications',
                    sound: 'notification_sound',
                    actionTypeId: '',
                    extra: null
                }]
            });
            console.log('Fixed evening journal notification scheduled');
            return;
        }

        // Find Fajr and Isha prayer times
        const fajrPrayer = prayerTimes.find(p => p.name === 'Fajr');
        const ishaPrayer = prayerTimes.find(p => p.name === 'Isha');

        if (!fajrPrayer || !ishaPrayer) {
            console.error('Could not find Fajr or Isha prayer times for journal notifications');
            return;
        }

        console.log('Found prayer times for journal notifications:', {
            fajr: fajrPrayer.time,
            isha: ishaPrayer.time
        });

        // Helper function to convert prayer time to Date
        function getPrayerTimeDate(timeStr) {
            const [time, period] = timeStr.split(' ');
            const [hours, minutes] = time.split(':');
            let prayerHours = parseInt(hours);
            
            // Convert to 24-hour format
            if (period === 'PM' && prayerHours !== 12) {
                prayerHours += 12;
            } else if (period === 'AM' && prayerHours === 12) {
                prayerHours = 0;
            }

            const prayerTime = new Date();
            prayerTime.setHours(prayerHours, parseInt(minutes) + NOTIFICATION_DELAY, 0);
            
            // If the prayer time has passed for today, schedule for tomorrow
            if (prayerTime < new Date()) {
                prayerTime.setDate(prayerTime.getDate() + 1);
            }

            return prayerTime;
        }

        // Schedule morning notification (after Fajr)
        const morningTime = getPrayerTimeDate(fajrPrayer.time);
        console.log('Scheduling morning journal notification for:', morningTime.toLocaleString());
        
        await LocalNotifications.schedule({
            notifications: [{
                title: 'Morning Journal',
                body: 'Time for your morning reflection. Start your day mindfully!',
                id: 1001,
                schedule: { at: morningTime, every: 'day' },
                smallIcon: 'ic_launcher_foreground',
                channelId: 'journal_notifications',
                sound: 'notification_sound',
                actionTypeId: '',
                extra: null
            }]
        });
        console.log('Morning journal notification scheduled successfully');

        // Schedule evening notification (after Isha)
        const eveningTime = getPrayerTimeDate(ishaPrayer.time);
        console.log('Scheduling evening journal notification for:', eveningTime.toLocaleString());
        
        await LocalNotifications.schedule({
            notifications: [{
                title: 'Evening Journal',
                body: 'Time for your evening reflection. How was your day?',
                id: 1002,
                schedule: { at: eveningTime, every: 'day' },
                smallIcon: 'ic_launcher_foreground',
                channelId: 'journal_notifications',
                sound: 'notification_sound',
                actionTypeId: '',
                extra: null
            }]
        });
        console.log('Evening journal notification scheduled successfully');

        // Log all scheduled journal notifications
        const finalPending = await LocalNotifications.getPending();
        console.log('Currently scheduled journal notifications:', 
            finalPending.notifications
                .filter(n => n.id === 1001 || n.id === 1002)
                .map(n => ({
                    id: n.id,
                    title: n.title,
                    scheduledTime: new Date(n.schedule.at).toLocaleString()
                }))
        );
        console.log('=== Journal Notification Setup Complete ===');

    } catch (error) {
        console.error('=== Error in Journal Notification Setup ===');
        console.error('Error details:', error);
    }
} 