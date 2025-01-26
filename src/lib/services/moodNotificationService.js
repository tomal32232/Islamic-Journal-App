import { LocalNotifications } from '@capacitor/local-notifications';
import { prayerTimesStore } from '../stores/prayerTimesStore';
import { get } from 'svelte/store';

// Minutes to wait after prayer time before sending mood notification
const NOTIFICATION_DELAY = 10;

export async function scheduleMoodNotifications(enabled = true) {
    if (!enabled) {
        // Cancel any existing mood notifications
        const pendingNotifications = await LocalNotifications.getPending();
        const moodNotifications = pendingNotifications.notifications.filter(n => 
            n.id === 2001 || n.id === 2002
        );
        if (moodNotifications.length > 0) {
            await LocalNotifications.cancel({ notifications: moodNotifications });
        }
        return;
    }

    try {
        // Cancel existing mood notifications first
        const pendingNotifications = await LocalNotifications.getPending();
        const moodNotifications = pendingNotifications.notifications.filter(n => 
            n.id === 2001 || n.id === 2002
        );
        if (moodNotifications.length > 0) {
            await LocalNotifications.cancel({ notifications: moodNotifications });
        }

        const prayerTimes = get(prayerTimesStore);
        if (!prayerTimes || prayerTimes.length === 0) {
            console.error('Prayer times not available');
            return;
        }

        // Find Fajr and Isha prayer times
        const fajrPrayer = prayerTimes.find(p => p.name === 'Fajr');
        const ishaPrayer = prayerTimes.find(p => p.name === 'Isha');

        if (!fajrPrayer || !ishaPrayer) {
            console.error('Could not find Fajr or Isha prayer times');
            return;
        }

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

        // Schedule morning mood notification (after Fajr)
        const morningTime = getPrayerTimeDate(fajrPrayer.time);
        await LocalNotifications.schedule({
            notifications: [{
                title: 'Morning Mood Check',
                body: 'How are you feeling after Fajr prayer? Take a moment to reflect.',
                id: 2001,
                schedule: { at: morningTime, every: 'day' },
                sound: null,
                attachments: null,
                actionTypeId: '',
                extra: null
            }]
        });

        // Schedule evening mood notification (after Isha)
        const eveningTime = getPrayerTimeDate(ishaPrayer.time);
        await LocalNotifications.schedule({
            notifications: [{
                title: 'Evening Mood Check',
                body: 'How are you feeling after Isha prayer? Take a moment to reflect.',
                id: 2002,
                schedule: { at: eveningTime, every: 'day' },
                sound: null,
                attachments: null,
                actionTypeId: '',
                extra: null
            }]
        });

    } catch (error) {
        console.error('Error scheduling mood notifications:', error);
    }
} 