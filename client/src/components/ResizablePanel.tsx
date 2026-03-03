import React, { useEffect, useRef, useState } from "react";

type Size = { w: number; h: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type ResizablePanelProps = {
  children: React.ReactNode;
  defaultSize?: Size;
  storageKey?: string;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
  contentClassName?: string;
};

export function ResizablePanel({
  children,
  defaultSize = { w: 420, h: 720 },
  storageKey = "fractalSettingsPanelSize_v1",
  minWidth = 340,
  minHeight = 420,
  maxWidth = 900,
  maxHeight = 900,
  className = "",
  contentClassName = "",
}: ResizablePanelProps) {
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const [size, setSize] = useState<Size>(() => {
    if (typeof window === "undefined") return defaultSize;
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : defaultSize;
    } catch {
      return defaultSize;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(size));
    } catch {
      // ignore storage failures
    }
  }, [size, storageKey]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = true;
    startRef.current = { x: event.clientX, y: event.clientY, w: size.w, h: size.h };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    event.stopPropagation();

    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;

    const viewportW = typeof window === "undefined" ? maxWidth : window.innerWidth;
    const viewportH = typeof window === "undefined" ? maxHeight : window.innerHeight;

    const maxW = Math.min(maxWidth, Math.max(minWidth, viewportW - 24));
    const maxH = Math.min(maxHeight, Math.max(minHeight, viewportH - 24));

    setSize({
      w: clamp(startRef.current.w + dx, minWidth, maxW),
      h: clamp(startRef.current.h + dy, minHeight, maxH),
    });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore release failures
    }
  };

  return (
    <div
      data-radial-node="true"
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-xl ${className}`}
      style={{ width: size.w, height: size.h }}
    >
      <div className={`h-full w-full overflow-auto ${contentClassName}`}>{children}</div>

      <div
        role="separator"
        aria-label="Resize panel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="absolute bottom-2 right-2 z-[130] flex h-6 w-6 cursor-nwse-resize items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
        title="Drag to resize"
        style={{ touchAction: "none", pointerEvents: "auto" }}
      >
        <div className="h-3 w-3 border-b border-r border-white/70 opacity-70" />
      </div>
    </div>
  );
}
