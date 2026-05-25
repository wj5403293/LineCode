package com.lineai

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class LineAIConfigModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "LineAIConfig"

    override fun getConstants(): MutableMap<String, Any> = hashMapOf(
        "localModelEnabled" to BuildConfig.LOCAL_MODEL_ENABLED,
        "modelRuntime" to BuildConfig.MODEL_RUNTIME
    )
}
