import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import type { AudioData } from "@/hooks/use-audio-analyzer";
import { ATTRACTOR_CONFIGS, type AttractorType } from "./attractors";

const TEX_WIDTH = 160;
const TEX_HEIGHT = 160;
const PARTICLE_COUNT = TEX_WIDTH * TEX_HEIGHT; // 25,600

interface GPUComputeParticlesProps {
  getAudioData: () => AudioData;
  attractorType: AttractorType;
  settings: {
    intensity: number;
    speed: number;
    colorPalette: string[];
    gpuSettings?: {
      particleDensity: number;
      orbitSpeed: number;
      attractorStrength: number;
      trailLength: number;
      pointBrightness: number;
      turbulence: number;
      colorMode: "heat" | "palette" | "rainbow";
      cameraAutoOrbit: boolean;
    };
  };
}

function buildPositionShader(): string {
  return `
    uniform float u_dt;
    uniform float u_kick;
    uniform float u_time;
    uniform float u_bass;

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec4 pos = texture2D(texturePosition, uv);
      vec4 vel = texture2D(textureVelocity, uv);

      vec3 newPos = pos.xyz + vel.xyz * u_dt;
      float life = pos.w - u_dt * 0.08;

      if (life <= 0.0) {
        float r1 = fract(sin(dot(uv, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
        float r2 = fract(sin(dot(uv, vec2(93.989, 67.345)) + u_time * 1.3) * 24634.6345);
        float r3 = fract(sin(dot(uv, vec2(45.164, 12.987)) + u_time * 0.7) * 65432.1234);
        float r4 = fract(sin(dot(uv, vec2(73.156, 29.843)) + u_time * 2.1) * 37291.8463);

        float theta = r1 * 6.2832;
        float phi = acos(2.0 * r2 - 1.0);
        float rad = 0.05 + r3 * 0.4;
        newPos = vec3(
          rad * sin(phi) * cos(theta),
          rad * sin(phi) * sin(theta),
          rad * cos(phi)
        );
        life = 2.0 + r4 * 6.0;
      }

      // Kick burst — explosive outward push
      if (u_kick > 0.3) {
        float burstStrength = (u_kick - 0.3) * 6.0;
        float r = length(newPos);
        if (r > 0.01) {
          newPos += normalize(newPos) * burstStrength * u_dt * (1.0 + u_bass);
        }
      }

      // Soft boundary — fade life near edges
      float r = length(newPos);
      if (r > 6.0) {
        life -= (r - 6.0) * u_dt * 2.0;
      }
      if (r > 10.0) {
        life = 0.0;
      }

      gl_FragColor = vec4(newPos, life);
    }
  `;
}

function buildVelocityShader(attractorType: AttractorType): string {
  const config = ATTRACTOR_CONFIGS[attractorType];
  return `
    uniform float u_dt;
    uniform float u_time;
    uniform float u_bass;
    uniform float u_mid;
    uniform float u_high;
    uniform float u_kick;
    uniform float u_energy;
    uniform float u_speed;
    uniform float u_attractorStrength;
    uniform float u_turbulence;

    // 3D simplex-like noise
    vec3 hash3(vec3 p) {
      p = vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
      );
      return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
    }

    // Curl noise for smooth turbulence
    vec3 curlNoise(vec3 p) {
      float e = 0.1;
      vec3 dx = hash3(p + vec3(e, 0.0, 0.0)) - hash3(p - vec3(e, 0.0, 0.0));
      vec3 dy = hash3(p + vec3(0.0, e, 0.0)) - hash3(p - vec3(0.0, e, 0.0));
      vec3 dz = hash3(p + vec3(0.0, 0.0, e)) - hash3(p - vec3(0.0, 0.0, e));
      return vec3(
        dy.z - dz.y,
        dz.x - dx.z,
        dx.y - dy.x
      ) / (2.0 * e);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec4 pos4 = texture2D(texturePosition, uv);
      vec4 vel4 = texture2D(textureVelocity, uv);

      vec3 pos = pos4.xyz;
      vec3 vel = vel4.xyz;
      vec3 acc = vec3(0.0);

      // === Attractor force (scaled by strength) ===
      ${config.glslForce}
      acc *= u_attractorStrength;

      // Curl noise turbulence — smooth, divergence-free
      vec3 curl = curlNoise(pos * 1.5 + u_time * 0.3) * (0.3 + u_mid * 1.5) * u_turbulence;
      acc += curl;

      // High-frequency sparkle
      vec3 sparkle = hash3(pos * 12.0 + u_time * 5.0) * u_high * 0.15;
      acc += sparkle;

      // Bass pulse — breathing expansion/contraction
      float r = length(pos);
      if (r > 0.01) {
        acc += normalize(pos) * sin(u_time * 1.5) * u_bass * 0.3;
      }

      vel += acc * u_dt * u_speed;

      // Smooth drag — higher drag at low energy for tighter orbits
      float drag = 0.990 - u_energy * 0.005;
      vel *= drag;

      // Speed limit
      float maxSpeed = 4.0 + u_energy * 6.0;
      float spd = length(vel);
      if (spd > maxSpeed) vel *= maxSpeed / spd;

      // Store speed in w for the renderer to use
      gl_FragColor = vec4(vel, spd);
    }
  `;
}

// Vertex shader — pixel-perfect dots like Casberry
const renderVertexShader = `
  uniform sampler2D u_positionTexture;
  uniform sampler2D u_velocityTexture;
  uniform float u_texWidth;
  uniform float u_texHeight;
  uniform float u_energy;
  uniform float u_bass;
  uniform float u_kick;
  uniform float u_pointSize;
  uniform float u_time;
  uniform float u_dpr;

  varying float vLife;
  varying float vSpeed;
  varying vec3 vWorldPos;

  attribute float a_index;

  void main() {
    float idx = a_index;
    float u = (mod(idx, u_texWidth) + 0.5) / u_texWidth;
    float v = (floor(idx / u_texWidth) + 0.5) / u_texHeight;

    vec4 posData = texture2D(u_positionTexture, vec2(u, v));
    vec4 velData = texture2D(u_velocityTexture, vec2(u, v));
    vec3 pos = posData.xyz;
    float life = posData.w;
    float speed = velData.w;

    vWorldPos = pos;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float camDist = -mvPosition.z;

    // Tiny crisp dots: 1.5-4px on screen, DPR-aware
    float sz = u_pointSize * u_dpr;
    sz *= 1.0 + u_bass * 0.3 + u_kick * 0.5;
    sz *= 60.0 / max(camDist, 0.5);
    gl_PointSize = clamp(sz, 1.0 * u_dpr, 4.5 * u_dpr);

    vLife = smoothstep(0.0, 0.3, life) * smoothstep(8.0, 5.0, life);
    vSpeed = speed;
  }
`;

// Fragment shader — hard pixel dots, user palette colors
const renderFragmentShader = `
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform vec3 u_color3;
  uniform float u_time;
  uniform float u_bass;
  uniform float u_brightness;
  uniform float u_colorMode;

  varying float vLife;
  varying float vSpeed;
  varying vec3 vWorldPos;

  void main() {
    // Hard circle — 1px anti-alias edge, no glow
    float dist = length(gl_PointCoord - 0.5);
    if (dist > 0.5) discard;
    float alpha = smoothstep(0.5, 0.45, dist) * vLife;

    float speedNorm = smoothstep(0.0, 4.0, vSpeed);

    // Palette interpolation
    float t = fract(speedNorm * 0.4 + length(vWorldPos) * 0.06 + u_time * 0.02);
    vec3 c;
    if (t < 0.5) {
      c = mix(u_color1, u_color2, t * 2.0);
    } else {
      c = mix(u_color2, u_color3, (t - 0.5) * 2.0);
    }

    vec3 color;
    if (u_colorMode < 0.5) {
      // Heat: slow = color1, fast = color3, bright core on fastest
      color = mix(u_color1, u_color3, speedNorm);
      color += vec3(speedNorm * speedNorm * 0.4);
    } else if (u_colorMode < 1.5) {
      color = c;
    } else {
      // Rainbow
      float h = fract(t + u_time * 0.03);
      float q = 1.0 - abs(mod(h * 6.0, 2.0) - 1.0);
      float hh = h * 6.0;
      vec3 rgb = hh < 1.0 ? vec3(1,q,0) : hh < 2.0 ? vec3(q,1,0) : hh < 3.0 ? vec3(0,1,q) : hh < 4.0 ? vec3(0,q,1) : hh < 5.0 ? vec3(q,0,1) : vec3(1,0,q);
      color = rgb * 0.8 + 0.2;
    }

    color *= u_brightness * (1.0 + u_bass * 0.2);
    gl_FragColor = vec4(color, alpha);
  }
`;

function hexToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

// Auto-orbiting camera rig
function CameraOrbit({ getAudioData, orbitSpeed, enabled }: { getAudioData: () => AudioData; orbitSpeed: number; enabled: boolean }) {
  const { camera } = useThree();
  const angleRef = useRef(0);
  const radiusRef = useRef(6);
  const yRef = useRef(2);

  useFrame((_, delta) => {
    if (!enabled) return;
    const audio = getAudioData();

    angleRef.current += delta * (orbitSpeed * 0.3 + audio.bass * 0.3 * orbitSpeed + audio.kick * 0.5);

    const targetRadius = 5.5 - audio.energy * 1.5;
    radiusRef.current += (targetRadius - radiusRef.current) * 0.02;

    const targetY = Math.sin(angleRef.current * 0.3) * 1.5 + audio.kick * 2.0;
    yRef.current += (targetY - yRef.current) * 0.03;

    const r = radiusRef.current;
    camera.position.set(
      Math.cos(angleRef.current) * r,
      yRef.current,
      Math.sin(angleRef.current) * r
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
}

export function GPUComputeParticles({ getAudioData, attractorType, settings }: GPUComputeParticlesProps) {
  const { gl } = useThree();
  const gpu = settings.gpuSettings ?? {
    particleDensity: 1.0, orbitSpeed: 0.5, attractorStrength: 1.0,
    trailLength: 0.0, pointBrightness: 1.0, turbulence: 1.0,
    colorMode: "heat" as const, cameraAutoOrbit: true,
  };
  const [ready, setReady] = useState(false);
  const gpuComputeRef = useRef<GPUComputationRenderer | null>(null);
  const posVarRef = useRef<any>(null);
  const velVarRef = useRef<any>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const currentAttractorRef = useRef<AttractorType>(attractorType);
  const timeRef = useRef(0);

  // Deferred GPGPU initialization
  useEffect(() => {
    if (gpuComputeRef.current) return;
    if (!(gl instanceof THREE.WebGLRenderer)) return;

    const compute = new GPUComputationRenderer(TEX_WIDTH, TEX_HEIGHT, gl);

    // Position texture
    const posTex = compute.createTexture();
    const posData = posTex.image.data;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i4 = i * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * 1.5;
      posData[i4 + 0] = r * Math.sin(phi) * Math.cos(theta);
      posData[i4 + 1] = r * Math.sin(phi) * Math.sin(theta);
      posData[i4 + 2] = r * Math.cos(phi);
      posData[i4 + 3] = Math.random() * 6.0 + 1.0; // longer life
    }

    // Velocity texture
    const velTex = compute.createTexture();
    const velData = velTex.image.data;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i4 = i * 4;
      velData[i4 + 0] = (Math.random() - 0.5) * 0.1;
      velData[i4 + 1] = (Math.random() - 0.5) * 0.1;
      velData[i4 + 2] = (Math.random() - 0.5) * 0.1;
      velData[i4 + 3] = 0.0; // speed (computed by shader)
    }

    const posVar = compute.addVariable("texturePosition", buildPositionShader(), posTex);
    const velVar = compute.addVariable("textureVelocity", buildVelocityShader(attractorType), velTex);

    compute.setVariableDependencies(posVar, [posVar, velVar]);
    compute.setVariableDependencies(velVar, [posVar, velVar]);

    // Position uniforms
    posVar.material.uniforms.u_dt = { value: 0.016 };
    posVar.material.uniforms.u_kick = { value: 0.0 };
    posVar.material.uniforms.u_time = { value: 0.0 };
    posVar.material.uniforms.u_bass = { value: 0.0 };

    // Velocity uniforms
    velVar.material.uniforms.u_dt = { value: 0.016 };
    velVar.material.uniforms.u_time = { value: 0.0 };
    velVar.material.uniforms.u_bass = { value: 0.0 };
    velVar.material.uniforms.u_mid = { value: 0.0 };
    velVar.material.uniforms.u_high = { value: 0.0 };
    velVar.material.uniforms.u_kick = { value: 0.0 };
    velVar.material.uniforms.u_energy = { value: 0.0 };
    velVar.material.uniforms.u_speed = { value: 1.0 };
    velVar.material.uniforms.u_attractorStrength = { value: 1.0 };
    velVar.material.uniforms.u_turbulence = { value: 1.0 };

    const error = compute.init();
    if (error !== null) {
      console.error("GPU Compute init error:", error);
      return;
    }

    gpuComputeRef.current = compute;
    posVarRef.current = posVar;
    velVarRef.current = velVar;
    currentAttractorRef.current = attractorType;
    setReady(true);

    return () => {
      gpuComputeRef.current = null;
      posVarRef.current = null;
      velVarRef.current = null;
      setReady(false);
    };
  }, [gl]);

  // Attractor switching
  useEffect(() => {
    if (!gpuComputeRef.current || !velVarRef.current) return;
    if (attractorType === currentAttractorRef.current) return;
    currentAttractorRef.current = attractorType;
    velVarRef.current.material.fragmentShader = buildVelocityShader(attractorType);
    velVarRef.current.material.needsUpdate = true;
  }, [attractorType]);

  // Geometry with particle indices
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const indices = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) indices[i] = i;
    geo.setAttribute("a_index", new THREE.BufferAttribute(indices, 1));
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
    return geo;
  }, []);

  const colors = useMemo(() => {
    const p = settings.colorPalette || ["#ff0080", "#7928ca", "#0070f3"];
    return {
      c1: hexToVec3(p[0] || "#ff0080"),
      c2: hexToVec3(p[1] || "#7928ca"),
      c3: hexToVec3(p[2] || "#0070f3"),
    };
  }, [settings.colorPalette]);

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: renderVertexShader,
      fragmentShader: renderFragmentShader,
      uniforms: {
        u_positionTexture: { value: null },
        u_velocityTexture: { value: null },
        u_texWidth: { value: TEX_WIDTH },
        u_texHeight: { value: TEX_HEIGHT },
        u_energy: { value: 0.0 },
        u_bass: { value: 0.0 },
        u_kick: { value: 0.0 },
        u_pointSize: { value: 2.0 },
        u_dpr: { value: Math.min(window.devicePixelRatio || 1, 2) },
        u_color1: { value: colors.c1.clone() },
        u_color2: { value: colors.c2.clone() },
        u_color3: { value: colors.c3.clone() },
        u_time: { value: 0.0 },
        u_brightness: { value: 1.0 },
        u_colorMode: { value: 0.0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    materialRef.current = mat;
    return mat;
  }, []);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.u_color1.value.copy(colors.c1);
    materialRef.current.uniforms.u_color2.value.copy(colors.c2);
    materialRef.current.uniforms.u_color3.value.copy(colors.c3);
  }, [colors]);

  // Per-frame: update uniforms, run compute, feed textures to renderer
  useFrame((_, delta) => {
    const gpuCompute = gpuComputeRef.current;
    if (!gpuCompute || !posVarRef.current || !velVarRef.current || !materialRef.current) return;

    const audio = getAudioData();
    const dt = Math.min(delta, 0.033);
    timeRef.current += dt;

    const posU = posVarRef.current.material.uniforms;
    const velU = velVarRef.current.material.uniforms;

    posU.u_dt.value = dt;
    posU.u_kick.value = audio.kick;
    posU.u_time.value = timeRef.current;
    posU.u_bass.value = audio.bass;

    velU.u_dt.value = dt;
    velU.u_time.value = timeRef.current;
    velU.u_bass.value = audio.bass;
    velU.u_mid.value = audio.mid;
    velU.u_high.value = audio.high;
    velU.u_kick.value = audio.kick;
    velU.u_energy.value = audio.energy;
    velU.u_speed.value = settings.speed * 2.5;
    velU.u_attractorStrength.value = gpu.attractorStrength;
    velU.u_turbulence.value = gpu.turbulence;

    // Run 2 compute steps per frame for smoother attractor paths
    gpuCompute.compute();
    gpuCompute.compute();

    const mat = materialRef.current;
    mat.uniforms.u_positionTexture.value = gpuCompute.getCurrentRenderTarget(posVarRef.current).texture;
    mat.uniforms.u_velocityTexture.value = gpuCompute.getCurrentRenderTarget(velVarRef.current).texture;
    mat.uniforms.u_energy.value = audio.energy;
    mat.uniforms.u_bass.value = audio.bass;
    mat.uniforms.u_kick.value = audio.kick;
    mat.uniforms.u_pointSize.value = 1.0 + settings.intensity * 1.5;
    mat.uniforms.u_time.value = timeRef.current;
    mat.uniforms.u_brightness.value = gpu.pointBrightness;
    mat.uniforms.u_colorMode.value = gpu.colorMode === "heat" ? 0.0 : gpu.colorMode === "palette" ? 1.0 : 2.0;
  });

  if (!ready) return null;

  return (
    <>
      <CameraOrbit getAudioData={getAudioData} orbitSpeed={gpu.orbitSpeed} enabled={gpu.cameraAutoOrbit} />
      <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
    </>
  );
}
