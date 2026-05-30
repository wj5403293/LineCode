package com.lineai

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class HttpServerPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            SimpleHttpServerModule(reactContext),
            KeepAwakeModule(reactContext),
            SshModule(reactContext),
            DataArchiveModule(reactContext),
            StoragePermissionModule(reactContext),
            AppLifecycleModule(reactContext),
            LineAIConfigModule(reactContext),
            KeyboardFrameModule(reactContext),
            ApkInstallerModule(reactContext),
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
