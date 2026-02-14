// android/app/src/main/java/com/yourapp/audio/AudioAnalyzerAndroidModule.kt
// Native module stub (Android)
// NOTE: Stub only; FFT/beat implementation points are marked TODO.

package com.yourapp.audio

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.*
import kotlin.concurrent.fixedRateTimer

class AudioAnalyzerAndroidModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var isRunning = false
  private var timer: Timer? = null

  override fun getName(): String = "AudioAnalyzerAndroid"

  /**
   Starts analysis.
   Edge cases:
   - No active playback/audio session -> reject
   - AudioRecord/Visualizer init failure -> reject
   */
  @ReactMethod
  fun startAnalysis(options: ReadableMap?, promise: Promise) {
    if (isRunning) {
      promise.resolve(null)
      return
    }

    // TODO:
    // 1) Attach to playback PCM source (AudioTrack/ExoPlayer hook or Visualizer fallback)
    // 2) Buffer PCM frames
    // 3) FFT (KissFFT/JTransforms/custom)
    // 4) Band aggregation:
    //    bass 20-250, mid 250-2000, high 2000-10000
    // 5) RMS + beat detection (spectral flux/adaptive threshold)
    // 6) Emit AudioBandsUpdate

    isRunning = true
    timer = fixedRateTimer("audio-analyzer", initialDelay = 0L, period = 33L) {
      if (!isRunning) return@fixedRateTimer
      val map = Arguments.createMap().apply {
        putDouble("bass", 0.0)
        putDouble("mid", 0.0)
        putDouble("high", 0.0)
        putDouble("rmsEnergy", 0.0)
        putBoolean("beatDetected", false)
        putDouble("timestampMs", System.currentTimeMillis().toDouble())
      }
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("AudioBandsUpdate", map)
    }

    promise.resolve(null)
  }

  @ReactMethod
  fun stopAnalysis(promise: Promise) {
    isRunning = false
    timer?.cancel()
    timer = null

    // TODO: release analyzer resources
    promise.resolve(null)
  }
}
