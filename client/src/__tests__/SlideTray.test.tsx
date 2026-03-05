import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlideTray } from "@/components/layout/SlideTray";

describe("SlideTray", () => {
  const defaultProps = {
    topOffset: 64,
    availableHeight: 200,
  };

  it("starts collapsed (default closed) and shows hover zone", () => {
    render(
      <SlideTray label="Presets" position={0} {...defaultProps}>
        <div data-testid="tray-child">Child</div>
      </SlideTray>,
    );

    // Should show hover zone, not the tray panel
    expect(screen.getByTestId("tray-hover-presets")).toBeDefined();
    expect(screen.queryByTestId("tray-presets")).toBeNull();
  });

  it("renders open when defaultOpen is true", () => {
    render(
      <SlideTray label="Presets" position={0} {...defaultProps} defaultOpen>
        <div data-testid="tray-child">Child</div>
      </SlideTray>,
    );

    expect(screen.getByTestId("tray-presets")).toBeDefined();
    expect(screen.getByText("Presets")).toBeDefined();
    expect(screen.getByTestId("tray-child")).toBeDefined();
  });

  it("positions on right side with correct topOffset", () => {
    render(
      <SlideTray label="Filters" position={1} topOffset={104} availableHeight={180} defaultOpen>
        <span>Filter content</span>
      </SlideTray>,
    );

    const tray = screen.getByTestId("tray-filters");
    expect(tray.style.top).toBe("104px");
    expect(tray.style.right).toBe("0px");
  });

  it("collapses when close button is clicked and calls onToggle", () => {
    const onToggle = vi.fn();
    render(
      <SlideTray label="Filters" position={1} {...defaultProps} defaultOpen onToggle={onToggle}>
        <span>Filter content</span>
      </SlideTray>,
    );

    expect(screen.getByTestId("tray-filters")).toBeDefined();
    fireEvent.click(screen.getByTestId("tray-close-filters"));
    expect(onToggle).toHaveBeenCalledWith(1, false);
  });

  it("has a resize drag handle on the left edge", () => {
    render(
      <SlideTray label="Overlays" position={2} {...defaultProps} defaultOpen>
        <span>Overlay content</span>
      </SlideTray>,
    );

    const handle = screen.getByTestId("tray-resize-overlays");
    expect(handle).toBeDefined();
    expect(handle.className).toContain("cursor-col-resize");
  });

  it("applies availableHeight as maxHeight", () => {
    render(
      <SlideTray label="Artwork" position={3} topOffset={300} availableHeight={250} defaultOpen>
        <span>Artwork content</span>
      </SlideTray>,
    );

    const tray = screen.getByTestId("tray-artwork");
    expect(tray.style.maxHeight).toBe("250px");
  });
});
