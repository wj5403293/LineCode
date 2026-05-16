package com.lineai

import android.content.Context
import java.io.File

object BundlePathProvider {
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
    val bundle = File(context.filesDir, ".linecode/updates/current/index.android.bundle")
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
}
