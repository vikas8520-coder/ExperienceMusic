import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useVisualizerStore } from '../stores/visualizerStore';

const SMOOTHING_FACTORS = {
  sub: 0.92,
  bass: 0.88,
  mid: 0.85,
  high: 0.80,
  kick: 0.75,
  energy: 0.85,
};

const BEAT_THRESHOLD = 0.4;
const BEAT_DECAY = 0.95;

export function useAudioAnalysis() {
  const { sound, isPlaying, positionMs, durationMs } = usePlayerStore();
  const { updateAudioBands, audioBands } = useVisualizerStore();
  
  const prevBands = useRef(audioBands);
  const beatHistory = useRef<number[]>([]);
  const lastBeatTime = useRef(0);
  const frameCount = useRef(0);

  const analyzeAudio = useCallback(async () => {
    if (!sound || !isPlaying) {
      updateAudioBands({
        sub: prevBands.current.sub * 0.95,
        bass: prevBands.current.bass * 0.95,
        mid: prevBands.current.mid * 0.95,
        high: prevBands.current.high * 0.95,
        kick: prevBands.current.kick * 0.9,
        energy: prevBands.current.energy * 0.95,
      });
      return;
    }

    try {
      const status = await sound.getStatusAsync();
      
      if (!status.isLoaded) return;

      frameCount.current++;
      const time = Date.now() / 1000;
      const progress = durationMs > 0 ? positionMs / durationMs : 0;

      const baseFreq = 0.5 + progress * 0.5;
      const t1 = Math.sin(time * 2.1 * baseFreq) * 0.5 + 0.5;
      const t2 = Math.sin(time * 3.7 * baseFreq + 0.5) * 0.5 + 0.5;
      const t3 = Math.sin(time * 5.3 * baseFreq + 1.0) * 0.5 + 0.5;
      const t4 = Math.sin(time * 7.1 * baseFreq + 1.5) * 0.5 + 0.5;

      const variation1 = Math.sin(time * 0.3) * 0.15;
      const variation2 = Math.cos(time * 0.5) * 0.1;

      const rawSub = 0.4 + t1 * 0.4 + variation1;
      const rawBass = 0.3 + t2 * 0.5 + Math.abs(Math.sin(time * 1.5)) * 0.2;
      const rawMid = 0.25 + t3 * 0.5 + variation2;
      const rawHigh = 0.2 + t4 * 0.6 + Math.abs(Math.cos(time * 2.3)) * 0.2;

      const currentEnergy = (rawSub + rawBass + rawMid + rawHigh) / 4;
      beatHistory.current.push(currentEnergy);
      if (beatHistory.current.length > 30) {
        beatHistory.current.shift();
      }

      const avgEnergy = beatHistory.current.reduce((a, b) => a + b, 0) / beatHistory.current.length;
      const energyDelta = currentEnergy - avgEnergy;
      
      let kick = prevBands.current.kick * BEAT_DECAY;
      if (energyDelta > BEAT_THRESHOLD && time - lastBeatTime.current > 0.15) {
        kick = Math.min(1, 0.6 + energyDelta);
        lastBeatTime.current = time;
      }

      const smoothedBands = {
        sub: lerp(prevBands.current.sub, clamp(rawSub, 0, 1), 1 - SMOOTHING_FACTORS.sub),
        bass: lerp(prevBands.current.bass, clamp(rawBass, 0, 1), 1 - SMOOTHING_FACTORS.bass),
        mid: lerp(prevBands.current.mid, clamp(rawMid, 0, 1), 1 - SMOOTHING_FACTORS.mid),
        high: lerp(prevBands.current.high, clamp(rawHigh, 0, 1), 1 - SMOOTHING_FACTORS.high),
        kick: clamp(kick, 0, 1),
        energy: lerp(prevBands.current.energy, clamp(currentEnergy, 0, 1), 1 - SMOOTHING_FACTORS.energy),
      };

      prevBands.current = smoothedBands;
      updateAudioBands(smoothedBands);

    } catch (error) {
      console.warn('Audio analysis error:', error);
    }
  }, [sound, isPlaying, positionMs, durationMs, updateAudioBands]);

  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = setInterval(analyzeAudio, 50);
    return () => clearInterval(intervalId);
  }, [isPlaying, analyzeAudio]);

  return audioBands;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
