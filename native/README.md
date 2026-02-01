# Native Mobile Code for Audio Visualizer

This directory contains code for building native mobile apps that use Unity as the visual rendering engine.

## Architecture Overview

The native apps follow **Option B** architecture:
- **Native wrapper (iOS/Android)** owns authentication, playback, and UI
- **Unity** is the visual engine that receives messages and renders visualizations

## Directory Structure

```
native/
├── unity/
│   └── Scripts/
│       ├── NativeBridgeReceiver.cs    # Receives JSON messages from native
│       ├── AudioReactiveController.cs # Smooths audio band values
│       └── PresetManager.cs           # Manages visual presets
├── ios/
│   └── AudioVisualizer/
│       ├── UnityBridge.swift          # Sends messages to Unity
│       └── VisualizerView.swift       # SwiftUI visualizer screen
└── android/
    └── app/src/main/java/com/audiovisualizer/
        ├── UnityBridge.kt             # Sends messages to Unity
        └── VisualizerActivity.kt      # Compose visualizer screen
```

## Message Protocol

The native apps communicate with Unity using JSON messages:

### 1. Track Message
Sent when a new track is selected:
```json
{
  "type": "track",
  "source": "spotify",
  "title": "Song Title",
  "artist": "Artist Name",
  "artworkUrl": "https://...",
  "durationMs": 210000
}
```

### 2. Playback Message
Sent on play/pause/seek:
```json
{
  "type": "playback",
  "isPlaying": true,
  "positionMs": 12345
}
```

### 3. Bands Message
Sent 20-60 times per second with audio analysis:
```json
{
  "type": "bands",
  "bass": 0.62,
  "mid": 0.41,
  "high": 0.28,
  "sub": 0.3,
  "kick": 0.1
}
```

### 4. Preset Message
Sent to change visual presets:
```json
{
  "type": "preset",
  "presetName": "Blue Tunnel",
  "intensity": 1.0,
  "speed": 1.0,
  "trailsOn": true,
  "trailsAmount": 0.75
}
```

## Setup Instructions

### Unity Setup

1. Create a new Unity project (URP recommended)
2. Copy the scripts from `native/unity/Scripts/` to your Unity project
3. Create a scene named `VisualizerScene`
4. Add a GameObject named `NativeBridge` with the `NativeBridgeReceiver` component
5. Create your shader materials for each preset
6. Export as iOS framework and Android library

### iOS Setup

1. Create a new Xcode project with SwiftUI
2. Add Unity as a Library (follow Unity's iOS export guide)
3. Copy files from `native/ios/AudioVisualizer/` to your project
4. Update bundle ID and signing settings
5. Implement Spotify/Apple Music SDK integration

### Android Setup

1. Create a new Android project with Jetpack Compose
2. Import Unity as a module (follow Unity's Android export guide)
3. Copy files from `native/android/app/` to your project
4. Add required dependencies in build.gradle
5. Implement Spotify/SoundCloud SDK integration

## Audio Analysis

For audio-reactive visuals, implement FFT analysis in native code:

**Frequency Bands:**
- Sub: 20-60Hz (slow, heavy motion)
- Bass: 60-250Hz (bloom, breathing, zoom)
- Mid: 250-2000Hz (rotation, shape, density)
- High: 2000-12000Hz (sparkles, glitch)

**Smoothing:**
- Apply EMA (Exponential Moving Average) with different rates per band
- Fast attack, slow release for punchy visuals
- Send at 20-60 updates/second

## Preset List

Available visual presets:
1. Blue Tunnel - Crystalline tunnel effect
2. BW Vortex - Hypnotic monochrome spiral
3. Rainbow Spiral - Prismatic color flow
4. Red Mandala - Sacred geometry pattern
5. Energy Rings - Pulsing neon rings
6. Psy Tunnel - Psychedelic tunnel
7. Particle Field - 3D particle system
8. Waveform Sphere - Audio waveform on sphere
9. Audio Bars - Classic spectrum bars
10. Geometric Kaleidoscope - Kaleidoscopic geometry
11. Cosmic Web - Connected node network

## Post-Processing Effects

Unity should include:
- Bloom (driven by bass)
- Chromatic Aberration (driven by highs)
- Trails/Afterimage (feedback buffer)
- Vignette
- Film Grain

## Future Work

- [ ] Spotify OAuth integration
- [ ] SoundCloud API integration
- [ ] Apple Music (MusicKit) on iOS
- [ ] Video export functionality
- [ ] Thumbnail/artwork blending in shaders
