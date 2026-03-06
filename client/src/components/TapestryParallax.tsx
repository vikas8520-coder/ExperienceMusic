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

// Simple pass-through vertex shader — NO texture fetch, NO displacement
// All the magic happens in the fragment shader via parallax mapping
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

  // --- Cosmic background functions ---
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

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  vec3 cosmicBackground(vec2 uv, float time, float bass, float energy) {
    // Deep black void base
    vec3 cosmic = vec3(0.005, 0.002, 0.01);

    // --- REAL STARS: multiple layers at different scales ---

    // Layer 1: distant tiny stars (dense field, slow drift)
    vec2 s1 = uv * 120.0 + vec2(time * 0.05, time * 0.02);
    float star1 = hash(floor(s1));
    float twinkle1 = 0.4 + 0.6 * sin(time * 2.0 + star1 * 200.0);
    star1 = smoothstep(0.985, 0.995, star1);
    // Vary star color: white, warm, cool
    vec3 starCol1 = mix(vec3(0.7, 0.75, 1.0), vec3(1.0, 0.95, 0.8), hash(floor(s1) + 0.5));
    cosmic += starCol1 * star1 * twinkle1 * 0.5;

    // Layer 2: mid-field stars (medium density, slow drift)
    vec2 s2 = uv * 60.0 + vec2(-time * 0.03, time * 0.04);
    float star2 = hash(floor(s2));
    float twinkle2 = 0.3 + 0.7 * sin(time * 3.5 + star2 * 150.0);
    star2 = smoothstep(0.98, 0.995, star2);
    vec3 starCol2 = mix(vec3(1.0, 0.9, 0.7), vec3(0.6, 0.8, 1.0), hash(floor(s2) + 0.3));
    cosmic += starCol2 * star2 * twinkle2 * 0.7;

    // Layer 3: bright foreground stars (sparse, larger, brighter)
    vec2 s3 = uv * 25.0 + vec2(time * 0.02, -time * 0.015);
    float star3 = hash(floor(s3));
    float twinkle3 = 0.5 + 0.5 * sin(time * 1.5 + star3 * 300.0);
    star3 = smoothstep(0.992, 0.999, star3);
    // These get a subtle glow halo
    float glow3 = exp(-length(fract(s3) - 0.5) * 8.0) * star3;
    vec3 starCol3 = mix(vec3(1.0, 1.0, 1.0), vec3(0.8, 0.9, 1.0), hash(floor(s3) + 0.7));
    cosmic += starCol3 * (star3 * twinkle3 * 0.9 + glow3 * 0.3);

    // Bass makes stars pulse brighter
    cosmic *= 1.0 + bass * 0.4;

    // Very faint nebula dust — barely visible, NOT blue wash
    float neb = fbm(uv * 2.5 + vec2(time * 0.01, time * 0.008));
    cosmic += vec3(0.03, 0.005, 0.05) * neb * (0.3 + energy * 0.2);

    return cosmic;
  }

  // Neon glow detection — bright AND saturated = neon
  float neonMask(vec3 col) {
    float brightness = dot(col, vec3(0.299, 0.587, 0.114));
    float saturation = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
    return smoothstep(0.25, 0.7, brightness) * smoothstep(0.15, 0.5, saturation);
  }

  // UV blacklight — shift toward blue/purple, NO white wash
  vec3 uvBlacklightFilter(vec3 col) {
    // Suppress reds hard, push blue/green but don't over-brighten
    col.r *= 0.35;
    col.g *= 0.95;
    col.b *= 1.2;
    // Tint toward violet — additive but clamped to prevent white
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col += vec3(0.08, 0.0, 0.15) * lum;
    return col;
  }

  // LED light — sharp core + soft halo
  vec3 ledLight(vec2 uv, vec2 pos, vec3 col, float radius, float brightness) {
    float d = length(uv - pos);
    float core = exp(-d * d / (radius * radius * 0.3)) * 2.0;
    float halo = exp(-d * d / (radius * radius * 3.0)) * 0.6;
    return col * (core + halo) * brightness;
  }

  void main() {
    // Camera sway driven by mid frequencies
    float swaySpeed = 0.3 + uMid * 0.5;
    vec2 sway = vec2(
      sin(uTime * swaySpeed * 0.7) * 0.015,
      cos(uTime * swaySpeed * 0.5) * 0.01
    );

    // Sample base texture
    vec4 texBase = texture2D(uTexture, vUv);
    float depth = dot(texBase.rgb, vec3(0.299, 0.587, 0.114));

    // Parallax: offset UV by depth * sway (bright areas shift less = closer)
    float parallaxStrength = 0.3 + uMid * 0.2;
    vec2 uvFar  = vUv + sway * parallaxStrength;
    vec2 uvMid  = vUv + sway * parallaxStrength * 0.5;
    vec2 uvNear = vUv + sway * parallaxStrength * 0.1;

    // Sample at three parallax depths
    vec4 farSample  = texture2D(uTexture, uvFar);
    vec4 midSample  = texture2D(uTexture, uvMid);
    vec4 nearSample = texture2D(uTexture, uvNear);

    // Blend by luminance depth — bright pixels use near layer, dark use far
    vec4 texColor = mix(farSample, nearSample, depth);
    texColor = mix(texColor, midSample, 0.25);
    vec3 color = texColor.rgb;

    // --- COSMIC BACKGROUND behind dark areas ---
    // Dark areas of the tapestry become transparent to a living cosmos
    vec3 cosmic = cosmicBackground(vUv, uTime, uBass, uEnergy);
    float darkness = 1.0 - smoothstep(0.03, 0.18, depth); // only truly dark areas
    color = mix(color, cosmic, darkness * 0.9);

    // UV blacklight first — shift palette before contrast
    color = uvBlacklightFilter(color);

    // --- HARD CONTRAST ---
    // Crush blacks, saturate colors, NO white wash
    // Power curve: darks get much darker, brights stay vivid not white
    color = pow(color, vec3(0.75)); // lift midtones slightly
    color = (color - 0.5) * 2.2 + 0.5; // aggressive S-curve
    color = clamp(color, 0.0, 1.0);
    // Boost saturation — make colors more vivid
    float sat = max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
    float lum2 = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(lum2), color, 1.0 + sat * 0.8); // push saturation hard
    color = clamp(color, 0.0, 1.0);

    // Neon glow — colored glow only, NOT white
    float neon = neonMask(texBase.rgb);
    float glowPulse = 1.0 + uHigh * 1.0 * sin(uTime * 8.0 + vUv.y * 20.0);
    // Use the neon color itself, not normalized (which goes white)
    vec3 glowColor = texBase.rgb * 1.2;
    color += glowColor * neon * 0.4 * glowPulse;

    // Bass breathing
    float breathe = sin(uTime * 0.8) * 0.08 * (1.0 + uBass * 2.0);
    color *= 1.0 + breathe * depth;

    // --- ACID LED LIGHTS ---
    vec3 ledTotal = vec3(0.0);
    float beatPulse = 1.0 + uBass * 1.5 + uKick * 2.5;
    float ledR = 0.02 + uKick * 0.01 + uBass * 0.008;
    float t = uTime;

    // Center mandala — hot magenta
    ledTotal += ledLight(vUv, vec2(0.50, 0.38) + vec2(sin(t*0.3), cos(t*0.4))*0.01,
      vec3(1.0, 0.0, 0.8), ledR, (0.5 + 0.5*sin(t*3.0)) * beatPulse);

    // Left crystal — acid green
    ledTotal += ledLight(vUv, vec2(0.30, 0.45) + vec2(sin(t*0.3+1.0), cos(t*0.4+1.0))*0.01,
      vec3(0.0, 1.0, 0.2), ledR, (0.5 + 0.5*sin(t*3.0+1.5)) * beatPulse);

    // Right crystal — acid green
    ledTotal += ledLight(vUv, vec2(0.70, 0.45) + vec2(sin(t*0.3+2.0), cos(t*0.4+2.0))*0.01,
      vec3(0.0, 1.0, 0.2), ledR, (0.5 + 0.5*sin(t*3.0+3.0)) * beatPulse);

    // Left moon — electric cyan
    ledTotal += ledLight(vUv, vec2(0.35, 0.20) + vec2(sin(t*0.3+3.0), cos(t*0.4+3.0))*0.01,
      vec3(0.0, 0.8, 1.0), ledR, (0.5 + 0.5*sin(t*3.0+4.5)) * beatPulse);

    // Right moon — electric cyan
    ledTotal += ledLight(vUv, vec2(0.65, 0.20) + vec2(sin(t*0.3+4.0), cos(t*0.4+4.0))*0.01,
      vec3(0.0, 0.8, 1.0), ledR, (0.5 + 0.5*sin(t*3.0+6.0)) * beatPulse);

    // Buddha — golden amber
    ledTotal += ledLight(vUv, vec2(0.50, 0.60) + vec2(sin(t*0.3+5.0), cos(t*0.4+5.0))*0.01,
      vec3(1.0, 0.7, 0.1), ledR, (0.5 + 0.5*sin(t*3.0+7.5)) * beatPulse);

    // --- EXTRA ACID LIGHTS (scattered around tapestry edges + sacred geometry) ---
    float ledSmall = ledR * 0.7;

    // Top mountain peak — violet
    ledTotal += ledLight(vUv, vec2(0.50, 0.12) + vec2(sin(t*0.5), cos(t*0.6))*0.008,
      vec3(0.6, 0.0, 1.0), ledSmall, (0.4 + 0.6*sin(t*4.0)) * beatPulse);

    // Left star mandala — hot pink
    ledTotal += ledLight(vUv, vec2(0.15, 0.38) + vec2(sin(t*0.4+1.5), cos(t*0.5+1.5))*0.008,
      vec3(1.0, 0.0, 0.5), ledSmall, (0.4 + 0.6*sin(t*3.5+1.0)) * beatPulse);

    // Right edge flora — lime
    ledTotal += ledLight(vUv, vec2(0.88, 0.35) + vec2(sin(t*0.4+2.5), cos(t*0.5+2.5))*0.008,
      vec3(0.5, 1.0, 0.0), ledSmall, (0.4 + 0.6*sin(t*3.5+2.0)) * beatPulse);

    // Below buddha — deep UV blue
    ledTotal += ledLight(vUv, vec2(0.50, 0.75) + vec2(sin(t*0.35+3.0), cos(t*0.45+3.0))*0.008,
      vec3(0.1, 0.2, 1.0), ledSmall, (0.4 + 0.6*sin(t*4.5+3.0)) * beatPulse);

    // Left bottom — orange acid
    ledTotal += ledLight(vUv, vec2(0.30, 0.72) + vec2(sin(t*0.4+4.0), cos(t*0.5+4.0))*0.008,
      vec3(1.0, 0.4, 0.0), ledSmall, (0.4 + 0.6*sin(t*3.8+4.0)) * beatPulse);

    // Right bottom — orange acid
    ledTotal += ledLight(vUv, vec2(0.70, 0.72) + vec2(sin(t*0.4+5.0), cos(t*0.5+5.0))*0.008,
      vec3(1.0, 0.4, 0.0), ledSmall, (0.4 + 0.6*sin(t*3.8+5.0)) * beatPulse);

    // Mid-left vine area — teal
    ledTotal += ledLight(vUv, vec2(0.22, 0.55) + vec2(sin(t*0.45+6.0), cos(t*0.55+6.0))*0.008,
      vec3(0.0, 1.0, 0.7), ledSmall, (0.4 + 0.6*sin(t*3.2+6.0)) * beatPulse);

    // Mid-right vine area — teal
    ledTotal += ledLight(vUv, vec2(0.78, 0.55) + vec2(sin(t*0.45+7.0), cos(t*0.55+7.0))*0.008,
      vec3(0.0, 1.0, 0.7), ledSmall, (0.4 + 0.6*sin(t*3.2+7.0)) * beatPulse);

    // Third eye area — white-blue strobe
    ledTotal += ledLight(vUv, vec2(0.50, 0.28) + vec2(sin(t*0.6+8.0), cos(t*0.7+8.0))*0.006,
      vec3(0.7, 0.7, 1.0), ledSmall * 0.8, (0.3 + 0.7*sin(t*6.0)) * beatPulse);

    color += ledTotal;

    // Kick flash — deep violet, not white
    color += vec3(0.3, 0.0, 0.5) * uKick * 0.6;

    // Sub pulse from edges — dark purple throb
    float vignette = 1.0 - length((vUv - 0.5) * 1.8);
    float subPulse = uSub * 0.3 * (1.0 + sin(t * 1.5));
    color += vec3(0.08, 0.0, 0.15) * subPulse * (1.0 - vignette);

    // Depth fog — dark areas sink into deep black-blue
    color = mix(color, vec3(0.01, 0.005, 0.04), (1.0 - depth) * 0.2);

    // Vignette — darker edges
    color *= smoothstep(0.0, 0.45, vignette);

    // Clamp — no white blowout ever
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function TapestryParallax({ getAudioData, settings }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Load texture manually — no Suspense, no EffectComposer crash
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load("/textures/tapestry.png", (tex) => {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
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

  // Simple flat fullscreen quad — all depth is faked in fragment shader
  return (
    <mesh material={material} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
