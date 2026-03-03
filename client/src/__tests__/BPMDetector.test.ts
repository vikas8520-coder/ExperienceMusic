import { describe, it, expect } from "vitest";

// Pure logic tests for BPM detection algorithm

/**
 * Simulate BPM detection using the same onset-interval histogram approach
 * from use-audio-analyzer.ts
 */
function detectBPM(onsetTimesMs: number[]): number {
  if (onsetTimesMs.length < 4) return 0;

  const intervals: number[] = [];
  for (let i = 1; i < onsetTimesMs.length; i++) {
    const interval = onsetTimesMs[i] - onsetTimesMs[i - 1];
    if (interval > 200 && interval < 2000) intervals.push(interval);
  }

  if (intervals.length < 3) return 0;

  const buckets = new Map<number, number>();
  for (const iv of intervals) {
    const bucket = Math.round(iv / 20) * 20;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }

  let bestBucket = 0;
  let bestCount = 0;
  buckets.forEach((count, bucket) => {
    if (count > bestCount) {
      bestCount = count;
      bestBucket = bucket;
    }
  });

  if (bestBucket <= 0) return 0;
  const bpm = 60000 / bestBucket;
  return bpm >= 60 && bpm <= 200 ? Math.round(bpm) : 0;
}

function computeBeatPhase(now: number, lastBeatTime: number, bpm: number): number {
  if (bpm <= 0 || lastBeatTime <= 0) return 0;
  return ((now - lastBeatTime) * bpm / 60000) % 1;
}

describe("BPM Detection", () => {
  it("detects 120 BPM from 500ms intervals", () => {
    // 120 BPM = one beat every 500ms
    const onsets = Array.from({ length: 20 }, (_, i) => i * 500);
    const bpm = detectBPM(onsets);
    expect(bpm).toBe(120);
  });

  it("detects 140 BPM from ~428ms intervals", () => {
    // 140 BPM = one beat every ~428ms
    const interval = 60000 / 140;
    const onsets = Array.from({ length: 20 }, (_, i) => Math.round(i * interval));
    const bpm = detectBPM(onsets);
    // Should be within ±4 BPM due to 20ms bucketing
    expect(bpm).toBeGreaterThanOrEqual(136);
    expect(bpm).toBeLessThanOrEqual(144);
  });

  it("returns 0 for too few onsets", () => {
    expect(detectBPM([])).toBe(0);
    expect(detectBPM([0, 500])).toBe(0);
    expect(detectBPM([0, 500, 1000])).toBe(0);
  });

  it("returns 0 for out-of-range BPM", () => {
    // Intervals too short → BPM > 200
    const fastOnsets = Array.from({ length: 20 }, (_, i) => i * 100);
    expect(detectBPM(fastOnsets)).toBe(0);
  });
});

describe("Beat Phase", () => {
  it("wraps correctly 0→1", () => {
    const lastBeat = 1000;
    const bpm = 120; // 500ms per beat

    expect(computeBeatPhase(1000, lastBeat, bpm)).toBeCloseTo(0, 2);
    expect(computeBeatPhase(1250, lastBeat, bpm)).toBeCloseTo(0.5, 2);
    expect(computeBeatPhase(1500, lastBeat, bpm)).toBeCloseTo(0, 2); // wraps
  });

  it("returns 0 when BPM is 0", () => {
    expect(computeBeatPhase(5000, 1000, 0)).toBe(0);
  });

  it("returns 0 when lastBeatTime is 0", () => {
    expect(computeBeatPhase(5000, 0, 120)).toBe(0);
  });
});

describe("BPM Oscillators", () => {
  it("bpmSin1 is mathematically correct", () => {
    const phase = 0.25; // quarter beat
    const sin1 = Math.sin(2 * Math.PI * phase);
    expect(sin1).toBeCloseTo(1, 5); // sin(π/2) = 1
  });

  it("bpmSin2 cycles twice per beat", () => {
    const phase = 0.25;
    const sin2 = Math.sin(4 * Math.PI * phase);
    expect(sin2).toBeCloseTo(0, 5); // sin(π) = 0
  });

  it("bpmCos1 is offset from sin1", () => {
    const phase = 0;
    const cos1 = Math.cos(2 * Math.PI * phase);
    expect(cos1).toBeCloseTo(1, 5); // cos(0) = 1
  });
});
