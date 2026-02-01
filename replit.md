# Audio-Reactive Visualization Web App

## Overview

This is a production-ready audio-reactive visualization web application that allows users to upload audio tracks and generates real-time, high-quality WebGL visualizations in the browser. The app analyzes audio frequency bands (bass, mid, high) and uses them to drive GPU-accelerated 3D visuals with Three.js. It includes 15 visual presets:
- **7 Base Presets**: Energy Rings, Psy Tunnel, Particle Field, Waveform Sphere, Audio Bars, Geometric Kaleidoscope, Cosmic Web
- **4 Cymatics Presets**: Cymatic Sand Plate (particles settling on wave nodes), Water Membrane Orb (spherical standing waves), Chladni Geometry (ultra premium with multi-layer patterns, 3D displacement, and node particles), Resonant Field Lines (magnetic-field curves)
- **4 Psy Shader Presets**: Blue Tunnel, BW Vortex, Rainbow Spiral, Red Mandala

Features include 10 color palettes, customizable controls for intensity/speed/color, AI-powered thumbnail analysis for automatic theme extraction, and dominant frequency detection for mode-quantized resonance effects. The UI is fully responsive with mobile-optimized touch controls.

### Psy Overlay System
The app includes 4 psychedelic shader presets (Blue Tunnel, BW Vortex, Rainbow Spiral, Red Mandala) that can function both as:
- **Standalone presets**: Selectable from the preset dropdown
- **Overlay layers**: Can be toggled on/off via the "Psy Overlays" section in the control panel, layering on top of any active preset with additive blending. Multiple overlays can be active simultaneously.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, bundled by Vite
- **3D Rendering**: Three.js via @react-three/fiber (R3F) for declarative WebGL
- **Visual Effects**: @react-three/postprocessing for Bloom, ChromaticAberration, and Noise effects
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: React hooks + TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Animations**: Framer Motion for UI transitions

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript compiled with tsx for development, esbuild for production
- **API Pattern**: REST endpoints defined in `shared/routes.ts` with Zod validation
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **AI Integration**: OpenAI API via Replit AI Integrations for image/audio analysis

### Audio Processing
- **Analysis**: Web Audio API with AnalyserNode for real-time frequency extraction
- **Frequency Bands**: Enhanced psychedelic-optimized frequency analysis:
  - **Sub (20-60Hz)**: Slow, heavy motion - drives global breathing/pulsing effects
  - **Bass (60-250Hz)**: Bloom intensity, breathing, zoom effects
  - **Mid (250-2000Hz)**: Rotation, shape deformation, particle density
  - **High (2000-10000Hz)**: Sparkles, glitch, chromatic aberration
  - **Kick Detection**: Beat/transient detection for sudden visual impacts
- **Smoothing**: Per-band EMA (exponential moving average) with different rates:
  - Sub: Very slow smoothing for body/feel
  - Bass: Medium smoothing for punch
  - Mid: Medium-fast for geometry
  - High: Fast for sparkle responsiveness
- **Recording**: MediaRecorder API for WebM/Opus audio capture
- **Source Management**: Audio analyzer hook tracks MediaElementSource to avoid recreation errors and properly reconnects on source changes

### Track Library
- **Storage**: Client-side localStorage for saving tracks with audio URLs, thumbnails, and color palettes
- **Interface**: Slide-out panel with visual track cards showing thumbnails and color swatches
- **Operations**: Save new tracks, load saved tracks, delete tracks from library

### WebGL Fallback
- **Detection**: Proactive WebGL support check before rendering Canvas component
- **Fallback**: 2D animated visualization with pulsing rings using the selected color palette
- **Thumbnail Integration**: Background image works in both WebGL and fallback modes

### Quality Enhancements
- **Post-Processing**: High-quality bloom (4x multisampling, large kernel), smooth chromatic aberration, vignette effects
- **Smooth Transitions**: Fade effect when switching between visual presets via PresetTransition component
- **Audio Interpolation**: Smooth lerping of audio data for fluid visual response
- **Error Handling**: ErrorBoundary component for graceful error recovery with restart option
- **Keyboard Shortcuts**: Space (play/pause), Arrow keys (volume/seek), F (fullscreen), M (mute with volume preservation)
- **Mute Toggle**: Preserves previous volume level for seamless unmute
- **Auto-Hide Controls**: Settings panel automatically hides after 5 seconds of inactivity; reappears on "Show Controls" click or any interaction (mouse, touch, keyboard)

### Premium Visual Presets
All 7 main presets upgraded to premium quality with:
- **Smooth Audio Interpolation**: Per-band lerp smoothing (sub: 0.06-0.08, bass: 0.1-0.15, mid: 0.12-0.18, high: 0.18-0.22, kick: 0.2-0.25)
- **Higher Detail Geometries**:
  - EnergyRings: 24 rings, 128 torus segments, multi-axis rotation
  - ParticleField (Ultra Premium): Custom shader with 3 layers (core: 4000, glow: 2500, trail: 1500 particles), soft glow effects, Fibonacci sphere distribution, vortex flow motion, gravity wells, and sparkle on high frequencies
  - WaveformSphere: 6 subdivisions, layered displacement
  - AudioBars: 128 bars, smooth height transitions
  - GeometricKaleidoscope: 42 shapes, 6 geometry types
  - CosmicWeb: 120 nodes with optimized connection calculation
- **Multi-Layered Audio Reactivity**: Separate responses for sub/bass/mid/high/kick/energy per preset
- **Dynamic Material Properties**: Emissive intensity, opacity, and color shift based on audio
- **Performance Optimizations**: Reused Color objects, dynamic material sizes, clamped shader values for stability

### Data Flow
1. User uploads audio file → stored as blob URL
2. Audio element connected to Web Audio API AnalyserNode
3. Animation loop reads frequency data via `getAudioData()` callback
4. Three.js shaders/meshes respond to bass/mid/high/energy values
5. Optional: Thumbnail uploaded → AI Vision extracts colors → applied to visualization

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Vite builds static assets to `dist/public`, esbuild bundles server to `dist/index.cjs`
- **Database**: Drizzle Kit for schema migrations via `npm run db:push`

## External Dependencies

### Database
- **PostgreSQL**: Primary data store for tracks, presets, conversations, and messages
- **Connection**: `DATABASE_URL` environment variable required
- **Session Storage**: connect-pg-simple for Express session persistence

### AI Services
- **OpenAI API**: Accessed via Replit AI Integrations
  - Image analysis for thumbnail color/theme extraction
  - Voice chat capabilities (speech-to-text, text-to-speech)
  - Chat completions for conversational features
- **Environment Variables**: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Third-Party Libraries
- **Three.js ecosystem**: @react-three/fiber, @react-three/drei, @react-three/postprocessing
- **Audio utilities**: maath for mathematical helpers
- **Batch processing**: p-limit and p-retry for rate-limited API calls
- **Media conversion**: ffmpeg (system dependency) for audio format conversion

## Post-Processing Effects

### Glow Enhancement Effect
A custom post-processing effect that enhances brightness and adds subtle glow:
- **Location**: `client/src/components/AfterimageEffect.tsx`
- **Parameters**: `decay` and `blend` control glow intensity and spread
- **Audio Reactivity**: Effect intensity is modulated by bass/high for responsive enhancement
- **UI Controls**: Toggle and amount slider in Effects panel (mobile and desktop)
- **Note**: True motion blur/afterimage (temporal accumulation) is planned for future enhancement

## Native Mobile Preparation

The project includes code for building native iOS/Android apps with Unity as the visual engine.

### Native Code Structure
```
native/
├── unity/Scripts/           # Unity C# scripts for receiving messages
├── ios/AudioVisualizer/     # SwiftUI wrapper with UnityBridge
└── android/app/             # Kotlin/Compose wrapper with UnityBridge
```

### JSON Bridge Contract
Defined in `shared/native-bridge.ts`, provides standardized message types:
- **TrackMessage**: Track metadata (source, title, artist, artwork, duration)
- **PlaybackMessage**: Playback state (isPlaying, positionMs, volume)
- **BandsMessage**: Audio frequency bands (sub, bass, mid, high, kick, energy)
- **PresetMessage**: Visual preset settings (name, intensity, speed, trails)
- **ControlMessage**: Playback control actions

### Architecture (Option B)
- Native wrapper (iOS/Android) owns authentication, playback, and UI
- Unity is the visual engine screen receiving JSON messages via `UnitySendMessage`
- Native code performs FFT audio analysis and sends band data at 20-60 FPS

See `native/README.md` for detailed setup instructions.