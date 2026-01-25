import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

export interface AudioData {
  bass: number; // 0-1
  mid: number;  // 0-1
  high: number; // 0-1
  energy: number; // 0-1
  frequencyData: Uint8Array;
}

export function useAudioAnalyzer(audioSource: HTMLAudioElement | null) {
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Store data in a ref for loop performance, but also expose a way to get it
  const getAudioData = useCallback((): AudioData => {
    if (!analyzerRef.current || !dataArrayRef.current) {
      return { bass: 0, mid: 0, high: 0, energy: 0, frequencyData: new Uint8Array(0) };
    }

    analyzerRef.current.getByteFrequencyData(dataArrayRef.current);
    const data = dataArrayRef.current;
    const bufferLength = analyzerRef.current.frequencyBinCount;

    // Calculate bands (Approximate ranges for 44.1kHz sample rate, FFT 2048)
    // 0-20kHz range roughly distributed
    
    // Bass: ~20Hz - 140Hz (Indices approx 1-7)
    let bassSum = 0;
    const bassCount = 7;
    for (let i = 1; i < 8; i++) bassSum += data[i] || 0;
    const bass = Math.min((bassSum / bassCount) / 255, 1);

    // Mid: ~140Hz - 2000Hz (Indices approx 8-100)
    let midSum = 0;
    const midCount = 92;
    for (let i = 8; i < 100; i++) midSum += data[i] || 0;
    const mid = Math.min((midSum / midCount) / 255, 1);

    // High: ~2000Hz+ (Indices 100+)
    let highSum = 0;
    let highCount = 0;
    for (let i = 100; i < bufferLength; i++) {
      highSum += data[i] || 0;
      highCount++;
    }
    const high = Math.min((highSum / highCount) / 255, 1);

    // Overall Energy
    const energy = (bass + mid + high) / 3;

    return { bass, mid, high, energy, frequencyData: data };
  }, []);

  useEffect(() => {
    if (!audioSource) return;

    // Initialize Audio Context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const analyzer = ctx.createAnalyser();
    analyzer.fftSize = 2048;
    analyzer.smoothingTimeConstant = 0.8;
    analyzerRef.current = analyzer;

    const bufferLength = analyzer.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    // Create Source
    try {
      const source = ctx.createMediaElementSource(audioSource);
      sourceNodeRef.current = source;
      
      // Destination for recording (optional usage later)
      const dest = ctx.createMediaStreamDestination();
      destNodeRef.current = dest;

      source.connect(analyzer);
      analyzer.connect(ctx.destination);
      analyzer.connect(dest);
    } catch (e) {
      console.error("Error connecting audio nodes:", e);
    }

    return () => {
      // Cleanup
      if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
      if (analyzerRef.current) analyzerRef.current.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [audioSource]);

  return { getAudioData, audioContext: audioContextRef.current, destNode: destNodeRef.current };
}
