type RecorderOptions = {
  fps?: number;
  // 4K-ish target bitrate default
  videoBitsPerSecond?: number;
  // Try VP9 first, fallback automatically
  mimeType?: string;
  // Optional audio track to merge into the captured stream
  audioTrack?: MediaStreamTrack;
};

type RecorderController = {
  start: () => Promise<void>;
  stop: () => Promise<Blob>;
  download: (filename?: string) => Promise<void>;
  isRecording: () => boolean;
};

export function createCanvasRecorder(
  canvas: HTMLCanvasElement,
  opts: RecorderOptions = {}
): RecorderController {
  const fps = opts.fps ?? 60;
  const targetBitrate = opts.videoBitsPerSecond ?? 50_000_000;

  const preferredTypes = [
    opts.mimeType,
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ].filter(Boolean) as string[];

  const mimeType =
    preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ??
    "video/webm";

  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let stream: MediaStream | null = null;
  let recording = false;
  let stopPromiseResolve: ((b: Blob) => void) | null = null;
  let stopPromiseReject: ((e: unknown) => void) | null = null;

  const pickBitrate = (requested: number) => {
    // Progressive fallback if browser rejects high bitrate.
    // 50M -> 35M -> 20M -> undefined (browser default)
    const ladder = [requested, 35_000_000, 20_000_000];
    return ladder;
  };

  const cleanupStream = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  const start = async () => {
    if (recording) return;

    stream = canvas.captureStream(fps);
    if (opts.audioTrack) {
      stream.addTrack(opts.audioTrack);
    }
    chunks = [];

    let lastError: unknown = null;
    const bitrates = pickBitrate(targetBitrate);

    for (const bps of [...bitrates, undefined]) {
      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          ...(bps ? { videoBitsPerSecond: bps } : {}),
        });
        break;
      } catch (e) {
        lastError = e;
      }
    }

    if (!mediaRecorder) {
      cleanupStream();
      throw lastError ?? new Error("Failed to create MediaRecorder");
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onerror = () => {
      recording = false;
      cleanupStream();
      stopPromiseReject?.(new Error("MediaRecorder error"));
      stopPromiseResolve = null;
      stopPromiseReject = null;
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      stopPromiseResolve?.(blob);
      stopPromiseResolve = null;
      stopPromiseReject = null;
      recording = false;
      cleanupStream();
    };

    mediaRecorder.start(100); // gather chunks every 100ms
    recording = true;
  };

  const stop = async () => {
    if (!mediaRecorder || !recording) {
      throw new Error("Recorder is not running");
    }

    return new Promise<Blob>((resolve, reject) => {
      stopPromiseResolve = resolve;
      stopPromiseReject = reject;
      mediaRecorder!.stop();
    });
  };

  const download = async (filename = `recording-${Date.now()}.webm`) => {
    const blob = await stop();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    start,
    stop,
    download,
    isRecording: () => recording,
  };
}
