package com.lineai

import android.database.sqlite.SQLiteDatabase
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import kotlin.concurrent.thread

class DataArchiveModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private val ASYNC_STORAGE_FILES = listOf(
            "RKStorage",
            "RKStorage-journal",
            "RKStorage-wal",
            "RKStorage-shm",
            "AsyncStorage",
            "AsyncStorage-journal",
            "AsyncStorage-wal",
            "AsyncStorage-shm"
        )
    }

    override fun getName() = "DataArchive"

    @ReactMethod
    fun exportAsyncStorageDatabase(targetDir: String, promise: Promise) {
        thread {
            try {
                val outDir = File(targetDir)
                if (!outDir.exists() && !outDir.mkdirs()) {
                    throw IllegalStateException("无法创建 AsyncStorage 备份目录: $targetDir")
                }

                checkpointDatabase("RKStorage")
                checkpointDatabase("AsyncStorage")

                var copied = 0
                for (name in ASYNC_STORAGE_FILES) {
                    val source = reactContext.getDatabasePath(name)
                    if (!source.exists() || !source.isFile) continue
                    source.copyTo(File(outDir, name), overwrite = true)
                    copied++
                }
                promise.resolve(copied)
            } catch (e: Exception) {
                promise.reject("E_EXPORT_ASYNC_STORAGE_DB", e.message ?: "导出 AsyncStorage 数据库失败")
            }
        }
    }

    @ReactMethod
    fun restoreAsyncStorageDatabase(sourceDir: String, promise: Promise) {
        thread {
            try {
                val inDir = File(sourceDir)
                if (!inDir.exists() || !inDir.isDirectory) {
                    throw IllegalStateException("备份包缺少 AsyncStorage 数据库目录")
                }

                val files = ASYNC_STORAGE_FILES
                    .map { File(inDir, it) }
                    .filter { it.exists() && it.isFile }
                if (files.isEmpty()) {
                    throw IllegalStateException("备份包缺少 AsyncStorage 数据库文件")
                }

                for (name in ASYNC_STORAGE_FILES) {
                    val target = reactContext.getDatabasePath(name)
                    if (target.exists() && !target.delete()) {
                        throw IllegalStateException("无法替换 AsyncStorage 数据库文件: ${target.name}")
                    }
                }

                for (source in files) {
                    val target = reactContext.getDatabasePath(source.name)
                    target.parentFile?.mkdirs()
                    source.copyTo(target, overwrite = true)
                }
                promise.resolve(files.size)
            } catch (e: Exception) {
                promise.reject("E_RESTORE_ASYNC_STORAGE_DB", e.message ?: "恢复 AsyncStorage 数据库失败")
            }
        }
    }

    private fun checkpointDatabase(name: String) {
        val dbFile = reactContext.getDatabasePath(name)
        if (!dbFile.exists()) return
        var db: SQLiteDatabase? = null
        try {
            db = SQLiteDatabase.openDatabase(dbFile.path, null, SQLiteDatabase.OPEN_READWRITE)
            db.rawQuery("PRAGMA wal_checkpoint(FULL)", null).use { cursor ->
                cursor.moveToFirst()
            }
        } catch (_: Exception) {
            // Best effort only. Copying WAL/SHM sidecars below still preserves pending pages.
        } finally {
            try {
                db?.close()
            } catch (_: Exception) {
            }
        }
    }
}
