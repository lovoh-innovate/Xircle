package com.lovohcreate.xircle;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;                     // ← add this
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "MyFCMService";
    private static final String CALL_CHANNEL_ID = "call_channel";
    private static final int CALL_NOTIFICATION_ID = 1001;

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (data != null && "call".equals(data.get("notificationType"))) {
            Log.d(TAG, "📞 Call push received (data‑only)");
            handleCallNotification(data);
        } else {
            Log.d(TAG, "📩 Non‑call push received – forwarding to super");
            super.onMessageReceived(remoteMessage);
        }
    }

    private void handleCallNotification(Map<String, String> data) {
        Bundle callData = new Bundle();
        for (Map.Entry<String, String> entry : data.entrySet()) {
            callData.putString(entry.getKey(), entry.getValue());
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction("OPEN_CALL");
        intent.putExtra("callData", callData);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CALL_CHANNEL_ID,
                    "Incoming Calls",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setSound(
                Uri.parse("android.resource://" + getPackageName() + "/raw/ringtone"),
                null
            );
            channel.setBypassDnd(true);
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            channel.setVibrationPattern(new long[]{1000, 500, 1000});
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CALL_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Incoming Call")
                .setContentText(data.get("callerName") != null ? data.get("callerName") : "Unknown Caller")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(pendingIntent, true)
                .setAutoCancel(true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
                .setVibrate(new long[]{1000, 500, 1000, 500, 1000})
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        NotificationManagerCompat.from(this).notify(CALL_NOTIFICATION_ID, builder.build());
        Log.d(TAG, "🔔 Full‑screen call notification posted");
    }
}