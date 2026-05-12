package com.lineai

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.jcraft.jsch.ChannelExec
import com.jcraft.jsch.JSch
import java.io.ByteArrayOutputStream
import java.util.Properties
import kotlin.concurrent.thread

class SshModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SshModule"

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
                config["PreferredAuthentications"] = if (privateKey.isNotBlank()) {
                    "publickey,password,keyboard-interactive"
                } else {
                    "password,keyboard-interactive,publickey"
                }
                session.setConfig(config)
                session.connect(timeoutMs)

                channel = session.openChannel("exec") as ChannelExec
                channel.setCommand(command)

                val stdout = ByteArrayOutputStream()
                val stderr = ByteArrayOutputStream()
                channel.outputStream = stdout
                channel.setErrStream(stderr)
                channel.connect(timeoutMs)

                val startedAt = System.currentTimeMillis()
                while (!channel.isClosed) {
                    if (System.currentTimeMillis() - startedAt > timeoutMs) {
                        throw RuntimeException("命令执行超时")
                    }
                    Thread.sleep(100)
                }

                val output = stdout.toString("UTF-8")
                val error = stderr.toString("UTF-8")
                val exitStatus = channel.exitStatus
                val combined = buildString {
                    if (output.isNotBlank()) append(output)
                    if (error.isNotBlank()) {
                        if (isNotEmpty()) append('\n')
                        append(error)
                    }
                    if (isBlank()) append("exit status: $exitStatus")
                }

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
}
