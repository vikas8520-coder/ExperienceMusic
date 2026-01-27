import { useEffect, useRef, useCallback } from "react";

export interface AudioData {
  bass: number;
  mid: number;
  high: number;
  energy: number;
  frequencyData: Uint8Array;
}

export function useAudioAnalyzer(audioElement: HTMLAudioElement | null, audioSrc: string | null) {
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const lastAudioElementRef = useRef<HTMLAudioElement | null>(null);

  const getAudioData = useCallback((): AudioData => {
    if (!analyzerRef.current || !dataArrayRef.current) {
      return { bass: 0, mid: 0, high: 0, energy: 0, frequencyData: new Uint8Array(0) };
    }

    analyzerRef.current.getByteFrequencyData(dataArrayRef.current);
    const data = dataArrayRef.current;
    const bufferLength = analyzerRef.current.frequencyBinCount;

    // Bass: ~20Hz - 140Hz
    let bassSum = 0;
    for (let i = 1; i < 8; i++) bassSum += data[i] || 0;
    const bass = Math.min((bassSum / 7) / 255, 1);

    // Mid: ~140Hz - 2000Hz
    let midSum = 0;
    for (let i = 8; i < 100; i++) midSum += data[i] || 0;
    const mid = Math.min((midSum / 92) / 255, 1);

    // High: ~2000Hz+
    let highSum = 0;
    let highCount = 0;
    for (let i = 100; i < bufferLength; i++) {
      highSum += data[i] || 0;
      highCount++;
    }
    const high = highCount > 0 ? Math.min((highSum / highCount) / 255, 1) : 0;

    const energy = (bass + mid + high) / 3;
    return { bass, mid, high, energy, frequencyData: data };
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

    // Create new analyzer
    const analyzer = ctx.createAnalyser();
    analyzer.fftSize = 2048;
    analyzer.smoothingTimeConstant = 0.8;
    
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

  return { 
    getAudioData, 
    audioContext: audioContextRef.current, 
    destNode: destNodeRef.current 
  };
}
