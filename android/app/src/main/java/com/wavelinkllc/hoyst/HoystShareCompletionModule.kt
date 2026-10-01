package com.wavelinkllc.hoyst

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.UUID

/** Unlike RN Share's Android result, this acknowledges a selected share destination. */
class HoystShareCompletionModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var pending: Promise? = null
  private var receiver: BroadcastReceiver? = null
  private var callbackIntent: PendingIntent? = null
  private var activeRequestCode = 48172
  private val handler = Handler(Looper.getMainLooper())
  init {
    context.addActivityEventListener(object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == activeRequestCode) {
          val current = pending
          // The chooser callback can be queued behind the activity result.
          handler.postDelayed({if (pending === current) finish("dismissedAction")}, 250)
        }
      }
    })
  }
  override fun getName() = "HoystShareCompletion"
  private fun finish(action: String) {
    val promise = pending ?: return
    pending = null
    receiver?.let {try {context.unregisterReceiver(it)} catch (_: IllegalArgumentException) {}}
    receiver = null
    callbackIntent?.cancel()
    callbackIntent = null
    promise.resolve(Arguments.createMap().apply {putString("action", action)})
  }
  @ReactMethod
  fun share(message: String, title: String, promise: Promise) {
    context.runOnUiQueueThread {
      val activity = currentActivity
      if (activity == null) {promise.reject("share_unavailable", "No activity is available."); return@runOnUiQueueThread}
      if (pending != null) {promise.reject("share_in_progress", "Finish the current share first."); return@runOnUiQueueThread}
      pending = promise
      activeRequestCode = if (activeRequestCode >= 49000) 48172 else activeRequestCode + 1
      val action = context.packageName + ".SHARE_CHOSEN." + UUID.randomUUID()
      receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          @Suppress("DEPRECATION") val chosen = intent.getParcelableExtra<ComponentName>(Intent.EXTRA_CHOSEN_COMPONENT)
          if (chosen != null) finish("sharedAction")
        }
      }
      try {
        ContextCompat.registerReceiver(context, receiver, IntentFilter(action), ContextCompat.RECEIVER_NOT_EXPORTED)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
        callbackIntent = PendingIntent.getBroadcast(context, activeRequestCode, Intent(action).setPackage(context.packageName), flags)
        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, message).putExtra(Intent.EXTRA_SUBJECT, title)
        activity.startActivityForResult(Intent.createChooser(send, title, callbackIntent!!.intentSender), activeRequestCode)
      } catch (error: Exception) {
        val failed = pending
        pending = null
        receiver?.let {try {context.unregisterReceiver(it)} catch (_: IllegalArgumentException) {}}
        receiver = null
        callbackIntent?.cancel()
        callbackIntent = null
        failed?.reject("share_failed", error.message, error)
      }
    }
  }
  override fun invalidate() {handler.post {finish("dismissedAction")}; super.invalidate()}
}
