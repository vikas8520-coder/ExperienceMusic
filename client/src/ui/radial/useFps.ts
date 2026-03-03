import { useEffect, useRef, useState } from "react";

export function useFps(sampleMs = 500): number {
  const [fps, setFps] = useState(60);
  const frameCount = useRef(0);
  const lastTick = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const loop = (t: number) => {
      frameCount.current += 1;
      const delta = t - lastTick.current;

      if (delta >= sampleMs) {
        const rawFps = (frameCount.current * 1000) / delta;
        setFps((prev) => prev * 0.85 + rawFps * 0.15);
        frameCount.current = 0;
        lastTick.current = t;
      }

      rafId.current = window.requestAnimationFrame(loop);
    };

    rafId.current = window.requestAnimationFrame(loop);

    return () => {
      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
      }
    };
  }, [sampleMs]);

  return fps;
}
