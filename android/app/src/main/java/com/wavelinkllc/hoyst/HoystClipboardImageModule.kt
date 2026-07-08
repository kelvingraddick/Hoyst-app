package com.wavelinkllc.hoyst

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileInputStream
import java.io.InputStream

class HoystClipboardImageModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "HoystClipboardImage"

  @ReactMethod
  fun copyImage(uriString: String, promise: Promise) {
    try {
      val sourceUri = Uri.parse(uriString)
      val copiedFile = copyImageToCache(sourceUri)
      val contentUri =
          FileProvider.getUriForFile(
              reactContext,
              "${reactContext.packageName}.hoyst.clipboard.fileprovider",
              copiedFile,
          )
      val clipboard =
          reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val clip = ClipData.newUri(reactContext.contentResolver, "Hoyst Story", contentUri)

      clipboard.setPrimaryClip(clip)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("copy_failed", "The story image could not be copied.", error)
    }
  }

  private fun copyImageToCache(sourceUri: Uri): File {
    val clipboardDir = File(reactContext.cacheDir, "clipboard")
    if (!clipboardDir.exists()) {
      clipboardDir.mkdirs()
    }

    val copiedFile = File(clipboardDir, "hoyst-story.png")
    openInputStream(sourceUri).use { input ->
      copiedFile.outputStream().use { output ->
        input.copyTo(output)
      }
    }

    return copiedFile
  }

  private fun openInputStream(sourceUri: Uri): InputStream {
    if (sourceUri.scheme == "file") {
      val path = sourceUri.path
      if (!path.isNullOrBlank()) {
        return FileInputStream(File(path))
      }
    }

    return reactContext.contentResolver.openInputStream(sourceUri)
        ?: throw IllegalArgumentException("Unable to read story image.")
  }
}
