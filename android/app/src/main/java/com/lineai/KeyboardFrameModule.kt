package com.lineai

import android.graphics.Color
import android.graphics.Rect
import android.graphics.drawable.ColorDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.PopupWindow
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule

class KeyboardFrameModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val KEYBOARD_FRAME_EVENT = "LineCodeKeyboardFrameChanged"
    }

    private var popupWindow: PopupWindow? = null
    private var probeView: View? = null
    private var lastVisibleBottom = -1
    private var lastWindowHeight = -1

    override fun getName() = "KeyboardFrameModule"

    @ReactMethod
    fun addListener(eventName: String) {
        // Required by React Native event emitters.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required by React Native event emitters.
    }

    @ReactMethod
    fun start() {
        UiThreadUtil.runOnUiThread {
            ensurePopup()
        }
    }

    @ReactMethod
    fun stop() {
        UiThreadUtil.runOnUiThread {
            dismissPopup()
        }
    }

    override fun invalidate() {
        super.invalidate()
        UiThreadUtil.runOnUiThread {
            dismissPopup()
        }
    }

    private fun ensurePopup() {
        if (popupWindow?.isShowing == true) return
        val activity = reactContext.currentActivity ?: return
        val decorView = activity.window?.decorView ?: return
        if (decorView.windowToken == null) return

        val view = View(activity).apply {
            layoutParams = ViewGroup.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT)
            viewTreeObserver.addOnGlobalLayoutListener {
                emitKeyboardFrame(this)
            }
        }

        val popup = PopupWindow(view, 0, ViewGroup.LayoutParams.MATCH_PARENT, false).apply {
            inputMethodMode = PopupWindow.INPUT_METHOD_NEEDED
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            isClippingEnabled = false
            isTouchable = false
            isOutsideTouchable = false
        }

        popupWindow = popup
        probeView = view

        try {
            popup.showAtLocation(decorView, Gravity.NO_GRAVITY, 0, 0)
            emitKeyboardFrame(view)
        } catch (_: Exception) {
            dismissPopup()
        }
    }

    private fun dismissPopup() {
        probeView = null
        lastVisibleBottom = -1
        lastWindowHeight = -1
        popupWindow?.dismiss()
        popupWindow = null
    }

    private fun emitKeyboardFrame(view: View) {
        val rect = Rect()
        view.getWindowVisibleDisplayFrame(rect)
        val windowHeight = view.rootView?.height?.takeIf { it > 0 } ?: view.height
        if (windowHeight <= 0) return

        val visibleBottom = rect.bottom.coerceAtLeast(0)
        if (visibleBottom == lastVisibleBottom && windowHeight == lastWindowHeight) return
        lastVisibleBottom = visibleBottom
        lastWindowHeight = windowHeight

        val keyboardHeight = (windowHeight - visibleBottom).coerceAtLeast(0)
        val params = Arguments.createMap().apply {
            putInt("visibleBottom", visibleBottom)
            putInt("windowHeight", windowHeight)
            putInt("keyboardHeight", keyboardHeight)
        }

        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(KEYBOARD_FRAME_EVENT, params)
        } catch (_: Exception) {
        }
    }
}
