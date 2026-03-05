declare module "butterchurn" {
  interface ButterchurnVisualizer {
    loadPreset(preset: object, blendTime: number): void;
    setRendererSize(width: number, height: number): void;
    render(): void;
    renderer?: {
      freqArray?: Uint8Array;
      timeArray?: Uint8Array;
    };
  }

  const butterchurn: {
    createVisualizer(
      audioContext: AudioContext,
      canvas: HTMLCanvasElement,
      opts?: { width?: number; height?: number },
    ): ButterchurnVisualizer;
  };

  export default butterchurn;
}

declare module "butterchurn-presets" {
  const butterchurnPresets: {
    getPresets(): Record<string, object>;
  };

  export default butterchurnPresets;
}
