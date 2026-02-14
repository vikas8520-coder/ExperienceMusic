// @ts-nocheck
// client/src/audio/feature-worklet.ts
// AudioWorkletProcessor computes lightweight live features for mic reactivity.

class FeatureWorkletProcessor extends AudioWorkletProcessor {
  private prevMag: Float32Array | null = null;
  private rmsSm = 0;
  private centroidSm = 0;
  private onsetSm = 0;

  static get parameterDescriptors() {
    return [
      { name: "smoothing", defaultValue: 0.85, minValue: 0.0, maxValue: 0.99 },
      { name: "gain", defaultValue: 1.0, minValue: 0.0, maxValue: 8.0 },
    ];
  }

  private hann(n: number, N: number) {
    return 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
  }

  private fftReal(input: Float32Array): { re: Float32Array; im: Float32Array } {
    const N = input.length;
    const re = new Float32Array(N);
    const im = new Float32Array(N);

    for (let i = 0; i < N; i++) re[i] = input[i] * this.hann(i, N);

    let j = 0;
    for (let i = 0; i < N; i++) {
      if (i < j) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
      }
      let m = N >> 1;
      while (j >= m && m >= 2) {
        j -= m;
        m >>= 1;
      }
      j += m;
    }

    for (let len = 2; len <= N; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wlenRe = Math.cos(ang);
      const wlenIm = Math.sin(ang);
      for (let i = 0; i < N; i += len) {
        let wRe = 1;
        let wIm = 0;
        for (let k = 0; k < len / 2; k++) {
          const uRe = re[i + k];
          const uIm = im[i + k];
          const vRe = re[i + k + len / 2] * wRe - im[i + k + len / 2] * wIm;
          const vIm = re[i + k + len / 2] * wIm + im[i + k + len / 2] * wRe;

          re[i + k] = uRe + vRe;
          im[i + k] = uIm + vIm;
          re[i + k + len / 2] = uRe - vRe;
          im[i + k + len / 2] = uIm - vIm;

          const nextWRe = wRe * wlenRe - wIm * wlenIm;
          const nextWIm = wRe * wlenIm + wIm * wlenRe;
          wRe = nextWRe;
          wIm = nextWIm;
        }
      }
    }

    return { re, im };
  }

  process(inputs: Float32Array[][], _outputs: Float32Array[][], parameters: Record<string, Float32Array>) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const ch0 = input[0];
    const smoothing = parameters.smoothing[0] ?? 0.85;
    const gain = parameters.gain[0] ?? 1.0;

    let sumSq = 0;
    for (let i = 0; i < ch0.length; i++) {
      const x = ch0[i] * gain;
      sumSq += x * x;
    }
    const rms = Math.sqrt(sumSq / ch0.length);

    const N = ch0.length;
    const { re, im } = this.fftReal(ch0);
    const bins = N >> 1;
    const mag = new Float32Array(bins);

    let magSum = 0;
    let weighted = 0;
    for (let i = 0; i < bins; i++) {
      const m = Math.hypot(re[i], im[i]);
      mag[i] = m;
      magSum += m;
      weighted += i * m;
    }

    const centroid = magSum > 1e-9 ? (weighted / magSum) / bins : 0;

    let flux = 0;
    if (this.prevMag) {
      for (let i = 0; i < bins; i++) {
        const d = mag[i] - this.prevMag[i];
        if (d > 0) flux += d;
      }
      flux = flux / (magSum + 1e-9);
    }
    this.prevMag = mag;

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    this.rmsSm = smoothing * this.rmsSm + (1 - smoothing) * rms;
    this.centroidSm = smoothing * this.centroidSm + (1 - smoothing) * centroid;
    this.onsetSm = smoothing * this.onsetSm + (1 - smoothing) * clamp01(flux * 6);

    if ((currentFrame & 0x3) === 0) {
      this.port.postMessage({
        rms: this.rmsSm,
        centroid: this.centroidSm,
        onset: this.onsetSm,
        t: currentTime,
      });
    }

    return true;
  }
}

registerProcessor("feature-worklet", FeatureWorkletProcessor);

