import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Play, Pause, Upload, Save, Disc, Activity } from "lucide-react";
import { colorPalettes, presets, type PresetName } from "@/lib/visualizer-presets";
import { motion } from "framer-motion";

interface UIControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  settings: {
    intensity: number;
    speed: number;
    colorPalette: string[];
    presetName: PresetName;
  };
  setSettings: (s: any) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  onSavePreset: () => void;
}

export function UIControls({
  isPlaying,
  onPlayPause,
  onFileUpload,
  settings,
  setSettings,
  isRecording,
  onToggleRecording,
  onSavePreset,
}: UIControlsProps) {
  
  const currentPaletteName = colorPalettes.find(
    (p) => JSON.stringify(p.colors) === JSON.stringify(settings.colorPalette)
  )?.name || "Custom";

  return (
    <motion.div 
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute top-0 right-0 h-full w-80 p-6 glass-panel z-10 flex flex-col gap-8 overflow-y-auto"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-display text-primary text-glow tracking-widest">
          AURAL<span className="text-foreground">VIS</span>
        </h1>
        <p className="text-xs text-muted-foreground font-mono">
          AUDIO REACTIVE ENGINE V1.0
        </p>
      </div>

      {/* Audio Controls */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={onPlayPause} 
            className="flex-1 bg-primary hover:bg-primary/80 font-bold tracking-wider"
          >
            {isPlaying ? <><Pause className="mr-2 h-4 w-4" /> PAUSE</> : <><Play className="mr-2 h-4 w-4" /> PLAY</>}
          </Button>
          <div className="relative">
            <input
              type="file"
              accept="audio/*"
              onChange={onFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button variant="outline" size="icon" className="border-primary/50 text-primary hover:bg-primary/10">
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Visual Settings */}
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs uppercase tracking-widest text-primary font-bold">Preset</Label>
            <Activity className="w-3 h-3 text-primary/50" />
          </div>
          <Select
            value={settings.presetName}
            onValueChange={(val) => setSettings({ ...settings, presetName: val as PresetName })}
          >
            <SelectTrigger className="bg-black/50 border-white/10 font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border-white/10">
              {presets.map((preset) => (
                <SelectItem key={preset} value={preset} className="font-mono focus:bg-primary/20">
                  {preset}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between">
            <Label className="text-xs uppercase tracking-widest">Intensity</Label>
            <span className="text-xs font-mono text-primary">{settings.intensity.toFixed(1)}</span>
          </div>
          <Slider
            min={0} max={3} step={0.1}
            value={[settings.intensity]}
            onValueChange={([val]) => setSettings({ ...settings, intensity: val })}
            className="[&>.absolute]:bg-primary"
          />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between">
            <Label className="text-xs uppercase tracking-widest">Speed</Label>
            <span className="text-xs font-mono text-secondary">{settings.speed.toFixed(1)}</span>
          </div>
          <Slider
            min={0} max={2} step={0.1}
            value={[settings.speed]}
            onValueChange={([val]) => setSettings({ ...settings, speed: val })}
            className="[&>.absolute]:bg-secondary"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-accent font-bold">Palette</Label>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {colorPalettes.map((palette) => (
              <button
                key={palette.name}
                onClick={() => setSettings({ ...settings, colorPalette: palette.colors })}
                className={`w-full aspect-square rounded-full border-2 transition-all hover:scale-110 ${
                  JSON.stringify(settings.colorPalette) === JSON.stringify(palette.colors)
                    ? "border-white ring-2 ring-primary/50"
                    : "border-transparent opacity-50 hover:opacity-100"
                }`}
                style={{ background: `linear-gradient(135deg, ${palette.colors[0]}, ${palette.colors[1]})` }}
                title={palette.name}
              />
            ))}
          </div>
          <p className="text-[10px] text-right text-muted-foreground pt-1">{currentPaletteName}</p>
        </div>
      </div>

      <div className="mt-auto space-y-3">
        <Button 
          variant="outline" 
          className={`w-full border-destructive/50 hover:bg-destructive/10 text-destructive ${isRecording ? 'animate-pulse bg-destructive/20' : ''}`}
          onClick={onToggleRecording}
        >
          <Disc className={`mr-2 h-4 w-4 ${isRecording ? 'animate-spin' : ''}`} />
          {isRecording ? "STOP RECORDING" : "RECORD SESSION"}
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full text-xs text-muted-foreground hover:text-white"
          onClick={onSavePreset}
        >
          <Save className="mr-2 h-3 w-3" /> Save Preset
        </Button>
      </div>
    </motion.div>
  );
}
