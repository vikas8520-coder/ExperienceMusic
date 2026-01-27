import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

type AudioData = {
  bass: number;
  mid: number;
  high: number;
};

type Props = {
  bass?: number;
  mid?: number;
  high?: number;
  getAudioData?: () => AudioData;
  intensity?: number;
  speed?: number;
  opacity?: number;
  blend?: THREE.Blending;
};

export function PsyTunnel({
  bass: bassProp,
  mid: midProp,
  high: highProp,
  getAudioData,
  intensity = 1,
  speed = 1,
  opacity = 0.85,
  blend = THREE.AdditiveBlending,
}: Props) {
  const audioRef = useRef({ bass: 0, mid: 0, high: 0 });

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: blend,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uOpacity: { value: opacity },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uBass;
        uniform float uMid;
        uniform float uHigh;
        uniform float uOpacity;

        vec3 palette(float t) {
          vec3 a = vec3(0.5, 0.5, 0.5);
          vec3 b = vec3(0.5, 0.5, 0.5);
          vec3 c = vec3(1.0, 1.0, 1.0);
          vec3 d = vec3(0.10, 0.20, 0.40);
          return a + b * cos(6.28318 * (c * t + d));
        }

        float stripes(float x, float freq) {
          float s = sin(x * freq);
          return smoothstep(0.0, 0.15, abs(s));
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          p.x *= 0.46;
          float r = length(p);
          float a = atan(p.y, p.x);

          float kick = uBass;
          float shimmer = uHigh;
          float drive = uMid;

          float t = uTime;

          float zoom = 1.2 + kick * 1.4;
          float spin = (0.35 + drive * 1.2) * t;
          float spiral = a + spin + (1.8 + kick * 2.2) * log(r + 1e-3);

          float band = stripes(spiral * 2.0 + t * (0.7 + kick * 1.6), 10.0 + kick * 20.0);

          float wave = sin((1.0 / (r + 0.12)) * (2.2 + kick * 2.0) - t * (1.2 + drive));
          wave = smoothstep(-0.2, 0.9, wave);

          float mask = band * wave;

          float palT = t * 0.08 + spiral * 0.15 + kick * 0.25;
          vec3 col = palette(palT);

          float bw = smoothstep(0.55, 0.9, 1.0 - shimmer);
          col = mix(col, vec3(mask), bw);

          col *= (0.6 + shimmer * 1.3);

          float vig = smoothstep(1.2, 0.1, r);
          col *= vig;

          gl_FragColor = vec4(col, mask * uOpacity);
        }
      `,
    });

    return mat;
  }, [blend, opacity]);

  useFrame((_, delta) => {
    if (getAudioData) {
      const data = getAudioData();
      audioRef.current.bass = data.bass * intensity;
      audioRef.current.mid = data.mid * speed;
      audioRef.current.high = data.high;
    } else {
      audioRef.current.bass = (bassProp ?? 0) * intensity;
      audioRef.current.mid = (midProp ?? 0) * speed;
      audioRef.current.high = highProp ?? 0;
    }

    material.uniforms.uTime.value += delta * speed;
    material.uniforms.uBass.value = audioRef.current.bass;
    material.uniforms.uMid.value = audioRef.current.mid;
    material.uniforms.uHigh.value = audioRef.current.high;
    material.uniforms.uOpacity.value = opacity;
  });

  return (
    <mesh frustumCulled={false} renderOrder={10}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
