import { useState, useRef, useCallback, useEffect } from "react";

interface UseProjectionReturn {
  isProjecting: boolean;
  startProjection: (canvas: HTMLCanvasElement) => void;
  stopProjection: () => void;
  toggleProjection: (canvas: HTMLCanvasElement) => void;
}

export function useProjection(): UseProjectionReturn {
  const [isProjecting, setIsProjecting] = useState(false);
  const popoutRef = useRef<Window | null>(null);
  const pollRef = useRef<number>(0);

  const stopProjection = useCallback(() => {
    if (popoutRef.current && !popoutRef.current.closed) {
      popoutRef.current.close();
    }
    popoutRef.current = null;
    setIsProjecting(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = 0;
    }
  }, []);

  const startProjection = useCallback((canvas: HTMLCanvasElement) => {
    // Close existing
    if (popoutRef.current && !popoutRef.current.closed) {
      popoutRef.current.close();
    }

    const stream = canvas.captureStream(60);
    const popout = window.open(
      "",
      "ExperienceProjection",
      "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no"
    );

    if (!popout) {
      console.error("Popup blocked. Please allow popups for projection.");
      return;
    }

    popout.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Experience - Projection</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    video { width: 100%; height: 100%; object-fit: contain; display: block; }
    body.hide-cursor { cursor: none; }
  </style>
</head>
<body>
  <video autoplay muted playsinline id="projectionVideo"></video>
  <script>
    let hideTimer;
    const hideCursor = () => document.body.classList.add('hide-cursor');
    const showCursor = () => {
      document.body.classList.remove('hide-cursor');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideCursor, 2000);
    };
    document.addEventListener('mousemove', showCursor);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      }
    });
    document.addEventListener('dblclick', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    });
    hideTimer = setTimeout(hideCursor, 2000);
  <\/script>
</body>
</html>`);
    popout.document.close();

    // Wait for DOM to be ready then attach stream
    setTimeout(() => {
      try {
        const video = popout.document.getElementById("projectionVideo") as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
      } catch (e) {
        console.error("Failed to attach stream to projection:", e);
      }
    }, 100);

    popoutRef.current = popout;
    setIsProjecting(true);

    // Poll for closed window
    pollRef.current = window.setInterval(() => {
      if (!popoutRef.current || popoutRef.current.closed) {
        stopProjection();
      }
    }, 1000);
  }, [stopProjection]);

  const toggleProjection = useCallback((canvas: HTMLCanvasElement) => {
    if (isProjecting) {
      stopProjection();
    } else {
      startProjection(canvas);
    }
  }, [isProjecting, startProjection, stopProjection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (popoutRef.current && !popoutRef.current.closed) {
        popoutRef.current.close();
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  return { isProjecting, startProjection, stopProjection, toggleProjection };
}
