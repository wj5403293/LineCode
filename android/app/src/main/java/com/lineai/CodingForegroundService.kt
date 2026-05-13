package com.lineai

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class CodingForegroundService : Service() {
    private var audioTrack: AudioTrack? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val fakeMusic = intent?.getBooleanExtra(EXTRA_FAKE_MUSIC, false) == true
        startForeground(NOTIFICATION_ID, buildNotification())
        if (fakeMusic) {
            startFakeMusic()
        } else {
            stopFakeMusic()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        stopFakeMusic()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle("LineCode")
            .setContentText("正在编码")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "LineCode 编码服务",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "显示 LineCode 正在编码"
            setSound(null, null)
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    private fun startFakeMusic() {
        if (audioTrack != null) return
        val sampleRate = 8000
        val minBuffer = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(sampleRate)
        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(sampleRate)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(minBuffer)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        audioTrack?.setVolume(0f)
        audioTrack?.play()
        Thread {
            val buffer = ShortArray(minBuffer / 2)
            while (audioTrack != null) {
                try {
                    audioTrack?.write(buffer, 0, buffer.size)
                } catch (_: Exception) {
                    break
                }
            }
        }.start()
    }

    private fun stopFakeMusic() {
        val track = audioTrack
        audioTrack = null
        try {
            track?.pause()
            track?.flush()
            track?.release()
        } catch (_: Exception) {
        }
    }

    companion object {
        const val CHANNEL_ID = "linecode_coding"
        const val NOTIFICATION_ID = 4201
        const val EXTRA_FAKE_MUSIC = "fake_music"
    }
}
