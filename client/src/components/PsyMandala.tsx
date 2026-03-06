import * as THREE from "three";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { PALETTE_GLSL, psyPalettes, paletteToGLSLUniforms, type PsyPalette } from "@/lib/psyPalettes";

type AudioData = {
  bass: number; mid: number; high: number;
  kick: number; sub: number; energy: number;
};

export type MandalaParams = {
  symmetry: number;       // 2-24
  ringCount: number;      // 1-12 concentric rings
  complexity: number;     // 1-10
  zoom: number;           // 0.1-10
  rotation: number;       // 0-360
  speed: number;          // 0-2
  seed: number;           // 0-99999
  innerPattern: number;   // 0=fbm, 1=voronoi, 2=spirals
  palette: PsyPalette;
};

export const defaultMandalaParams: MandalaParams = {
  symmetry: 8,
  ringCount: 6,
  complexity: 5,
  zoom: 1.0,
  rotation: 0,
  speed: 1.0,
  seed: 7,
  innerPattern: 0,
  palette: psyPalettes[4], // Sacred Gold
};

type Props = {
  getAudioData?: () => AudioData;
  settings?: any;
  params?: MandalaParams;
  static?: boolean;
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  ${PALETTE_GLSL}

  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uKick;
  uniform float uSub;
  uniform float uEnergy;
  uniform float uSymmetry;
  uniform float uRingCount;
  uniform float uComplexity;
  uniform float uZoom;
  uniform float uRotation;
  uniform float uSeed;
  uniform float uInnerPattern;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p + uSeed * 0.01, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = p * 2.1 + vec2(1.7, 3.2);
      a *= 0.5;
    }
    return v;
  }

  // Voronoi
  float voronoi(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = vec2(hash(i + neighbor), hash(i + neighbor + 100.0));
        point = 0.5 + 0.5 * sin(uTime * 0.3 + 6.28 * point);
        float d = length(neighbor + point - f);
        minDist = min(minDist, d);
      }
    }
    return minDist;
  }

  // Spiral pattern
  float spiralPattern(vec2 p, float t) {
    float r = length(p);
    float a = atan(p.y, p.x);
    float spiral = sin(a * uComplexity + r * 10.0 - t * 2.0);
    float rings = sin(r * 20.0 - t);
    return spiral * 0.5 + rings * 0.5;
  }

  void main() {
    float t = uTime;

    // Center and zoom
    vec2 uv = (vUv - 0.5) * 2.0;
    float rot = uRotation * 0.01745 + t * 0.05;
    float cr = cos(rot), sr = sin(rot);
    uv = mat2(cr, -sr, sr, cr) * uv;
    uv /= uZoom;

    // Polar coordinates
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // --- Mandala symmetry folding ---
    float segments = uSymmetry;
    float segAngle = 6.28318 / segments;
    float foldedAngle = mod(a + 3.14159, segAngle);
    foldedAngle = min(foldedAngle, segAngle - foldedAngle); // mirror

    // Reconstruct UV from folded polar
    vec2 mandalaUv = vec2(cos(foldedAngle), sin(foldedAngle)) * r;

    // --- Inner pattern selection ---
    float pattern = 0.0;
    if (uInnerPattern < 0.5) {
      // fBm with domain warping
      vec2 p = mandalaUv * uComplexity;
      float q = fbm(p + t * 0.1);
      pattern = fbm(p + 3.0 * vec2(q) + t * 0.05);
    } else if (uInnerPattern < 1.5) {
      // Voronoi cells
      pattern = voronoi(mandalaUv * uComplexity * 2.0);
    } else {
      // Spirals
      pattern = spiralPattern(mandalaUv * uComplexity, t) * 0.5 + 0.5;
    }

    // --- Concentric ring structure ---
    float ringFreq = uRingCount * 3.14159;
    float ringPattern = sin(r * ringFreq - t * 0.5 - uBass * 2.0) * 0.5 + 0.5;
    float ringEdge = smoothstep(0.48, 0.5, ringPattern) * smoothstep(0.52, 0.5, ringPattern);

    // Combine pattern with ring structure
    float combined = pattern * 0.7 + ringPattern * 0.2 + ringEdge * 0.5;

    // --- Color from palette ---
    vec3 color = iqPalette(combined);

    // Ring borders get bright accent color
    vec3 ringColor = iqPalette(combined + 0.5) * 1.5;
    color = mix(color, ringColor, ringEdge * 0.6);

    // Radial glow — center brighter
    float centerGlow = exp(-r * r * 2.0);
    color += iqPalette(pattern + 0.3) * centerGlow * 0.3;

    // --- Audio reactivity ---
    // Bass breathes the rings
    color *= 1.0 + sin(r * 5.0 - t) * uBass * 0.2;

    // Kick flash at center
    color += iqPalette(0.5) * uKick * 0.4 * centerGlow;

    // High = sparkle on ring edges
    color += vec3(1.0) * ringEdge * uHigh * 0.3 * sin(t * 10.0 + a * 5.0);

    // Mid = rotation speed is already modulated via uTime

    // Energy overall brightness
    color *= 1.0 + uEnergy * 0.15;

    // --- Contrast & cleanup ---
    color = pow(color, vec3(0.9));
    color = (color - 0.4) * 1.5 + 0.4;

    // Circular mask — fade to black at edges
    float mask = smoothstep(1.05, 0.85, r / uZoom);
    color *= mask;

    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function PsyMandala({ getAudioData, settings, params, static: isStatic }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const p = params || defaultMandalaParams;

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uKick: { value: 0 },
        uSub: { value: 0 },
        uEnergy: { value: 0 },
        uSymmetry: { value: p.symmetry },
        uRingCount: { value: p.ringCount },
        uComplexity: { value: p.complexity },
        uZoom: { value: p.zoom },
        uRotation: { value: p.rotation },
        uSeed: { value: p.seed },
        uInnerPattern: { value: p.innerPattern },
        ...paletteToGLSLUniforms(p.palette),
      },
      vertexShader,
      fragmentShader,
    });
  }, []);

  useEffect(() => {
    matRef.current = material;
  }, [material]);

  useEffect(() => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uSymmetry.value = p.symmetry;
    u.uRingCount.value = p.ringCount;
    u.uComplexity.value = p.complexity;
    u.uZoom.value = p.zoom;
    u.uRotation.value = p.rotation;
    u.uSeed.value = p.seed;
    u.uInnerPattern.value = p.innerPattern;
    u.uPalA.value = p.palette.a;
    u.uPalB.value = p.palette.b;
    u.uPalC.value = p.palette.c;
    u.uPalD.value = p.palette.d;
  }, [p]);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;

    if (!isStatic) {
      u.uTime.value += delta * p.speed;
    }

    if (getAudioData) {
      const audio = getAudioData();
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      u.uBass.value = lerp(u.uBass.value, audio.bass || 0, 0.3);
      u.uMid.value = lerp(u.uMid.value, audio.mid || 0, 0.4);
      u.uHigh.value = lerp(u.uHigh.value, audio.high || 0, 0.5);
      u.uKick.value = lerp(u.uKick.value, audio.kick || 0, 0.6);
      u.uSub.value = lerp(u.uSub.value, audio.sub || 0, 0.2);
      u.uEnergy.value = lerp(u.uEnergy.value, audio.energy || 0, 0.3);
    }
  });

  return (
    <mesh material={material} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
