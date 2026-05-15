package com.lineai

import android.app.Application
import android.os.Build
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.system.exitProcess

class CrashLogHandler private constructor(
    private val application: Application,
    private val previous: Thread.UncaughtExceptionHandler?
) : Thread.UncaughtExceptionHandler {

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        try {
            writeCrashLog(application, thread, throwable)
        } catch (_: Throwable) {
        }

        if (previous != null && previous !== this) {
            previous.uncaughtException(thread, throwable)
        } else {
            android.os.Process.killProcess(android.os.Process.myPid())
            exitProcess(10)
        }
    }

    companion object {
        fun install(application: Application) {
            val current = Thread.getDefaultUncaughtExceptionHandler()
            if (current is CrashLogHandler) return
            Thread.setDefaultUncaughtExceptionHandler(CrashLogHandler(application, current))
        }

        private fun writeCrashLog(
            application: Application,
            thread: Thread,
            throwable: Throwable
        ) {
            val crashDir = File(application.filesDir, ".linecode/crash")
            if (!crashDir.exists()) {
                crashDir.mkdirs()
            }

            val text = buildString {
                append("LineCode native crash report\n")
                append("time: ${isoNow()}\n")
                append("source: native\n")
                append("fatal: true\n")
                append("\n")
                append("Device\n")
                append("appVersion: ${BuildConfig.VERSION_NAME}\n")
                append("versionCode: ${BuildConfig.VERSION_CODE}\n")
                append("platform: android\n")
                append("sdkInt: ${Build.VERSION.SDK_INT}\n")
                append("release: ${Build.VERSION.RELEASE}\n")
                append("brand: ${Build.BRAND}\n")
                append("model: ${Build.MODEL}\n")
                append("manufacturer: ${Build.MANUFACTURER}\n")
                append("thread: ${thread.name}\n")
                append("\n")
                append("Error\n")
                append("${throwable.javaClass.name}: ${throwable.message ?: ""}\n")
                append(stackTraceToString(throwable))
            }

            File(crashDir, "last-crash.log").writeText(text)
            File(crashDir, "last-native-crash.log").writeText(text)
        }

        private fun isoNow(): String {
            return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(Date())
        }

        private fun stackTraceToString(throwable: Throwable): String {
            val writer = StringWriter()
            throwable.printStackTrace(PrintWriter(writer))
            return writer.toString()
        }
    }
}
