import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type AccentColor = "violet" | "amber" | "cyan" | "emerald";

const accentStyles: Record<AccentColor, { headerBorder: string; headerText: string; chevronBg: string }> = {
  violet:  { headerBorder: "border-violet-500/20",  headerText: "text-violet-300",  chevronBg: "bg-violet-500/10" },
  amber:   { headerBorder: "border-amber-500/20",   headerText: "text-amber-300",   chevronBg: "bg-amber-500/10" },
  cyan:    { headerBorder: "border-cyan-500/20",     headerText: "text-cyan-300",    chevronBg: "bg-cyan-500/10" },
  emerald: { headerBorder: "border-emerald-500/20",  headerText: "text-emerald-300", chevronBg: "bg-emerald-500/10" },
};

const labelToAccent: Record<string, AccentColor> = {
  Presets: "violet",
  Filters: "amber",
  Overlays: "cyan",
  Artwork: "emerald",
};

interface SlideTrayProps {
  label: string;
  position: number;
  topOffset: number;
  availableHeight: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onToggle?: (position: number, open: boolean) => void;
  accentColor?: AccentColor;
  toggleChecked?: boolean;
  onToggleChange?: (checked: boolean) => void;
}

export function SlideTray({
  label,
  position,
  topOffset,
  availableHeight,
  children,
  defaultOpen = false,
  onToggle,
  accentColor,
  toggleChecked,
  onToggleChange,
}: SlideTrayProps) {
  const accent = accentStyles[accentColor ?? labelToAccent[label] ?? "violet"];
  const [open, setOpen] = useState(defaultOpen);
  const [showChevron, setShowChevron] = useState(false);
  const [width, setWidth] = useState(200);
  const hoverTimerRef = useRef<number | null>(null);
  const dragRef = useRef({ active: false, startX: 0, startWidth: 200 });

  const MIN_WIDTH = 160;
  const MAX_WIDTH = 360;

  const handleHoverZoneEnter = useCallback(() => {
    if (open) return;
    hoverTimerRef.current = window.setTimeout(() => {
      setShowChevron(true);
    }, 150);
  }, [open]);

  const handleHoverZoneLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowChevron(false);
  }, []);

  const handleChevronClick = useCallback(() => {
    setOpen(true);
    setShowChevron(false);
    onToggle?.(position, true);
  }, [onToggle, position]);

  const handleClose = useCallback(() => {
    setOpen(false);
    onToggle?.(position, false);
  }, [onToggle, position]);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { active: true, startX: e.clientX, startWidth: width };
    },
    [width],
  );

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    // Dragging left = larger width (tray anchored to right edge)
    const delta = dragRef.current.startX - e.clientX;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startWidth + delta));
    setWidth(newWidth);
  }, []);

  const handleResizePointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  return (
    <>
      {/* Hover zone on right edge when collapsed */}
      {!open && (
        <div
          className="fixed z-40"
          style={{
            top: topOffset,
            right: 0,
            width: 40,
            height: 40,
            pointerEvents: "auto",
          }}
          onMouseEnter={handleHoverZoneEnter}
          onMouseLeave={handleHoverZoneLeave}
          data-testid={`tray-hover-${label.toLowerCase()}`}
        >
          <AnimatePresence>
            {showChevron && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.15 }}
                onClick={handleChevronClick}
                className={`absolute top-1/2 -translate-y-1/2 right-1 flex items-center gap-1 px-2 py-1.5 rounded-l-lg ${accent.chevronBg} backdrop-blur-md border border-white/[0.08] border-r-0 ${accent.headerText} hover:text-white hover:bg-white/10 transition-colors text-xs whitespace-nowrap`}
                style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06)" }}
                data-testid={`tray-chevron-${label.toLowerCase()}`}
              >
                <ChevronLeft className="w-3 h-3" />
                {label}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tray panel — slides in from right */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: width + 20 }}
            animate={{ x: 0 }}
            exit={{ x: width + 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed z-40 backdrop-blur-xl border border-white/[0.08] border-r-0 rounded-l-xl overflow-hidden flex flex-col"
            style={{
              top: topOffset,
              right: 0,
              width,
              maxHeight: availableHeight,
              pointerEvents: "auto",
              background: "rgba(255,255,255,0.04)",
              boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            data-testid={`tray-${label.toLowerCase()}`}
            data-ui-root="true"
          >
            {/* Resize handle — left edge */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-50 hover:bg-white/[0.12] transition-colors"
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              data-testid={`tray-resize-${label.toLowerCase()}`}
            />

            {/* Header */}
            <div className={`flex items-center justify-between px-3 py-1.5 border-b ${accent.headerBorder} shrink-0`}>
              <span className={`text-sm font-bold tracking-wide ${accent.headerText}`}>{label}</span>
              {onToggleChange != null && (
                <Switch
                  checked={toggleChecked}
                  onCheckedChange={onToggleChange}
                  className="h-4 w-7 data-[state=checked]:bg-violet-500 data-[state=unchecked]:bg-white/10 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
                  data-testid={`tray-toggle-${label.toLowerCase()}`}
                />
              )}
              <button
                onClick={handleClose}
                className="text-white/40 hover:text-white transition-colors"
                data-testid={`tray-close-${label.toLowerCase()}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
