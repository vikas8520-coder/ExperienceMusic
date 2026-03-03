import { AudioVisualizer } from "@/components/AudioVisualizer";
import { PlayerBar } from "@/components/player/PlayerBar";
import { PresetsPanel } from "@/components/settings/PresetsPanel";
import { ColorsPanel } from "@/components/settings/ColorsPanel";
import { EffectsPanel } from "@/components/settings/EffectsPanel";
import { AudioPanel } from "@/components/settings/AudioPanel";
import type { AudioData } from "@/hooks/use-audio-analyzer";
import type { ColorSettings } from "@/lib/visualizer-presets";
import type { UniformValues, UniformSpec } from "@/engine/presets/types";
import type { PresetEvolutionConfig } from "@/lib/visualizer-presets";

interface CommandCenterProps {
  // Audio
  getAudioData: () => AudioData;
  isPlaying: boolean;
  onPlayPause: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  trackName?: string;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  hasLibraryTracks?: boolean;
  // Visualizer
  settings: any;
  setSettings: (s: any) => void;
  backgroundImage?: string | null;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  fractalUniforms?: UniformValues;
  fractalSpecs?: UniformSpec[];
  fractalMacros?: UniformSpec[];
  onFractalUniformChange?: (key: string, value: any) => void;
  renderProfile?: "mobile60" | "desktopCinematic" | "exportQuality";
  adaptiveQualityTier?: 0 | 1 | 2;
  evolutionEnabled?: boolean;
  evolutionSpec?: PresetEvolutionConfig | null;
  // Colors
  colorSettings: ColorSettings;
  setColorSettings: (s: ColorSettings) => void;
  // Recording
  isRecording: boolean;
  onToggleRecording: () => void;
  // Misc
  onSavePreset: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  micStatus?: "idle" | "starting" | "running" | "error";
  onToggleMicReactivity?: () => void;
  // Canvas interaction
  screenZoomLayerRef: React.RefObject<HTMLDivElement | null>;
  onCanvasPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasDoubleClick: () => void;
  onScreenTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onScreenTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onScreenTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void;
}

export function CommandCenter(props: CommandCenterProps) {
  return (
    <div
      className="w-full h-screen grid grid-rows-[1fr_280px] gap-0 bg-background overflow-hidden"
      data-testid="command-center"
    >
      {/* Top Row: Canvas + Presets */}
      <div className="grid grid-cols-[1fr_380px] gap-0 min-h-0">
        {/* Canvas */}
        <div className="relative overflow-hidden border-r border-white/5">
          <AudioVisualizer
            getAudioData={props.getAudioData}
            settings={props.settings}
            backgroundImage={props.backgroundImage}
            zoom={props.zoom}
            fractalUniforms={props.fractalUniforms}
            renderProfile={props.renderProfile}
            adaptiveQualityTier={props.adaptiveQualityTier}
            evolutionEnabled={props.evolutionEnabled}
            evolutionSpec={props.evolutionSpec}
          />
          {/* Interaction layer */}
          <div
            ref={props.screenZoomLayerRef}
            className="absolute inset-0 z-10"
            onPointerDown={props.onCanvasPointerDown}
            onPointerMove={props.onCanvasPointerMove}
            onPointerUp={props.onCanvasPointerUp}
            onPointerCancel={props.onCanvasPointerUp}
            onDoubleClick={props.onCanvasDoubleClick}
            onTouchStart={props.onScreenTouchStart}
            onTouchMove={props.onScreenTouchMove}
            onTouchEnd={props.onScreenTouchEnd}
            onTouchCancel={props.onScreenTouchEnd}
            style={{ pointerEvents: "auto", touchAction: "none" }}
            data-testid="command-canvas-catcher"
          />
          {/* Recording indicator */}
          {props.isRecording && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-red-500/20 border border-red-500/50 rounded-full px-3 py-1 text-red-400 text-xs">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              REC
            </div>
          )}
        </div>

        {/* Presets Panel */}
        <div className="glass-panel border-b border-white/5 overflow-y-auto settings-panel p-4 scrollbar-thin">
          <h3 className="text-xs font-bold font-display uppercase tracking-widest text-white mb-3">Presets</h3>
          <PresetsPanel settings={props.settings} setSettings={props.setSettings} onSavePreset={props.onSavePreset} />
        </div>
      </div>

      {/* Bottom Row: Player+Audio | Colors | Effects */}
      <div className="grid grid-cols-3 gap-0 border-t border-white/10 min-h-0">
        {/* Player + Audio */}
        <div className="glass-panel overflow-y-auto settings-panel p-3 space-y-3 scrollbar-thin border-r border-white/5">
          <PlayerBar
            isPlaying={props.isPlaying}
            onPlayPause={props.onPlayPause}
            onFileUpload={props.onFileUpload}
            trackName={props.trackName}
            currentTime={props.currentTime}
            duration={props.duration}
            onSeek={props.onSeek}
            volume={props.volume}
            onVolumeChange={props.onVolumeChange}
            onPreviousTrack={props.onPreviousTrack}
            onNextTrack={props.onNextTrack}
            hasLibraryTracks={props.hasLibraryTracks}
          />
          <AudioPanel
            getAudioData={props.getAudioData}
            micStatus={props.micStatus}
            onToggleMicReactivity={props.onToggleMicReactivity}
          />
        </div>

        {/* Colors */}
        <div className="glass-panel overflow-y-auto settings-panel p-4 scrollbar-thin border-r border-white/5">
          <h3 className="text-xs font-bold font-display uppercase tracking-widest text-white mb-3">Colors</h3>
          <ColorsPanel
            colorSettings={props.colorSettings}
            setColorSettings={props.setColorSettings}
            colorPalette={props.settings.colorPalette}
          />
        </div>

        {/* Effects */}
        <div className="glass-panel overflow-y-auto settings-panel p-4 scrollbar-thin">
          <h3 className="text-xs font-bold font-display uppercase tracking-widest text-white mb-3">Effects</h3>
          <EffectsPanel settings={props.settings} setSettings={props.setSettings} />
        </div>
      </div>
    </div>
  );
}
