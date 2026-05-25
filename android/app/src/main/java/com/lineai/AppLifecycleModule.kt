package com.lineai

import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlin.system.exitProcess

class AppLifecycleModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AppLifecycle"

    @ReactMethod
    fun exitApp(delayMs: Double, promise: Promise) {
        try {
            stopBackgroundServices()
            finishCurrentActivity()

            val delay = delayMs.toLong().coerceAtLeast(0L)
            Handler(Looper.getMainLooper()).postDelayed({
                android.os.Process.killProcess(android.os.Process.myPid())
                exitProcess(0)
            }, delay)

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_APP_LIFECYCLE", e.message ?: "Failed to exit app", e)
        }
    }

    private fun stopBackgroundServices() {
        try {
            val intent = Intent(reactContext, CodingForegroundService::class.java)
            reactContext.stopService(intent)
        } catch (_: Exception) {
        }
    }

    private fun finishCurrentActivity() {
        try {
            reactContext.currentActivity?.finishAndRemoveTask()
        } catch (_: Exception) {
        }
    }
}
