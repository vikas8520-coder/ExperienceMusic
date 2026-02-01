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
│   │   └── NowPlayingTopDrawer.tsx
│   ├── navigation/
│   │   └── AppNavigator.tsx     # Navigation setup
│   ├── screens/
│   │   ├── ConnectSourcesScreen.tsx
│   │   ├── LibraryScreen.tsx
│   │   └── VisualizerScreen.tsx
│   ├── stores/
│   │   ├── authStore.ts         # Authentication state
│   │   ├── playerStore.ts       # Audio playback state
│   │   └── visualizerStore.ts   # Visualizer settings
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
- ✅ Background audio support (iOS)

### Phase 5: V1 Visuals
- ✅ Animated ring visualization
- ✅ Playback time-based reactivity
- ✅ Preset selector with thumbnail strips
- ✅ Color palette support

### Phase 6: Real Audio Analysis (TODO)
- Native FFT module (iOS: AVAudioEngine, Android: AudioRecord)
- Real bass/mid/high extraction
- Smooth attack/release

## Future Enhancements

- Spotify integration
- Apple Music integration (iOS)
- Unity WebGL embed for premium visuals
- Video export/sharing
