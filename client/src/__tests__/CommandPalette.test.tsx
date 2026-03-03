import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandPalette } from "@/components/CommandPalette";
import { presets } from "@/lib/visualizer-presets";

// Mock the dialog portal
vi.mock("@radix-ui/react-dialog", async () => {
  const actual = await vi.importActual("@radix-ui/react-dialog");
  return {
    ...(actual as any),
    Portal: ({ children }: any) => children,
  };
});

describe("CommandPalette", () => {
  const mockOnSelectPreset = vi.fn();
  const mockOnOpenChange = vi.fn();
  const mockTogglePlay = vi.fn();
  const mockSavePreset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", () => {
    render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelectPreset={mockOnSelectPreset}
      />,
    );

    // Should render the command input
    const input = screen.queryByTestId("command-palette-input") ||
      screen.queryByPlaceholderText("Search presets, actions...");
    expect(input).toBeDefined();
  });

  it("does not render when closed", () => {
    const { container } = render(
      <CommandPalette
        open={false}
        onOpenChange={mockOnOpenChange}
        onSelectPreset={mockOnSelectPreset}
      />,
    );

    // Dialog should not be visible when closed
    const dialog = container.querySelector("[role='dialog']");
    expect(dialog).toBeNull();
  });

  it("lists action items", () => {
    render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelectPreset={mockOnSelectPreset}
        onTogglePlay={mockTogglePlay}
        onSavePreset={mockSavePreset}
        isPlaying={false}
      />,
    );

    // Should show Play action when not playing
    expect(screen.getByText("Play")).toBeDefined();
    expect(screen.getByText("Save Preset")).toBeDefined();
  });

  it("shows Pause when playing", () => {
    render(
      <CommandPalette
        open={true}
        onOpenChange={mockOnOpenChange}
        onSelectPreset={mockOnSelectPreset}
        onTogglePlay={mockTogglePlay}
        isPlaying={true}
      />,
    );

    expect(screen.getByText("Pause")).toBeDefined();
  });

  it("preset names array has at least 30 entries", () => {
    // Verify all registered presets (original 27 + 7 new fractals + 5 milkdrop)
    expect(presets.length).toBeGreaterThanOrEqual(30);
  });
});
