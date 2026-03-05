import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LibraryPanel } from "@/components/settings/LibraryPanel";
import type { SavedTrack } from "@/pages/Home";

const mockTracks: SavedTrack[] = [
  { id: "1", name: "Track A", audioUrl: "/a.mp3", theme: "cosmic", createdAt: new Date() },
  { id: "2", name: "Track B", audioUrl: "/b.mp3", theme: "chill", thumbnailUrl: "/thumb.jpg", createdAt: new Date() },
  { id: "3", name: "Track C", audioUrl: "/c.mp3", createdAt: new Date() },
];

function makeProps(overrides: Record<string, any> = {}) {
  return {
    savedTracks: [] as SavedTrack[],
    onLoadTrack: vi.fn(),
    onDeleteTrack: vi.fn(),
    showSoundCloud: false,
    onToggleSoundCloud: vi.fn(),
    onPlaySoundCloudTrack: vi.fn(),
    ...overrides,
  };
}

describe("LibraryPanel", () => {
  // ─── Core Rendering ─────────────────────────────────────────────────

  describe("Core Rendering", () => {
    it("renders panel-library container", () => {
      render(<LibraryPanel {...makeProps()} />);
      expect(screen.getByTestId("panel-library")).toBeTruthy();
    });

    it("shows My Library tab button", () => {
      render(<LibraryPanel {...makeProps()} />);
      expect(screen.getByText(/My Library/)).toBeTruthy();
    });

    it("shows SoundCloud tab button", () => {
      render(<LibraryPanel {...makeProps()} />);
      expect(screen.getByText("SoundCloud")).toBeTruthy();
    });
  });

  // ─── Empty vs Populated Library ─────────────────────────────────────

  describe("Empty vs populated library", () => {
    it("shows empty state when no tracks", () => {
      render(<LibraryPanel {...makeProps({ savedTracks: [] })} />);
      expect(screen.getByText("No tracks saved yet")).toBeTruthy();
    });

    it("shows track count in tab", () => {
      render(<LibraryPanel {...makeProps({ savedTracks: mockTracks })} />);
      expect(screen.getByText(`My Library (${mockTracks.length})`)).toBeTruthy();
    });

    it("shows track names when populated", () => {
      render(<LibraryPanel {...makeProps({ savedTracks: mockTracks })} />);
      expect(screen.getByText("Track A")).toBeTruthy();
      expect(screen.getByText("Track B")).toBeTruthy();
      expect(screen.getByText("Track C")).toBeTruthy();
    });
  });

  // ─── Track Count Permutations ───────────────────────────────────────

  describe("Track count permutations", () => {
    [0, 1, 3, 10].forEach((count) => {
      it(`renders with ${count} tracks`, () => {
        const tracks = Array.from({ length: count }, (_, i) => ({
          id: String(i),
          name: `Track ${i}`,
          url: `/${i}.mp3`,
        }));
        render(<LibraryPanel {...makeProps({ savedTracks: tracks })} />);
        expect(screen.getByText(`My Library (${count})`)).toBeTruthy();
      });
    });
  });

  // ─── SoundCloud Tab ─────────────────────────────────────────────────

  describe("SoundCloud tab", () => {
    it("switches to SoundCloud tab on click", () => {
      render(<LibraryPanel {...makeProps()} />);
      fireEvent.click(screen.getByText("SoundCloud"));
      expect(screen.getByText("Open SoundCloud Panel")).toBeTruthy();
    });

    it("calls onToggleSoundCloud when Open SoundCloud clicked", () => {
      const props = makeProps();
      render(<LibraryPanel {...props} />);
      fireEvent.click(screen.getByText("SoundCloud"));
      fireEvent.click(screen.getByText("Open SoundCloud Panel"));
      expect(props.onToggleSoundCloud).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Tab Switch Permutations ────────────────────────────────────────

  describe("Tab switch permutations", () => {
    it("library → soundcloud → library cycle", () => {
      render(<LibraryPanel {...makeProps({ savedTracks: mockTracks })} />);
      // Start on library tab
      expect(screen.getByText("Track A")).toBeTruthy();
      // Switch to soundcloud
      fireEvent.click(screen.getByText("SoundCloud"));
      expect(screen.getByText("Open SoundCloud Panel")).toBeTruthy();
      // Switch back to library
      fireEvent.click(screen.getByText(`My Library (${mockTracks.length})`));
      expect(screen.getByText("Track A")).toBeTruthy();
    });
  });

  // ─── Callbacks ──────────────────────────────────────────────────────

  describe("Callbacks fire correctly", () => {
    it("calls onLoadTrack when track clicked", () => {
      const props = makeProps({ savedTracks: mockTracks });
      render(<LibraryPanel {...props} />);
      fireEvent.click(screen.getByText("Track A"));
      expect(props.onLoadTrack).toHaveBeenCalledWith(mockTracks[0]);
    });

    it("calls onDeleteTrack when Remove clicked (with stopPropagation)", () => {
      const props = makeProps({ savedTracks: mockTracks });
      render(<LibraryPanel {...props} />);
      const removeButtons = screen.getAllByText("Remove");
      fireEvent.click(removeButtons[0]);
      expect(props.onDeleteTrack).toHaveBeenCalledWith("1");
      // onLoadTrack should NOT fire thanks to stopPropagation
      expect(props.onLoadTrack).not.toHaveBeenCalled();
    });
  });
});
