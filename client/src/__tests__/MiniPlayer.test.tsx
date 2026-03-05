import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MiniPlayer } from "@/components/player/MiniPlayer";

function makeProps(overrides: Record<string, any> = {}) {
  return {
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
    ...overrides,
  };
}

describe("MiniPlayer", () => {
  it("renders in compact mode by default", () => {
    render(<MiniPlayer {...makeProps()} />);

    expect(screen.getByTestId("mini-player")).toBeDefined();
    expect(screen.getByTestId("mini-player-compact")).toBeDefined();
  });

  it("shows progress ring SVG in compact mode", () => {
    render(<MiniPlayer {...makeProps()} />);

    const compact = screen.getByTestId("mini-player-compact");
    const svg = compact.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("expands when compact circle is clicked", () => {
    render(<MiniPlayer {...makeProps()} />);

    fireEvent.click(screen.getByTestId("mini-player-compact"));

    expect(screen.getByTestId("mini-player-expanded")).toBeDefined();
    expect(screen.getByText("Test Track")).toBeDefined();
  });

  it("shows play button and calls onPlayPause in expanded mode", () => {
    const props = makeProps();
    render(<MiniPlayer {...props} />);

    // Expand
    fireEvent.click(screen.getByTestId("mini-player-compact"));

    const playBtn = screen.getByTestId("mini-player-play");
    fireEvent.click(playBtn);
    expect(props.onPlayPause).toHaveBeenCalledTimes(1);
  });

  it("collapses when collapse button is clicked", () => {
    render(<MiniPlayer {...makeProps()} />);

    // Expand first
    fireEvent.click(screen.getByTestId("mini-player-compact"));
    expect(screen.getByTestId("mini-player-expanded")).toBeDefined();

    // Collapse
    fireEvent.click(screen.getByTestId("mini-player-collapse"));
    expect(screen.getByTestId("mini-player-compact")).toBeDefined();
  });

  it("shows prev/next buttons when hasLibraryTracks is true", () => {
    render(<MiniPlayer {...makeProps({ hasLibraryTracks: true })} />);

    // Expand
    fireEvent.click(screen.getByTestId("mini-player-compact"));

    expect(screen.getByTestId("mini-player-prev")).toBeDefined();
    expect(screen.getByTestId("mini-player-next")).toBeDefined();
  });

  it("hides prev/next buttons when hasLibraryTracks is false", () => {
    render(<MiniPlayer {...makeProps({ hasLibraryTracks: false })} />);

    // Expand
    fireEvent.click(screen.getByTestId("mini-player-compact"));

    expect(screen.queryByTestId("mini-player-prev")).toBeNull();
    expect(screen.queryByTestId("mini-player-next")).toBeNull();
  });
});
