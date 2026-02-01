package com.audiovisualizer

import android.content.Context
import com.unity3d.player.UnityPlayer
import org.json.JSONObject

object UnityBridge {
    private var unityPlayer: UnityPlayer? = null
    private var isInitialized = false

    fun initialize(context: Context) {
        if (isInitialized) return
        isInitialized = true
    }

    fun setUnityPlayer(player: UnityPlayer) {
        unityPlayer = player
    }

    fun sendMessage(gameObject: String, method: String, message: String) {
        UnityPlayer.UnitySendMessage(gameObject, method, message)
    }

    fun sendTrackMessage(
        source: String,
        title: String,
        artist: String,
        artworkUrl: String? = null,
        durationMs: Int
    ) {
        val json = JSONObject().apply {
            put("type", "track")
            put("source", source)
            put("title", title)
            put("artist", artist)
            put("durationMs", durationMs)
            artworkUrl?.let { put("artworkUrl", it) }
        }
        
        sendMessage("NativeBridge", "OnNativeMessage", json.toString())
    }

    fun sendPlaybackMessage(
        isPlaying: Boolean,
        positionMs: Int,
        volume: Float? = null
    ) {
        val json = JSONObject().apply {
            put("type", "playback")
            put("isPlaying", isPlaying)
            put("positionMs", positionMs)
            volume?.let { put("volume", it) }
        }
        
        sendMessage("NativeBridge", "OnNativeMessage", json.toString())
    }

    fun sendBandsMessage(
        bass: Float,
        mid: Float,
        high: Float,
        sub: Float? = null,
        kick: Float? = null,
        energy: Float? = null
    ) {
        val json = JSONObject().apply {
            put("type", "bands")
            put("bass", bass.toDouble())
            put("mid", mid.toDouble())
            put("high", high.toDouble())
            sub?.let { put("sub", it.toDouble()) }
            kick?.let { put("kick", it.toDouble()) }
            energy?.let { put("energy", it.toDouble()) }
        }
        
        sendMessage("NativeBridge", "OnNativeMessage", json.toString())
    }

    fun sendPresetMessage(
        presetName: String,
        intensity: Float? = null,
        speed: Float? = null,
        trailsOn: Boolean? = null,
        trailsAmount: Float? = null
    ) {
        val json = JSONObject().apply {
            put("type", "preset")
            put("presetName", presetName)
            intensity?.let { put("intensity", it.toDouble()) }
            speed?.let { put("speed", it.toDouble()) }
            trailsOn?.let { put("trailsOn", it) }
            trailsAmount?.let { put("trailsAmount", it.toDouble()) }
        }
        
        sendMessage("NativeBridge", "OnNativeMessage", json.toString())
    }

    fun sendControlMessage(action: String, value: Float? = null) {
        val json = JSONObject().apply {
            put("type", "control")
            put("action", action)
            value?.let { put("value", it.toDouble()) }
        }
        
        sendMessage("NativeBridge", "OnNativeMessage", json.toString())
    }
}
