import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type FloatingGlassEdgeChipProps = {
  onOpen: () => void;
  onClose: () => void;
  isOpen?: boolean;
  side?: "right" | "left";
  sideInsetPx?: number;
  label?: string;
  alwaysVisible?: boolean;
  edgeThresholdPx?: number;
  y?: number;
  fixedTopPx?: number;
  bottomSafeAreaPx?: number;
  topSafeAreaPx?: number;
  holdKey?: "Space" | "KeyR";
  clickToggles?: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.tagName === "SELECT") return true;
  return element.isContentEditable;
}

export default function FloatingGlassEdgeChip({
  onOpen,
  onClose,
  isOpen = false,
  side = "right",
  sideInsetPx = 24,
  label = "RADIAL",
  alwaysVisible = false,
  edgeThresholdPx = 70,
  y = 0.55,
  fixedTopPx,
  bottomSafeAreaPx = 110,
  topSafeAreaPx = 84,
  holdKey = "Space",
  clickToggles = true,
}: FloatingGlassEdgeChipProps) {
  const [nearEdge, setNearEdge] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === "undefined" ? 900 : window.innerHeight));

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const near = side === "right" ? window.innerWidth - event.clientX < edgeThresholdPx : event.clientX < edgeThresholdPx;
      setNearEdge(near);
    };

    const onLeave = () => setNearEdge(false);
    const onResize = () => setViewportHeight(window.innerHeight);

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, [edgeThresholdPx, side]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== holdKey) return;
      if (event.repeat) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      onOpen();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== holdKey) return;
      onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [holdKey, onClose, onOpen]);

  const top = useMemo(() => {
    if (typeof fixedTopPx === "number" && Number.isFinite(fixedTopPx)) {
      return fixedTopPx;
    }
    const raw = viewportHeight * y;
    const minTop = topSafeAreaPx;
    const maxTop = viewportHeight - bottomSafeAreaPx;
    return clamp(raw, minTop, Math.max(minTop, maxTop));
  }, [bottomSafeAreaPx, fixedTopPx, topSafeAreaPx, viewportHeight, y]);

  return (
    <AnimatePresence>
      {(alwaysVisible || nearEdge) && !isOpen && (
        <motion.div
          initial={{ opacity: 0, x: side === "right" ? 30 : -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: side === "right" ? 30 : -30 }}
          transition={{ duration: 0.18, ease: [0.2, 0.9, 0.2, 1] }}
          className="fixed z-[58]"
          style={{
            top,
            right: side === "right" ? sideInsetPx : "auto",
            left: side === "left" ? sideInsetPx : "auto",
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            onClick={() => {
              if (!clickToggles) return;
              onOpen();
            }}
            className="flex cursor-pointer items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl shadow-[0_0_25px_rgba(180,120,255,0.15)] transition-all duration-200"
            style={{ flexDirection: side === "left" ? "row-reverse" : "row" }}
            title="Open radial"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 shadow-[0_0_18px_rgba(180,120,255,0.6)]">
              <span aria-hidden className="text-[13px] leading-none text-white">
                ⚡
              </span>
            </div>

            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{
                opacity: hovered ? 1 : 0,
                width: hovered ? "auto" : 0,
              }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden whitespace-nowrap text-sm tracking-wider text-white/80"
            >
              {label}
            </motion.span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
