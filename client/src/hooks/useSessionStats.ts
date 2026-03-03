import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioData } from "@/hooks/use-audio-analyzer";
import { useToast } from "@/hooks/use-toast";

export interface SessionStatsData {
  listenTime: number;        // seconds of active playback
  presetsExplored: string[]; // unique preset names used
  tracksPlayed: number;      // count of tracks played
  peakEnergy: number;        // highest energy value seen
  bpmRange: [number, number]; // [min, max] BPM detected
  sessionDate: string;       // ISO date string
}

const STORAGE_KEY = "experiencemusic-session-stats";

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function loadStats(): SessionStatsData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.sessionDate === getToday()) return parsed;
    }
  } catch {}
  return {
    listenTime: 0,
    presetsExplored: [],
    tracksPlayed: 0,
    peakEnergy: 0,
    bpmRange: [0, 0],
    sessionDate: getToday(),
  };
}

export function useSessionStats(
  isPlaying: boolean,
  presetName: string,
  getAudioData?: () => AudioData,
) {
  const [stats, setStats] = useState<SessionStatsData>(loadStats);
  const intervalRef = useRef<number | null>(null);
  const { toast } = useToast();
  const milestonesRef = useRef<Set<string>>(new Set());

  // Track listen time
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setStats((prev) => {
          const next = { ...prev, listenTime: prev.listenTime + 1 };

          // Update audio-based stats
          if (getAudioData) {
            const data = getAudioData();
            if (data.energy > next.peakEnergy) {
              next.peakEnergy = data.energy;
            }
            if (data.bpm > 0) {
              const [minBpm, maxBpm] = next.bpmRange;
              next.bpmRange = [
                minBpm === 0 ? data.bpm : Math.min(minBpm, data.bpm),
                Math.max(maxBpm, data.bpm),
              ];
            }
          }

          return next;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, getAudioData]);

  // Track presets explored
  useEffect(() => {
    if (presetName) {
      setStats((prev) => {
        if (prev.presetsExplored.includes(presetName)) return prev;
        return { ...prev, presetsExplored: [...prev.presetsExplored, presetName] };
      });
    }
  }, [presetName]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {}
  }, [stats]);

  // Milestone toasts
  useEffect(() => {
    const checkMilestone = (key: string, message: string) => {
      if (!milestonesRef.current.has(key)) {
        milestonesRef.current.add(key);
        toast({ title: message });
      }
    };

    if (stats.presetsExplored.length >= 10) {
      checkMilestone("10presets", "10 presets explored!");
    }
    if (stats.presetsExplored.length >= 5) {
      checkMilestone("5presets", "5 presets explored!");
    }
    if (stats.listenTime >= 3600) {
      checkMilestone("1hour", "1 hour of visuals!");
    }
    if (stats.listenTime >= 1800) {
      checkMilestone("30min", "30 minutes of visuals!");
    }
    if (stats.listenTime >= 600) {
      checkMilestone("10min", "10 minutes of visuals!");
    }
  }, [stats.presetsExplored.length, stats.listenTime, toast]);

  const incrementTracksPlayed = useCallback(() => {
    setStats((prev) => ({ ...prev, tracksPlayed: prev.tracksPlayed + 1 }));
  }, []);

  return { stats, incrementTracksPlayed };
}
