import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startVirtualCamera, stopVirtualCamera, isVirtualCameraActive } from "@/lib/virtualCamera";

describe("Virtual Camera", () => {
  let mockCanvas: HTMLCanvasElement;
  let mockStream: MediaStream;
  let mockTrack: MediaStreamTrack;

  beforeEach(() => {
    // Reset module state
    stopVirtualCamera();

    mockTrack = {
      stop: vi.fn(),
      kind: "video",
      enabled: true,
    } as unknown as MediaStreamTrack;

    mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    } as unknown as MediaStream;

    mockCanvas = document.createElement("canvas");
    mockCanvas.captureStream = vi.fn(() => mockStream);
  });

  afterEach(() => {
    stopVirtualCamera();
  });

  it("calls captureStream on canvas", () => {
    const stream = startVirtualCamera(mockCanvas);

    expect(mockCanvas.captureStream).toHaveBeenCalledWith(30);
    expect(stream).toBe(mockStream);
  });

  it("reports active state correctly", () => {
    expect(isVirtualCameraActive()).toBe(false);

    startVirtualCamera(mockCanvas);
    expect(isVirtualCameraActive()).toBe(true);

    stopVirtualCamera();
    expect(isVirtualCameraActive()).toBe(false);
  });

  it("stop cleans up all tracks", () => {
    startVirtualCamera(mockCanvas);
    stopVirtualCamera();

    expect(mockStream.getTracks).toHaveBeenCalled();
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it("returns existing stream if already active", () => {
    const stream1 = startVirtualCamera(mockCanvas);
    const stream2 = startVirtualCamera(mockCanvas);

    expect(stream1).toBe(stream2);
    expect(mockCanvas.captureStream).toHaveBeenCalledTimes(1);
  });

  it("returns null when no canvas is found", () => {
    const stream = startVirtualCamera(null);
    // Will try document.querySelector("canvas") which returns null in jsdom by default
    // Since we didn't add a canvas to the DOM, this should return null
    expect(stream).toBeNull();
  });
});
