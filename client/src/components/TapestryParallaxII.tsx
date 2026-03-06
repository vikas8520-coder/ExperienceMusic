import * as THREE from "three";
import { useMemo, useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";

type AudioData = {
  bass: number;
  mid: number;
  high: number;
  kick: number;
  sub: number;
  energy: number;
};

type Props = {
  getAudioData?: () => AudioData;
  settings?: any;
};

// Fullscreen quad — bypasses camera, fills entire viewport
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uKick;
  uniform float uSub;
  uniform float uEnergy;
  uniform sampler2D uTexture;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // LED light
  vec3 ledLight(vec2 uv, vec2 pos, vec3 col, float radius, float brightness) {
    float d = length(uv - pos);
    float core = exp(-d * d / (radius * radius * 0.3)) * 2.0;
    float halo = exp(-d * d / (radius * radius * 3.0)) * 0.6;
    return col * (core + halo) * brightness;
  }

  // UV blacklight — dark, no wash
  vec3 uvBlacklightFilter(vec3 col) {
    col.r *= 0.35;
    col.g *= 0.95;
    col.b *= 1.2;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col += vec3(0.08, 0.0, 0.15) * lum;
    return col;
  }

  // Sample one zoom layer of the tapestry
  vec4 sampleLayer(vec2 uv, float zoom, float rotation) {
    // Center, zoom, rotate
    vec2 centered = uv - 0.5;
    centered /= zoom;
    float c = cos(rotation), s = sin(rotation);
    centered = mat2(c, -s, s, c) * centered;
    centered += 0.5;
    // Wrap infinitely
    vec2 wrapped = fract(centered);
    return texture2D(uTexture, wrapped);
  }

  void main() {
    float t = uTime;

    // --- INFINITE ZOOM ---
    // Continuous zoom that loops: zoom increases over time, fract() makes it repeat
    float zoomSpeed = 0.15 + uBass * 0.1 + uKick * 0.3;
    float zoomPhase = t * zoomSpeed;
    // Two layers that crossfade for seamless infinite loop
    float zoomA = exp(fract(zoomPhase) * 1.5);       // 1.0 → ~4.5
    float zoomB = exp(fract(zoomPhase + 0.5) * 1.5); // offset by half cycle
    float crossfade = abs(fract(zoomPhase) - 0.5) * 2.0; // 0→1→0 triangle wave

    // Slow rotation that accelerates with mids
    float rotSpeed = 0.05 + uMid * 0.08;
    float rot = t * rotSpeed;

    // Sample both zoom layers
    vec4 layerA = sampleLayer(vUv, zoomA, rot);
    vec4 layerB = sampleLayer(vUv, zoomB, rot + 0.3);

    // Crossfade between them for seamless infinite zoom
    vec4 texColor = mix(layerA, layerB, crossfade);

    // Depth from luminance
    float depth = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

    // --- 3D TUNNEL DEPTH ---
    // Radial distance from center creates tunnel perspective
    vec2 centered = vUv - 0.5;
    float radial = length(centered);
    float angle = atan(centered.y, centered.x);

    // Tunnel rings — concentric depth layers
    float tunnelDepth = fract(radial * 3.0 - t * 0.2 - uBass * 0.3);
    float ring = smoothstep(0.0, 0.05, tunnelDepth) * smoothstep(0.15, 0.05, tunnelDepth);

    // Third zoom layer — deeper, more rotated (gives parallax depth)
    float zoomC = zoomA * 2.5;
    vec4 deepLayer = sampleLayer(vUv, zoomC, rot * 1.5 + 1.0);
    // Blend deep layer into center (tunnel effect — center = far away)
    float centerMask = smoothstep(0.4, 0.1, radial);
    texColor = mix(texColor, deepLayer, centerMask * 0.4);

    vec3 color = texColor.rgb;

    // --- COSMIC STARS in dark areas ---
    float darkness = 1.0 - smoothstep(0.03, 0.18, depth);
    vec3 cosmic = vec3(0.005, 0.002, 0.01);

    // Stars layer 1
    vec2 s1 = vUv * 100.0 + vec2(t * 0.05, t * 0.02);
    float star1 = hash(floor(s1));
    star1 = smoothstep(0.985, 0.995, star1);
    float tw1 = 0.4 + 0.6 * sin(t * 2.0 + star1 * 200.0);
    cosmic += mix(vec3(0.7, 0.75, 1.0), vec3(1.0, 0.95, 0.8), hash(floor(s1)+0.5)) * star1 * tw1 * 0.5;

    // Stars layer 2
    vec2 s2 = vUv * 50.0 + vec2(-t * 0.03, t * 0.04);
    float star2 = hash(floor(s2));
    star2 = smoothstep(0.98, 0.995, star2);
    float tw2 = 0.3 + 0.7 * sin(t * 3.5 + star2 * 150.0);
    cosmic += mix(vec3(1.0, 0.9, 0.7), vec3(0.6, 0.8, 1.0), hash(floor(s2)+0.3)) * star2 * tw2 * 0.7;

    // Bright stars with glow
    vec2 s3 = vUv * 20.0 + vec2(t * 0.02, -t * 0.015);
    float star3 = hash(floor(s3));
    star3 = smoothstep(0.992, 0.999, star3);
    float glow3 = exp(-length(fract(s3) - 0.5) * 8.0) * star3;
    cosmic += vec3(1.0, 1.0, 1.0) * (star3 * 0.9 + glow3 * 0.3);

    cosmic *= 1.0 + uBass * 0.4;
    color = mix(color, cosmic, darkness * 0.9);

    // UV blacklight
    color = uvBlacklightFilter(color);

    // --- CONTRAST ---
    color = pow(color, vec3(0.75));
    color = (color - 0.5) * 2.2 + 0.5;
    color = clamp(color, 0.0, 1.0);
    float sat = max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
    float lum2 = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(lum2), color, 1.0 + sat * 0.8);
    color = clamp(color, 0.0, 1.0);

    // --- TUNNEL RING GLOW ---
    // Subtle neon ring outlines at depth boundaries
    vec3 ringColor = vec3(0.3, 0.0, 0.6) + vec3(0.2, 0.5, 0.0) * sin(angle * 3.0 + t);
    color += ringColor * ring * 0.2 * (1.0 + uEnergy * 0.5);

    // --- ZOOM SPEED LINES ---
    // Radial streaks that appear during zooms, stronger on kick
    float streak = noise(vec2(angle * 10.0, radial * 20.0 - t * 2.0));
    streak = smoothstep(0.6, 0.9, streak) * radial;
    color += vec3(0.15, 0.05, 0.3) * streak * (uKick * 1.5 + uBass * 0.3);

    // --- ACID LED LIGHTS ---
    vec3 ledTotal = vec3(0.0);
    float beatPulse = 1.0 + uBass * 1.5 + uKick * 2.5;
    float ledR = 0.02 + uKick * 0.01 + uBass * 0.008;

    // LEDs orbit around center as zoom happens
    float orbitSpeed = t * 0.4;
    float orbitRadius = 0.2 + 0.05 * sin(t * 0.3);

    // 8 orbiting acid LEDs
    ledTotal += ledLight(vUv, vec2(0.5, 0.5) + orbitRadius * vec2(cos(orbitSpeed), sin(orbitSpeed)),
      vec3(1.0, 0.0, 0.8), ledR, (0.5 + 0.5*sin(t*3.0)) * beatPulse);

    ledTotal += ledLight(vUv, vec2(0.5, 0.5) + orbitRadius * vec2(cos(orbitSpeed+0.785), sin(orbitSpeed+0.785)),
      vec3(0.0, 1.0, 0.2), ledR, (0.5 + 0.5*sin(t*3.0+1.0)) * beatPulse);

    ledTotal += ledLight(vUv, vec2(0.5, 0.5) + orbitRadius * vec2(cos(orbitSpeed+1.571), sin(orbitSpeed+1.571)),
      vec3(0.0, 0.8, 1.0), ledR, (0.5 + 0.5*sin(t*3.0+2.0)) * beatPulse);

    ledTotal += ledLight(vUv, vec2(0.5, 0.5) + orbitRadius * vec2(cos(orbitSpeed+2.356), sin(orbitSpeed+2.356)),
      vec3(1.0, 0.7, 0.0), ledR, (0.5 + 0.5*sin(t*3.0+3.0)) * beatPulse);

    ledTotal += ledLight(vUv, vec2(0.5, 0.5) + orbitRadius * vec2(cos(orbitSpeed+3.142), sin(orbitSpeed+3.142)),
      vec3(0.6, 0.0, 1.0), ledR, (0.5 + 0.5*sin(t*3.0+4.0)) * beatPulse);

    ledTotal += ledLight(vUv, vec2(0.5, 0.5) + orbitRadius * vec2(cos(orbitSpeed+3.927), sin(orbitSpeed+3.927)),
      vec3(1.0, 0.0, 0.4), ledR, (0.5 + 0.5*sin(t*3.0+5.0)) * beatPulse);

    ledTotal += ledLight(vUv, vec2(0.5, 0.5) + orbitRadius * vec2(cos(orbitSpeed+4.712), sin(orbitSpeed+4.712)),
      vec3(0.0, 1.0, 0.7), ledR, (0.5 + 0.5*sin(t*3.0+6.0)) * beatPulse);

    ledTotal += ledLight(vUv, vec2(0.5, 0.5) + orbitRadius * vec2(cos(orbitSpeed+5.498), sin(orbitSpeed+5.498)),
      vec3(0.3, 0.6, 1.0), ledR, (0.5 + 0.5*sin(t*3.0+7.0)) * beatPulse);

    // Center LED — pulses with kick
    ledTotal += ledLight(vUv, vec2(0.5, 0.5),
      vec3(1.0, 0.5, 1.0), ledR * 1.5, uKick * 3.0 + uBass * 0.5);

    color += ledTotal;

    // Kick flash — violet
    color += vec3(0.3, 0.0, 0.5) * uKick * 0.5;

    // Sub pulse from edges
    float vignette = 1.0 - length((vUv - 0.5) * 1.8);
    float subPulse = uSub * 0.25 * (1.0 + sin(t * 1.5));
    color += vec3(0.06, 0.0, 0.12) * subPulse * (1.0 - vignette);

    // Depth fog
    color = mix(color, vec3(0.01, 0.005, 0.03), (1.0 - depth) * 0.12);

    // Vignette — slightly tighter for tunnel feel
    color *= smoothstep(0.0, 0.4, vignette);

    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function TapestryParallaxII({ getAudioData, settings }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load("/textures/tapestry.png", (tex) => {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;
      setTexture(tex);
    });
  }, []);

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
        uTexture: { value: texture },
      },
      vertexShader,
      fragmentShader,
    });
  }, [texture]);

  useEffect(() => {
    matRef.current = material;
  }, [material]);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uTime.value += delta;

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
