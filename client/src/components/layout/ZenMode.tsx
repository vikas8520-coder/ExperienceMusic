import { useState, useCallback, useEffect } from "react";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { FloatingPlayer } from "@/components/player/FloatingPlayer";
import { IconRail, type PanelId } from "./IconRail";
import { SidePanel } from "./SidePanel";
import { PresetsPanel } from "@/components/settings/PresetsPanel";
import { ColorsPanel } from "@/components/settings/ColorsPanel";
import { EffectsPanel } from "@/components/settings/EffectsPanel";
import { PerformPanel } from "@/components/settings/PerformPanel";
import { AudioPanel } from "@/components/settings/AudioPanel";
import { RecordPanel } from "@/components/settings/RecordPanel";
import { LibraryPanel } from "@/components/settings/LibraryPanel";
import { SessionStats } from "@/components/SessionStats";
import type { AudioData } from "@/hooks/use-audio-analyzer";
import type { ColorSettings } from "@/lib/visualizer-presets";
import type { SavedTrack } from "@/pages/Home";
import type { UniformSpec, UniformValues } from "@/engine/presets/types";
import type { PresetEvolutionConfig } from "@/lib/visualizer-presets";

interface ZenModeProps {
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
  recordingQuality: "1080p" | "2k" | "4k";
  onRecordingQualityChange?: (quality: "1080p" | "2k" | "4k") => void;
  // Misc
  onSavePreset: () => void;
  onSaveToLibrary?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  micStatus?: "idle" | "starting" | "running" | "error";
  onToggleMicReactivity?: () => void;
  // Library
  savedTracks: SavedTrack[];
  onLoadTrack: (track: SavedTrack) => void;
  onDeleteTrack: (trackId: string) => void;
  showSoundCloud: boolean;
  onToggleSoundCloud: () => void;
  onPlaySoundCloudTrack: (streamUrl: string, title: string, artworkUrl?: string) => void;
  // Canvas interaction handlers
  screenZoomLayerRef: React.RefObject<HTMLDivElement | null>;
  onCanvasClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCanvasPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasDoubleClick: () => void;
  onScreenTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onScreenTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onScreenTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void;
}

export function ZenMode(props: ZenModeProps) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);

  const handlePanelToggle = useCallback((panel: PanelId) => {
    setActivePanel(prev => prev === panel ? null : panel);
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  // Escape to close panel
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activePanel) {
        closePanel();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activePanel, closePanel]);

  const renderPanelContent = () => {
    switch (activePanel) {
      case "presets":
        return <PresetsPanel settings={props.settings} setSettings={props.setSettings} onSavePreset={props.onSavePreset} />;
      case "colors":
        return <ColorsPanel colorSettings={props.colorSettings} setColorSettings={props.setColorSettings} colorPalette={props.settings.colorPalette} />;
      case "effects":
        return <EffectsPanel settings={props.settings} setSettings={props.setSettings} />;
      case "perform":
        return (
          <PerformPanel
            settings={props.settings}
            setSettings={props.setSettings}
            zoom={props.zoom}
            onZoomChange={props.onZoomChange}
            fractalMacros={props.fractalMacros}
            fractalUniforms={props.fractalUniforms}
            onFractalUniformChange={props.onFractalUniformChange}
          />
        );
      case "audio":
        return (
          <AudioPanel
            getAudioData={props.getAudioData}
            micStatus={props.micStatus}
            onToggleMicReactivity={props.onToggleMicReactivity}
          />
        );
      case "record":
        return (
          <RecordPanel
            isRecording={props.isRecording}
            onToggleRecording={props.onToggleRecording}
            recordingQuality={props.recordingQuality}
            onRecordingQualityChange={props.onRecordingQualityChange}
            onSaveToLibrary={props.onSaveToLibrary}
            isFullscreen={props.isFullscreen}
            onToggleFullscreen={props.onToggleFullscreen}
          />
        );
      case "library":
        return (
          <LibraryPanel
            savedTracks={props.savedTracks}
            onLoadTrack={props.onLoadTrack}
            onDeleteTrack={props.onDeleteTrack}
            showSoundCloud={props.showSoundCloud}
            onToggleSoundCloud={props.onToggleSoundCloud}
            onPlaySoundCloudTrack={props.onPlaySoundCloudTrack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Full-viewport canvas */}
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

      {/* Canvas Click Catcher */}
      <div
        ref={props.screenZoomLayerRef}
        className="absolute inset-0 z-10"
        onPointerDown={props.onCanvasPointerDown}
        onPointerMove={props.onCanvasPointerMove}
        onPointerUp={props.onCanvasPointerUp}
        onPointerCancel={props.onCanvasPointerUp}
        onClick={(e) => {
          if (activePanel) {
            closePanel();
          }
          props.onCanvasClick(e);
        }}
        onDoubleClick={props.onCanvasDoubleClick}
        onTouchStart={props.onScreenTouchStart}
        onTouchMove={props.onScreenTouchMove}
        onTouchEnd={props.onScreenTouchEnd}
        onTouchCancel={props.onScreenTouchEnd}
        style={{ pointerEvents: "auto", touchAction: "none" }}
        data-testid="zen-canvas-catcher"
      />

      {/* Icon Rail */}
      <IconRail activePanel={activePanel} onPanelToggle={handlePanelToggle} />

      {/* Slide-out Side Panel */}
      <SidePanel activePanel={activePanel} onClose={closePanel}>
        {renderPanelContent()}
      </SidePanel>

      {/* Floating Player Pill */}
      <FloatingPlayer
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

      {/* Session Stats */}
      <SessionStats
        isPlaying={props.isPlaying}
        presetName={props.settings.presetName}
        getAudioData={props.getAudioData}
      />
    </>
  );
}
