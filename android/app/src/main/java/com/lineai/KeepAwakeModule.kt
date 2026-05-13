package com.lineai

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.LifecycleEventListener

class KeepAwakeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    private var enabled = false
    private var wakeLock: PowerManager.WakeLock? = null
    private var foregroundEnabled = false
    private var fakeMusicEnabled = false

    init {
        reactApplicationContext.addLifecycleEventListener(this)
    }

    override fun getName() = "KeepAwake"

    @ReactMethod
    fun setEnabled(nextEnabled: Boolean, promise: Promise) {
        try {
            if (nextEnabled) {
                acquire()
            } else {
                release()
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_KEEP_AWAKE", e.message, e)
        }
    }

    @ReactMethod
    fun setForegroundServiceEnabled(nextEnabled: Boolean, promise: Promise) {
        try {
            foregroundEnabled = nextEnabled
            applyForegroundState()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_FOREGROUND_SERVICE", e.message, e)
        }
    }

    @ReactMethod
    fun setFakeMusicEnabled(nextEnabled: Boolean, promise: Promise) {
        try {
            fakeMusicEnabled = nextEnabled
            applyForegroundState()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_FAKE_MUSIC", e.message, e)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(false)
                return
            }
            val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            if (powerManager.isIgnoringBatteryOptimizations(reactApplicationContext.packageName)) {
                promise.resolve(true)
                return
            }
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${reactApplicationContext.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("E_BATTERY_OPTIMIZATION", e.message, e)
        }
    }

    private fun acquire() {
        enabled = true
        if (wakeLock == null) {
            val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "LineAI:LongRunningTask"
            ).apply {
                setReferenceCounted(false)
            }
        }
        if (wakeLock?.isHeld != true) {
            wakeLock?.acquire()
        }
        applyScreenFlag()
    }

    private fun release() {
        enabled = false
        clearScreenFlag()
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
    }

    private fun applyForegroundState() {
        val intent = Intent(reactApplicationContext, CodingForegroundService::class.java).apply {
            putExtra(CodingForegroundService.EXTRA_FAKE_MUSIC, fakeMusicEnabled)
        }
        if (foregroundEnabled || fakeMusicEnabled) {
            ContextCompat.startForegroundService(reactApplicationContext, intent)
        } else {
            reactApplicationContext.stopService(intent)
        }
    }

    private fun applyScreenFlag() {
        UiThreadUtil.runOnUiThread {
            reactApplicationContext.currentActivity?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    private fun clearScreenFlag() {
        UiThreadUtil.runOnUiThread {
            reactApplicationContext.currentActivity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    override fun onHostResume() {
        if (enabled) applyScreenFlag()
    }

    override fun onHostPause() = Unit

    override fun onHostDestroy() {
        foregroundEnabled = false
        fakeMusicEnabled = false
        applyForegroundState()
        release()
    }

    override fun invalidate() {
        release()
        reactApplicationContext.removeLifecycleEventListener(this)
        super.invalidate()
    }
}
