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
  uniform sampler2D uMckenna;
  uniform sampler2D uTapestry;

  varying vec2 vUv;

  // --- Utilities ---
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  vec3 ledLight(vec2 uv, vec2 pos, vec3 col, float radius, float brightness) {
    float d = length(uv - pos);
    float core = exp(-d * d / (radius * radius * 0.3)) * 2.0;
    float halo = exp(-d * d / (radius * radius * 3.0)) * 0.6;
    return col * (core + halo) * brightness;
  }

  // --- Phase cycling: 30s per phase, smooth crossfade ---
  // Phase 0: Self-transforming morphs (#2)
  // Phase 1: Through McKenna's Eyes — glasses zoom (#4)
  // Phase 2: Stoned Ape dissolve (#5)
  float phaseTime() {
    return mod(uTime, 90.0); // 90s full cycle
  }

  float phaseMix(float t, float start, float end) {
    float fadeIn = smoothstep(start, start + 3.0, t);
    float fadeOut = smoothstep(end - 3.0, end, t);
    return fadeIn * (1.0 - fadeOut);
  }

  // =============================================
  // PHASE 2: Self-transforming machine elves
  // Face breathes, triangles rotate, kaleidoscopic mirrors
  // =============================================
  vec3 selfTransforming(vec2 uv, float t) {
    // Breathing warp — face inhales/exhales
    vec2 centered = uv - vec2(0.5, 0.45); // face center
    float dist = length(centered);
    float breathe = sin(t * 0.6) * 0.03 * (1.0 + uBass * 3.0);
    vec2 breathUv = uv + centered * breathe;

    // Liquid morph — face warps like it's alive
    float warpX = noise(uv * 4.0 + t * 0.3) - 0.5;
    float warpY = noise(uv * 4.0 + t * 0.3 + 100.0) - 0.5;
    float warpAmt = 0.02 + uMid * 0.04 + uKick * 0.06;
    vec2 morphUv = breathUv + vec2(warpX, warpY) * warpAmt;

    vec4 tex = texture2D(uMckenna, clamp(morphUv, 0.0, 1.0));
    vec3 color = tex.rgb;

    // Triangle rotation — the geometric triangles in the art spin
    // Detect triangle areas (high frequency detail + saturation)
    float detail = abs(noise(uv * 20.0 + t * 0.5));
    float triMask = smoothstep(0.4, 0.7, detail);

    // Rotate the triangle areas locally
    float rotAngle = t * 0.3 * (1.0 + uHigh * 2.0);
    vec2 triCenter = uv - 0.5;
    float cr = cos(rotAngle * triMask), sr = sin(rotAngle * triMask);
    vec2 rotUv = vec2(cr * triCenter.x - sr * triCenter.y, sr * triCenter.x + cr * triCenter.y) + 0.5;
    vec4 rotTex = texture2D(uMckenna, clamp(rotUv, 0.0, 1.0));
    color = mix(color, rotTex.rgb, triMask * 0.4);

    // Kaleidoscopic mirrors at edges
    float angle = atan(centered.y, centered.x);
    float kaleid = abs(sin(angle * 3.0 + t * 0.2));
    vec2 mirrorUv = vec2(0.5) + vec2(cos(angle * 3.0), sin(angle * 3.0)) * dist;
    vec4 mirrorTex = texture2D(uMckenna, clamp(mirrorUv, 0.0, 1.0));
    float edgeMask = smoothstep(0.3, 0.5, dist);
    color = mix(color, mirrorTex.rgb * vec3(0.8, 0.6, 1.0), edgeMask * 0.5 * kaleid);

    // Color shift — psychedelic hue rotation
    float hueShift = t * 0.1 + uEnergy * 0.5;
    float cs = cos(hueShift), sn = sin(hueShift);
    mat3 hueRot = mat3(
      0.299+0.701*cs+0.168*sn, 0.587-0.587*cs+0.330*sn, 0.114-0.114*cs-0.497*sn,
      0.299-0.299*cs-0.328*sn, 0.587+0.413*cs+0.035*sn, 0.114-0.114*cs+0.292*sn,
      0.299-0.300*cs+1.250*sn, 0.587-0.588*cs-1.050*sn, 0.114+0.886*cs-0.203*sn
    );
    color = hueRot * color;

    return color;
  }

  // =============================================
  // PHASE 4: Through McKenna's Eyes
  // Infinite zoom into glasses → fractal world inside
  // =============================================
  vec3 throughTheEyes(vec2 uv, float t) {
    // Glasses positions (approximate from the portrait)
    vec2 leftEye = vec2(0.42, 0.48);
    vec2 rightEye = vec2(0.58, 0.48);

    // Zoom target — alternate between eyes
    float eyeSwitch = smoothstep(0.0, 1.0, sin(t * 0.1) * 0.5 + 0.5);
    vec2 zoomCenter = mix(leftEye, rightEye, eyeSwitch);

    // Continuous zoom
    float zoomSpeed = 0.12 + uBass * 0.08 + uKick * 0.2;
    float zoomPhase = t * zoomSpeed;
    float zoomA = exp(fract(zoomPhase) * 2.0);
    float zoomB = exp(fract(zoomPhase + 0.5) * 2.0);
    float crossfade = abs(fract(zoomPhase) - 0.5) * 2.0;

    // Zoom into McKenna's face
    vec2 uvA = (uv - zoomCenter) / zoomA + zoomCenter;
    vec2 uvB = (uv - zoomCenter) / zoomB + zoomCenter;

    vec4 faceA = texture2D(uMckenna, fract(uvA));
    vec4 faceB = texture2D(uMckenna, fract(uvB));
    vec3 face = mix(faceA.rgb, faceB.rgb, crossfade);

    // Inside the glasses — reveal the tapestry fractal world
    float distToCenter = length(uv - zoomCenter);
    float glassMask = smoothstep(0.15, 0.05, distToCenter);

    // Tapestry world inside — zooming and rotating
    float innerZoom = exp(fract(zoomPhase * 0.7) * 1.5);
    float innerRot = t * 0.05 + uMid * 0.1;
    vec2 innerUv = uv - 0.5;
    float ic = cos(innerRot), is = sin(innerRot);
    innerUv = mat2(ic, -is, is, ic) * innerUv / innerZoom + 0.5;
    vec4 innerWorld = texture2D(uTapestry, fract(innerUv));

    // Blend: glasses area shows fractal world, rest shows zooming face
    vec3 color = mix(face, innerWorld.rgb, glassMask * 0.8);

    // Add cosmic stars in dark areas of the inner world
    float depth = dot(color, vec3(0.299, 0.587, 0.114));
    float darkness = 1.0 - smoothstep(0.03, 0.15, depth);
    vec2 s1 = uv * 80.0 + vec2(t * 0.05, t * 0.03);
    float star = hash(floor(s1));
    star = smoothstep(0.985, 0.995, star);
    float twinkle = 0.4 + 0.6 * sin(t * 2.5 + star * 200.0);
    color += vec3(0.8, 0.85, 1.0) * star * twinkle * 0.6 * darkness;

    // Lens flare on glasses
    float flare = exp(-distToCenter * distToCenter / 0.01) * (0.3 + uKick * 0.7);
    color += vec3(0.4, 0.3, 0.8) * flare;

    return color;
  }

  // =============================================
  // PHASE 5: Stoned Ape — mushroom dissolve
  // Mushroom warp grows from bottom, portrait dissolves into geometry
  // =============================================
  vec3 stonedApe(vec2 uv, float t) {
    vec4 tex = texture2D(uMckenna, uv);
    vec3 color = tex.rgb;

    // Mushroom shape growing from bottom
    // Stem: thin column from bottom center
    vec2 stemCenter = vec2(0.5, 1.0);
    float stemDist = abs(uv.x - 0.5);
    float stemWidth = 0.06 + 0.02 * sin(t * 0.5 + uv.y * 5.0);
    float stemMask = smoothstep(stemWidth, stemWidth - 0.02, stemDist);
    stemMask *= smoothstep(0.45, 0.55, uv.y); // only bottom half

    // Cap: dome at top of stem
    vec2 capCenter = vec2(0.5, 0.45 + sin(t * 0.3) * 0.03);
    float capDist = length((uv - capCenter) * vec2(1.0, 1.8));
    float capRadius = 0.2 + 0.05 * sin(t * 0.4) + uBass * 0.05;
    float capMask = smoothstep(capRadius, capRadius - 0.05, capDist);
    capMask *= smoothstep(capCenter.y - 0.05, capCenter.y + 0.05, capCenter.y - (uv.y - capCenter.y)); // top half only

    float mushroomMask = max(stemMask, capMask);

    // Inside the mushroom — geometric dissolution
    // The portrait breaks into triangular fragments
    float gridScale = 15.0 + uHigh * 10.0;
    vec2 grid = floor(uv * gridScale);
    float cellHash = hash(grid);

    // Each cell dissolves at different rate
    float dissolveWave = sin(t * 0.5 + cellHash * 6.28) * 0.5 + 0.5;
    float dissolveAmt = mushroomMask * dissolveWave;

    // Fragment rotation per cell
    float fragAngle = cellHash * 6.28 + t * (0.5 + uMid * 1.0);
    vec2 cellCenter = (grid + 0.5) / gridScale;
    vec2 fragUv = uv - cellCenter;
    float fc = cos(fragAngle), fs = sin(fragAngle);
    fragUv = mat2(fc, -fs, fs, fc) * fragUv + cellCenter;
    vec4 fragTex = texture2D(uMckenna, clamp(fragUv, 0.0, 1.0));

    // Dissolve: original → rotated fragments → geometric pattern
    vec3 geomColor = vec3(
      0.5 + 0.5 * sin(cellHash * 10.0 + t),
      0.5 + 0.5 * sin(cellHash * 15.0 + t * 1.3),
      0.5 + 0.5 * sin(cellHash * 20.0 + t * 0.7)
    ) * 0.6;

    vec3 dissolved = mix(fragTex.rgb, geomColor, dissolveAmt * 0.6);
    color = mix(color, dissolved, mushroomMask);

    // Spore particles rising from mushroom
    vec2 sporeUv = uv * 30.0 + vec2(0.0, -t * 2.0);
    float spore = hash(floor(sporeUv));
    spore = smoothstep(0.97, 0.99, spore);
    float sporeFade = smoothstep(0.7, 0.3, uv.y); // fade toward top
    float sporeGlow = spore * sporeFade * (0.5 + uBass * 1.0);
    color += vec3(0.6, 0.4, 1.0) * sporeGlow * mushroomMask * 2.0;

    // Mycelium network — branching lines from bottom
    float mycel = noise(vec2(uv.x * 8.0 + t * 0.1, uv.y * 3.0 - t * 0.2));
    mycel = smoothstep(0.48, 0.52, mycel);
    float mycelFade = smoothstep(1.0, 0.5, uv.y) * (1.0 - smoothstep(0.0, 0.1, uv.y));
    color += vec3(0.3, 0.5, 0.2) * mycel * mycelFade * 0.3;

    // Color shift in mushroom area — more purple/psychedelic
    color = mix(color, color * vec3(0.7, 0.5, 1.2), mushroomMask * 0.4);

    return color;
  }

  void main() {
    float t = uTime;
    float pt = phaseTime();

    // Phase weights — smooth crossfade between phases
    float w2 = phaseMix(pt, 0.0, 30.0);   // Self-transforming: 0-30s
    float w4 = phaseMix(pt, 27.0, 60.0);  // Through eyes: 27-60s
    float w5 = phaseMix(pt, 57.0, 90.0);  // Stoned ape: 57-90s

    // Normalize weights
    float wTotal = w2 + w4 + w5 + 0.001;
    w2 /= wTotal; w4 /= wTotal; w5 /= wTotal;

    // Render active phases
    vec3 color = vec3(0.0);
    if (w2 > 0.01) color += selfTransforming(vUv, t) * w2;
    if (w4 > 0.01) color += throughTheEyes(vUv, t) * w4;
    if (w5 > 0.01) color += stonedApe(vUv, t) * w5;

    // --- UV blacklight ---
    color.r *= 0.4;
    color.g *= 0.95;
    color.b *= 1.15;
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color += vec3(0.06, 0.0, 0.12) * lum;

    // --- Contrast ---
    color = pow(color, vec3(0.8));
    color = (color - 0.5) * 1.8 + 0.5;
    color = clamp(color, 0.0, 1.0);
    float sat = max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
    color = mix(vec3(dot(color, vec3(0.299, 0.587, 0.114))), color, 1.0 + sat * 0.6);
    color = clamp(color, 0.0, 1.0);

    // --- Acid LEDs ---
    vec3 ledTotal = vec3(0.0);
    float bp = 1.0 + uBass * 1.5 + uKick * 2.5;
    float lr = 0.018 + uKick * 0.01;

    // Orbiting LEDs around face
    float orbit = t * 0.5;
    float orbitR = 0.25 + 0.05 * sin(t * 0.3);
    ledTotal += ledLight(vUv, vec2(0.5,0.45) + orbitR*vec2(cos(orbit), sin(orbit)),
      vec3(1.0, 0.0, 0.8), lr, (0.5+0.5*sin(t*3.0)) * bp);
    ledTotal += ledLight(vUv, vec2(0.5,0.45) + orbitR*vec2(cos(orbit+2.094), sin(orbit+2.094)),
      vec3(0.0, 1.0, 0.3), lr, (0.5+0.5*sin(t*3.0+2.0)) * bp);
    ledTotal += ledLight(vUv, vec2(0.5,0.45) + orbitR*vec2(cos(orbit+4.189), sin(orbit+4.189)),
      vec3(0.0, 0.7, 1.0), lr, (0.5+0.5*sin(t*3.0+4.0)) * bp);

    // Third eye LED
    ledTotal += ledLight(vUv, vec2(0.5, 0.35) + vec2(sin(t*0.4), cos(t*0.5))*0.005,
      vec3(0.8, 0.3, 1.0), lr * 1.3, (0.4+0.6*sin(t*4.0)) * bp);

    // Glasses glint LEDs
    ledTotal += ledLight(vUv, vec2(0.42, 0.48) + vec2(sin(t*0.6)*0.005, 0.0),
      vec3(0.5, 0.8, 1.0), lr * 0.8, (0.3+0.7*sin(t*5.0)) * bp);
    ledTotal += ledLight(vUv, vec2(0.58, 0.48) + vec2(sin(t*0.6+1.0)*0.005, 0.0),
      vec3(0.5, 0.8, 1.0), lr * 0.8, (0.3+0.7*sin(t*5.0+1.5)) * bp);

    color += ledTotal;

    // Kick flash
    color += vec3(0.25, 0.0, 0.4) * uKick * 0.5;

    // Vignette
    float vig = 1.0 - length((vUv - 0.5) * 1.8);
    color *= smoothstep(0.0, 0.4, vig);

    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function McKennaMachine({ getAudioData, settings }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const [mckenna, setMckenna] = useState<THREE.Texture | null>(null);
  const [tapestry, setTapestry] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load("/textures/mckenna.jpg", (tex) => {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;
      setMckenna(tex);
    });
    loader.load("/textures/tapestry.png", (tex) => {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;
      setTapestry(tex);
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
        uMckenna: { value: mckenna },
        uTapestry: { value: tapestry },
      },
      vertexShader,
      fragmentShader,
    });
  }, [mckenna, tapestry]);

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
