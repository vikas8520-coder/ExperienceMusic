import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Variant = "glass" | "neon" | "beacon";

type FloatingEdgeChipProps = {
  onActivate: () => void;
  onDeactivate?: () => void;
  variant?: Variant;
  label?: string;
  side?: "right" | "left";
  edgeThresholdPx?: number;
  y?: number;
  bottomSafeAreaPx?: number;
  topSafeAreaPx?: number;
  fadeMs?: number;
  holdKey?: "Space" | "KeyR";
  holdToOpen?: boolean;
  clickToggles?: boolean;
  isOpen?: boolean;
  forceVisible?: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.tagName === "SELECT") return true;
  if (element.isContentEditable) return true;
  return false;
}

export function FloatingEdgeChip({
  onActivate,
  onDeactivate,
  variant = "glass",
  label = "RADIAL",
  side = "right",
  edgeThresholdPx = 70,
  y = 0.55,
  bottomSafeAreaPx = 110,
  topSafeAreaPx = 84,
  fadeMs = 180,
  holdKey = "Space",
  holdToOpen = true,
  clickToggles = true,
  isOpen,
  forceVisible = false,
}: FloatingEdgeChipProps) {
  const [nearEdge, setNearEdge] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === "undefined" ? 900 : window.innerHeight));
  const [internalOpen, setInternalOpen] = useState(false);

  const open = isOpen ?? internalOpen;
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const setOpen = useCallback(
    (next: boolean) => {
      if (isOpen === undefined) setInternalOpen(next);
    },
    [isOpen],
  );

  const activate = useCallback(() => {
    if (openRef.current) return;
    setOpen(true);
    onActivate();
  }, [onActivate, setOpen]);

  const deactivate = useCallback(() => {
    if (!openRef.current) return;
    setOpen(false);
    onDeactivate?.();
  }, [onDeactivate, setOpen]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const width = window.innerWidth;
      const x = event.clientX;
      const near = side === "right" ? width - x <= edgeThresholdPx : x <= edgeThresholdPx;
      setNearEdge(near);
    };
    const onLeaveWindow = () => setNearEdge(false);
    const onResize = () => setViewportHeight(window.innerHeight);

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeaveWindow);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeaveWindow);
      window.removeEventListener("resize", onResize);
    };
  }, [edgeThresholdPx, side]);

  useEffect(() => {
    if (!holdToOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== holdKey) return;
      if (event.repeat) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      activate();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== holdKey) return;
      deactivate();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [activate, deactivate, holdKey, holdToOpen]);

  const top = useMemo(() => {
    const raw = viewportHeight * y;
    const minTop = topSafeAreaPx + 18;
    const maxTop = viewportHeight - bottomSafeAreaPx - 18;
    return clamp(raw, minTop, Math.max(minTop, maxTop));
  }, [bottomSafeAreaPx, topSafeAreaPx, viewportHeight, y]);

  const visible = forceVisible || nearEdge || open;

  const variantStyles = useMemo(() => {
    if (variant === "neon") {
      return {
        bg: "bg-[linear-gradient(135deg,rgba(217,70,239,0.3),rgba(6,182,212,0.25))]",
        border: "border-fuchsia-300/35",
        glow: "shadow-[0_0_24px_rgba(217,70,239,0.3)]",
      };
    }
    if (variant === "beacon") {
      return {
        bg: "bg-[linear-gradient(135deg,rgba(6,182,212,0.3),rgba(59,130,246,0.22))]",
        border: "border-cyan-200/30",
        glow: "shadow-[0_0_24px_rgba(6,182,212,0.3)]",
      };
    }
    return {
      bg: "bg-black/55",
      border: "border-white/15",
      glow: "shadow-[0_10px_36px_rgba(0,0,0,0.45)]",
    };
  }, [variant]);

  const hiddenShift = side === "right" ? "translateX(55%)" : "translateX(-55%)";
  const shownShift = "translateX(0)";
  const showLabel = hovered || open || nearEdge;

  return (
    <div
      className="pointer-events-none fixed z-[58]"
      style={{
        top,
        right: side === "right" ? 10 : "auto",
        left: side === "left" ? 10 : "auto",
        opacity: visible ? 1 : 0,
        transform: visible ? shownShift : hiddenShift,
        transition: `opacity ${fadeMs}ms ease, transform ${fadeMs}ms ease`,
      }}
    >
      <button
        type="button"
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md transition ${variantStyles.bg} ${variantStyles.border} ${variantStyles.glow}`}
        style={{ flexDirection: side === "left" ? "row-reverse" : "row" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (!clickToggles) return;
          if (openRef.current) deactivate();
          else activate();
        }}
        title={open ? "Close radial" : "Open radial"}
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{
            background: open ? "rgba(52,211,153,0.95)" : "rgba(255,255,255,0.82)",
            boxShadow: open ? "0 0 10px rgba(52,211,153,0.85)" : "0 0 6px rgba(255,255,255,0.65)",
          }}
        />
        <span
          style={{
            maxWidth: showLabel ? 88 : 0,
            opacity: showLabel ? 1 : 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
            transition: "max-width 180ms ease, opacity 180ms ease",
          }}
        >
          {label}
        </span>
      </button>
    </div>
  );
}
