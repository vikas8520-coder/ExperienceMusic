import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Disc, Maximize, Minimize, FolderPlus } from "lucide-react";

interface RecordPanelProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  recordingQuality: "1080p" | "2k" | "4k";
  onRecordingQualityChange?: (quality: "1080p" | "2k" | "4k") => void;
  onSaveToLibrary?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function RecordPanel({
  isRecording,
  onToggleRecording,
  recordingQuality,
  onRecordingQualityChange,
  onSaveToLibrary,
  isFullscreen,
  onToggleFullscreen,
}: RecordPanelProps) {
  return (
    <div className="space-y-5" data-testid="panel-record">
      {/* Quality Selector */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Quality</Label>
        <div className="flex gap-2">
          {(["1080p", "2k", "4k"] as const).map((q) => (
            <Button
              key={q}
              variant={recordingQuality === q ? "default" : "outline"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => onRecordingQualityChange?.(q)}
              data-testid={`button-quality-${q}`}
            >
              {q.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Record + Fullscreen */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onToggleRecording}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isRecording
              ? "bg-destructive/30 border-2 border-destructive animate-pulse"
              : "bg-destructive/20 border-2 border-destructive/50 hover:bg-destructive/30"
          }`}
          data-testid="button-record"
        >
          <Disc className={`w-6 h-6 text-destructive ${isRecording ? 'animate-spin' : ''}`} />
        </button>
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleFullscreen}
          data-testid="button-fullscreen"
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {isRecording ? "Recording... tap to stop" : "Tap to start recording"}
      </p>

      {/* Save */}
      <Button
        variant="outline"
        className="w-full"
        onClick={onSaveToLibrary}
        data-testid="button-save-library"
      >
        <FolderPlus className="mr-2 h-4 w-4" />
        Save to Library
      </Button>
    </div>
  );
}
