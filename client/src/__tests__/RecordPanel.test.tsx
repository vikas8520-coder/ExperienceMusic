import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecordPanel } from "@/components/settings/RecordPanel";

function makeProps(overrides: Record<string, any> = {}) {
  return {
    isRecording: false,
    onToggleRecording: vi.fn(),
    recordingQuality: "1080p" as const,
    onRecordingQualityChange: vi.fn(),
    onSaveToLibrary: vi.fn(),
    isFullscreen: false,
    onToggleFullscreen: vi.fn(),
    ...overrides,
  };
}

describe("RecordPanel", () => {
  // ─── Core Rendering ─────────────────────────────────────────────────

  describe("Core Rendering", () => {
    it("renders panel-record container", () => {
      render(<RecordPanel {...makeProps()} />);
      expect(screen.getByTestId("panel-record")).toBeTruthy();
    });

    it("renders record button", () => {
      render(<RecordPanel {...makeProps()} />);
      expect(screen.getByTestId("button-record")).toBeTruthy();
    });

    it("renders fullscreen button", () => {
      render(<RecordPanel {...makeProps()} />);
      expect(screen.getByTestId("button-fullscreen")).toBeTruthy();
    });

    it("renders save-to-library button", () => {
      render(<RecordPanel {...makeProps()} />);
      expect(screen.getByTestId("button-save-library")).toBeTruthy();
    });

    it("renders all three quality buttons", () => {
      render(<RecordPanel {...makeProps()} />);
      expect(screen.getByTestId("button-quality-1080p")).toBeTruthy();
      expect(screen.getByTestId("button-quality-2k")).toBeTruthy();
      expect(screen.getByTestId("button-quality-4k")).toBeTruthy();
    });
  });

  // ─── Recording × Quality × Fullscreen permutations ──────────────────

  describe("Recording × Quality × Fullscreen permutations", () => {
    const qualities = ["1080p", "2k", "4k"] as const;
    const booleans = [false, true];

    booleans.forEach((isRecording) => {
      qualities.forEach((quality) => {
        booleans.forEach((isFullscreen) => {
          it(`isRecording=${isRecording}, quality=${quality}, isFullscreen=${isFullscreen}`, () => {
            render(
              <RecordPanel
                {...makeProps({
                  isRecording,
                  recordingQuality: quality,
                  isFullscreen,
                })}
              />
            );
            expect(screen.getByTestId("panel-record")).toBeTruthy();
            expect(screen.getByTestId("button-record")).toBeTruthy();
          });
        });
      });
    });
  });

  // ─── Callbacks ──────────────────────────────────────────────────────

  describe("Callbacks fire correctly", () => {
    it("calls onToggleRecording when record button clicked", () => {
      const props = makeProps();
      render(<RecordPanel {...props} />);
      fireEvent.click(screen.getByTestId("button-record"));
      expect(props.onToggleRecording).toHaveBeenCalledTimes(1);
    });

    it("calls onToggleFullscreen when fullscreen button clicked", () => {
      const props = makeProps();
      render(<RecordPanel {...props} />);
      fireEvent.click(screen.getByTestId("button-fullscreen"));
      expect(props.onToggleFullscreen).toHaveBeenCalledTimes(1);
    });

    it("calls onSaveToLibrary when save button clicked", () => {
      const props = makeProps();
      render(<RecordPanel {...props} />);
      fireEvent.click(screen.getByTestId("button-save-library"));
      expect(props.onSaveToLibrary).toHaveBeenCalledTimes(1);
    });

    it("calls onRecordingQualityChange for each quality button", () => {
      const props = makeProps();
      render(<RecordPanel {...props} />);

      fireEvent.click(screen.getByTestId("button-quality-1080p"));
      expect(props.onRecordingQualityChange).toHaveBeenCalledWith("1080p");

      fireEvent.click(screen.getByTestId("button-quality-2k"));
      expect(props.onRecordingQualityChange).toHaveBeenCalledWith("2k");

      fireEvent.click(screen.getByTestId("button-quality-4k"));
      expect(props.onRecordingQualityChange).toHaveBeenCalledWith("4k");
    });
  });
});
