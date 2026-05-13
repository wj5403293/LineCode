package com.lineai

import android.content.Context
import java.io.File

object BundlePathProvider {
  fun getInstalledBundlePath(context: Context): String? {
    val bundle = File(context.filesDir, ".linecode/updates/current/index.android.bundle")
    return if (bundle.exists() && bundle.isFile && bundle.length() > 0L) {
      bundle.absolutePath
    } else {
      null
    }
  }
}
