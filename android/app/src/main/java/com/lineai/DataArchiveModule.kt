package com.lineai

import android.database.sqlite.SQLiteDatabase
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import java.io.File
import java.util.LinkedHashMap
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
    fun getAsyncStorageEntrySizes(promise: Promise) {
        thread {
            try {
                val legacySizes = LinkedHashMap<String, Long>()
                collectEntrySizes("RKStorage", "catalystLocalStorage", legacySizes)
                val nextSizes = LinkedHashMap<String, Long>()
                collectEntrySizes("AsyncStorage", "Storage", nextSizes)

                val sizes = if (nextSizes.isNotEmpty()) nextSizes else legacySizes
                promise.resolve(toEntrySizeArray(sizes))
            } catch (e: Exception) {
                promise.reject("E_ASYNC_STORAGE_SIZE", e.message ?: "统计 AsyncStorage 大小失败")
            }
        }
    }

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

    private fun collectEntrySizes(
        databaseName: String,
        tableName: String,
        sizes: LinkedHashMap<String, Long>
    ) {
        val dbFile = reactContext.getDatabasePath(databaseName)
        if (!dbFile.exists()) return

        var db: SQLiteDatabase? = null
        try {
            db = SQLiteDatabase.openDatabase(dbFile.path, null, SQLiteDatabase.OPEN_READONLY)
            if (!tableExists(db, tableName)) return

            db.rawQuery(
                "SELECT key, length(CAST(value AS BLOB)) FROM $tableName WHERE key LIKE ? OR key LIKE ?",
                arrayOf("@lineai_%", "@linecode_%")
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    val key = cursor.getString(0) ?: continue
                    sizes[key] = cursor.getLong(1)
                }
            }
        } finally {
            try {
                db?.close()
            } catch (_: Exception) {
            }
        }
    }

    private fun tableExists(db: SQLiteDatabase, tableName: String): Boolean {
        db.rawQuery(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            arrayOf(tableName)
        ).use { cursor ->
            return cursor.moveToFirst()
        }
    }

    private fun toEntrySizeArray(sizes: Map<String, Long>): WritableArray {
        val result = Arguments.createArray()
        for ((key, bytes) in sizes) {
            val item = Arguments.createMap()
            item.putString("key", key)
            item.putDouble("bytes", bytes.toDouble())
            result.pushMap(item)
        }
        return result
    }
}
