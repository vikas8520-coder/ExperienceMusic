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
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const workletUrl = useMemo(() => new URL("./feature-worklet.ts", import.meta.url), []);

  const start = useCallback(async () => {
    if (status === "running" || status === "starting") return;
    try {
      setStatus("starting");
      setError(null);

      if (!window.isSecureContext) {
        throw new Error("Microphone requires a secure context (https or localhost).");
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support microphone capture.");
      }

      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) {
        throw new Error("Web Audio API is not available in this browser.");
      }

      const ctx = new Ctx({ latencyHint: "interactive" });
      await ctx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      await ctx.audioWorklet.addModule(workletUrl.href);

      const source = ctx.createMediaStreamSource(stream);
      if (typeof AudioWorkletNode === "undefined") {
        throw new Error("AudioWorklet is not supported in this browser.");
      }

      const node = new AudioWorkletNode(ctx, "feature-worklet", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });

      node.parameters.get("smoothing")?.setValueAtTime(0.85, ctx.currentTime);
      node.parameters.get("gain")?.setValueAtTime(1.0, ctx.currentTime);

      node.port.onmessage = (ev: MessageEvent<AudioFeatures>) => {
        setFeatures(ev.data);
      };

      source.connect(node);

      sourceRef.current = source;
      nodeRef.current = node;
      streamRef.current = stream;
      ctxRef.current = ctx;
      setStatus("running");
    } catch (e: any) {
      // Ensure partially initialized resources do not leak on failed start.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      sourceRef.current?.disconnect();
      sourceRef.current = null;
      nodeRef.current?.disconnect();
      nodeRef.current = null;
      if (ctxRef.current) {
        try {
          await ctxRef.current.close();
        } catch {}
        ctxRef.current = null;
      }

      const message = e?.message ?? "Failed to start microphone reactivity";
      setStatus("error");
      setError(message);
      throw new Error(message);
    }
  }, [status, workletUrl.href]);

  const stop = useCallback(async () => {
    try {
      if (nodeRef.current) {
        nodeRef.current.port.onmessage = null;
        nodeRef.current.disconnect();
        nodeRef.current = null;
      }
      sourceRef.current?.disconnect();
      sourceRef.current = null;

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      if (ctxRef.current) {
        await ctxRef.current.close();
        ctxRef.current = null;
      }
    } finally {
      setStatus("idle");
      setFeatures({ rms: 0, centroid: 0, onset: 0, t: 0 });
    }
  }, []);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return { status, features, error, start, stop };
}
