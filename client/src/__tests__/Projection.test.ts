import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjection } from "@/hooks/useProjection";

describe("useProjection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with isProjecting=false", () => {
    const { result } = renderHook(() => useProjection());
    expect(result.current.isProjecting).toBe(false);
  });

  it("provides startProjection, stopProjection, toggleProjection functions", () => {
    const { result } = renderHook(() => useProjection());
    expect(typeof result.current.startProjection).toBe("function");
    expect(typeof result.current.stopProjection).toBe("function");
    expect(typeof result.current.toggleProjection).toBe("function");
  });

  it("calls window.open when startProjection is called", () => {
    const mockWindow = {
      closed: false,
      close: vi.fn(),
      document: {
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => ({
          srcObject: null,
          play: vi.fn(() => Promise.resolve()),
        })),
      },
    };
    vi.spyOn(window, "open").mockReturnValue(mockWindow as any);

    const mockCanvas = {
      captureStream: vi.fn(() => ({ getTracks: () => [], getVideoTracks: () => [] })),
    } as any;

    const { result } = renderHook(() => useProjection());
    act(() => {
      result.current.startProjection(mockCanvas);
    });

    expect(window.open).toHaveBeenCalledWith(
      "",
      "ExperienceProjection",
      expect.stringContaining("width=1920")
    );
    expect(result.current.isProjecting).toBe(true);
  });

  it("sets isProjecting=false when stopProjection is called", () => {
    const mockWindow = {
      closed: false,
      close: vi.fn(),
      document: {
        write: vi.fn(),
        close: vi.fn(),
        getElementById: vi.fn(() => ({
          srcObject: null,
          play: vi.fn(() => Promise.resolve()),
        })),
      },
    };
    vi.spyOn(window, "open").mockReturnValue(mockWindow as any);

    const mockCanvas = {
      captureStream: vi.fn(() => ({ getTracks: () => [], getVideoTracks: () => [] })),
    } as any;

    const { result } = renderHook(() => useProjection());
    act(() => {
      result.current.startProjection(mockCanvas);
    });
    expect(result.current.isProjecting).toBe(true);

    act(() => {
      result.current.stopProjection();
    });
    expect(result.current.isProjecting).toBe(false);
    expect(mockWindow.close).toHaveBeenCalled();
  });

  it("handles popup blocked (window.open returns null)", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockCanvas = {
      captureStream: vi.fn(() => ({ getTracks: () => [] })),
    } as any;

    const { result } = renderHook(() => useProjection());
    act(() => {
      result.current.startProjection(mockCanvas);
    });

    expect(result.current.isProjecting).toBe(false);
    consoleSpy.mockRestore();
  });
});
