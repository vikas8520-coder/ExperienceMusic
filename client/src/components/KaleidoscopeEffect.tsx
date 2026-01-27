import { Effect, BlendFunction } from "postprocessing";
import { forwardRef, useEffect, useMemo, useImperativeHandle, useRef } from "react";
import { Uniform } from "three";

const fragmentShader = /* glsl */ `
  uniform float sides;
  uniform float angle;
  uniform float intensity;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 p = uv * 2.0 - 1.0;
    float a = atan(p.y, p.x) + angle;
    float r = length(p);

    float tau = 6.28318530718;
    float sector = tau / max(1.0, sides);

    a = mod(a, sector);
    a = abs(a - sector * 0.5);

    vec2 kp = r * vec2(cos(a), sin(a));
    vec2 kuv = (kp + 1.0) * 0.5;

    vec3 col = mix(inputColor.rgb, texture2D(inputBuffer, kuv).rgb, intensity);
    outputColor = vec4(col, inputColor.a);
  }
`;

class KaleidoscopeEffectImpl extends Effect {
  constructor({
    sides = 8,
    angle = 0,
    intensity = 0.6,
  }: {
    sides?: number;
    angle?: number;
    intensity?: number;
  } = {}) {
    super("KaleidoscopeEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["sides", new Uniform(sides)],
        ["angle", new Uniform(angle)],
        ["intensity", new Uniform(intensity)],
      ]),
    });
  }

  get sides() {
    return (this.uniforms.get("sides") as Uniform).value;
  }
  set sides(v: number) {
    (this.uniforms.get("sides") as Uniform).value = v;
  }
  get angle() {
    return (this.uniforms.get("angle") as Uniform).value;
  }
  set angle(v: number) {
    (this.uniforms.get("angle") as Uniform).value = v;
  }
  get intensity() {
    return (this.uniforms.get("intensity") as Uniform).value;
  }
  set intensity(v: number) {
    (this.uniforms.get("intensity") as Uniform).value = v;
  }
}

type Props = {
  enabled?: boolean;
  sides?: number;
  angle?: number;
  intensity?: number;
};

export const Kaleidoscope = forwardRef<KaleidoscopeEffectImpl | null, Props>(
  function Kaleidoscope({ enabled = true, sides = 8, angle = 0, intensity = 0.6 }, ref) {
    const effectRef = useRef<KaleidoscopeEffectImpl | null>(null);

    const effect = useMemo(() => {
      return new KaleidoscopeEffectImpl({ sides, angle, intensity });
    }, []);

    useEffect(() => {
      effectRef.current = effect;
      return () => {
        effect.dispose();
      };
    }, [effect]);

    useEffect(() => {
      if (effectRef.current) {
        effectRef.current.sides = sides;
        effectRef.current.angle = angle;
        effectRef.current.intensity = enabled ? intensity : 0;
      }
    }, [sides, angle, intensity, enabled]);

    useImperativeHandle(ref, () => effectRef.current as KaleidoscopeEffectImpl, [effect]);

    if (!enabled) return null;

    return <primitive object={effect} />;
  }
);
