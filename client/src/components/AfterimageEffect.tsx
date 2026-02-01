import { Effect, BlendFunction } from "postprocessing";
import { forwardRef, useEffect, useMemo, useImperativeHandle, useRef } from "react";
import { Uniform } from "three";

const fragmentShader = /* glsl */ `
  uniform float decay;
  uniform float blend;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float d = clamp(decay, 0.0, 0.99);
    float b = clamp(blend, 0.0, 1.0);
    
    vec3 col = inputColor.rgb;
    
    float brightness = max(col.r, max(col.g, col.b));
    float trailStrength = smoothstep(0.1, 0.8, brightness) * b;
    
    col = col * (1.0 + trailStrength * 0.3);
    
    float glow = brightness * d * 0.15;
    col += glow;
    
    outputColor = vec4(col, inputColor.a);
  }
`;

class AfterimageEffectImpl extends Effect {
  constructor({
    decay = 0.92,
    blend = 0.75,
  }: {
    decay?: number;
    blend?: number;
  } = {}) {
    super("AfterimageEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["decay", new Uniform(decay)],
        ["blend", new Uniform(blend)],
      ]),
    });
  }

  get decay() {
    return (this.uniforms.get("decay") as Uniform).value;
  }
  
  set decay(v: number) {
    (this.uniforms.get("decay") as Uniform).value = Math.max(0, Math.min(0.99, v));
  }

  get blend() {
    return (this.uniforms.get("blend") as Uniform).value;
  }
  
  set blend(v: number) {
    (this.uniforms.get("blend") as Uniform).value = Math.max(0, Math.min(1, v));
  }
}

type Props = {
  enabled?: boolean;
  decay?: number;
  blend?: number;
};

export const Afterimage = forwardRef<AfterimageEffectImpl | null, Props>(
  function Afterimage({ enabled = true, decay = 0.92, blend = 0.75 }, ref) {
    const effectRef = useRef<AfterimageEffectImpl | null>(null);

    const effect = useMemo(() => {
      return new AfterimageEffectImpl({ decay, blend });
    }, []);

    useEffect(() => {
      effectRef.current = effect;
      return () => {
        effect.dispose();
      };
    }, [effect]);

    useEffect(() => {
      if (effectRef.current) {
        effectRef.current.decay = enabled ? decay : 0;
        effectRef.current.blend = enabled ? blend : 0;
      }
    }, [decay, blend, enabled]);

    useImperativeHandle(ref, () => effectRef.current as AfterimageEffectImpl, [effect]);

    if (!enabled) return null;

    return <primitive object={effect} />;
  }
);
