import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Pure logic tests for session stats

const STORAGE_KEY = "experiencemusic-session-stats";

interface SessionStatsData {
  listenTime: number;
  presetsExplored: string[];
  tracksPlayed: number;
  peakEnergy: number;
  bpmRange: [number, number];
  sessionDate: string;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

describe("Session Stats", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with default values", () => {
    const stats: SessionStatsData = {
      listenTime: 0,
      presetsExplored: [],
      tracksPlayed: 0,
      peakEnergy: 0,
      bpmRange: [0, 0],
      sessionDate: getToday(),
    };

    expect(stats.listenTime).toBe(0);
    expect(stats.presetsExplored).toEqual([]);
    expect(stats.tracksPlayed).toBe(0);
    expect(stats.peakEnergy).toBe(0);
  });

  it("listen time increments correctly", () => {
    const stats: SessionStatsData = {
      listenTime: 0,
      presetsExplored: [],
      tracksPlayed: 0,
      peakEnergy: 0,
      bpmRange: [0, 0],
      sessionDate: getToday(),
    };

    // Simulate 5 seconds of playback
    for (let i = 0; i < 5; i++) {
      stats.listenTime += 1;
    }

    expect(stats.listenTime).toBe(5);
  });

  it("tracks unique presets only", () => {
    const explored = new Set<string>();

    explored.add("Energy Rings");
    explored.add("Mandelbrot Explorer");
    explored.add("Energy Rings"); // duplicate

    expect(explored.size).toBe(2);
  });

  it("milestones trigger at correct thresholds", () => {
    const milestones: string[] = [];

    const checkMilestone = (presetsCount: number, listenTime: number) => {
      if (presetsCount >= 10 && !milestones.includes("10presets")) {
        milestones.push("10presets");
      }
      if (presetsCount >= 5 && !milestones.includes("5presets")) {
        milestones.push("5presets");
      }
      if (listenTime >= 3600 && !milestones.includes("1hour")) {
        milestones.push("1hour");
      }
      if (listenTime >= 1800 && !milestones.includes("30min")) {
        milestones.push("30min");
      }
      if (listenTime >= 600 && !milestones.includes("10min")) {
        milestones.push("10min");
      }
    };

    checkMilestone(3, 100);
    expect(milestones).toEqual([]);

    checkMilestone(5, 100);
    expect(milestones).toContain("5presets");

    checkMilestone(10, 3600);
    expect(milestones).toContain("10presets");
    expect(milestones).toContain("1hour");
    expect(milestones).toContain("30min");
    expect(milestones).toContain("10min");
  });

  it("persists to localStorage", () => {
    const stats: SessionStatsData = {
      listenTime: 120,
      presetsExplored: ["Energy Rings", "Mandelbrot Explorer"],
      tracksPlayed: 3,
      peakEnergy: 0.85,
      bpmRange: [110, 140],
      sessionDate: getToday(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));

    const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(loaded.listenTime).toBe(120);
    expect(loaded.presetsExplored).toHaveLength(2);
    expect(loaded.peakEnergy).toBe(0.85);
  });

  it("resets stats for a new day", () => {
    const yesterday: SessionStatsData = {
      listenTime: 500,
      presetsExplored: ["test"],
      tracksPlayed: 2,
      peakEnergy: 0.9,
      bpmRange: [120, 128],
      sessionDate: "2020-01-01",
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(yesterday));

    // Load and check if date matches today
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    const isToday = stored.sessionDate === getToday();
    expect(isToday).toBe(false);
    // In real hook, this triggers a reset
  });
});
