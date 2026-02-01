# Psych Visuals Mobile App

React Native (Expo) mobile application for audio-reactive visualizations with SoundCloud integration.

## Setup

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
cd mobile
npm install
```

### Environment Variables

Create a `.env` file in the `mobile` directory:

```
EXPO_PUBLIC_SOUNDCLOUD_CLIENT_ID=your_soundcloud_client_id
EXPO_PUBLIC_API_BASE_URL=https://your-app-url.replit.app
```

**Important Security Note**: The client secret is NOT stored in the mobile app. Token exchange happens through the web app's backend (`/api/auth/soundcloud/token`) which keeps the client secret secure on the server.

The web app backend requires these environment variables (secrets):
- `SOUNDCLOUD_CLIENT_ID`
- `SOUNDCLOUD_CLIENT_SECRET`

### SoundCloud App Setup

1. Go to [SoundCloud Developer Portal](https://soundcloud.com/you/apps)
2. Create a new app
3. Set Redirect URI to: `psychvisuals://auth/soundcloud`
4. Copy Client ID and Client Secret to your `.env` file

### Running the App

```bash
# Start Expo development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Project Structure

```
mobile/
├── App.tsx                      # App entry point
├── src/
│   ├── adapters/
│   │   └── soundcloudAdapter.ts # SoundCloud API client
│   ├── components/
│   │   ├── NowPlayingTopDrawer.tsx
│   │   └── GLVisualizer.tsx     # WebGL shader-based visuals
│   ├── hooks/
│   │   ├── useAudioAnalysis.ts  # Simulated FFT analysis
│   │   └── useScreenCapture.ts  # Screenshot/sequence capture
│   ├── navigation/
│   │   └── AppNavigator.tsx     # Navigation setup
│   ├── screens/
│   │   ├── ConnectSourcesScreen.tsx
│   │   ├── LibraryScreen.tsx
│   │   └── VisualizerScreen.tsx
│   ├── stores/
│   │   ├── authStore.ts         # Authentication state
│   │   ├── downloadStore.ts     # Offline downloads
│   │   ├── playerStore.ts       # Audio playback + queue
│   │   └── visualizerStore.ts   # Visualizer settings + gyroscope
│   └── types/
│       └── index.ts             # TypeScript types
```

## Features

### Phase 1-2: Project Setup & UX Skeleton
- ✅ Expo project with prebuild support
- ✅ Navigation structure (stack + tabs)
- ✅ ConnectSourcesScreen with SoundCloud OAuth
- ✅ LibraryScreen with search, likes, playlists tabs
- ✅ NowPlayingTopDrawer for playback controls
- ✅ VisualizerScreen with preset picker

### Phase 3: SoundCloud Integration
- ✅ OAuth 2.0 flow with expo-auth-session
- ✅ Secure token exchange via backend (client secret protected)
- ✅ Token storage with expo-secure-store
- ✅ Automatic token refresh on 401 responses
- ✅ Search tracks API
- ✅ Get user likes
- ✅ Get playlists and playlist tracks
- ✅ Stream URL retrieval

### Phase 4: Playback
- ✅ expo-av audio playback
- ✅ Zustand player store
- ✅ Play/pause/seek/volume controls
- ✅ Background audio support (iOS & Android)
- ✅ Queue management (add, remove, reorder tracks)
- ✅ Repeat modes (off, one, all)
- ✅ Shuffle mode

### Phase 5: V1 Visuals
- ✅ Animated ring visualization (2D fallback)
- ✅ Playback time-based reactivity
- ✅ Preset selector with thumbnail strips
- ✅ Color palette support
- ✅ Gyroscope control for visual motion (expo-sensors)
- ✅ WebGL shader-based presets (expo-gl):
  - Energy Rings, Psy Tunnel, Particle Field
  - Waveform Sphere, Audio Bars
  - Geometric Kaleidoscope, Cosmic Web
- ✅ Toggle between WebGL and 2D renderers

### Phase 6: Audio Analysis
- ✅ Simulated FFT using time-based mathematical patterns
- ✅ Per-band audio data (sub, bass, mid, high, kick, energy)
- ✅ Smooth interpolation for fluid visual response
- Future: Native FFT module for true audio analysis

### Phase 7: Offline & Downloads
- ✅ Download tracks for offline playback (expo-file-system)
- ✅ Secure metadata storage (expo-secure-store)
- ✅ Automatic local file detection during playback
- ✅ Download progress tracking
- ✅ Delete downloaded tracks

### Phase 8: Screen Capture & Export
- ✅ Screenshot capture (react-native-view-shot)
- ✅ Frame sequence capture for animation export
- ✅ Save to media library (expo-media-library)
- ✅ Share captures (expo-sharing)
- ✅ Capture progress indicator

**Note**: Frame sequences are captured as individual PNG files. True video encoding with audio requires native modules (ffmpeg or platform-specific encoders) which are planned for a future release.

## Future Enhancements

- Spotify integration
- Apple Music integration (iOS)
- Native FFT for real audio analysis
- Video export with audio (encode frames + audio to MP4)
- Cloud sync for downloaded tracks
