import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ZenMode } from "@/components/layout/ZenMode";
import type { AudioData } from "@/hooks/use-audio-analyzer";

const mockAudioData: AudioData = {
  sub: 0, bass: 0, mid: 0, high: 0, energy: 0, kick: 0,
  dominantFreq: 200, modeIndex: 1,
  frequencyData: new Uint8Array(0),
  bpm: 0, beatPhase: 0,
  bpmSin1: 0, bpmSin2: 0, bpmSin4: 0, bpmCos1: 1,
  bassHits: 0, bassPresence: 0,
};

const defaultProps = {
  getAudioData: () => mockAudioData,
  isPlaying: false,
  onPlayPause: vi.fn(),
  onFileUpload: vi.fn(),
  trackName: "Test Track.mp3",
  currentTime: 30,
  duration: 180,
  onSeek: vi.fn(),
  volume: 0.8,
  onVolumeChange: vi.fn(),
  onPreviousTrack: vi.fn(),
  onNextTrack: vi.fn(),
  hasLibraryTracks: true,
  settings: {
    intensity: 1, speed: 0.5,
    colorPalette: ["#ff0000", "#00ff00", "#0000ff"],
    presetName: "Energy Rings" as const,
    presetEnabled: true,
    imageFilters: ["none" as const],
    psyOverlays: [],
    trailsOn: false, darkOverlay: false,
    trailsAmount: 0.75, glowEnabled: true, glowIntensity: 1.0,
  },
  setSettings: vi.fn(),
  backgroundImage: null,
  zoom: 1,
  onZoomChange: vi.fn(),
  colorSettings: {
    mode: "gradient" as const,
    primaryColor: "#a855f7",
    secondaryColor: "#06b6d4",
    tertiaryColor: "#f43f5e",
    moodPreset: "psychedelic" as const,
    customColors: [],
    spectrumSpeed: 1,
    spectrumOffset: 0,
    aiColors: [],
  },
  setColorSettings: vi.fn(),
  isRecording: false,
  onToggleRecording: vi.fn(),
  recordingQuality: "1080p" as const,
  onRecordingQualityChange: vi.fn(),
  onSavePreset: vi.fn(),
  onSaveToLibrary: vi.fn(),
  isFullscreen: false,
  onToggleFullscreen: vi.fn(),
  micStatus: "idle" as const,
  onToggleMicReactivity: vi.fn(),
  savedTracks: [],
  onLoadTrack: vi.fn(),
  onDeleteTrack: vi.fn(),
  showSoundCloud: false,
  onToggleSoundCloud: vi.fn(),
  onPlaySoundCloudTrack: vi.fn(),
  screenZoomLayerRef: { current: null },
  onCanvasClick: vi.fn(),
  onCanvasPointerDown: vi.fn(),
  onCanvasPointerMove: vi.fn(),
  onCanvasPointerUp: vi.fn(),
  onCanvasDoubleClick: vi.fn(),
  onScreenTouchStart: vi.fn(),
  onScreenTouchMove: vi.fn(),
  onScreenTouchEnd: vi.fn(),
  renderProfile: "desktopCinematic" as const,
  adaptiveQualityTier: 1 as const,
};

describe("ZenMode", () => {
  it("renders icon rail with 7 panel buttons", () => {
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByTestId("icon-rail")).toBeTruthy();
    const buttons = screen.getByTestId("icon-rail").querySelectorAll("button");
    expect(buttons.length).toBe(7);
  });

  it("renders floating player", () => {
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByTestId("floating-player")).toBeTruthy();
  });

  it("opens side panel when icon clicked", () => {
    render(<ZenMode {...defaultProps} />);
    fireEvent.click(screen.getByTestId("icon-rail-presets"));
    expect(screen.getByTestId("side-panel")).toBeTruthy();
    expect(screen.getByTestId("panel-presets")).toBeTruthy();
  });

  it("closes side panel when clicking same icon again", () => {
    render(<ZenMode {...defaultProps} />);
    fireEvent.click(screen.getByTestId("icon-rail-presets"));
    expect(screen.getByTestId("side-panel")).toBeTruthy();
    fireEvent.click(screen.getByTestId("icon-rail-presets"));
    // Panel should be gone after closing
    expect(screen.queryByTestId("side-panel")).toBeNull();
  });

  it("swaps panel when clicking different icon", () => {
    render(<ZenMode {...defaultProps} />);
    fireEvent.click(screen.getByTestId("icon-rail-presets"));
    expect(screen.getByTestId("panel-presets")).toBeTruthy();
    fireEvent.click(screen.getByTestId("icon-rail-colors"));
    expect(screen.queryByTestId("panel-presets")).toBeNull();
    expect(screen.getByTestId("panel-colors")).toBeTruthy();
  });

  it("shows track name in floating player", () => {
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByText("Test Track")).toBeTruthy();
  });
});
