import { useCallback } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { presets, presetCategories, type PresetName } from "@/lib/visualizer-presets";
import { Music, Play, Pause, Save, Eye, EyeOff, Library, Monitor, Layers, ExternalLink } from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPreset: (presetName: PresetName) => void;
  onTogglePlay?: () => void;
  onSavePreset?: () => void;
  onToggleTrails?: () => void;
  onToggleDarkOverlay?: () => void;
  onToggleLibrary?: () => void;
  isPlaying?: boolean;
  trailsOn?: boolean;
  darkOverlay?: boolean;
  layoutMode?: "zen" | "command";
  onSwitchMode?: () => void;
  isProjecting?: boolean;
  onToggleProjection?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onSelectPreset,
  onTogglePlay,
  onSavePreset,
  onToggleTrails,
  onToggleDarkOverlay,
  onToggleLibrary,
  isPlaying,
  trailsOn,
  darkOverlay,
  layoutMode,
  onSwitchMode,
  isProjecting,
  onToggleProjection,
}: CommandPaletteProps) {
  const handleSelect = useCallback(
    (value: string) => {
      onOpenChange(false);
      // Check if it's a preset name
      if (presets.includes(value as any)) {
        onSelectPreset(value as PresetName);
        return;
      }
      // Handle actions
      switch (value) {
        case "action:play-pause":
          onTogglePlay?.();
          break;
        case "action:save-preset":
          onSavePreset?.();
          break;
        case "action:toggle-trails":
          onToggleTrails?.();
          break;
        case "action:toggle-dark-overlay":
          onToggleDarkOverlay?.();
          break;
        case "action:library":
          onToggleLibrary?.();
          break;
        case "action:switch-mode":
          onSwitchMode?.();
          break;
        case "action:toggle-projection":
          onToggleProjection?.();
          break;
      }
    },
    [onOpenChange, onSelectPreset, onTogglePlay, onSavePreset, onToggleTrails, onToggleDarkOverlay, onToggleLibrary, onSwitchMode, onToggleProjection],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search presets, actions..." data-testid="command-palette-input" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem value="action:play-pause" onSelect={handleSelect}>
            {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {isPlaying ? "Pause" : "Play"}
            <CommandShortcut>Space</CommandShortcut>
          </CommandItem>
          <CommandItem value="action:save-preset" onSelect={handleSelect}>
            <Save className="mr-2 h-4 w-4" />
            Save Preset
          </CommandItem>
          <CommandItem value="action:toggle-trails" onSelect={handleSelect}>
            {trailsOn ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {trailsOn ? "Disable Trails" : "Enable Trails"}
          </CommandItem>
          <CommandItem value="action:toggle-dark-overlay" onSelect={handleSelect}>
            {darkOverlay ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {darkOverlay ? "Disable Dark Overlay" : "Enable Dark Overlay"}
          </CommandItem>
          <CommandItem value="action:library" onSelect={handleSelect}>
            <Library className="mr-2 h-4 w-4" />
            Toggle Library
          </CommandItem>
          <CommandItem value="action:switch-mode" onSelect={handleSelect}>
            {layoutMode === "zen" ? (
              <Layers className="mr-2 h-4 w-4" />
            ) : (
              <Monitor className="mr-2 h-4 w-4" />
            )}
            {layoutMode === "zen" ? "Switch to Command Center" : "Switch to Zen Mode"}
            <CommandShortcut>Ctrl+Shift+L</CommandShortcut>
          </CommandItem>
          <CommandItem value="action:toggle-projection" onSelect={handleSelect}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {isProjecting ? "Stop Projection" : "Start Projection"}
            <CommandShortcut>P</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {presetCategories.map((cat) => (
          <CommandGroup key={cat.name} heading={cat.name}>
            {cat.presets.map((p) => (
              <CommandItem key={p.name} value={p.name} onSelect={handleSelect}>
                <Music className="mr-2 h-4 w-4" />
                {p.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
