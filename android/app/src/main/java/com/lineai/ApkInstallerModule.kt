package com.lineai

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

class ApkInstallerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "ApkInstaller"

  @ReactMethod
  fun canRequestPackageInstalls(promise: Promise) {
    try {
      val allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
        reactContext.packageManager.canRequestPackageInstalls()
      promise.resolve(allowed)
    } catch (error: Exception) {
      promise.reject("APK_INSTALL_PERMISSION_CHECK_FAILED", error)
    }
  }

  @ReactMethod
  fun openInstallPermissionSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val intent = Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:${reactContext.packageName}")
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("APK_INSTALL_PERMISSION_SETTINGS_FAILED", error)
    }
  }

  @ReactMethod
  fun decryptXorFile(inputPath: String, outputPath: String, key: String, promise: Promise) {
    try {
      val keyBytes = key.toByteArray(Charsets.UTF_8)
      if (keyBytes.isEmpty()) {
        promise.reject("APK_DECRYPT_KEY_EMPTY", "XOR key must not be empty.")
        return
      }

      val inputFile = File(stripFileScheme(inputPath))
      val outputFile = File(stripFileScheme(outputPath))
      outputFile.parentFile?.mkdirs()

      FileInputStream(inputFile).use { input ->
        FileOutputStream(outputFile).use { output ->
          val buffer = ByteArray(64 * 1024)
          var offset = 0L
          while (true) {
            val count = input.read(buffer)
            if (count <= 0) break
            for (index in 0 until count) {
              val keyByte = keyBytes[((offset + index) % keyBytes.size).toInt()].toInt()
              buffer[index] = (buffer[index].toInt() xor keyByte).toByte()
            }
            output.write(buffer, 0, count)
            offset += count.toLong()
          }
        }
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("APK_DECRYPT_FAILED", error)
    }
  }

  @ReactMethod
  fun installApk(apkPath: String, promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        !reactContext.packageManager.canRequestPackageInstalls()
      ) {
        promise.reject("APK_INSTALL_PERMISSION_REQUIRED", "需要允许 LineCode 安装未知应用。")
        return
      }

      val apkFile = File(stripFileScheme(apkPath))
      if (!apkFile.exists()) {
        promise.reject("APK_NOT_FOUND", "APK 文件不存在: ${apkFile.absolutePath}")
        return
      }

      val uri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.fileprovider",
        apkFile
      )
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      reactContext.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("APK_INSTALL_FAILED", error)
    }
  }

  private fun stripFileScheme(path: String): String =
    if (path.startsWith("file://")) path.removePrefix("file://") else path
}
