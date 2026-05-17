package com.lineai

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.jcraft.jsch.ChannelExec
import com.jcraft.jsch.JSch
import java.io.InputStream
import java.util.Properties
import kotlin.concurrent.thread

class SshModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TERMUX_PACKAGE = "com.termux"
        private const val TERMUX_RUN_COMMAND_SERVICE = "com.termux.app.RunCommandService"
        private const val TERMUX_PERMISSION_RUN_COMMAND = "com.termux.permission.RUN_COMMAND"
        private const val TERMUX_ACTION_RUN_COMMAND = "com.termux.RUN_COMMAND"
        private const val TERMUX_EXTRA_COMMAND_PATH = "com.termux.RUN_COMMAND_PATH"
        private const val TERMUX_EXTRA_ARGUMENTS = "com.termux.RUN_COMMAND_ARGUMENTS"
        private const val TERMUX_EXTRA_STDIN = "com.termux.RUN_COMMAND_STDIN"
        private const val TERMUX_EXTRA_WORKDIR = "com.termux.RUN_COMMAND_WORKDIR"
        private const val TERMUX_EXTRA_BACKGROUND = "com.termux.RUN_COMMAND_BACKGROUND"
        private const val TERMUX_EXTRA_RUNNER = "com.termux.RUN_COMMAND_RUNNER"
        private const val TERMUX_EXTRA_COMMAND_LABEL = "com.termux.RUN_COMMAND_COMMAND_LABEL"
        private const val TERMUX_EXTRA_COMMAND_DESCRIPTION = "com.termux.RUN_COMMAND_COMMAND_DESCRIPTION"
        private const val TERMUX_EXTRA_PENDING_INTENT = "com.termux.RUN_COMMAND_PENDING_INTENT"
        private const val TERMUX_RESULT_BUNDLE = "result"
        private const val TERMUX_RESULT_STDOUT = "stdout"
        private const val TERMUX_RESULT_STDERR = "stderr"
        private const val TERMUX_RESULT_EXIT_CODE = "exitCode"
        private const val TERMUX_RESULT_ERR = "err"
        private const val TERMUX_RESULT_ERRMSG = "errmsg"
        private const val TERMUX_HOME = "/data/data/com.termux/files/home"
        private const val TERMUX_SH = "/data/data/com.termux/files/usr/bin/sh"
        private const val SSH_OUTPUT_EVENT = "LineAISshOutput"

        private val TERMUX_SETUP_SCRIPT = """
            set -eu
            export DEBIAN_FRONTEND=noninteractive
            mkdir -p "${'$'}HOME/.termux"
            properties_path="${'$'}HOME/.termux/termux.properties"
            touch "${'$'}properties_path"
            grep -qxF 'allow-external-apps=true' "${'$'}properties_path" || printf '\nallow-external-apps=true\n' >> "${'$'}properties_path"
            termux-reload-settings >/dev/null 2>&1 || true

            if ! command -v pkg >/dev/null 2>&1; then
              echo "Termux pkg command not found" >&2
              exit 127
            fi
            pkg update -y
            pkg install -y openssh

            user_name="${'$'}(whoami 2>/dev/null || id -un 2>/dev/null || echo "")"
            shell_path="${'$'}{SHELL:-}"
            if [ -z "${'$'}shell_path" ] && command -v getent >/dev/null 2>&1; then
              shell_path="${'$'}(getent passwd "${'$'}user_name" | awk -F: '{print ${'$'}7}' || true)"
            fi
            if [ -z "${'$'}shell_path" ]; then
              shell_path="${'$'}{PREFIX:-/data/data/com.termux/files/usr}/bin/sh"
            fi
            shell_name="${'$'}(basename "${'$'}shell_path")"
            start_line='command -v sshd >/dev/null 2>&1 && { command -v pgrep >/dev/null 2>&1 && pgrep -x sshd >/dev/null 2>&1 || sshd >/dev/null 2>&1 || true; }'
            case "${'$'}shell_name" in
              fish)
                rc_path="${'$'}HOME/.config/fish/config.fish"
                mkdir -p "${'$'}(dirname "${'$'}rc_path")"
                start_line='command -v sshd >/dev/null 2>&1; and begin; command -v pgrep >/dev/null 2>&1; and pgrep -x sshd >/dev/null 2>&1; or sshd >/dev/null 2>&1; or true; end'
                ;;
              zsh) rc_path="${'$'}HOME/.zshrc" ;;
              bash) rc_path="${'$'}HOME/.bashrc" ;;
              *) rc_path="${'$'}HOME/.profile" ;;
            esac
            touch "${'$'}rc_path"
            if ! grep -Fq 'LineAI:sshd-autostart' "${'$'}rc_path"; then
              printf '\n# LineAI:sshd-autostart\n%s\n' "${'$'}start_line" >> "${'$'}rc_path"
            fi

            chmod 700 "${'$'}HOME" 2>/dev/null || true
            mkdir -p "${'$'}HOME/.ssh"
            chmod 700 "${'$'}HOME/.ssh"
            key_path="${'$'}HOME/.ssh/lineai_rsa"
            if [ ! -f "${'$'}key_path" ] || ! ssh-keygen -y -f "${'$'}key_path" >/dev/null 2>&1; then
              rm -f "${'$'}key_path.pub"
              ssh-keygen -t rsa -b 4096 -m PEM -f "${'$'}key_path" -N "" -C "lineai@termux" >/dev/null
            fi
            chmod 600 "${'$'}key_path"
            if [ ! -f "${'$'}key_path.pub" ]; then
              ssh-keygen -y -f "${'$'}key_path" > "${'$'}key_path.pub"
            fi
            auth_path="${'$'}HOME/.ssh/authorized_keys"
            touch "${'$'}auth_path"
            pub_key="${'$'}(cat "${'$'}key_path.pub")"
            grep -qxF "${'$'}pub_key" "${'$'}auth_path" || printf '%s\n' "${'$'}pub_key" >> "${'$'}auth_path"
            chmod 600 "${'$'}auth_path"
            if command -v pgrep >/dev/null 2>&1; then
              pgrep -x sshd >/dev/null 2>&1 || sshd >/dev/null 2>&1 || true
            else
              sshd >/dev/null 2>&1 || true
            fi
            sleep 1

            printf 'LINEAI_TERMUX_USERNAME=%s\n' "${'$'}user_name"
            printf 'LINEAI_TERMUX_SHELL=%s\n' "${'$'}shell_name"
            printf 'LINEAI_TERMUX_RC=%s\n' "${'$'}rc_path"
            printf 'LINEAI_TERMUX_HOST=127.0.0.1\n'
            printf 'LINEAI_TERMUX_PORT=8022\n'
            printf 'LINEAI_PRIVATE_KEY_BEGIN\n'
            cat "${'$'}key_path"
            printf '\nLINEAI_PRIVATE_KEY_END\n'
        """.trimIndent()
    }

    override fun getName() = "SshModule"

    @ReactMethod
    fun addListener(eventName: String) {
        // Required by React Native event emitters.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required by React Native event emitters.
    }

    @ReactMethod
    fun execute(
        host: String,
        port: Int,
        username: String,
        password: String,
        privateKey: String,
        passphrase: String,
        command: String,
        timeoutMs: Int,
        promise: Promise
    ) {
        executeInternal(host, port, username, password, privateKey, passphrase, command, timeoutMs, null, promise)
    }

    @ReactMethod
    fun executeStreaming(
        host: String,
        port: Int,
        username: String,
        password: String,
        privateKey: String,
        passphrase: String,
        command: String,
        timeoutMs: Int,
        executionId: String,
        promise: Promise
    ) {
        executeInternal(host, port, username, password, privateKey, passphrase, command, timeoutMs, executionId, promise)
    }

    private fun executeInternal(
        host: String,
        port: Int,
        username: String,
        password: String,
        privateKey: String,
        passphrase: String,
        command: String,
        timeoutMs: Int,
        executionId: String?,
        promise: Promise
    ) {
        thread {
            var channel: ChannelExec? = null
            var session: com.jcraft.jsch.Session? = null
            try {
                val jsch = JSch()
                if (privateKey.isNotBlank()) {
                    val passphraseBytes = if (passphrase.isNotBlank()) passphrase.toByteArray(Charsets.UTF_8) else null
                    jsch.addIdentity(
                        "lineai-key",
                        privateKey.toByteArray(Charsets.UTF_8),
                        null,
                        passphraseBytes
                    )
                }
                session = jsch.getSession(username, host, port)
                if (password.isNotBlank()) {
                    session.setPassword(password)
                }
                val config = Properties()
                config["StrictHostKeyChecking"] = "no"
                config["IdentitiesOnly"] = "yes"
                config["PreferredAuthentications"] = if (privateKey.isNotBlank()) {
                    "publickey,password,keyboard-interactive"
                } else {
                    "password,keyboard-interactive,publickey"
                }
                session.setConfig(config)
                session.connect(timeoutMs)

                channel = session.openChannel("exec") as ChannelExec
                channel.setCommand(command)

                val stdout = channel.inputStream
                val stderr = channel.errStream
                channel.connect(timeoutMs)

                val startedAt = System.currentTimeMillis()
                val output = StringBuilder()
                val error = StringBuilder()
                while (!channel.isClosed) {
                    if (System.currentTimeMillis() - startedAt > timeoutMs) {
                        throw RuntimeException("命令执行超时")
                    }
                    drainAvailable(stdout, "stdout", executionId, output)
                    drainAvailable(stderr, "stderr", executionId, error)
                    Thread.sleep(100)
                }
                drainAvailable(stdout, "stdout", executionId, output)
                drainAvailable(stderr, "stderr", executionId, error)

                val exitStatus = channel.exitStatus
                val combined = buildString {
                    if (output.isNotBlank()) append(output)
                    if (error.isNotBlank()) {
                        if (isNotEmpty()) append('\n')
                        append(error)
                    }
                    if (isBlank()) append("exit status: $exitStatus")
                }
                emitSshOutput(
                    executionId,
                    "system",
                    "",
                    done = true,
                    exitStatus = exitStatus
                )

                if (exitStatus == 0) {
                    promise.resolve(combined)
                } else {
                    promise.reject("E_COMMAND", "exit status $exitStatus\n$combined")
                }
            } catch (e: Exception) {
                promise.reject("E_SSH", e.message ?: "SSH 执行失败")
            } finally {
                try { channel?.disconnect() } catch (_: Exception) {}
                try { session?.disconnect() } catch (_: Exception) {}
            }
        }
    }

    private fun drainAvailable(
        stream: InputStream,
        streamName: String,
        executionId: String?,
        target: StringBuilder
    ): Boolean {
        var emitted = false
        val buffer = ByteArray(4096)
        while (stream.available() > 0) {
            val read = stream.read(buffer, 0, minOf(buffer.size, stream.available()))
            if (read <= 0) break
            val chunk = String(buffer, 0, read, Charsets.UTF_8)
            target.append(chunk)
            emitSshOutput(executionId, streamName, chunk)
            emitted = true
        }
        return emitted
    }

    private fun emitSshOutput(
        executionId: String?,
        stream: String,
        data: String,
        done: Boolean = false,
        exitStatus: Int? = null
    ) {
        if (executionId.isNullOrBlank()) return

        try {
            val params = Arguments.createMap()
            params.putString("executionId", executionId)
            params.putString("stream", stream)
            params.putString("data", data)
            params.putBoolean("done", done)
            if (exitStatus != null) {
                params.putInt("exitStatus", exitStatus)
            }
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(SSH_OUTPUT_EVENT, params)
        } catch (_: Exception) {
        }
    }

    @ReactMethod
    fun openLineAiAppSettings(promise: Promise) {
        try {
            val intent = Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:${reactApplicationContext.packageName}")
            )
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_SETTINGS", e.message ?: "无法打开应用权限设置")
        }
    }

    @ReactMethod
    fun openTermux(promise: Promise) {
        try {
            ensureTermuxInstalled()
            val launchIntent = reactApplicationContext.packageManager.getLaunchIntentForPackage(TERMUX_PACKAGE)
                ?: Intent().setClassName(TERMUX_PACKAGE, "com.termux.app.TermuxActivity")
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(launchIntent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_TERMUX_OPEN", e.message ?: "无法打开 Termux")
        }
    }

    @ReactMethod
    fun setupTermuxSshd(timeoutMs: Int, promise: Promise) {
        try {
            ensureTermuxInstalled()
            if (reactApplicationContext.checkSelfPermission(TERMUX_PERMISSION_RUN_COMMAND) != PackageManager.PERMISSION_GRANTED) {
                promise.reject(
                    "E_TERMUX_PERMISSION",
                    "LineAI 未获得 Termux RUN_COMMAND 权限，请在 LineAI 的应用权限中允许“Run commands in Termux environment”。"
                )
                return
            }

            val boundedTimeout = timeoutMs.coerceIn(60_000, 900_000)
            val action = "${reactApplicationContext.packageName}.TERMUX_SETUP_RESULT.${System.currentTimeMillis()}"
            val handler = Handler(Looper.getMainLooper())
            var settled = false
            lateinit var receiver: BroadcastReceiver
            var timeoutRunnable: Runnable? = null

            fun unregisterReceiverSafely() {
                try {
                    reactApplicationContext.unregisterReceiver(receiver)
                } catch (_: Exception) {
                }
            }

            fun settle(block: () -> Unit) {
                if (settled) return
                settled = true
                timeoutRunnable?.let { handler.removeCallbacks(it) }
                unregisterReceiverSafely()
                block()
            }

            receiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    val result = intent?.getBundleExtra(TERMUX_RESULT_BUNDLE)
                    if (result == null) {
                        settle {
                            promise.reject("E_TERMUX_RESULT", "Termux 未返回执行结果，请确认 Termux 版本 >= 0.109。")
                        }
                        return
                    }

                    val stdout = result.getString(TERMUX_RESULT_STDOUT, "") ?: ""
                    val stderr = result.getString(TERMUX_RESULT_STDERR, "") ?: ""
                    val exitCode = result.getInt(TERMUX_RESULT_EXIT_CODE, 0)
                    val err = result.getInt(TERMUX_RESULT_ERR, Activity.RESULT_OK)
                    val errmsg = result.getString(TERMUX_RESULT_ERRMSG, "") ?: ""
                    val combined = buildString {
                        if (stdout.isNotBlank()) append(stdout)
                        if (stderr.isNotBlank()) {
                            if (isNotEmpty()) append('\n')
                            append(stderr)
                        }
                    }

                    settle {
                        if (err != Activity.RESULT_OK) {
                            promise.reject("E_TERMUX_INTERNAL", errmsg.ifBlank { "Termux 启动命令失败: $err" })
                        } else if (exitCode != 0) {
                            promise.reject("E_TERMUX_COMMAND", "exit status $exitCode\n$combined")
                        } else {
                            promise.resolve(combined)
                        }
                    }
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactApplicationContext.registerReceiver(receiver, IntentFilter(action), Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                reactApplicationContext.registerReceiver(receiver, IntentFilter(action))
            }

            val timeoutTask = Runnable {
                settle {
                    promise.reject(
                        "E_TERMUX_TIMEOUT",
                        "等待 Termux 配置 OpenSSH 超时，请确认 Termux 已执行授权指令并开启 allow-external-apps=true。"
                    )
                }
            }
            timeoutRunnable = timeoutTask
            handler.postDelayed(timeoutTask, boundedTimeout.toLong())

            val requestCode = (System.currentTimeMillis() and 0x7fffffff).toInt()
            val resultIntent = Intent(action).setPackage(reactApplicationContext.packageName)
            val flags = PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
            val pendingIntent = PendingIntent.getBroadcast(
                reactApplicationContext,
                requestCode,
                resultIntent,
                flags
            )

            val intent = Intent()
                .setClassName(TERMUX_PACKAGE, TERMUX_RUN_COMMAND_SERVICE)
                .setAction(TERMUX_ACTION_RUN_COMMAND)
                .putExtra(TERMUX_EXTRA_COMMAND_PATH, TERMUX_SH)
                .putExtra(TERMUX_EXTRA_ARGUMENTS, arrayOf("-s"))
                .putExtra(TERMUX_EXTRA_STDIN, TERMUX_SETUP_SCRIPT)
                .putExtra(TERMUX_EXTRA_WORKDIR, TERMUX_HOME)
                .putExtra(TERMUX_EXTRA_BACKGROUND, true)
                .putExtra(TERMUX_EXTRA_RUNNER, "app-shell")
                .putExtra(TERMUX_EXTRA_COMMAND_LABEL, "LineAI OpenSSH setup")
                .putExtra(
                    TERMUX_EXTRA_COMMAND_DESCRIPTION,
                    "Install openssh, create a LineAI key, enable authorized_keys, add sshd autostart to shell rc, and start sshd."
                )
                .putExtra(TERMUX_EXTRA_PENDING_INTENT, pendingIntent)

            try {
                reactApplicationContext.startService(intent)
            } catch (e: Exception) {
                settle {
                    promise.reject("E_TERMUX_SETUP", e.message ?: "Termux OpenSSH 自动配置失败")
                }
            }
        } catch (e: Exception) {
            promise.reject("E_TERMUX_SETUP", e.message ?: "Termux OpenSSH 自动配置失败")
        }
    }

    private fun ensureTermuxInstalled() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactApplicationContext.packageManager.getPackageInfo(TERMUX_PACKAGE, PackageManager.PackageInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                reactApplicationContext.packageManager.getPackageInfo(TERMUX_PACKAGE, 0)
            }
        } catch (_: PackageManager.NameNotFoundException) {
            throw IllegalStateException("未检测到 Termux，请先安装 Termux。")
        }
    }
}
