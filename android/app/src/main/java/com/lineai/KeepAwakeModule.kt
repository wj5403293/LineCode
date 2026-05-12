package com.lineai

import android.content.Context
import android.os.PowerManager
import android.view.WindowManager
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
        release()
    }

    override fun invalidate() {
        release()
        reactApplicationContext.removeLifecycleEventListener(this)
        super.invalidate()
    }
}
