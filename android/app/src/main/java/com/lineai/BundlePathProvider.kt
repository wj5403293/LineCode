package com.lineai

import android.content.Context
import java.io.File
import org.json.JSONObject

object BundlePathProvider {
  private const val UPDATE_CURRENT_DIR = ".linecode/updates/current"
  private const val BUNDLE_FILE_NAME = "index.android.bundle"
  private const val STATE_FILE_NAME = "hot-update-state.json"

  private val HERMES_BYTECODE_MAGIC = byteArrayOf(
    0xc6.toByte(),
    0x1f.toByte(),
    0xbc.toByte(),
    0x03.toByte(),
    0xc1.toByte(),
    0x03.toByte(),
    0x19.toByte(),
    0x1f.toByte(),
  )

  fun getInstalledBundlePath(context: Context): String? {
    val currentDir = File(context.filesDir, UPDATE_CURRENT_DIR)
    val state = File(currentDir, STATE_FILE_NAME)
    if (!isStateForCurrentApk(state)) return null

    val bundle = File(currentDir, BUNDLE_FILE_NAME)
    return if (bundle.exists() && bundle.isFile && isHermesBytecodeBundle(bundle)) {
      bundle.absolutePath
    } else {
      null
    }
  }

  private fun isHermesBytecodeBundle(bundle: File): Boolean {
    if (bundle.length() < HERMES_BYTECODE_MAGIC.size) return false

    return try {
      bundle.inputStream().use { input ->
        val header = ByteArray(HERMES_BYTECODE_MAGIC.size)
        input.read(header) == HERMES_BYTECODE_MAGIC.size && header.contentEquals(HERMES_BYTECODE_MAGIC)
      }
    } catch (_: Exception) {
      false
    }
  }

  private fun isStateForCurrentApk(state: File): Boolean {
    if (!state.exists() || !state.isFile) return false

    return try {
      val json = JSONObject(state.readText(Charsets.UTF_8))
      json.optString("installedApkVersionName") == BuildConfig.VERSION_NAME &&
        json.optInt("installedApkVersionCode", -1) == BuildConfig.VERSION_CODE
    } catch (_: Exception) {
      false
    }
  }
}
