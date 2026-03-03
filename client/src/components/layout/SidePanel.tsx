import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { PanelId } from "./IconRail";

const panelTitles: Record<PanelId, string> = {
  presets: "Presets",
  colors: "Colors",
  effects: "Effects",
  perform: "Perform",
  audio: "Audio",
  record: "Record",
  library: "Library",
};

interface SidePanelProps {
  activePanel: PanelId | null;
  onClose: () => void;
  children: React.ReactNode;
}

export function SidePanel({ activePanel, onClose, children }: SidePanelProps) {
  return (
    <AnimatePresence>
      {activePanel && (
        <motion.div
          key={activePanel}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="fixed right-16 top-16 bottom-16 w-[300px] z-[45] glass-panel rounded-xl settings-panel overflow-hidden flex flex-col"
          data-testid="side-panel"
          data-ui-root="true"
          style={{ pointerEvents: "auto" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <h3 className="text-sm font-bold font-display uppercase tracking-widest text-white">
              {panelTitles[activePanel]}
            </h3>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white transition-colors"
              data-testid="side-panel-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
