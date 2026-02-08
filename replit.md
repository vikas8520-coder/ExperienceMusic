# Experience - Audio-Reactive Visualization Web App

## Overview

Experience is a production-ready audio-reactive visualization web application designed to generate real-time, high-quality WebGL visualizations in the browser. It analyzes audio frequency bands to drive GPU-accelerated 3D visuals using Three.js. The application features 15 visual presets, including 7 base presets, 4 cymatics presets, and 4 psychedelic shader presets that can also function as overlay layers. Key capabilities include 10 color palettes, customizable controls, AI-powered thumbnail analysis for theme extraction, dominant frequency detection, and a fully responsive UI with mobile-optimized touch controls. The project aims to provide an immersive and customizable audio-visual experience, expanding into mobile platforms with a React Native app and native Unity integrations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite.
- **3D Rendering**: Three.js via @react-three/fiber (R3F).
- **UI Components**: shadcn/ui built on Radix UI, styled with Tailwind CSS.
- **State Management**: React hooks and TanStack Query.
- **Routing**: Wouter.
- **Animations**: Framer Motion.

### Backend Architecture
- **Runtime**: Node.js with Express.js and TypeScript.
- **API Pattern**: REST endpoints with Zod validation.
- **Database ORM**: Drizzle ORM with PostgreSQL.
- **AI Integration**: OpenAI API for image/audio analysis via Replit AI Integrations.

### Audio Processing
- **Analysis**: Web Audio API with AnalyserNode for real-time frequency extraction across multiple enhanced psychedelic-optimized frequency bands (Sub, Bass, Mid, High, Kick Detection).
- **Smoothing**: Per-band Exponential Moving Average (EMA) for fluid visual response.
- **Recording**: MediaRecorder API for audio capture.

### WebGL Fallback
- Proactive WebGL support check with a 2D animated visualization fallback.

### Premium Image Filters
- GPU-accelerated shader-based image filters (9 types) applied to background thumbnails with audio-reactive modulation. Features include high-quality noise, HSL color manipulation, barrel distortion, and dynamic vignettes.

### Quality Enhancements
- **Post-Processing**: High-quality bloom, chromatic aberration, and vignette effects.
- **Smooth Transitions**: Fade effects between visual presets and audio interpolation.
- **Error Handling**: Graceful error recovery with ErrorBoundary.
- **User Experience**: Keyboard shortcuts, mute toggle, and auto-hide controls.

### Premium Visual Presets
All presets are designed with unique visual identities, avoiding generic patterns, and feature multi-layered audio reactivity, dynamic material properties, and performance optimizations.

### Fractal Preset Engine
- **Architecture**: Typed preset engine in `client/src/engine/presets/` with full lifecycle management (init/update/dispose).
- **Types** (`types.ts`): AudioFeatures, PresetContext, UniformSpec (with type/min/max/step/group/macro/transform/visibleIf), FractalPreset interface.
- **Engine Hook** (`usePresetEngine.ts`): Manages preset lifecycle, uniform state, per-frame tick. Available for standalone use.
- **Bridge** (`FractalPresetBridge.tsx`): R3F component that bridges AudioData to AudioFeatures format, calls init/dispose lifecycle, and renders the preset's Render component.
- **Registry** (`registry.ts`): Maps preset names to FractalPreset instances. `isFractalPreset()` and `getFractalPreset()` for lookup.
- **Auto-Generated UI**: ControlPanel renders sliders/color pickers/toggles/vec2 inputs from uniformSpecs. PerformOverlay renders macro-flagged uniforms as large slider cards.
- **Current Presets**: Mandelbrot Explorer (GLSL shader2d with audio-reactive zoom, rotation, color cycling, beat punch).
- **Adding New Fractals**: Create a new file in `fractals/`, implement FractalPreset interface, add to registry.ts and visualizer-presets.ts.

### Data Flow
User audio upload or selection → Web Audio API analysis → Three.js rendering in response to audio data → Optional AI vision for thumbnail analysis.

### Build System
- **Development**: Vite dev server.
- **Production**: Vite for static assets, esbuild for server.
- **Database**: Drizzle Kit for schema migrations.

### Mobile Application
- **React Native (Expo)**: A full mobile app with SoundCloud integration, playback management (expo-av), offline downloads, shader-based WebGL visuals (expo-gl), gyroscope control, and simulated audio analysis.
- **Native Mobile Preparation (Unity)**: Unity serves as the visual engine for native iOS/Android apps, receiving JSON messages for track, playback, audio bands, and preset data.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **connect-pg-simple**: For Express session persistence.

### AI Services
- **OpenAI API**: For image analysis, voice chat, and chat completions (via Replit AI Integrations).

### Third-Party Libraries
- **Three.js Ecosystem**: @react-three/fiber, @react-three/drei, @react-three/postprocessing.
- **maath**: Mathematical helpers.
- **p-limit, p-retry**: For batch processing and rate-limited API calls.
- **ffmpeg**: System dependency for audio format conversion.

### SoundCloud Integration
- **SoundCloud API**: Full OAuth 2.0 flow for search and streaming, with server-side token exchange, CSRF protection, and automatic token refresh.