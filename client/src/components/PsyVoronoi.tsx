import * as THREE from "three";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { PALETTE_GLSL, psyPalettes, paletteToGLSLUniforms, type PsyPalette } from "@/lib/psyPalettes";

type AudioData = {
  bass: number; mid: number; high: number;
  kick: number; sub: number; energy: number;
};

export type VoronoiParams = {
  cellScale: number;      // 2-30 cell density
  symmetry: number;       // 1-24
  edgeWidth: number;      // 0-1
  warpStrength: number;   // 0-5
  zoom: number;           // 0.1-10
  rotation: number;       // 0-360
  speed: number;          // 0-2
  seed: number;           // 0-99999
  mode: number;           // 0=cells, 1=edges, 2=crystal, 3=organic
  palette: PsyPalette;
};

export const defaultVoronoiParams: VoronoiParams = {
  cellScale: 8,
  symmetry: 6,
  edgeWidth: 0.3,
  warpStrength: 1.5,
  zoom: 1.0,
  rotation: 0,
  speed: 1.0,
  seed: 137,
  mode: 2, // crystal
  palette: psyPalettes[10], // Crystal Cave
};

export const VORONOI_MODE_NAMES = ["Cells", "Edges", "Crystal", "Organic"];

type Props = {
  getAudioData?: () => AudioData;
  settings?: any;
  params?: VoronoiParams;
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
  uniform float uCellScale;
  uniform float uSymmetry;
  uniform float uEdgeWidth;
  uniform float uWarpStrength;
  uniform float uZoom;
  uniform float uRotation;
  uniform float uSeed;
  uniform float uMode;

  varying vec2 vUv;

  #define TAU 6.28318530

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1 + uSeed * 0.01, 311.7)),
             dot(p, vec2(269.5 + uSeed * 0.01, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = dot(hash2(i), vec2(1.0));
    float b = dot(hash2(i + vec2(1,0)), vec2(1.0));
    float c = dot(hash2(i + vec2(0,1)), vec2(1.0));
    float d = dot(hash2(i + vec2(1,1)), vec2(1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  // Polar symmetry
  vec2 polarFold(vec2 p, float segments) {
    if (segments < 1.5) return p;
    float a = atan(p.y, p.x);
    float r = length(p);
    float seg = TAU / segments;
    a = mod(a + 3.14159, seg);
    a = min(a, seg - a);
    return vec2(cos(a), sin(a)) * r;
  }

  // Returns: x=minDist, y=secondDist, z=cellID
  vec3 voronoi(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float minDist = 10.0;
    float secondDist = 10.0;
    float cellId = 0.0;
    vec2 minPoint = vec2(0.0);

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = hash2(i + neighbor);

        // Animate points
        point = 0.5 + 0.4 * sin(t * 0.5 + TAU * point);

        vec2 diff = neighbor + point - f;
        float d = length(diff);

        if (d < minDist) {
          secondDist = minDist;
          minDist = d;
          cellId = dot(i + neighbor, vec2(7.0, 113.0));
          minPoint = point;
        } else if (d < secondDist) {
          secondDist = d;
        }
      }
    }

    return vec3(minDist, secondDist, cellId);
  }

  void main() {
    float t = uTime;

    // UV with rotation + zoom
    vec2 uv = (vUv - 0.5) * 2.0;
    float rot = uRotation * 0.01745 + t * 0.03;
    float cr = cos(rot), sr = sin(rot);
    uv = mat2(cr, -sr, sr, cr) * uv;
    uv /= uZoom;

    // Symmetry
    uv = polarFold(uv, uSymmetry);

    // Domain warping before Voronoi
    if (uWarpStrength > 0.01) {
      float warp1 = fbm(uv * 2.0 + t * 0.1);
      float warp2 = fbm(uv * 2.0 + vec2(5.2, 1.3) + t * 0.08);
      uv += vec2(warp1, warp2) * uWarpStrength * 0.3;
    }

    // Audio warp
    uv += vec2(uBass * 0.05, uKick * 0.08) * sin(t);

    // Voronoi
    vec2 scaledUv = uv * uCellScale;
    vec3 vor = voronoi(scaledUv, t);
    float minDist = vor.x;
    float secondDist = vor.y;
    float cellId = vor.z;

    // Edge detection
    float edge = secondDist - minDist;
    float edgeMask = 1.0 - smoothstep(0.0, uEdgeWidth * 0.3, edge);

    // --- Mode-specific coloring ---
    vec3 color = vec3(0.0);

    if (uMode < 0.5) {
      // Mode 0: Cells — solid colored cells
      float cellColor = fract(cellId * 0.1234);
      color = iqPalette(cellColor + t * 0.03);
      color *= 1.0 - minDist * 0.5;
      // Bright edges
      color = mix(color, iqPalette(cellColor + 0.5) * 1.5, edgeMask * 0.8);

    } else if (uMode < 1.5) {
      // Mode 1: Edges — neon wireframe
      color = iqPalette(edge * 3.0 + t * 0.05) * edgeMask;
      // Inner glow
      float innerGlow = exp(-minDist * 5.0);
      color += iqPalette(fract(cellId * 0.1) + 0.3) * innerGlow * 0.2;

    } else if (uMode < 2.5) {
      // Mode 2: Crystal — faceted gem-like
      float facet = fract(cellId * 0.1234);
      vec3 cellCol = iqPalette(facet + t * 0.02);

      // Specular highlight within each cell
      float spec = pow(1.0 - minDist, 8.0) * 0.8;
      // Facet gradient
      float gradient = minDist * 2.0;
      color = cellCol * (0.6 + 0.4 * cos(gradient * 3.14));
      color += vec3(1.0) * spec * 0.3;
      // Crystal edges
      color = mix(color, iqPalette(facet + 0.5) * 2.0, edgeMask * 0.7);
      // Depth variation
      color *= 0.7 + 0.3 * cos(facet * TAU + t * 0.5);

    } else {
      // Mode 3: Organic — soft, biological
      float cellColor = fract(cellId * 0.1234);
      // Soft cell shading
      float soft = smoothstep(0.0, 0.6, minDist);
      color = iqPalette(cellColor + minDist * 0.5 + t * 0.02);
      color *= 1.0 - soft * 0.5;
      // Membrane edges
      float membrane = smoothstep(0.02, 0.0, edge - uEdgeWidth * 0.15);
      color = mix(color, iqPalette(cellColor + 0.3) * 0.5, membrane * 0.5);
      // Nucleus glow
      float nucleus = exp(-minDist * minDist * 20.0);
      color += iqPalette(cellColor + 0.6) * nucleus * 0.5;
    }

    // --- Audio reactivity ---
    color += color * uEnergy * 0.15;
    color += iqPalette(0.5) * uKick * 0.2 * edgeMask;
    // Bass pulses cell brightness
    float cellPulse = fract(cellId * 0.5);
    color *= 1.0 + uBass * 0.3 * sin(cellPulse * TAU + t * 2.0);
    // High shimmer on edges
    color += vec3(0.5, 0.5, 1.0) * edgeMask * uHigh * 0.3 * sin(t * 8.0);

    // Contrast
    color = pow(color, vec3(0.85));

    // Vignette
    float vig = 1.0 - length((vUv - 0.5) * 1.6);
    color *= smoothstep(0.0, 0.5, vig);

    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function PsyVoronoi({ getAudioData, settings, params, static: isStatic }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const p = params || defaultVoronoiParams;

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 },
        uKick: { value: 0 }, uSub: { value: 0 }, uEnergy: { value: 0 },
        uCellScale: { value: p.cellScale },
        uSymmetry: { value: p.symmetry },
        uEdgeWidth: { value: p.edgeWidth },
        uWarpStrength: { value: p.warpStrength },
        uZoom: { value: p.zoom },
        uRotation: { value: p.rotation },
        uSeed: { value: p.seed },
        uMode: { value: p.mode },
        ...paletteToGLSLUniforms(p.palette),
      },
      vertexShader,
      fragmentShader,
    });
  }, []);

  useEffect(() => { matRef.current = material; }, [material]);

  useEffect(() => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uCellScale.value = p.cellScale;
    u.uSymmetry.value = p.symmetry;
    u.uEdgeWidth.value = p.edgeWidth;
    u.uWarpStrength.value = p.warpStrength;
    u.uZoom.value = p.zoom;
    u.uRotation.value = p.rotation;
    u.uSeed.value = p.seed;
    u.uMode.value = p.mode;
    u.uPalA.value = p.palette.a;
    u.uPalB.value = p.palette.b;
    u.uPalC.value = p.palette.c;
    u.uPalD.value = p.palette.d;
  }, [p]);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    if (!isStatic) u.uTime.value += delta * p.speed;
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
