import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Vec2 = { x: number; y: number };

type Props = {
  value: Vec2;
  onChange: (next: Vec2) => void;
  onReset: () => void;
  zoom: number;
  onZoomChange: (nextZoom: number) => void;
  range?: number;
  size?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomSpeed?: number;
};

export function FractalCenterPad({
  value,
  onChange,
  onReset,
  zoom,
  onZoomChange,
  range = 2.0,
  size = 140,
  minZoom = 0.05,
  maxZoom = 50,
  zoomSpeed = 0.008,
}: Props) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const pinchRef = useRef<{ dist: number; startZoom: number } | null>(null);
  const gestureRef = useRef<{ startScale: number; startZoom: number } | null>(null);
  const pointerInsideRef = useRef(false);
  const targetZoomRef = useRef(zoom ?? 1);
  const currentZoomRef = useRef(zoom ?? 1);
  const onZoomChangeRef = useRef(onZoomChange);
  const rafRef = useRef<number | null>(null);

  const clamped = useMemo(() => {
    const cx = Math.max(-range, Math.min(range, value.x));
    const cy = Math.max(-range, Math.min(range, value.y));
    return { x: cx, y: cy };
  }, [value.x, value.y, range]);

  const dot = useMemo(() => {
    const nx = (clamped.x / range + 1) / 2;
    const ny = (-clamped.y / range + 1) / 2;
    return { nx, ny };
  }, [clamped.x, clamped.y, range]);

  const updateFromEvent = (e: PointerEvent | React.PointerEvent) => {
    const el = padRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const px = (("clientX" in e ? e.clientX : 0) - r.left) / r.width;
    const py = (("clientY" in e ? e.clientY : 0) - r.top) / r.height;

    const cx = (px * 2 - 1) * range;
    const cy = -(py * 2 - 1) * range;

    onChange({
      x: Math.max(-range, Math.min(range, cx)),
      y: Math.max(-range, Math.min(range, cy)),
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    updateFromEvent(e);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    updateFromEvent(e);
  };

  const onPointerUp = () => setDragging(false);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    // Keep internal current value in sync with external state updates,
    // but do not overwrite the target every frame or smoothing collapses.
    currentZoomRef.current = zoom ?? 1;
    if (rafRef.current === null) {
      targetZoomRef.current = zoom ?? 1;
    }
  }, [zoom]);

  const startZoomAnimation = useCallback(() => {
    if (rafRef.current !== null) return;

    const tick = () => {
      const current = currentZoomRef.current;
      const target = targetZoomRef.current;
      const lerpFactor = 0.22;
      const smooth = current + (target - current) * lerpFactor;

      if (Math.abs(target - smooth) < 0.00001) {
        currentZoomRef.current = target;
        onZoomChangeRef.current(target);
        rafRef.current = null;
        return;
      }

      currentZoomRef.current = smooth;
      onZoomChangeRef.current(smooth);
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const el = padRef.current;
      if (!el) return;
      const hovered = el.matches(":hover");
      if (!hovered) return;
      if (!e.ctrlKey) return;

      e.preventDefault();
      e.stopPropagation();

      if (!onZoomChange) return;

      const clamp = (v: number, lo: number, hi: number) =>
        Math.max(lo, Math.min(hi, v));

      const min = minZoom ?? 0.05;
      const max = maxZoom ?? 50;
      const speed = zoomSpeed ?? 0.008;
      const modeScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1;
      const delta = e.deltaY * modeScale;
      const factor = Math.exp(-delta * speed);
      targetZoomRef.current = clamp((targetZoomRef.current ?? zoom ?? 1) * factor, min, max);
      startZoomAnimation();
    };

    window.addEventListener("wheel", handler, { passive: false });
    return () => window.removeEventListener("wheel", handler as any);
  }, [zoom, onZoomChange, minZoom, maxZoom, zoomSpeed]);

  useEffect(() => {
    const onGestureStart = (e: Event) => {
      const ge = e as Event & { scale?: number };
      e.preventDefault();
      e.stopPropagation();
      if (!pointerInsideRef.current) return;
      gestureRef.current = {
        startScale: ge.scale ?? 1,
        startZoom: zoom,
      };
    };

    const onGestureChange = (e: Event) => {
      const ge = e as Event & { scale?: number };
      e.preventDefault();
      e.stopPropagation();
      if (!pointerInsideRef.current || !gestureRef.current) return;
      const startScale = gestureRef.current.startScale || 1;
      const scale = ge.scale ?? startScale;
      const ratio = scale / startScale;
      targetZoomRef.current = clamp(gestureRef.current.startZoom * ratio, minZoom, maxZoom);
      startZoomAnimation();
    };

    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      gestureRef.current = null;
    };

    window.addEventListener("gesturestart", onGestureStart as EventListener, { passive: false, capture: true });
    window.addEventListener("gesturechange", onGestureChange as EventListener, { passive: false, capture: true });
    window.addEventListener("gestureend", onGestureEnd as EventListener, { passive: false, capture: true });

    return () => {
      window.removeEventListener("gesturestart", onGestureStart as EventListener, { capture: true });
      window.removeEventListener("gesturechange", onGestureChange as EventListener, { capture: true });
      window.removeEventListener("gestureend", onGestureEnd as EventListener, { capture: true });
    };
  }, [zoom, minZoom, maxZoom, onZoomChange]);

  const getDist = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    pinchRef.current = {
      dist: getDist(e.touches[0], e.touches[1]),
      startZoom: zoom,
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!pinchRef.current || e.touches.length !== 2) return;
    e.preventDefault();
    const newDist = getDist(e.touches[0], e.touches[1]);
    const ratio = pinchRef.current.dist / newDist;
    targetZoomRef.current = clamp(pinchRef.current.startZoom * ratio, minZoom, maxZoom);
    startZoomAnimation();
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  return (
    <div className="flex items-center gap-3">
      <div
        ref={padRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={() => { pointerInsideRef.current = true; }}
        onPointerLeave={() => { pointerInsideRef.current = false; }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onDoubleClick={onReset}
        className={[
          "relative rounded-xl border border-white/10 bg-black/25",
          "select-none touch-none",
        ].join(" ")}
        style={{ width: size, height: size, touchAction: "none" }}
        title="Drag to pan. Double-click to reset."
      >
        <div className="absolute inset-0 rounded-xl opacity-30">
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
          <div className="absolute top-1/2 left-0 h-px w-full bg-white/20" />
        </div>

        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow"
          style={{
            left: `${dot.nx * 100}%`,
            top: `${dot.ny * 100}%`,
          }}
        />
      </div>

      <button
        type="button"
        onClick={onReset}
        className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs uppercase tracking-widest text-white/80 hover:bg-black/35"
      >
        Reset
      </button>
    </div>
  );
}
