import { useEffect, useRef, useCallback } from "react";

export interface AudioData {
  sub: number;      // 20-60Hz - slow heavy motion, global pulse
  bass: number;     // 60-250Hz - bloom, breathing, zoom
  mid: number;      // 250-2000Hz - rotation, shape, density
  high: number;     // 2000-10000Hz - sparkles, glitch, aberration
  energy: number;   // Overall energy
  kick: number;     // Beat/kick detection (peak hold)
  dominantFreq: number;  // Dominant frequency in Hz for cymatics mode selection
  modeIndex: number;     // Quantized mode index (1-8) for resonance snapping
  frequencyData: Uint8Array;
  // BPM & beat-phase tracking
  bpm: number;          // Detected BPM (0 if unknown)
  beatPhase: number;    // Phase within current beat (0→1)
  bpmSin1: number;      // sin(2π * beatPhase)
  bpmSin2: number;      // sin(4π * beatPhase) — half-beat
  bpmSin4: number;      // sin(8π * beatPhase) — quarter-beat
  bpmCos1: number;      // cos(2π * beatPhase)
  bassHits: number;     // Exponential decay bass hit counter
  bassPresence: number; // Smoothed bass energy
}

// Reusable empty buffer — avoids allocating new Uint8Array(0) every frame
const EMPTY_FREQ_DATA = new Uint8Array(0);

// Smooth value with EMA (exponential moving average)
function ema(current: number, previous: number, alpha: number): number {
  return alpha * current + (1 - alpha) * previous;
}

export function useAudioAnalyzer(audioElement: HTMLAudioElement | null, audioSrc: string | null) {
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const lastAudioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Smoothed values for each band with fallback decay
  const smoothedRef = useRef({
    sub: 0, bass: 0, mid: 0, high: 0, kick: 0, lastBass: 0,
    dominantFreq: 200, modeIndex: 1,
    lastUpdateTime: Date.now(),
    // BPM detection state
    onsetTimes: [] as number[],   // Circular buffer of onset timestamps
    bpm: 0,
    lastBeatTime: 0,
    bassHits: 0,
    bassPresence: 0,
  });

  const getAudioData = useCallback((): AudioData => {
    const s = smoothedRef.current;
    const now = Date.now();
    const dt = (now - s.lastUpdateTime) / 1000;
    s.lastUpdateTime = now;
    
    // Decay rate: smoothly reduce values when audio stops (prevents abrupt black/blue screen)
    const decayRate = 0.92;
    
    if (!analyzerRef.current || !dataArrayRef.current) {
      // Decay existing values smoothly instead of snapping to zero
      s.sub = s.sub * decayRate;
      s.bass = s.bass * decayRate;
      s.mid = s.mid * decayRate;
      s.high = s.high * decayRate;
      s.kick = s.kick * decayRate;
      
      // Keep minimum fallback values to prevent shader artifacts
      const minFallback = 0.02;
      
      s.bassHits *= 0.95;
      const beatPhase = s.bpm > 0 && s.lastBeatTime > 0
        ? ((now - s.lastBeatTime) * s.bpm / 60000) % 1
        : 0;
      return {
        sub: Math.max(s.sub, minFallback),
        bass: Math.max(s.bass, minFallback),
        mid: Math.max(s.mid, minFallback),
        high: Math.max(s.high, minFallback),
        energy: Math.max((s.sub + s.bass + s.mid + s.high) * 0.25, minFallback),
        kick: s.kick,
        dominantFreq: s.dominantFreq,
        modeIndex: s.modeIndex,
        frequencyData: EMPTY_FREQ_DATA,
        bpm: s.bpm,
        beatPhase,
        bpmSin1: Math.sin(2 * Math.PI * beatPhase),
        bpmSin2: Math.sin(4 * Math.PI * beatPhase),
        bpmSin4: Math.sin(8 * Math.PI * beatPhase),
        bpmCos1: Math.cos(2 * Math.PI * beatPhase),
        bassHits: s.bassHits,
        bassPresence: Math.max(s.bass, minFallback),
      };
    }

    analyzerRef.current.getByteFrequencyData(dataArrayRef.current);
    const data = dataArrayRef.current;
    const bufferLength = analyzerRef.current.frequencyBinCount;
    
    // Sample rate is typically 44100Hz or 48000Hz
    // With fftSize 2048, we get 1024 bins
    // Each bin = sampleRate / fftSize Hz
    // At 44100Hz: each bin ≈ 21.5Hz
    // Bin index = frequency / (sampleRate / fftSize)
    
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const hzPerBin = sampleRate / 2048;
    
    // Calculate bin indices for each frequency range
    const subEnd = Math.ceil(60 / hzPerBin);      // ~3 bins
    const bassStart = Math.ceil(60 / hzPerBin);   // ~3
    const bassEnd = Math.ceil(250 / hzPerBin);    // ~12
    const midStart = Math.ceil(250 / hzPerBin);   // ~12
    const midEnd = Math.ceil(2000 / hzPerBin);    // ~93
    const highStart = Math.ceil(2000 / hzPerBin); // ~93
    const highEnd = Math.min(Math.ceil(10000 / hzPerBin), bufferLength); // ~465

    // Sub: 20-60Hz - slow, heavy motion
    let subSum = 0;
    for (let i = 1; i < subEnd; i++) subSum += data[i] || 0;
    const subRaw = subEnd > 1 ? (subSum / (subEnd - 1)) / 255 : 0;

    // Bass: 60-250Hz - bloom, breathing
    let bassSum = 0;
    for (let i = bassStart; i < bassEnd; i++) bassSum += data[i] || 0;
    const bassRaw = bassEnd > bassStart ? (bassSum / (bassEnd - bassStart)) / 255 : 0;

    // Mid: 250-2000Hz - rotation, shape
    let midSum = 0;
    for (let i = midStart; i < midEnd; i++) midSum += data[i] || 0;
    const midRaw = midEnd > midStart ? (midSum / (midEnd - midStart)) / 255 : 0;

    // High: 2000-10000Hz - sparkles, glitch
    let highSum = 0;
    for (let i = highStart; i < highEnd; i++) highSum += data[i] || 0;
    const highRaw = highEnd > highStart ? (highSum / (highEnd - highStart)) / 255 : 0;

    // Apply EMA smoothing with different rates per band
    // Sub: very slow (low alpha = more smoothing)
    // Bass: medium
    // Mid: medium-fast
    // High: fast (high alpha = less smoothing for sparkle responsiveness)
    s.sub = ema(subRaw, s.sub, 0.15);
    s.bass = ema(bassRaw, s.bass, 0.35);
    s.mid = ema(midRaw, s.mid, 0.45);
    s.high = ema(highRaw, s.high, 0.6);

    // Kick/beat detection: detect sudden bass increases
    const bassJump = bassRaw - s.lastBass;
    const kickThreshold = 0.15;
    if (bassJump > kickThreshold) {
      s.kick = Math.min(s.kick + bassJump * 2, 1);
      // Record onset for BPM detection
      s.onsetTimes.push(now);
      if (s.onsetTimes.length > 50) s.onsetTimes.shift();
      s.lastBeatTime = now;
      s.bassHits = Math.min(s.bassHits + 1, 10);
      // Compute BPM from onset intervals
      if (s.onsetTimes.length >= 4) {
        const intervals: number[] = [];
        for (let i = 1; i < s.onsetTimes.length; i++) {
          const interval = s.onsetTimes[i] - s.onsetTimes[i - 1];
          if (interval > 200 && interval < 2000) intervals.push(interval);
        }
        if (intervals.length >= 3) {
          // Histogram approach: bucket intervals and find dominant
          const buckets = new Map<number, number>();
          for (const iv of intervals) {
            const bucket = Math.round(iv / 20) * 20; // 20ms buckets
            buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
          }
          let bestBucket = 0, bestCount = 0;
          buckets.forEach((count, bucket) => {
            if (count > bestCount) { bestCount = count; bestBucket = bucket; }
          });
          if (bestBucket > 0) {
            const candidateBpm = 60000 / bestBucket;
            // Only accept reasonable BPMs (60-200)
            if (candidateBpm >= 60 && candidateBpm <= 200) {
              s.bpm = ema(candidateBpm, s.bpm || candidateBpm, 0.15);
            }
          }
        }
      }
    } else {
      s.kick = Math.max(s.kick * 0.85, 0); // Decay
      s.bassHits *= 0.97;
    }
    s.lastBass = bassRaw;
    s.bassPresence = ema(bassRaw, s.bassPresence, 0.2);

    // Energy is weighted average (bass/sub matter more for "feel")
    const energy = s.sub * 0.3 + s.bass * 0.35 + s.mid * 0.2 + s.high * 0.15;

    // Dominant frequency detection for cymatics mode selection
    // Find the strongest peak in the 60-500Hz range (most relevant for resonance patterns)
    const freqRangeStart = Math.ceil(60 / hzPerBin);
    const freqRangeEnd = Math.min(Math.ceil(500 / hzPerBin), bufferLength);
    let maxAmp = 0;
    let maxBin = freqRangeStart;
    for (let i = freqRangeStart; i < freqRangeEnd; i++) {
      if (data[i] > maxAmp) {
        maxAmp = data[i];
        maxBin = i;
      }
    }
    const rawDominantFreq = maxBin * hzPerBin;
    
    // Smooth dominant frequency with slow EMA (prevents jittery mode changes)
    s.dominantFreq = ema(rawDominantFreq, s.dominantFreq, 0.1);
    
    // Quantize to mode index (1-8) based on frequency bands
    // This creates the "resonance snap" effect where patterns lock into stable modes
    let newModeIndex = 1;
    if (s.dominantFreq < 80) newModeIndex = 1;
    else if (s.dominantFreq < 120) newModeIndex = 2;
    else if (s.dominantFreq < 160) newModeIndex = 3;
    else if (s.dominantFreq < 200) newModeIndex = 4;
    else if (s.dominantFreq < 260) newModeIndex = 5;
    else if (s.dominantFreq < 340) newModeIndex = 6;
    else if (s.dominantFreq < 440) newModeIndex = 7;
    else newModeIndex = 8;
    
    // Slowly transition mode index to avoid rapid flipping
    s.modeIndex = Math.round(ema(newModeIndex, s.modeIndex, 0.15));

    // Beat phase calculation
    const beatPhase = s.bpm > 0 && s.lastBeatTime > 0
      ? ((now - s.lastBeatTime) * s.bpm / 60000) % 1
      : 0;

    return {
      sub: Math.min(s.sub, 1),
      bass: Math.min(s.bass, 1),
      mid: Math.min(s.mid, 1),
      high: Math.min(s.high, 1),
      energy: Math.min(energy, 1),
      kick: Math.min(s.kick, 1),
      dominantFreq: s.dominantFreq,
      modeIndex: Math.max(1, Math.min(8, s.modeIndex)),
      frequencyData: data,
      bpm: Math.round(s.bpm),
      beatPhase,
      bpmSin1: Math.sin(2 * Math.PI * beatPhase),
      bpmSin2: Math.sin(4 * Math.PI * beatPhase),
      bpmSin4: Math.sin(8 * Math.PI * beatPhase),
      bpmCos1: Math.cos(2 * Math.PI * beatPhase),
      bassHits: s.bassHits,
      bassPresence: s.bassPresence,
    };
  }, []);

  // Initialize or reconnect audio when element or source changes
  useEffect(() => {
    if (!audioElement || !audioSrc) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

    // Check if we need to create a new connection
    const needsNewSource = audioElement !== lastAudioElementRef.current;
    const needsNewContext = !audioContextRef.current || audioContextRef.current.state === 'closed';

    // Create new context if needed
    if (needsNewContext) {
      audioContextRef.current = new AudioContextClass();
    }

    const ctx = audioContextRef.current!;

    // Create new analyzer with higher FFT for better frequency resolution
    const analyzer = ctx.createAnalyser();
    analyzer.fftSize = 2048;
    analyzer.smoothingTimeConstant = 0.6; // Less smoothing in analyzer, we do our own EMA

    // Disconnect old analyzer if exists
    if (analyzerRef.current) {
      try {
        analyzerRef.current.disconnect();
      } catch (e) {
        // Already disconnected
      }
    }

    analyzerRef.current = analyzer;
    const bufferLength = analyzer.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    try {
      // Only create source if this is a new audio element
      // MediaElementAudioSourceNode can only be created once per element
      if (needsNewSource && !sourceNodeRef.current) {
        const source = ctx.createMediaElementSource(audioElement);
        sourceNodeRef.current = source;
        lastAudioElementRef.current = audioElement;
      }

      // Create new destination for recording
      const dest = ctx.createMediaStreamDestination();
      destNodeRef.current = dest;

      // Connect the audio graph
      if (sourceNodeRef.current) {
        // Disconnect from previous analyzer before reconnecting
        try {
          sourceNodeRef.current.disconnect();
        } catch (e) {
          // Not connected
        }

        sourceNodeRef.current.connect(analyzer);
        analyzer.connect(ctx.destination);
        analyzer.connect(dest);
      }
    } catch (e) {
      console.error("Audio connection error:", e);
    }

    return () => {
      // Disconnect analyzer to prevent orphan nodes accumulating
      try { analyzer.disconnect(); } catch {}
    };
  }, [audioElement, audioSrc]);

  // Resume audio context on user interaction
  useEffect(() => {
    const resumeContext = async () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    };

    document.addEventListener('click', resumeContext);
    document.addEventListener('keydown', resumeContext);

    return () => {
      document.removeEventListener('click', resumeContext);
      document.removeEventListener('keydown', resumeContext);
    };
  }, []);

  // Close AudioContext when hook unmounts to prevent leaked browser audio resources
  useEffect(() => {
    return () => {
      try { analyzerRef.current?.disconnect(); } catch {}
      try { sourceNodeRef.current?.disconnect(); } catch {}
      try { destNodeRef.current?.disconnect(); } catch {}
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    getAudioData,
    audioContext: audioContextRef.current,
    destNode: destNodeRef.current
  };
}
