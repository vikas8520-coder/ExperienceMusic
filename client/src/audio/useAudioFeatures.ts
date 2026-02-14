import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AudioFeatures = {
  rms: number;
  centroid: number;
  onset: number;
  t: number;
};

type Status = "idle" | "starting" | "running" | "error";

export function useAudioFeatures() {
  const [status, setStatus] = useState<Status>("idle");
  const [features, setFeatures] = useState<AudioFeatures>({ rms: 0, centroid: 0, onset: 0, t: 0 });
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const workletUrl = useMemo(() => new URL("./feature-worklet.ts", import.meta.url), []);

  const teardownPipeline = useCallback(async () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (nodeRef.current) {
      nodeRef.current.port.onmessage = null;
      nodeRef.current.disconnect();
      nodeRef.current = null;
    }

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    sourceRef.current?.disconnect();
    sourceRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (ctxRef.current) {
      try {
        await ctxRef.current.close();
      } catch {}
      ctxRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (status === "running" || status === "starting") return;
    let localCtx: AudioContext | null = null;
    let localStream: MediaStream | null = null;
    let localNode: AudioWorkletNode | null = null;
    let localAnalyser: AnalyserNode | null = null;
    let localSource: MediaStreamAudioSourceNode | null = null;
    let localRaf: number | null = null;

    try {
      await teardownPipeline();
      setStatus("starting");
      setError(null);

      if (!window.isSecureContext) {
        throw new Error(
          `Microphone is blocked on insecure pages (${window.location.origin}). Use https:// (or localhost on this device).`
        );
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support microphone capture.");
      }

      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) {
        throw new Error("Web Audio API is not available in this browser.");
      }

      localCtx = new Ctx({ latencyHint: "interactive" });
      await localCtx.resume();

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localSource = localCtx.createMediaStreamSource(localStream);

      let usingWorklet = false;
      if (typeof AudioWorkletNode !== "undefined" && localCtx.audioWorklet?.addModule) {
        try {
          await localCtx.audioWorklet.addModule(workletUrl.href);
          localNode = new AudioWorkletNode(localCtx, "feature-worklet", {
            numberOfInputs: 1,
            numberOfOutputs: 0,
            channelCount: 1,
          });

          localNode.parameters.get("smoothing")?.setValueAtTime(0.85, localCtx.currentTime);
          localNode.parameters.get("gain")?.setValueAtTime(1.0, localCtx.currentTime);
          localNode.port.onmessage = (ev: MessageEvent<AudioFeatures>) => {
            setFeatures(ev.data);
          };
          localSource.connect(localNode);
          usingWorklet = true;
        } catch (workletError) {
          console.warn("AudioWorklet unavailable, falling back to AnalyserNode.", workletError);
        }
      }

      if (!usingWorklet) {
        localAnalyser = localCtx.createAnalyser();
        localAnalyser.fftSize = 1024;
        localAnalyser.smoothingTimeConstant = 0.8;
        localSource.connect(localAnalyser);

        const timeData = new Float32Array(localAnalyser.fftSize);
        const freqData = new Uint8Array(localAnalyser.frequencyBinCount);
        const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
        const smoothing = 0.85;
        let rmsSm = 0;
        let centroidSm = 0;
        let onsetSm = 0;
        let prevRms = 0;

        const tick = () => {
          if (!analyserRef.current || !ctxRef.current) return;

          localAnalyser?.getFloatTimeDomainData(timeData);
          let sumSq = 0;
          for (let i = 0; i < timeData.length; i++) {
            const x = timeData[i];
            sumSq += x * x;
          }
          const rms = Math.sqrt(sumSq / timeData.length);

          localAnalyser?.getByteFrequencyData(freqData);
          let magSum = 0;
          let weighted = 0;
          for (let i = 0; i < freqData.length; i++) {
            const m = freqData[i] / 255;
            magSum += m;
            weighted += i * m;
          }
          const centroid = magSum > 1e-9 ? (weighted / magSum) / freqData.length : 0;
          const onset = clamp01(Math.max(0, rms - prevRms) * 8);
          prevRms = rms;

          rmsSm = smoothing * rmsSm + (1 - smoothing) * rms;
          centroidSm = smoothing * centroidSm + (1 - smoothing) * centroid;
          onsetSm = smoothing * onsetSm + (1 - smoothing) * onset;

          setFeatures({
            rms: rmsSm,
            centroid: centroidSm,
            onset: onsetSm,
            t: ctxRef.current.currentTime,
          });

          localRaf = window.requestAnimationFrame(tick);
          rafRef.current = localRaf;
        };

        localRaf = window.requestAnimationFrame(tick);
        rafRef.current = localRaf;
      }

      sourceRef.current = localSource;
      nodeRef.current = localNode;
      analyserRef.current = localAnalyser;
      streamRef.current = localStream;
      ctxRef.current = localCtx;
      setStatus("running");
    } catch (e: any) {
      if (localRaf !== null) {
        window.cancelAnimationFrame(localRaf);
      }
      try {
        localNode?.port && (localNode.port.onmessage = null);
      } catch {}
      try {
        localNode?.disconnect();
      } catch {}
      try {
        localAnalyser?.disconnect();
      } catch {}
      try {
        localSource?.disconnect();
      } catch {}
      try {
        localStream?.getTracks().forEach((t) => t.stop());
      } catch {}
      if (localCtx) {
        try {
          await localCtx.close();
        } catch {}
      }
      await teardownPipeline();

      const message = e?.message ?? "Failed to start microphone reactivity";
      setStatus("error");
      setError(message);
      throw new Error(message);
    }
  }, [status, teardownPipeline, workletUrl.href]);

  const stop = useCallback(async () => {
    try {
      await teardownPipeline();
    } finally {
      setStatus("idle");
      setError(null);
      setFeatures({ rms: 0, centroid: 0, onset: 0, t: 0 });
    }
  }, [teardownPipeline]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return { status, features, error, start, stop };
}
