import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionCluster } from "@/components/layout/ActionCluster";

function makeProps(overrides: Record<string, any> = {}) {
  return {
    isRecording: false,
    onToggleRecording: vi.fn(),
    micStatus: "idle" as const,
    onToggleMicReactivity: vi.fn(),
    onToggleLibrary: vi.fn(),
    onToggleRadial: vi.fn(),
    showRadial: false,
    onSavePreset: vi.fn(),
    isFullscreen: false,
    onToggleFullscreen: vi.fn(),
    isProjecting: false,
    onToggleProjection: vi.fn(),
    ...overrides,
  };
}

describe("ActionCluster", () => {
  it("renders all action buttons", () => {
    render(<ActionCluster {...makeProps()} />);

    expect(screen.getByTestId("action-cluster")).toBeDefined();
    expect(screen.getByTestId("action-record")).toBeDefined();
    expect(screen.getByTestId("action-mic")).toBeDefined();
    expect(screen.getByTestId("action-library")).toBeDefined();
    expect(screen.getByTestId("action-fullscreen")).toBeDefined();
    expect(screen.getByTestId("action-projection")).toBeDefined();
    expect(screen.getByTestId("action-settings")).toBeDefined();
  });

  it("calls onToggleRecording when record button clicked", () => {
    const props = makeProps();
    render(<ActionCluster {...props} />);

    fireEvent.click(screen.getByTestId("action-record"));
    expect(props.onToggleRecording).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleRadial when settings button clicked", () => {
    const props = makeProps();
    render(<ActionCluster {...props} />);

    fireEvent.click(screen.getByTestId("action-settings"));
    expect(props.onToggleRadial).toHaveBeenCalledTimes(1);
  });

  it("shows green dot when mic is running", () => {
    render(<ActionCluster {...makeProps({ micStatus: "running" })} />);

    const micButton = screen.getByTestId("action-mic");
    const greenDot = micButton.querySelector(".bg-green-400");
    expect(greenDot).toBeDefined();
  });

});
