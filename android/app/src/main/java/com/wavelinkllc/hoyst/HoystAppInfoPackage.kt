package com.wavelinkllc.hoyst

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.uimanager.ViewManager

class HoystAppInfoModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "HoystAppInfo"
  override fun getConstants(): Map<String, Any> = mapOf("version" to BuildConfig.VERSION_NAME, "build" to BuildConfig.VERSION_CODE.toString())
}
class HoystAppInfoPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(HoystAppInfoModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
