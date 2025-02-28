import { LocalNotifications } from '@capacitor/local-notifications';
import { prayerHistoryStore } from '../stores/prayerHistoryStore';
import { prayerTimesStore } from '../stores/prayerTimes';
import { auth } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

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

        // Get user's timezone offset
        const userTimezoneOffset = new Date().getTimezoneOffset();
        console.log(`User's timezone offset for end-of-day reminders: ${userTimezoneOffset} minutes`);

        // Check if we have timezone information for any prayer in the database
        let prayerTimezoneOffset = null;
        try {
            const user = auth.currentUser;
            if (user) {
                const today = new Date().toLocaleDateString('en-CA');
                const prayerQuery = query(
                    collection(db, 'prayer_history'),
                    where('userId', '==', user.uid),
                    where('date', '==', today)
                );
                const querySnapshot = await getDocs(prayerQuery);
                if (!querySnapshot.empty) {
                    // Use the first prayer's timezone offset
                    const prayerData = querySnapshot.docs[0].data();
                    prayerTimezoneOffset = prayerData.timezoneOffset || null;
                    console.log(`Found timezone offset for end-of-day reminders: ${prayerTimezoneOffset}`);
                }
            }
        } catch (error) {
            console.error('Error getting prayer timezone information for end-of-day reminders:', error);
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

            // Adjust for timezone if we have the information
            if (prayerTimezoneOffset !== null && prayerTimezoneOffset !== userTimezoneOffset) {
                const offsetDiff = userTimezoneOffset - prayerTimezoneOffset;
                scheduleTime.setMinutes(scheduleTime.getMinutes() + offsetDiff);
                console.log(`Adjusted end-of-day reminder time by ${offsetDiff} minutes for timezone difference`);
            }

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