package com.audiovisualizer

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import android.widget.SeekBar
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.unity3d.player.UnityPlayer

class VisualizerActivity : ComponentActivity() {
    private var unityPlayer: UnityPlayer? = null
    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        )

        setContent {
            VisualizerScreen(
                onIntensityChange = { intensity ->
                    sendPresetUpdate(intensity = intensity)
                },
                onSpeedChange = { speed ->
                    sendPresetUpdate(speed = speed)
                },
                onTrailsToggle = { enabled ->
                    sendPresetUpdate(trailsOn = enabled)
                },
                onPresetChange = { presetName ->
                    sendPresetUpdate(presetName = presetName)
                }
            )
        }
    }

    override fun onResume() {
        super.onResume()
        startAudioAnalysis()
    }

    override fun onPause() {
        super.onPause()
        stopAudioAnalysis()
    }

    private fun startAudioAnalysis() {
        isRunning = true
        handler.post(audioUpdateRunnable)
    }

    private fun stopAudioAnalysis() {
        isRunning = false
        handler.removeCallbacks(audioUpdateRunnable)
    }

    /**
     * STUB: Simulates audio bands with random values for testing.
     * TODO: Replace with real FFT audio analysis using Android Visualizer API:
     * 1. Create Visualizer attached to audio session
     * 2. Capture FFT data using Visualizer.getFft()
     * 3. Compute band energies: bass (60-250Hz), mid (250-2kHz), high (2k-10kHz)
     * 4. Normalize and smooth values before sending
     * Note: Requires RECORD_AUDIO permission and audio session ID
     */
    private val audioUpdateRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            
            // STUB: Random values for UI testing - replace with real FFT
            val bass = (Math.random() * 0.5 + 0.3).toFloat()
            val mid = (Math.random() * 0.4 + 0.2).toFloat()
            val high = (Math.random() * 0.3 + 0.1).toFloat()
            
            UnityBridge.sendBandsMessage(bass, mid, high)
            
            // Update at ~30fps (33ms interval)
            handler.postDelayed(this, 33)
        }
    }

    private fun sendPresetUpdate(
        presetName: String? = null,
        intensity: Float? = null,
        speed: Float? = null,
        trailsOn: Boolean? = null
    ) {
        UnityBridge.sendPresetMessage(
            presetName = presetName ?: "Blue Tunnel",
            intensity = intensity,
            speed = speed,
            trailsOn = trailsOn,
            trailsAmount = 0.75f
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisualizerScreen(
    onIntensityChange: (Float) -> Unit,
    onSpeedChange: (Float) -> Unit,
    onTrailsToggle: (Boolean) -> Unit,
    onPresetChange: (String) -> Unit
) {
    var showControls by remember { mutableStateOf(true) }
    var isPlaying by remember { mutableStateOf(false) }
    var intensity by remember { mutableStateOf(1f) }
    var speed by remember { mutableStateOf(1f) }
    var trailsEnabled by remember { mutableStateOf(false) }
    var currentPresetIndex by remember { mutableStateOf(0) }
    
    val presets = listOf(
        "Blue Tunnel", "BW Vortex", "Rainbow Spiral", "Red Mandala",
        "Energy Rings", "Psy Tunnel", "Particle Field"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .clickable { showControls = !showControls }
    ) {
        AnimatedVisibility(
            visible = showControls,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color.Transparent,
                                Color.Black.copy(alpha = 0.8f)
                            )
                        )
                    )
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = {
                            currentPresetIndex = if (currentPresetIndex > 0) 
                                currentPresetIndex - 1 else presets.size - 1
                            onPresetChange(presets[currentPresetIndex])
                        }
                    ) {
                        Icon(
                            Icons.Filled.KeyboardArrowLeft,
                            contentDescription = "Previous",
                            tint = Color.White,
                            modifier = Modifier.size(40.dp)
                        )
                    }
                    
                    Spacer(modifier = Modifier.width(20.dp))
                    
                    IconButton(
                        onClick = { isPlaying = !isPlaying },
                        modifier = Modifier
                            .size(60.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.2f))
                    ) {
                        Icon(
                            if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = Color.White,
                            modifier = Modifier.size(40.dp)
                        )
                    }
                    
                    Spacer(modifier = Modifier.width(20.dp))
                    
                    IconButton(
                        onClick = {
                            currentPresetIndex = (currentPresetIndex + 1) % presets.size
                            onPresetChange(presets[currentPresetIndex])
                        }
                    ) {
                        Icon(
                            Icons.Filled.KeyboardArrowRight,
                            contentDescription = "Next",
                            tint = Color.White,
                            modifier = Modifier.size(40.dp)
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = presets[currentPresetIndex],
                    color = Color.Cyan,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium
                )
                
                Spacer(modifier = Modifier.height(20.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Intensity", color = Color.Gray, fontSize = 12.sp)
                    Spacer(modifier = Modifier.width(12.dp))
                    Slider(
                        value = intensity,
                        onValueChange = { 
                            intensity = it
                            onIntensityChange(it)
                        },
                        valueRange = 0.1f..2f,
                        modifier = Modifier.weight(1f),
                        colors = SliderDefaults.colors(
                            thumbColor = Color.Cyan,
                            activeTrackColor = Color.Cyan
                        )
                    )
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Speed", color = Color.Gray, fontSize = 12.sp)
                    Spacer(modifier = Modifier.width(12.dp))
                    Slider(
                        value = speed,
                        onValueChange = { 
                            speed = it
                            onSpeedChange(it)
                        },
                        valueRange = 0.1f..3f,
                        modifier = Modifier.weight(1f),
                        colors = SliderDefaults.colors(
                            thumbColor = Color.Magenta,
                            activeTrackColor = Color.Magenta
                        )
                    )
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Trails", color = Color.Gray, fontSize = 12.sp)
                    Switch(
                        checked = trailsEnabled,
                        onCheckedChange = { 
                            trailsEnabled = it
                            onTrailsToggle(it)
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.Magenta,
                            checkedTrackColor = Color.Magenta.copy(alpha = 0.5f)
                        )
                    )
                }
            }
        }
    }
}
