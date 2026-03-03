import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Share2, Download, Search, X } from "lucide-react";

interface PresetMarketplaceProps {
  isOpen: boolean;
  onClose: () => void;
  onImportPreset: (settings: any) => void;
}

interface SharedPreset {
  id: number;
  name: string;
  author?: string;
  description?: string;
  tags?: string[];
  thumbnail?: string;
  settings: any;
  shareCode?: string;
  isPublic?: boolean;
}

export function PresetMarketplace({ isOpen, onClose, onImportPreset }: PresetMarketplaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [importCode, setImportCode] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: publicPresets = [] } = useQuery<SharedPreset[]>({
    queryKey: ["public-presets"],
    queryFn: async () => {
      const res = await fetch("/api/presets/public");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen,
  });

  const importByCode = useCallback(async () => {
    if (!importCode.trim()) return;
    try {
      const res = await fetch(`/api/presets/shared/${importCode.trim()}`);
      if (!res.ok) {
        toast({ title: "Preset not found", description: "Check the share code and try again.", variant: "destructive" });
        return;
      }
      const preset = await res.json();
      onImportPreset(preset.settings);
      toast({ title: "Preset imported!", description: `"${preset.name}" has been loaded.` });
      setImportCode("");
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    }
  }, [importCode, onImportPreset, toast]);

  const filtered = publicPresets.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid="preset-marketplace">
      <div className="w-full max-w-2xl max-h-[80vh] bg-background border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">Preset Marketplace</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Import by code */}
        <div className="px-4 py-3 border-b border-border flex gap-2">
          <input
            type="text"
            placeholder="Paste share code..."
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            className="flex-1 bg-muted px-3 py-1.5 rounded text-sm"
            data-testid="import-code-input"
          />
          <button
            onClick={importByCode}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
            data-testid="import-code-button"
          >
            <Download className="w-4 h-4 inline mr-1" />
            Import
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2 bg-muted rounded px-3 py-1.5">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search public presets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-2 text-center text-muted-foreground py-12">
              No public presets available yet. Share your presets to get started!
            </div>
          ) : (
            filtered.map((preset) => (
              <div
                key={preset.id}
                className="border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => {
                  onImportPreset(preset.settings);
                  toast({ title: `Loaded "${preset.name}"` });
                }}
                data-testid={`marketplace-preset-${preset.id}`}
              >
                {preset.thumbnail && (
                  <div className="w-full h-24 rounded mb-2 overflow-hidden bg-muted">
                    <img src={preset.thumbnail} alt={preset.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="font-medium text-sm">{preset.name}</div>
                {preset.author && <div className="text-xs text-muted-foreground">by {preset.author}</div>}
                {preset.tags && preset.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {preset.tags.map((tag) => (
                      <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
