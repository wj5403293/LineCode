package com.lineai

import com.facebook.react.bridge.*
import java.io.*
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder

class SimpleHttpServerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SimpleHttpServer"

    private var server: ServerInstance? = null

    @ReactMethod
    fun start(port: Int, rootDir: String, promise: Promise) {
        if (server != null) {
            promise.resolve(server!!.port)
            return
        }
        try {
            val dir = File(rootDir).canonicalFile
            if (!dir.exists() || !dir.isDirectory) {
                promise.reject("E_DIR", "Directory not found: $rootDir")
                return
            }
            val inst = ServerInstance(port, dir.canonicalPath)
            inst.start()
            server = inst
            promise.resolve(inst.port)
        } catch (e: Exception) {
            promise.reject("E_START", "Failed to start: ${e.message}")
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            server?.stop()
        } catch (_: Exception) {}
        server = null
        promise.resolve(null)
    }

    @ReactMethod
    fun getPort(promise: Promise) {
        promise.resolve(server?.port ?: 0)
    }

    private class ServerInstance(port: Int, rootDir: String) {
        var port: Int = 0
            private set
        private var serverSocket: ServerSocket? = null
        private var running = false
        private val root = File(rootDir).canonicalFile

        fun start() {
            serverSocket = ServerSocket(port, 10)
            this.port = serverSocket!!.localPort
            running = true
            Thread {
                while (running && !serverSocket!!.isClosed) {
                    try {
                        val client = serverSocket!!.accept()
                        Thread { handle(client) }.start()
                    } catch (_: IOException) {
                        if (running) continue else break
                    }
                }
            }.also { it.isDaemon = true; it.start() }
        }

        fun stop() {
            running = false
            try { serverSocket?.close() } catch (_: Exception) {}
            serverSocket = null
        }

        private fun handle(socket: java.net.Socket) {
            try {
                socket.use { sock ->
                    sock.soTimeout = 10000
                    val input = sock.getInputStream()
                    val buf = ByteArray(8192)
                    var total = 0
                    // read up to 8KB of the request
                    var end = -1
                    while (total < buf.size) {
                        val n = input.read(buf, total, 1)
                        if (n < 0) break
                        total += n
                        if (total >= 4 && buf[total-4] == '\r'.code.toByte()
                            && buf[total-3] == '\n'.code.toByte()
                            && buf[total-2] == '\r'.code.toByte()
                            && buf[total-1] == '\n'.code.toByte()) {
                            end = total
                            break
                        }
                    }
                    if (end < 0) return

                    val headerStr = String(buf, 0, end, Charsets.UTF_8)
                    val lines = headerStr.split("\r\n")
                    if (lines.isEmpty()) return
                    val parts = lines[0].split(" ")
                    if (parts.size < 2) return
                    val method = parts[0]
                    val rawPath = parts[1].split("?")[0]

                    if (method != "GET") {
                        send(sock, 405, "Method Not Allowed", null, null)
                        return
                    }

                    val decoded = URLDecoder.decode(rawPath, "UTF-8").replace('\\', '/')
                    if (decoded.indexOf('\u0000') >= 0) {
                        send(sock, 400, "Bad Request", null, null)
                        return
                    }

                    val relativePath = decoded.trimStart('/')
                    val file = File(root, relativePath).canonicalFile

                    if (!isInsideRoot(file)) {
                        send(sock, 403, "Forbidden", null, null)
                        return
                    }

                    if (file.isDirectory) {
                        serveDir(sock, file, requestPathFor(file))
                    } else if (file.exists()) {
                        serveFile(sock, file)
                    } else {
                        send(sock, 404, "Not Found", null, null)
                    }
                }
            } catch (_: Exception) {}
        }

        private fun isInsideRoot(file: File): Boolean {
            val targetPath = file.canonicalPath
            val rootPath = root.canonicalPath
            return targetPath == rootPath || targetPath.startsWith(rootPath + File.separator)
        }

        private fun requestPathFor(file: File): String {
            val rootPath = root.canonicalPath
            val targetPath = file.canonicalPath
            if (targetPath == rootPath) return "/"
            return "/" + targetPath.removePrefix(rootPath).trimStart(File.separatorChar).replace(File.separatorChar, '/')
        }

        private fun serveFile(sock: Socket, file: File) {
            val bytes = file.readBytes()
            val mime = getMime(file.name)
            send(sock, 200, "OK", mime, bytes)
        }

        private fun serveDir(sock: Socket, dir: File, path: String) {
            val items = dir.listFiles()?.sortedBy { it.name } ?: emptyList()
            val html = buildString {
                val safeTitle = escapeHtml(path)
                append("<!DOCTYPE html><html><head><meta charset='utf-8'><title>$safeTitle</title>")
                append("<style>body{font-family:monospace;background:#000;color:#fff;padding:20px}")
                append("a{color:#30D158;text-decoration:none;display:block;padding:4px 0}")
                append("a:hover{text-decoration:underline}</style></head><body>")
                append("<h2>Index of $safeTitle</h2>")
                if (path != "/") append("<a href='..'>../</a>")
                for (f in items) {
                    val name = if (f.isDirectory) "${f.name}/" else f.name
                    val href = if (path.endsWith("/")) "$path$name" else "$path/$name"
                    append("<a href='${escapeAttribute(href)}'>${escapeHtml(name)}</a>")
                }
                append("</body></html>")
            }
            send(sock, 200, "OK", "text/html; charset=utf-8", html.toByteArray(Charsets.UTF_8))
        }

        private fun escapeHtml(value: String): String {
            return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;")
        }

        private fun escapeAttribute(value: String): String {
            return escapeHtml(value.replace("&", "%26"))
        }

        private fun send(sock: Socket, code: Int, msg: String, mime: String?, body: ByteArray?) {
            val out = sock.getOutputStream()
            val hdr = buildString {
                append("HTTP/1.1 $code $msg\r\n")
                if (mime != null) append("Content-Type: $mime\r\n")
                append("Content-Length: ${body?.size ?: 0}\r\n")
                append("Connection: close\r\n\r\n")
            }
            out.write(hdr.toByteArray(Charsets.UTF_8))
            if (body != null) out.write(body)
            out.flush()
        }

        private fun getMime(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
            "html", "htm" -> "text/html"
            "css" -> "text/css"
            "js" -> "application/javascript"
            "json" -> "application/json"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "gif" -> "image/gif"
            "svg" -> "image/svg+xml"
            "ico" -> "image/x-icon"
            "txt" -> "text/plain"
            "xml" -> "application/xml"
            "pdf" -> "application/pdf"
            "zip" -> "application/zip"
            "mp3" -> "audio/mpeg"
            "mp4" -> "video/mp4"
            else -> "application/octet-stream"
        }
    }
}
