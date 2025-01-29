package com.islamicjournal.app;

import android.os.Bundle;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            NotificationManager notificationManager = 
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

            // Prayer Times Channel
            NotificationChannel prayerChannel = new NotificationChannel(
                "prayer_notifications",
                "Prayer Times",
                NotificationManager.IMPORTANCE_HIGH
            );
            prayerChannel.setDescription("Notifications for prayer times");
            prayerChannel.enableVibration(true);
            prayerChannel.enableLights(true);
            notificationManager.createNotificationChannel(prayerChannel);

            // Prayer Marking Channel
            NotificationChannel markingChannel = new NotificationChannel(
                "prayer_mark_notifications",
                "Prayer Marking",
                NotificationManager.IMPORTANCE_HIGH
            );
            markingChannel.setDescription("Reminders to mark your prayers");
            markingChannel.enableVibration(true);
            markingChannel.enableLights(true);
            notificationManager.createNotificationChannel(markingChannel);

            // Mood Tracking Channel
            NotificationChannel moodChannel = new NotificationChannel(
                "mood_notifications",
                "Mood Tracking Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            moodChannel.setDescription("Reminders for mood tracking");
            moodChannel.enableVibration(true);
            moodChannel.enableLights(true);
            notificationManager.createNotificationChannel(moodChannel);

            // Journal Channel
            NotificationChannel journalChannel = new NotificationChannel(
                "journal_notifications",
                "Journal Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            journalChannel.setDescription("Reminders for journal entries");
            journalChannel.enableVibration(true);
            journalChannel.enableLights(true);
            notificationManager.createNotificationChannel(journalChannel);
        }
    }
}
