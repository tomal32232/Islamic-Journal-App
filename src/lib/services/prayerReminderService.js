import { LocalNotifications } from '@capacitor/local-notifications';
import { prayerHistoryStore } from '../stores/prayerHistoryStore';
import { prayerTimesStore } from './prayerTimes';

let prayerTimes = [];
prayerTimesStore.subscribe(value => {
    prayerTimes = value;
});

function hasUnmarkedPrayers() {
    const today = new Date().toLocaleDateString('en-CA');
    const history = prayerHistoryStore.getHistory();
    
    // Check if any prayer for today is unmarked
    return prayerTimes.some(prayer => {
        const prayerRecord = history?.find(
            p => p.date === today && p.prayerName === prayer.name
        );
        return !prayerRecord || !prayerRecord.status;
    });
}

export async function scheduleEndOfDayReminders() {
    try {
        // Cancel any existing end-of-day reminders
        const pendingNotifications = await LocalNotifications.getPending();
        const reminderIds = [9001, 9002, 9003]; // Fixed IDs for our reminders
        const existingReminders = pendingNotifications.notifications.filter(
            n => reminderIds.includes(n.id)
        );
        if (existingReminders.length > 0) {
            await LocalNotifications.cancel({ notifications: existingReminders });
        }

        // Schedule new reminders for 9 PM, 10 PM, and 11 PM
        const reminderTimes = [21, 22, 23]; // Hours in 24-hour format
        const now = new Date();
        
        for (let i = 0; i < reminderTimes.length; i++) {
            const scheduleTime = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                reminderTimes[i],
                0,
                0
            );

            // If the time has passed for today, schedule for tomorrow
            if (scheduleTime < now) {
                scheduleTime.setDate(scheduleTime.getDate() + 1);
            }

            await LocalNotifications.schedule({
                notifications: [
                    {
                        id: reminderIds[i],
                        title: 'Prayer Reminder',
                        body: 'You have unmarked prayers for today. Please mark them in the app.',
                        schedule: { 
                            at: scheduleTime,
                            repeating: true,
                            every: 'day',
                            allowWhileIdle: true
                        },
                        smallIcon: 'ic_launcher_foreground',
                        actionTypeId: '',
                        extra: {
                            type: 'unmarked_prayer_reminder'
                        }
                    }
                ]
            });
        }
    } catch (error) {
        console.error('Error scheduling end-of-day reminders:', error);
    }
} 