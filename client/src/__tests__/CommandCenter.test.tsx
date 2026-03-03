import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommandCenter } from "@/components/layout/CommandCenter";
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
  hasLibraryTracks: false,
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
  onSavePreset: vi.fn(),
  isFullscreen: false,
  onToggleFullscreen: vi.fn(),
  micStatus: "idle" as const,
  onToggleMicReactivity: vi.fn(),
  screenZoomLayerRef: { current: null },
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

describe("CommandCenter", () => {
  it("renders the 4-quadrant grid layout", () => {
    render(<CommandCenter {...defaultProps} />);
    expect(screen.getByTestId("command-center")).toBeTruthy();
  });

  it("renders player bar in bottom left", () => {
    render(<CommandCenter {...defaultProps} />);
    expect(screen.getByTestId("player-bar")).toBeTruthy();
  });

  it("renders presets panel in top right", () => {
    render(<CommandCenter {...defaultProps} />);
    expect(screen.getByTestId("panel-presets")).toBeTruthy();
  });

  it("renders colors panel in bottom center", () => {
    render(<CommandCenter {...defaultProps} />);
    expect(screen.getByTestId("panel-colors")).toBeTruthy();
  });

  it("renders effects panel in bottom right", () => {
    render(<CommandCenter {...defaultProps} />);
    expect(screen.getByTestId("panel-effects")).toBeTruthy();
  });

  it("renders audio panel with energy meters", () => {
    render(<CommandCenter {...defaultProps} />);
    expect(screen.getByTestId("panel-audio")).toBeTruthy();
  });

  it("shows track name in player bar", () => {
    render(<CommandCenter {...defaultProps} />);
    expect(screen.getByText("Test Track")).toBeTruthy();
  });
});
