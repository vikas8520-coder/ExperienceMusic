/**
 * Virtual Camera Output
 * Captures the R3F canvas as a MediaStream for use in OBS, Zoom, etc.
 */

let activeStream: MediaStream | null = null;
let hiddenVideo: HTMLVideoElement | null = null;

export function startVirtualCamera(canvas?: HTMLCanvasElement | null): MediaStream | null {
  if (activeStream) return activeStream;

  // Find the canvas element — either passed in or find the R3F canvas
  const targetCanvas = canvas || document.querySelector("canvas");
  if (!targetCanvas) {
    console.warn("No canvas element found for virtual camera");
    return null;
  }

  try {
    const stream = targetCanvas.captureStream(30);
    activeStream = stream;

    // Create hidden video element for OBS Browser Source capture
    hiddenVideo = document.createElement("video");
    hiddenVideo.srcObject = stream;
    hiddenVideo.autoplay = true;
    hiddenVideo.muted = true;
    hiddenVideo.style.position = "fixed";
    hiddenVideo.style.top = "-9999px";
    hiddenVideo.style.left = "-9999px";
    hiddenVideo.style.width = "1px";
    hiddenVideo.style.height = "1px";
    document.body.appendChild(hiddenVideo);

    return stream;
  } catch (e) {
    console.error("Failed to start virtual camera:", e);
    return null;
  }
}

export function stopVirtualCamera(): void {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }

  if (hiddenVideo) {
    hiddenVideo.srcObject = null;
    hiddenVideo.remove();
    hiddenVideo = null;
  }
}

export function isVirtualCameraActive(): boolean {
  return activeStream !== null;
}

export function getVirtualCameraStream(): MediaStream | null {
  return activeStream;
}
