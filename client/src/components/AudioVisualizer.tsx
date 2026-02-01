import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, extend } from "@react-three/fiber";
import { OrbitControls, Sphere, shaderMaterial } from "@react-three/drei";
import * as THREE from "three";
import { Effects } from "./Effects";
import { PsyTunnel as PsyTunnelShader } from "./PsyTunnel";
import { PsyPresetLayer, type PsyPresetName } from "./PsyPresetLayer";
import { type AudioData } from "@/hooks/use-audio-analyzer";
import { type ImageFilterId, type PsyOverlayId } from "@/lib/visualizer-presets";

interface AudioVisualizerProps {
  getAudioData: () => AudioData;
  settings: {
    intensity: number;
    speed: number;
    colorPalette: string[];
    presetName: string;
    presetEnabled?: boolean;
    imageFilters?: ImageFilterId[];
    psyOverlays?: PsyOverlayId[];
  };
  backgroundImage?: string | null;
  zoom?: number;
}

// Check WebGL support
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

// Fallback visualizer when WebGL is unavailable
function FallbackVisualizer({ settings, backgroundImage }: { settings: any; backgroundImage?: string | null }) {
  const [pulse, setPulse] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => (p + 0.1) % (Math.PI * 2));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const scale = 1 + Math.sin(pulse) * 0.1 * settings.intensity;
  
  return (
    <div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{
        background: backgroundImage 
          ? `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url(${backgroundImage}) center/cover`
          : `radial-gradient(ellipse at center, ${settings.colorPalette[0] || '#1a0a2e'} 0%, #050508 100%)`
      }}
    >
      <div className="relative">
        {settings.colorPalette.slice(0, 5).map((color: string, i: number) => (
          <div
            key={i}
            className="absolute rounded-full border-2 animate-ping"
            style={{
              borderColor: color,
              width: `${(i + 1) * 60 * scale}px`,
              height: `${(i + 1) * 60 * scale}px`,
              top: `${-((i + 1) * 30 * scale)}px`,
              left: `${-((i + 1) * 30 * scale)}px`,
              animationDuration: `${2 + i * 0.5}s`,
              animationDelay: `${i * 0.2}s`,
              opacity: 0.3 + (0.1 * i),
            }}
          />
        ))}
        <div 
          className="w-24 h-24 rounded-full"
          style={{ 
            background: `linear-gradient(135deg, ${settings.colorPalette.slice(0, 3).join(', ')})`,
            transform: `scale(${scale})`,
            transition: 'transform 0.1s ease-out',
            boxShadow: `0 0 60px ${settings.colorPalette[0]}80`
          }}
        />
      </div>
      <div className="absolute bottom-8 text-center">
        <p className="text-muted-foreground text-xs opacity-50">Audio Visualization (2D Fallback)</p>
      </div>
    </div>
  );
}

// === PRESET 1: Energy Rings (PREMIUM) ===
function EnergyRings({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Mesh[]>([]);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });

  // Premium: Higher detail geometry with more segments
  const geometry = useMemo(() => new THREE.TorusGeometry(1, 0.025, 24, 128), []);
  const count = 24; // More rings for denser effect

  const materials = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const colorIndex = i % settings.colorPalette.length;
      const mat = new THREE.MeshStandardMaterial({
        color: "#000000",
        roughness: 0.05,
        metalness: 0.95,
        emissive: new THREE.Color(settings.colorPalette[colorIndex]),
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.9
      });
      return mat;
    });
  }, [settings.colorPalette]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime();
    
    // Premium: Smooth audio interpolation for fluid motion
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smooth = smoothedAudioRef.current;
    smooth.sub = lerp(smooth.sub, audioRaw.sub, 0.08);
    smooth.bass = lerp(smooth.bass, audioRaw.bass, 0.12);
    smooth.mid = lerp(smooth.mid, audioRaw.mid, 0.15);
    smooth.high = lerp(smooth.high, audioRaw.high, 0.2);
    smooth.kick = lerp(smooth.kick, audioRaw.kick, 0.25);
    smooth.energy = lerp(smooth.energy, audioRaw.energy, 0.1);

    // Premium: Complex multi-axis rotation with smooth transitions
    const baseSpeed = 0.08 * settings.speed;
    groupRef.current.rotation.z += delta * (baseSpeed + smooth.sub * 0.2 + smooth.kick * 0.4);
    groupRef.current.rotation.x = Math.sin(time * 0.15) * 0.25 * (1 + smooth.mid * settings.intensity);
    groupRef.current.rotation.y = Math.cos(time * 0.1) * 0.15 * (1 + smooth.sub * settings.intensity * 0.5);

    ringsRef.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = time * settings.speed;
      const offset = i * 0.3;
      const layerDepth = i / count;
      
      // Premium: Multi-layered scaling with organic feel
      const breathing = 1 + smooth.sub * 0.25 * Math.sin(t * 0.4 + offset);
      const pulse = smooth.bass * settings.intensity * 1.5 * (Math.sin(t * 1.5 + offset) * 0.5 + 0.5);
      const waveform = smooth.mid * 0.3 * Math.sin(t * 2 + i * 0.2);
      const kickPop = smooth.kick * 0.6 * (1 - layerDepth * 0.5);
      const baseScale = (i * 0.15 + 0.4);
      const scale = baseScale * (breathing + pulse + waveform + kickPop);
      mesh.scale.setScalar(scale);
      
      // Premium: Individual ring rotation for depth
      mesh.rotation.x = Math.PI / 2 + Math.sin(t * 0.3 + offset) * 0.1 * smooth.mid;
      mesh.rotation.y = Math.cos(t * 0.25 + offset) * 0.08 * smooth.high;

      const mat = materialsRef.current[i];
      if (mat) {
        const colorIndex = i % settings.colorPalette.length;
        // Premium: Dynamic color shifting based on audio (reusing mat.emissive)
        mat.emissive.set(settings.colorPalette[colorIndex]);
        const hueShift = smooth.high * 0.05 * Math.sin(t + i * 0.5);
        mat.emissive.offsetHSL(hueShift, 0, smooth.energy * 0.1);
        
        const boost = (smooth.high * 3 + smooth.kick * 2.5 + smooth.energy) * settings.intensity;
        mat.emissive.multiplyScalar(0.3 + boost);
        mat.emissive.r = Math.min(mat.emissive.r, 1);
        mat.emissive.g = Math.min(mat.emissive.g, 1);
        mat.emissive.b = Math.min(mat.emissive.b, 1);
        mat.emissiveIntensity = 1.2 + smooth.bass * settings.intensity;
        mat.opacity = 0.7 + smooth.energy * 0.3;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh 
          key={i} 
          ref={(el) => {
            if (el) ringsRef.current[i] = el;
          }} 
          geometry={geometry}
          material={materials[i]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}
      {materials.map((mat, i) => {
        materialsRef.current[i] = mat;
        return null;
      })}
    </group>
  );
}

// === PRESET 2: Psy Tunnel (Shader-based fullscreen effect) ===
function PsyTunnel({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  return (
    <PsyTunnelShader
      getAudioData={getAudioData}
      intensity={settings.intensity}
      speed={settings.speed}
      opacity={0.85}
    />
  );
}

// === PRESET 3: Particle Field (ULTRA PREMIUM) ===
// Custom shader for glowing particles with soft edges and depth
const ParticleGlowMaterial = shaderMaterial(
  {
    uTime: 0,
    uEnergy: 0,
    uBass: 0,
    uHigh: 0,
    uKick: 0,
    uIntensity: 1,
  },
  // Vertex shader
  `
    attribute float aSize;
    attribute float aPhase;
    attribute vec3 color;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vPhase;
    uniform float uTime;
    uniform float uEnergy;
    uniform float uBass;
    uniform float uKick;
    uniform float uIntensity;
    
    void main() {
      vColor = color;
      vPhase = aPhase;
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      
      // Dynamic size based on audio and distance (clamped to avoid extreme values)
      float distanceFade = 1.0 / max(-mvPosition.z * 0.05 + 1.0, 0.1);
      distanceFade = clamp(distanceFade, 0.2, 3.0);
      float audioSize = 1.0 + uBass * 0.5 * uIntensity + uKick * 0.8;
      float pulse = 1.0 + sin(uTime * 2.0 + aPhase * 6.28) * 0.15 * uEnergy;
      
      float pointSize = aSize * audioSize * pulse * distanceFade * 80.0;
      gl_PointSize = clamp(pointSize, 1.0, 64.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Alpha based on energy and sparkle
      vAlpha = 0.6 + uEnergy * 0.4;
    }
  `,
  // Fragment shader
  `
    varying vec3 vColor;
    varying float vAlpha;
    varying float vPhase;
    uniform float uTime;
    uniform float uHigh;
    uniform float uKick;
    
    void main() {
      // Soft circular particle with glow falloff
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      
      // Multi-layer glow: bright core + soft outer glow
      float core = smoothstep(0.5, 0.0, dist);
      float glow = smoothstep(0.5, 0.1, dist) * 0.6;
      float outerGlow = smoothstep(0.5, 0.3, dist) * 0.2;
      
      float alpha = (core + glow + outerGlow) * vAlpha;
      
      // Sparkle effect on high frequencies
      float sparkle = step(0.98, fract(sin(vPhase * 1000.0 + uTime * 10.0) * 43758.5453));
      vec3 finalColor = vColor + sparkle * uHigh * vec3(0.5, 0.5, 1.0);
      
      // Kick adds brightness punch
      finalColor += uKick * 0.3;
      
      if (alpha < 0.01) discard;
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
);

extend({ ParticleGlowMaterial });

// Energy core shader for glowing center orb
const EnergyCoreShader = {
  uniforms: {
    uTime: { value: 0 },
    uBass: { value: 0 },
    uEnergy: { value: 0 },
    uKick: { value: 0 },
    uColor1: { value: new THREE.Color("#ffffff") },
    uColor2: { value: new THREE.Color("#6600ff") },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vLocalPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vLocalPosition = position;
      // Compute world position for correct Fresnel calculation
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uBass;
    uniform float uEnergy;
    uniform float uKick;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec3 vLocalPosition;
    
    void main() {
      // Fresnel rim glow (using world space for both camera and position)
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - clamp(dot(viewDir, vNormal), 0.0, 1.0), 3.0);
      fresnel = clamp(fresnel, 0.0, 1.0);
      
      // Pulsing core (use local position for consistent effect)
      float pulse = 0.5 + 0.5 * sin(uTime * 3.0 + uBass * 5.0);
      float core = smoothstep(0.8, 0.0, length(vLocalPosition) / 2.0);
      
      // Energy waves
      float wave = sin(length(vLocalPosition) * 8.0 - uTime * 4.0) * 0.5 + 0.5;
      wave *= uEnergy;
      
      // Color blend
      vec3 color = mix(uColor2, uColor1, clamp(fresnel + pulse * 0.3, 0.0, 1.0));
      color += uColor1 * wave * 0.3;
      color += vec3(1.0) * uKick * 0.5;
      
      float alpha = fresnel * 0.8 + core * 0.6 + wave * 0.2;
      alpha = clamp(alpha * (0.6 + uEnergy * 0.4), 0.0, 1.0);
      
      gl_FragColor = vec4(color, alpha);
    }
  `
};

function ParticleField({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const corePointsRef = useRef<THREE.Points>(null);
  const glowPointsRef = useRef<THREE.Points>(null);
  const trailPointsRef = useRef<THREE.Points>(null);
  const energyCoreRef = useRef<THREE.Mesh>(null);
  const energyCoreMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  const tempColor = useMemo(() => new THREE.Color(), []);
  const tempColor2 = useMemo(() => new THREE.Color(), []);
  
  // Premium: Multi-layer particle system
  const coreCount = 4000;    // Bright core particles
  const glowCount = 2500;    // Larger glow particles  
  const trailCount = 1500;   // Trailing dust particles

  // Core layer - bright, dense particles
  const [corePositions, coreColors, coreSizes, corePhases, coreBasePositions] = useMemo(() => {
    const pos = new Float32Array(coreCount * 3);
    const col = new Float32Array(coreCount * 3);
    const sizes = new Float32Array(coreCount);
    const phases = new Float32Array(coreCount);
    const basePos = new Float32Array(coreCount * 3);
    
    for (let i = 0; i < coreCount; i++) {
      // Fibonacci sphere distribution for even coverage
      const goldenRatio = (1 + Math.sqrt(5)) / 2;
      const theta = 2 * Math.PI * i / goldenRatio;
      const phi = Math.acos(1 - 2 * (i + 0.5) / coreCount);
      const radius = 8 + Math.pow(Math.random(), 0.7) * 20;
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      basePos[i * 3] = x;
      basePos[i * 3 + 1] = y;
      basePos[i * 3 + 2] = z;
      
      col[i * 3] = 1;
      col[i * 3 + 1] = 1;
      col[i * 3 + 2] = 1;
      
      sizes[i] = 0.08 + Math.random() * 0.12;
      phases[i] = Math.random();
    }
    return [pos, col, sizes, phases, basePos];
  }, []);

  // Glow layer - larger, softer particles
  const [glowPositions, glowColors, glowSizes, glowPhases, glowBasePositions] = useMemo(() => {
    const pos = new Float32Array(glowCount * 3);
    const col = new Float32Array(glowCount * 3);
    const sizes = new Float32Array(glowCount);
    const phases = new Float32Array(glowCount);
    const basePos = new Float32Array(glowCount * 3);
    
    for (let i = 0; i < glowCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const radius = 12 + Math.random() * 28;
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      basePos[i * 3] = x;
      basePos[i * 3 + 1] = y;
      basePos[i * 3 + 2] = z;
      
      col[i * 3] = 1;
      col[i * 3 + 1] = 1;
      col[i * 3 + 2] = 1;
      
      sizes[i] = 0.15 + Math.random() * 0.25;
      phases[i] = Math.random();
    }
    return [pos, col, sizes, phases, basePos];
  }, []);

  // Trail layer - fine dust particles
  const [trailPositions, trailColors, trailSizes, trailPhases, trailBasePositions] = useMemo(() => {
    const pos = new Float32Array(trailCount * 3);
    const col = new Float32Array(trailCount * 3);
    const sizes = new Float32Array(trailCount);
    const phases = new Float32Array(trailCount);
    const basePos = new Float32Array(trailCount * 3);
    
    for (let i = 0; i < trailCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const radius = 5 + Math.random() * 35;
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      basePos[i * 3] = x;
      basePos[i * 3 + 1] = y;
      basePos[i * 3 + 2] = z;
      
      col[i * 3] = 1;
      col[i * 3 + 1] = 1;
      col[i * 3 + 2] = 1;
      
      sizes[i] = 0.03 + Math.random() * 0.06;
      phases[i] = Math.random();
    }
    return [pos, col, sizes, phases, basePos];
  }, []);

  // Helper function for simplex-like noise
  const noise3D = (x: number, y: number, z: number) => {
    return Math.sin(x * 1.2) * Math.cos(y * 0.9) * Math.sin(z * 1.1) +
           Math.sin(x * 2.3 + y * 1.7) * 0.5 +
           Math.cos(y * 3.1 + z * 2.2) * 0.3;
  };

  useFrame((state) => {
    if (!groupRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime();
    
    // Smooth audio interpolation with per-band rates
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smooth = smoothedAudioRef.current;
    smooth.sub = lerp(smooth.sub, audioRaw.sub, 0.05);
    smooth.bass = lerp(smooth.bass, audioRaw.bass, 0.08);
    smooth.mid = lerp(smooth.mid, audioRaw.mid, 0.1);
    smooth.high = lerp(smooth.high, audioRaw.high, 0.15);
    smooth.kick = lerp(smooth.kick, audioRaw.kick, 0.2);
    smooth.energy = lerp(smooth.energy, audioRaw.energy, 0.06);

    // Update shader uniforms
    const updateMaterial = (points: THREE.Points | null) => {
      if (!points) return;
      const mat = points.material as any;
      if (mat.uniforms) {
        mat.uniforms.uTime.value = time;
        mat.uniforms.uEnergy.value = smooth.energy;
        mat.uniforms.uBass.value = smooth.bass;
        mat.uniforms.uHigh.value = smooth.high;
        mat.uniforms.uKick.value = smooth.kick;
        mat.uniforms.uIntensity.value = settings.intensity;
      }
    };
    
    updateMaterial(corePointsRef.current);
    updateMaterial(glowPointsRef.current);
    updateMaterial(trailPointsRef.current);

    // Complex motion parameters
    const breathScale = 1 + smooth.sub * 0.25;
    const pulseScale = 1 + smooth.bass * 0.4 * settings.intensity;
    const vortexStrength = smooth.mid * 0.4 * settings.intensity;
    const turbulence = (smooth.mid * 0.5 + smooth.high * 0.4) * settings.intensity;
    const explosionForce = smooth.kick * 0.6 * settings.intensity;

    // Update core particles
    if (corePointsRef.current) {
      const posAttr = corePointsRef.current.geometry.attributes.position;
      const colAttr = corePointsRef.current.geometry.attributes.color;
      
      for (let i = 0; i < coreCount; i++) {
        const bx = coreBasePositions[i * 3];
        const by = coreBasePositions[i * 3 + 1];
        const bz = coreBasePositions[i * 3 + 2];
        const phase = corePhases[i];
        
        // Vortex flow motion
        const radius = Math.sqrt(bx * bx + by * by);
        const angle = Math.atan2(by, bx) + time * 0.2 * settings.speed + vortexStrength * 0.5;
        const vortexX = radius * Math.cos(angle);
        const vortexY = radius * Math.sin(angle);
        
        // Layered noise turbulence
        const noiseScale = 0.08;
        const n1 = noise3D(bx * noiseScale + time * 0.3, by * noiseScale, bz * noiseScale) * turbulence * 3;
        const n2 = noise3D(by * noiseScale, bz * noiseScale + time * 0.25, bx * noiseScale) * turbulence * 3;
        const n3 = noise3D(bz * noiseScale, bx * noiseScale, by * noiseScale + time * 0.2) * turbulence * 2;
        
        // Gravity well effect towards center on bass
        const distToCenter = Math.sqrt(bx * bx + by * by + bz * bz);
        const gravityPull = smooth.bass * 0.15 / (distToCenter * 0.05 + 1);
        
        // Explosion on kick
        const explosionDir = distToCenter > 0 ? explosionForce * (1 + phase) : 0;
        
        // Wave motion
        const waveOffset = Math.sin(time * 1.5 + phase * Math.PI * 2) * smooth.mid * 2;
        
        const finalX = (vortexX * breathScale + n1 + explosionDir * (bx / distToCenter || 0)) * pulseScale - bx * gravityPull;
        const finalY = (vortexY * breathScale + n2 + explosionDir * (by / distToCenter || 0)) * pulseScale - by * gravityPull;
        const finalZ = (bz * breathScale + n3 + waveOffset + explosionDir * (bz / distToCenter || 0)) - bz * gravityPull;
        
        posAttr.setXYZ(i, finalX, finalY, finalZ);
        
        // Dynamic color with smooth gradient flow
        const colorPhase = (phase + time * 0.08 * settings.speed) % 1;
        const colorIdx = Math.floor(colorPhase * settings.colorPalette.length);
        const nextColorIdx = (colorIdx + 1) % settings.colorPalette.length;
        const colorBlend = (colorPhase * settings.colorPalette.length) % 1;
        
        tempColor.set(settings.colorPalette[colorIdx]);
        tempColor2.set(settings.colorPalette[nextColorIdx]);
        tempColor.lerp(tempColor2, colorBlend);
        
        // Energy boost to brightness
        const energyBoost = smooth.energy * 0.3;
        tempColor.offsetHSL(0, 0, energyBoost);
        
        colAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
      }
      
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // Update glow particles (slower, larger motion)
    if (glowPointsRef.current) {
      const posAttr = glowPointsRef.current.geometry.attributes.position;
      const colAttr = glowPointsRef.current.geometry.attributes.color;
      
      for (let i = 0; i < glowCount; i++) {
        const bx = glowBasePositions[i * 3];
        const by = glowBasePositions[i * 3 + 1];
        const bz = glowBasePositions[i * 3 + 2];
        const phase = glowPhases[i];
        
        // Slower, smoother motion for glow layer
        const slowTime = time * 0.6;
        const radius = Math.sqrt(bx * bx + by * by);
        const angle = Math.atan2(by, bx) + slowTime * 0.15 * settings.speed;
        
        const breathe = 1 + smooth.sub * 0.3 + Math.sin(slowTime + phase * 6.28) * 0.1;
        
        const flowX = radius * Math.cos(angle) * breathe + Math.sin(slowTime * 0.5 + bz * 0.1) * turbulence * 2;
        const flowY = radius * Math.sin(angle) * breathe + Math.cos(slowTime * 0.4 + bx * 0.1) * turbulence * 2;
        const flowZ = bz * breathe * (1 + smooth.bass * 0.2);
        
        posAttr.setXYZ(i, flowX, flowY, flowZ);
        
        // Slightly desaturated colors for glow
        const colorPhase = (phase + time * 0.05 * settings.speed) % 1;
        const colorIdx = Math.floor(colorPhase * settings.colorPalette.length);
        tempColor.set(settings.colorPalette[colorIdx]);
        tempColor.offsetHSL(0, -0.2, 0.1);
        
        colAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
      }
      
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // Update trail particles (fast, erratic motion)
    if (trailPointsRef.current) {
      const posAttr = trailPointsRef.current.geometry.attributes.position;
      const colAttr = trailPointsRef.current.geometry.attributes.color;
      
      for (let i = 0; i < trailCount; i++) {
        const bx = trailBasePositions[i * 3];
        const by = trailBasePositions[i * 3 + 1];
        const bz = trailBasePositions[i * 3 + 2];
        const phase = trailPhases[i];
        
        // Fast, jittery motion
        const fastTime = time * 1.5;
        const jitter = smooth.high * 3 * settings.intensity;
        
        const tx = bx + Math.sin(fastTime * 2 + phase * 10) * jitter + Math.cos(fastTime + bz) * turbulence;
        const ty = by + Math.cos(fastTime * 1.8 + phase * 8) * jitter + Math.sin(fastTime * 0.9 + bx) * turbulence;
        const tz = bz + Math.sin(fastTime * 1.5 + phase * 12) * jitter * 0.5;
        
        // Drift towards center on bass hits
        const drift = smooth.bass * 0.1;
        
        posAttr.setXYZ(i, tx * (1 - drift), ty * (1 - drift), tz);
        
        // High frequencies create white sparkles
        const sparkle = smooth.high > 0.4 && Math.random() < 0.1;
        if (sparkle) {
          tempColor.setRGB(1, 1, 1);
        } else {
          const colorIdx = Math.floor(phase * settings.colorPalette.length);
          tempColor.set(settings.colorPalette[colorIdx]);
          tempColor.offsetHSL(0, 0, -0.1);
        }
        
        colAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
      }
      
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // Smooth group rotation
    groupRef.current.rotation.y += 0.001 * settings.speed * (1 + smooth.mid * 0.3);
    groupRef.current.rotation.x = smooth.sub * 0.1 * Math.sin(time * 0.15);
    groupRef.current.rotation.z = smooth.high * 0.03 * Math.cos(time * 0.2);

    // Update energy core
    if (energyCoreRef.current && energyCoreMaterialRef.current) {
      const coreScale = 1 + smooth.bass * 0.5 + smooth.kick * 0.8;
      energyCoreRef.current.scale.setScalar(coreScale);
      energyCoreRef.current.rotation.y += 0.01 * settings.speed;
      energyCoreRef.current.rotation.x = Math.sin(time * 0.5) * 0.2;
      
      const u = energyCoreMaterialRef.current.uniforms;
      u.uTime.value = time;
      u.uBass.value = smooth.bass;
      u.uEnergy.value = smooth.energy;
      u.uKick.value = smooth.kick;
      u.uColor1.value.set(settings.colorPalette[0] || "#ffffff");
      u.uColor2.value.set(settings.colorPalette[1] || "#6600ff");
    }

    // Update energy ring
    if (ringRef.current && ringMaterialRef.current) {
      const ringScale = 1 + smooth.sub * 0.3 + smooth.bass * 0.5;
      ringRef.current.scale.setScalar(ringScale);
      ringRef.current.rotation.z += 0.005 * settings.speed * (1 + smooth.mid);
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(time * 0.3) * 0.1;
      
      tempColor.set(settings.colorPalette[2] || settings.colorPalette[0] || "#00ffff");
      tempColor.offsetHSL(Math.sin(time * 0.5) * 0.1, 0, smooth.energy * 0.2);
      ringMaterialRef.current.color = tempColor;
      ringMaterialRef.current.opacity = 0.3 + smooth.energy * 0.4 + smooth.kick * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Energy core at center */}
      <mesh ref={energyCoreRef}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <shaderMaterial
          ref={energyCoreMaterialRef}
          {...EnergyCoreShader}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Energy ring around core */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[4, 0.15, 16, 64]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color="#00ffff"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      
      {/* Glow layer - larger, softer particles (rendered first, behind) */}
      <points ref={glowPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={glowCount} array={glowPositions} itemSize={3} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-color" count={glowCount} array={glowColors} itemSize={3} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aSize" count={glowCount} array={glowSizes} itemSize={1} />
          <bufferAttribute attach="attributes-aPhase" count={glowCount} array={glowPhases} itemSize={1} />
        </bufferGeometry>
        {/* @ts-ignore */}
        <particleGlowMaterial transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </points>
      
      {/* Trail layer - fine dust particles */}
      <points ref={trailPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={trailCount} array={trailPositions} itemSize={3} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-color" count={trailCount} array={trailColors} itemSize={3} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aSize" count={trailCount} array={trailSizes} itemSize={1} />
          <bufferAttribute attach="attributes-aPhase" count={trailCount} array={trailPhases} itemSize={1} />
        </bufferGeometry>
        {/* @ts-ignore */}
        <particleGlowMaterial transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </points>
      
      {/* Core layer - bright, dense particles (rendered last, on top) */}
      <points ref={corePointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={coreCount} array={corePositions} itemSize={3} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-color" count={coreCount} array={coreColors} itemSize={3} usage={THREE.DynamicDrawUsage} />
          <bufferAttribute attach="attributes-aSize" count={coreCount} array={coreSizes} itemSize={1} />
          <bufferAttribute attach="attributes-aPhase" count={coreCount} array={corePhases} itemSize={1} />
        </bufferGeometry>
        {/* @ts-ignore */}
        <particleGlowMaterial transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

// === PRESET 4: Waveform Sphere (PREMIUM) ===
function WaveformSphere({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const originalPositions = useRef<Float32Array | null>(null);
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });

  useFrame((state) => {
    if (!meshRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    const geometry = meshRef.current.geometry as THREE.BufferGeometry;
    const positionAttr = geometry.attributes.position;

    // Premium: Smooth audio interpolation
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smooth = smoothedAudioRef.current;
    smooth.sub = lerp(smooth.sub, audioRaw.sub, 0.08);
    smooth.bass = lerp(smooth.bass, audioRaw.bass, 0.12);
    smooth.mid = lerp(smooth.mid, audioRaw.mid, 0.15);
    smooth.high = lerp(smooth.high, audioRaw.high, 0.2);
    smooth.kick = lerp(smooth.kick, audioRaw.kick, 0.25);
    smooth.energy = lerp(smooth.energy, audioRaw.energy, 0.1);

    if (!originalPositions.current) {
      originalPositions.current = new Float32Array(positionAttr.array);
    }

    // Premium: Multi-layered breathing and scaling
    const globalScale = 1 + smooth.sub * 0.15 + smooth.kick * 0.25 + smooth.energy * 0.1;

    for (let i = 0; i < positionAttr.count; i++) {
      const ox = originalPositions.current[i * 3];
      const oy = originalPositions.current[i * 3 + 1];
      const oz = originalPositions.current[i * 3 + 2];
      
      const freqIndex = Math.floor((i / positionAttr.count) * (audioRaw.frequencyData?.length || 128));
      const freqValue = (audioRaw.frequencyData?.[freqIndex] || 0) / 255;
      
      // Premium: Layered displacement with frequency bands
      const bassDisp = smooth.bass * 0.3 * Math.sin(time * 0.5 + i * 0.02);
      const midDisp = smooth.mid * 0.2 * Math.sin(time * 1.5 + i * 0.05);
      const highDisp = smooth.high * 0.1 * Math.sin(time * 4 + i * 0.1);
      const freqDisp = freqValue * settings.intensity * 0.4;
      const kickPulse = smooth.kick * 0.3;
      
      const length = Math.sqrt(ox * ox + oy * oy + oz * oz);
      const nx = ox / length;
      const ny = oy / length;
      const nz = oz / length;
      
      const totalDisp = freqDisp + bassDisp + midDisp + highDisp + kickPulse;
      
      positionAttr.setXYZ(
        i,
        (ox + nx * totalDisp) * globalScale,
        (oy + ny * totalDisp) * globalScale,
        (oz + nz * totalDisp) * globalScale
      );
    }
    
    positionAttr.needsUpdate = true;
    
    // Premium: Organic rotation with smooth transitions
    meshRef.current.rotation.y += 0.003 * (1 + smooth.mid * 0.5);
    meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.15 * (1 + smooth.sub * 0.3);
    meshRef.current.rotation.z = Math.cos(time * 0.25) * 0.08 * smooth.high;
    
    // Premium: Dynamic material properties
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (mat) {
      mat.emissiveIntensity = 0.5 + smooth.energy * 0.8 * settings.intensity;
    }
  });

  const colors = settings.colorPalette;
  
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[3, 6]} />
      <meshStandardMaterial
        color={colors[0]}
        emissive={colors[1]}
        emissiveIntensity={0.6}
        wireframe
        transparent
        opacity={0.92}
        metalness={0.3}
        roughness={0.5}
      />
    </mesh>
  );
}

// === PRESET 5: Audio Bars (PREMIUM) ===
function AudioBars({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const barCount = 128; // Premium: Double the bars
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const smoothedHeights = useRef<Float32Array>(new Float32Array(barCount));
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });

  useFrame((state) => {
    if (!meshRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Premium: Smooth audio interpolation
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smooth = smoothedAudioRef.current;
    smooth.sub = lerp(smooth.sub, audioRaw.sub, 0.1);
    smooth.bass = lerp(smooth.bass, audioRaw.bass, 0.15);
    smooth.mid = lerp(smooth.mid, audioRaw.mid, 0.18);
    smooth.high = lerp(smooth.high, audioRaw.high, 0.22);
    smooth.kick = lerp(smooth.kick, audioRaw.kick, 0.25);
    smooth.energy = lerp(smooth.energy, audioRaw.energy, 0.12);

    // Premium: Global breathing from sub frequencies
    const breathScale = 1 + smooth.sub * 0.15;
    const radiusPulse = 5 + smooth.bass * 1.5 * settings.intensity;

    for (let i = 0; i < barCount; i++) {
      const freqIndex = Math.floor((i / barCount) * (audioRaw.frequencyData?.length || 128));
      const freqValue = (audioRaw.frequencyData?.[freqIndex] || 0) / 255;
      
      // Premium: Smooth height transitions
      const targetHeight = 0.3 + freqValue * 10 * settings.intensity + smooth.kick * 2;
      smoothedHeights.current[i] = lerp(smoothedHeights.current[i], targetHeight, 0.2);
      const height = smoothedHeights.current[i];
      
      const angle = (i / barCount) * Math.PI * 2;
      const waveOffset = Math.sin(time * 2 + i * 0.15) * 0.3 * smooth.mid;
      
      const x = Math.cos(angle) * (radiusPulse + waveOffset);
      const z = Math.sin(angle) * (radiusPulse + waveOffset);
      
      dummy.position.set(x * breathScale, height / 2, z * breathScale);
      dummy.scale.set(0.18, height, 0.18);
      dummy.rotation.set(0, -angle, 0);
      dummy.updateMatrix();
      
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Premium: Dynamic color based on frequency and audio
      const colorPhase = (i / barCount + time * 0.05) % 1;
      const colorIdx = Math.floor(colorPhase * settings.colorPalette.length);
      const color = new THREE.Color(settings.colorPalette[colorIdx % settings.colorPalette.length]);
      
      // Brightness based on frequency value
      color.offsetHSL(smooth.high * 0.02, 0, freqValue * 0.3 + smooth.energy * 0.2);
      meshRef.current.setColorAt(i, color);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    
    meshRef.current.rotation.y = time * 0.2;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, barCount]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// === PRESET 6: Geometric Kaleidoscope (PREMIUM) ===
function GeometricKaleidoscope({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  
  // Premium: More varied geometries with higher detail
  const geometries = useMemo(() => [
    new THREE.OctahedronGeometry(1, 1),
    new THREE.TetrahedronGeometry(1, 1),
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.DodecahedronGeometry(0.8, 1),
    new THREE.TorusKnotGeometry(0.5, 0.2, 64, 8),
    new THREE.TorusGeometry(0.6, 0.2, 16, 32),
  ], []);

  const count = 42; // Premium: More shapes

  useFrame((state) => {
    if (!groupRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Premium: Smooth audio interpolation
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smooth = smoothedAudioRef.current;
    smooth.sub = lerp(smooth.sub, audioRaw.sub, 0.08);
    smooth.bass = lerp(smooth.bass, audioRaw.bass, 0.12);
    smooth.mid = lerp(smooth.mid, audioRaw.mid, 0.15);
    smooth.high = lerp(smooth.high, audioRaw.high, 0.2);
    smooth.kick = lerp(smooth.kick, audioRaw.kick, 0.25);
    smooth.energy = lerp(smooth.energy, audioRaw.energy, 0.1);

    // Premium: Multi-axis rotation with smooth audio reactivity
    groupRef.current.rotation.y += 0.002 * (1 + smooth.mid * 0.5);
    groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.25 * (1 + smooth.sub * 0.3);
    groupRef.current.rotation.z = Math.cos(time * 0.15) * 0.1 * smooth.high;

    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      
      const layer = Math.floor(i / 7);
      const angleInLayer = (i % 7) / 7 * Math.PI * 2;
      const layerRadius = 2 + layer * 2.2;
      
      // Premium: Organic movement with audio-driven oscillation
      const orbitSpeed = 0.3 + layer * 0.12;
      const bassWave = smooth.bass * 0.8 * Math.sin(time * 1.5 + i * 0.3);
      const midWave = smooth.mid * 0.4 * Math.cos(time * 2 + i * 0.5);
      
      const x = Math.cos(angleInLayer + time * orbitSpeed) * (layerRadius + bassWave);
      const y = Math.sin(time * 1.5 + i * 0.4) * (1 + smooth.bass * settings.intensity * 2) + midWave;
      const z = Math.sin(angleInLayer + time * orbitSpeed) * (layerRadius + bassWave);
      
      mesh.position.set(x, y, z);
      
      // Premium: Varied rotation speeds with smooth transitions
      const rotSpeed = (layer + 1) * 0.3;
      mesh.rotation.x += 0.01 * rotSpeed * (1 + smooth.mid * 0.5);
      mesh.rotation.y += 0.008 * rotSpeed * (1 + smooth.high * 0.3);
      mesh.rotation.z = Math.sin(time * 0.5 + i * 0.2) * 0.4 * (1 + smooth.kick * 0.5);
      
      // Premium: Dynamic scaling with kick response
      const baseScale = 0.4 + (layer * 0.1);
      const energyScale = smooth.energy * settings.intensity * 0.6;
      const kickPop = smooth.kick * 0.4;
      const breathe = Math.sin(time * 1.5 + i * 0.3) * 0.15;
      mesh.scale.setScalar(baseScale + energyScale + kickPop + breathe);
      
      // Premium: Dynamic color with hue shifting
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        const colorPhase = (i / count + time * 0.02) % 1;
        const colorIdx = Math.floor(colorPhase * settings.colorPalette.length);
        const color = new THREE.Color(settings.colorPalette[colorIdx % settings.colorPalette.length]);
        color.offsetHSL(smooth.high * 0.03, 0, smooth.energy * 0.15);
        mat.emissive.copy(color);
        mat.emissiveIntensity = 0.4 + smooth.high * settings.intensity * 1.5 + smooth.kick * 0.5;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) meshRefs.current[i] = el; }}
          geometry={geometries[i % geometries.length]}
        >
          <meshStandardMaterial
            color="#000000"
            emissive={settings.colorPalette[i % settings.colorPalette.length]}
            emissiveIntensity={1}
            roughness={0.15}
            metalness={0.9}
            transparent
            opacity={0.92}
          />
        </mesh>
      ))}
    </group>
  );
}

// === PRESET 7: Cosmic Web (PREMIUM) ===
function CosmicWeb({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const nodeCount = 120; // Premium: Optimized node count for performance
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  const tempColor = useMemo(() => new THREE.Color(), []); // Reused color object
  
  const [nodePositions, velocities, basePositions] = useMemo(() => {
    const pos = new Float32Array(nodeCount * 3);
    const vel = new Float32Array(nodeCount * 3);
    const base = new Float32Array(nodeCount * 3);
    for (let i = 0; i < nodeCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 6 + Math.random() * 12;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      base[i * 3] = x;
      base[i * 3 + 1] = y;
      base[i * 3 + 2] = z;
      vel[i * 3] = (Math.random() - 0.5) * 0.03;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.03;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.03;
    }
    return [pos, vel, base];
  }, []);

  const linePositions = useMemo(() => {
    return new Float32Array(nodeCount * nodeCount * 6);
  }, []);

  const lineColors = useMemo(() => {
    return new Float32Array(nodeCount * nodeCount * 6);
  }, []);

  useFrame((state) => {
    if (!pointsRef.current || !linesRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Premium: Smooth audio interpolation
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smooth = smoothedAudioRef.current;
    smooth.sub = lerp(smooth.sub, audioRaw.sub, 0.08);
    smooth.bass = lerp(smooth.bass, audioRaw.bass, 0.12);
    smooth.mid = lerp(smooth.mid, audioRaw.mid, 0.15);
    smooth.high = lerp(smooth.high, audioRaw.high, 0.2);
    smooth.kick = lerp(smooth.kick, audioRaw.kick, 0.25);
    smooth.energy = lerp(smooth.energy, audioRaw.energy, 0.1);

    const posAttr = pointsRef.current.geometry.attributes.position;
    
    // Premium: Dynamic connection threshold based on multiple audio bands
    const connectionThreshold = 3.5 + smooth.energy * settings.intensity * 2.5 + smooth.bass * 1.5;
    
    // Premium: Breathing effect from sub frequencies
    const breathScale = 1 + smooth.sub * 0.15;
    
    for (let i = 0; i < nodeCount; i++) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];
      const bz = basePositions[i * 3 + 2];
      
      // Premium: Layered noise motion with multiple frequencies
      const noise1 = Math.sin(time * 0.5 + i * 0.1) * velocities[i * 3] * smooth.energy * 15;
      const noise2 = Math.cos(time * 0.7 + i * 0.13) * velocities[i * 3 + 1] * smooth.mid * 8;
      const noise3 = Math.sin(time * 0.3 + i * 0.17) * velocities[i * 3 + 2] * smooth.bass * 6;
      
      const x = (bx + noise1 + noise3) * breathScale;
      const y = (by + noise2) * breathScale;
      const z = (bz + noise1 * 0.5 + noise2 * 0.5) * breathScale;
      
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;

    let lineIndex = 0;
    const lineGeom = linesRef.current.geometry as THREE.BufferGeometry;
    const linePosAttr = lineGeom.attributes.position;
    const lineColorAttr = lineGeom.attributes.color;

    // Premium: Optimized connection calculation
    for (let i = 0; i < nodeCount; i++) {
      const x1 = posAttr.getX(i);
      const y1 = posAttr.getY(i);
      const z1 = posAttr.getZ(i);
      
      for (let j = i + 1; j < nodeCount; j++) {
        const x2 = posAttr.getX(j);
        const y2 = posAttr.getY(j);
        const z2 = posAttr.getZ(j);
        
        const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (dist < connectionThreshold && lineIndex < nodeCount * nodeCount * 2) {
          linePosAttr.setXYZ(lineIndex * 2, x1, y1, z1);
          linePosAttr.setXYZ(lineIndex * 2 + 1, x2, y2, z2);
          
          // Premium: Gradient colors along connections (reusing tempColor)
          const colorPhase = ((i + j) / nodeCount + time * 0.02) % 1;
          const colorIdx = Math.floor(colorPhase * settings.colorPalette.length);
          tempColor.set(settings.colorPalette[colorIdx % settings.colorPalette.length]);
          
          // Brightness based on distance and audio
          const alpha = (1 - dist / connectionThreshold) * (0.6 + smooth.high * 0.4);
          tempColor.offsetHSL(smooth.high * 0.02, 0, smooth.energy * 0.1);
          
          lineColorAttr.setXYZ(lineIndex * 2, tempColor.r * alpha, tempColor.g * alpha, tempColor.b * alpha);
          lineColorAttr.setXYZ(lineIndex * 2 + 1, tempColor.r * alpha * 0.7, tempColor.g * alpha * 0.7, tempColor.b * alpha * 0.7);
          
          lineIndex++;
        }
      }
    }
    
    for (let i = lineIndex * 2; i < linePosAttr.count; i++) {
      linePosAttr.setXYZ(i, 0, 0, 0);
    }
    
    linePosAttr.needsUpdate = true;
    lineColorAttr.needsUpdate = true;
    
    // Premium: Smooth multi-axis rotation
    pointsRef.current.rotation.y += 0.002 * (1 + smooth.mid * 0.3);
    pointsRef.current.rotation.x = smooth.sub * 0.1 * Math.sin(time * 0.2);
    linesRef.current.rotation.y = pointsRef.current.rotation.y;
    linesRef.current.rotation.x = pointsRef.current.rotation.x;
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={nodeCount}
            array={nodePositions}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.3}
          color={settings.colorPalette[0]}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={nodeCount * nodeCount * 2}
            array={linePositions}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
          <bufferAttribute
            attach="attributes-color"
            count={nodeCount * nodeCount * 2}
            array={lineColors}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

// === PRESET 8: Cymatic Sand Plate ===
// Particles settle into standing-wave node patterns like Chladni figures
function CymaticSandPlate({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const pointsRef = useRef<THREE.Points>(null);
  const velocitiesRef = useRef<Float32Array | null>(null);
  const lastKickRef = useRef(0);
  const particleCount = 2500;
  
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    return pos;
  }, []);

  const colors = useMemo(() => {
    const col = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      col[i * 3] = 0.7;
      col[i * 3 + 1] = 0.6;
      col[i * 3 + 2] = 0.5;
    }
    return col;
  }, []);

  useEffect(() => {
    velocitiesRef.current = new Float32Array(particleCount * 3);
  }, []);

  useFrame((state) => {
    if (!pointsRef.current || !velocitiesRef.current) return;
    const { bass, high, kick, modeIndex, energy } = getAudioData();
    const time = state.clock.getElapsedTime();
    
    const posAttr = pointsRef.current.geometry.attributes.position;
    const colorAttr = pointsRef.current.geometry.attributes.color;
    const vel = velocitiesRef.current;
    
    // Mode determines the wave pattern (m, n) integers
    const modePatterns = [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4], [5, 5], [6, 5]];
    const [m, n] = modePatterns[Math.max(0, Math.min(7, modeIndex - 1))];
    
    // Kick burst detection (only on rising edge)
    const kickBurst = kick > 0.3 && kick > lastKickRef.current + 0.1 ? kick * 0.4 : 0;
    lastKickRef.current = kick;
    
    // Vibration intensity from bass
    const vibration = bass * settings.intensity * 0.3;
    
    for (let i = 0; i < particleCount; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      
      // Standing wave: sin(m*x)*sin(n*y) - nodes at zero crossings
      const waveValue = Math.sin(m * x * 0.5) * Math.sin(n * y * 0.5);
      
      // Analytical gradient toward node lines (faster than finite difference)
      const dx = 0.5 * m * Math.cos(m * x * 0.5) * Math.sin(n * y * 0.5);
      const dy = 0.5 * n * Math.sin(m * x * 0.5) * Math.cos(n * y * 0.5);
      
      // Force toward nodes: particles move to where wave = 0
      const settleSpeed = 0.02 * settings.speed * energy;
      const forceX = -Math.sign(waveValue) * dx * settleSpeed;
      const forceY = -Math.sign(waveValue) * dy * settleSpeed;
      
      // Apply forces + kick burst (deterministic per particle to avoid noise)
      vel[i * 3] += forceX;
      vel[i * 3 + 1] += forceY;
      
      if (kickBurst > 0) {
        const angle = Math.atan2(y, x) + i * 0.01;
        vel[i * 3] += Math.cos(angle) * kickBurst;
        vel[i * 3 + 1] += Math.sin(angle) * kickBurst;
      }
      
      vel[i * 3 + 2] = Math.sin(time * 4 + i * 0.1) * vibration * 0.08;
      
      // Strong damping for stable settling
      vel[i * 3] *= 0.92;
      vel[i * 3 + 1] *= 0.92;
      
      posAttr.setXYZ(i,
        Math.max(-5, Math.min(5, x + vel[i * 3])),
        Math.max(-5, Math.min(5, y + vel[i * 3 + 1])),
        z * 0.85 + vel[i * 3 + 2]
      );
      
      // Color: particles on nodes glow brighter
      const nodeProximity = 1 - Math.min(1, Math.abs(waveValue));
      const palette = settings.colorPalette;
      const color = new THREE.Color(palette[i % palette.length]);
      color.offsetHSL(0, 0, nodeProximity * 0.4 + high * 0.15);
      colorAttr.setXYZ(i, color.r, color.g, color.b);
    }
    
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// === PRESET 9: Water Membrane Orb ===
// Spherical membrane with standing wave deformations like liquid resonance
function WaterMembraneOrb({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const outerMeshRef = useRef<THREE.Mesh>(null);
  const innerMeshRef = useRef<THREE.Mesh>(null);
  const coreMeshRef = useRef<THREE.Mesh>(null);
  const outerOriginalPositions = useRef<Float32Array | null>(null);
  const innerOriginalPositions = useRef<Float32Array | null>(null);
  const smoothedAudio = useRef({ sub: 0, bass: 0, mid: 0, high: 0, energy: 0 });

  // Custom water shader for the outer membrane
  const waterShader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color("#00ccff") },
      uColor2: { value: new THREE.Color("#0066ff") },
      uColor3: { value: new THREE.Color("#ffffff") },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uEnergy: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uBass;
      uniform float uMid;
      uniform float uHigh;
      uniform float uEnergy;
      
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      
      // Fresnel effect for edge glow
      float fresnel(vec3 normal, vec3 viewDir, float power) {
        return pow(1.0 - abs(dot(normal, viewDir)), power);
      }
      
      // Caustic pattern
      float caustic(vec2 uv, float time) {
        vec2 p = uv * 8.0;
        float c = 0.0;
        for(int i = 0; i < 3; i++) {
          float fi = float(i);
          p += vec2(sin(p.y + time * (0.5 + fi * 0.2)), cos(p.x + time * (0.3 + fi * 0.15)));
          c += 1.0 / length(fract(p) - 0.5);
        }
        return c / 3.0;
      }
      
      void main() {
        vec3 viewDir = normalize(cameraPosition - vPosition);
        
        // Fresnel rim lighting
        float rim = fresnel(vNormal, viewDir, 2.5);
        
        // Caustic shimmer driven by highs
        float causticPattern = caustic(vUv, uTime * 2.0) * uHigh * 0.4;
        
        // Base color gradient based on position
        float gradient = (vPosition.y + 3.0) / 6.0;
        vec3 baseColor = mix(uColor1, uColor2, gradient);
        
        // Add energy-reactive iridescence
        float iridescence = sin(vPosition.x * 5.0 + uTime) * sin(vPosition.z * 5.0 - uTime) * 0.5 + 0.5;
        baseColor = mix(baseColor, uColor3, iridescence * uEnergy * 0.3);
        
        // Combine effects
        vec3 finalColor = baseColor;
        finalColor += uColor3 * rim * (0.4 + uBass * 0.6); // Rim glow
        finalColor += uColor3 * causticPattern; // Caustic highlights
        finalColor += baseColor * uMid * 0.3; // Mid boost
        
        // Transparency based on fresnel
        float alpha = 0.5 + rim * 0.4 + uEnergy * 0.1;
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
  }), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const audio = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Smooth audio values for premium feel
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    smoothedAudio.current.sub = lerp(smoothedAudio.current.sub, audio.sub, 0.08);
    smoothedAudio.current.bass = lerp(smoothedAudio.current.bass, audio.bass, 0.12);
    smoothedAudio.current.mid = lerp(smoothedAudio.current.mid, audio.mid, 0.15);
    smoothedAudio.current.high = lerp(smoothedAudio.current.high, audio.high, 0.18);
    smoothedAudio.current.energy = lerp(smoothedAudio.current.energy, audio.energy, 0.1);
    
    const { sub, bass, mid, high, energy } = smoothedAudio.current;
    const modeIndex = audio.modeIndex;
    const lobes = modeIndex + 2;
    
    // Update outer membrane
    if (outerMeshRef.current) {
      const geometry = outerMeshRef.current.geometry as THREE.BufferGeometry;
      const positionAttr = geometry.attributes.position;
      
      if (!outerOriginalPositions.current) {
        outerOriginalPositions.current = new Float32Array(positionAttr.array);
      }
      
      const breathScale = 1 + sub * 0.12;
      
      for (let i = 0; i < positionAttr.count; i++) {
        const ox = outerOriginalPositions.current[i * 3];
        const oy = outerOriginalPositions.current[i * 3 + 1];
        const oz = outerOriginalPositions.current[i * 3 + 2];
        
        const r = Math.sqrt(ox * ox + oy * oy + oz * oz);
        const theta = Math.atan2(oy, ox);
        const phi = Math.acos(oz / (r || 1));
        
        // Multi-layer standing waves
        const wave1 = Math.sin(lobes * theta + time) * Math.sin(phi * 3);
        const wave2 = Math.cos((lobes + 1) * theta - time * 0.7) * Math.sin(phi * 2);
        const wave3 = Math.sin(lobes * 2 * theta + time * 1.3) * Math.cos(phi * 4) * 0.5;
        const displacement = (wave1 * mid + wave2 * bass + wave3 * high * 0.5) * settings.intensity * 0.25;
        
        // High-frequency ripples
        const ripple = high * 0.03 * Math.sin(time * 12 + theta * 8 + phi * 6);
        
        const newR = (r + displacement + ripple) * breathScale;
        const nx = ox / r || 0;
        const ny = oy / r || 0;
        const nz = oz / r || 0;
        
        positionAttr.setXYZ(i, nx * newR, ny * newR, nz * newR);
      }
      
      positionAttr.needsUpdate = true;
      geometry.computeVertexNormals();
      
      // Update shader uniforms
      const material = outerMeshRef.current.material as THREE.ShaderMaterial;
      if (material.uniforms) {
        material.uniforms.uTime.value = time;
        material.uniforms.uBass.value = bass;
        material.uniforms.uMid.value = mid;
        material.uniforms.uHigh.value = high;
        material.uniforms.uEnergy.value = energy;
        
        const colors = settings.colorPalette;
        if (colors[0]) material.uniforms.uColor1.value.set(colors[0]);
        if (colors[1]) material.uniforms.uColor2.value.set(colors[1]);
        if (colors[2]) material.uniforms.uColor3.value.set(colors[2]);
      }
    }
    
    // Update inner layer with offset waves
    if (innerMeshRef.current) {
      const geometry = innerMeshRef.current.geometry as THREE.BufferGeometry;
      const positionAttr = geometry.attributes.position;
      
      if (!innerOriginalPositions.current) {
        innerOriginalPositions.current = new Float32Array(positionAttr.array);
      }
      
      for (let i = 0; i < positionAttr.count; i++) {
        const ox = innerOriginalPositions.current[i * 3];
        const oy = innerOriginalPositions.current[i * 3 + 1];
        const oz = innerOriginalPositions.current[i * 3 + 2];
        
        const r = Math.sqrt(ox * ox + oy * oy + oz * oz);
        const theta = Math.atan2(oy, ox);
        const phi = Math.acos(oz / (r || 1));
        
        // Counter-rotating waves for depth
        const wave = Math.sin(lobes * theta - time * 0.8) * Math.sin(phi * 2.5);
        const displacement = wave * bass * settings.intensity * 0.15;
        
        const newR = r + displacement;
        const nx = ox / r || 0;
        const ny = oy / r || 0;
        const nz = oz / r || 0;
        
        positionAttr.setXYZ(i, nx * newR, ny * newR, nz * newR);
      }
      
      positionAttr.needsUpdate = true;
    }
    
    // Animate core glow
    if (coreMeshRef.current) {
      const scale = 0.8 + energy * 0.4 + Math.sin(time * 2) * 0.1;
      coreMeshRef.current.scale.setScalar(scale);
      
      const material = coreMeshRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.3 + bass * 0.4;
    }
    
    // Smooth group rotation
    groupRef.current.rotation.y = time * 0.15;
    groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.08;
    groupRef.current.rotation.z = Math.cos(time * 0.25) * 0.05;
  });

  const colors = settings.colorPalette;
  
  return (
    <group ref={groupRef}>
      {/* Inner glowing core */}
      <mesh ref={coreMeshRef}>
        <icosahedronGeometry args={[1.2, 3]} />
        <meshBasicMaterial
          color={colors[2] || "#ffffff"}
          transparent
          opacity={0.4}
        />
      </mesh>
      
      {/* Inner membrane layer */}
      <mesh ref={innerMeshRef}>
        <icosahedronGeometry args={[2.2, 5]} />
        <meshStandardMaterial
          color={colors[1] || "#0066ff"}
          emissive={colors[1] || "#0044aa"}
          emissiveIntensity={0.3}
          transparent
          opacity={0.35}
          metalness={0.5}
          roughness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Outer water membrane with custom shader */}
      <mesh ref={outerMeshRef}>
        <icosahedronGeometry args={[3, 6]} />
        <shaderMaterial
          {...waterShader}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// === PRESET 10: Chladni Geometry (ULTRA PREMIUM) ===
// Sacred geometry Chladni patterns with multi-layer rendering, glow, and node particles
function ChladniGeometry({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const mainMeshRef = useRef<THREE.Mesh>(null);
  const glowMeshRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const mainMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const glowMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Premium Chladni shader with multi-layer patterns
  const chladniShader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uM: { value: 3 },
      uN: { value: 2 },
      uSub: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uKick: { value: 0 },
      uEnergy: { value: 0 },
      uColor1: { value: new THREE.Color("#ffffff") },
      uColor2: { value: new THREE.Color("#6600ff") },
      uColor3: { value: new THREE.Color("#00ffff") },
      uIntensity: { value: 1.0 },
      uSpeed: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;
      uniform float uTime;
      uniform float uBass;
      uniform float uMid;
      uniform float uM;
      uniform float uN;
      uniform float uIntensity;
      
      void main() {
        vUv = uv;
        vPosition = position;
        
        // 3D displacement based on Chladni pattern
        vec2 uvCenter = uv * 2.0 - 1.0;
        float pattern1 = sin(uM * uvCenter.x * 3.14159) * sin(uN * uvCenter.y * 3.14159);
        float pattern2 = sin(uN * uvCenter.x * 3.14159) * sin(uM * uvCenter.y * 3.14159);
        float chladni = pattern1 - pattern2;
        
        // Breathing displacement
        float displacement = abs(chladni) * uBass * uIntensity * 0.8;
        displacement += sin(uTime * 2.0 + length(uvCenter) * 5.0) * uMid * 0.2;
        
        vec3 newPosition = position;
        newPosition.z += displacement;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uM;
      uniform float uN;
      uniform float uSub;
      uniform float uBass;
      uniform float uMid;
      uniform float uHigh;
      uniform float uKick;
      uniform float uEnergy;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uIntensity;
      uniform float uSpeed;
      varying vec2 vUv;
      varying vec3 vPosition;
      
      // Smooth noise function
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
      
      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        float dist = length(uv);
        
        // Multi-layer Chladni patterns
        float m1 = uM;
        float n1 = uN;
        float m2 = uM + 1.0;
        float n2 = uN + 1.0;
        
        // Primary pattern
        float pattern1 = sin(m1 * uv.x * 3.14159) * sin(n1 * uv.y * 3.14159);
        float pattern2 = sin(n1 * uv.x * 3.14159) * sin(m1 * uv.y * 3.14159);
        float chladni1 = pattern1 - pattern2;
        
        // Secondary pattern (rotated, different mode)
        vec2 uvRot = vec2(
          uv.x * cos(uTime * 0.1) - uv.y * sin(uTime * 0.1),
          uv.x * sin(uTime * 0.1) + uv.y * cos(uTime * 0.1)
        );
        float pattern3 = sin(m2 * uvRot.x * 3.14159) * sin(n2 * uvRot.y * 3.14159);
        float pattern4 = sin(n2 * uvRot.x * 3.14159) * sin(m2 * uvRot.y * 3.14159);
        float chladni2 = pattern3 - pattern4;
        
        // Circular/radial pattern overlay
        float radialM = uM + uBass * 2.0;
        float radialPattern = sin(dist * radialM * 3.14159 + uTime * uSpeed) * cos(atan(uv.y, uv.x) * uN * 2.0);
        
        // Combine patterns with audio modulation
        float combined = chladni1 * 0.6 + chladni2 * 0.25 * uMid + radialPattern * 0.15 * uSub;
        
        // Node line thickness with audio reactivity
        float baseThickness = 0.08 + uBass * 0.08 + uSub * 0.05;
        float node = 1.0 - smoothstep(0.0, baseThickness * uIntensity, abs(combined));
        
        // Secondary thinner lines for detail
        float thinNode = 1.0 - smoothstep(0.0, baseThickness * 0.3, abs(chladni1));
        node = max(node, thinNode * 0.4 * uMid);
        
        // Glow bloom around nodes
        float glow = 1.0 - smoothstep(0.0, baseThickness * 3.0, abs(combined));
        glow *= 0.3 + uEnergy * 0.4;
        
        // Sparkle on high frequencies
        float sparkle = 0.0;
        if (uHigh > 0.3) {
          float sparkleNoise = noise(uv * 50.0 + uTime * 5.0);
          sparkle = step(0.92, sparkleNoise) * uHigh * 1.5;
        }
        
        // Kick pulse wave
        float kickWave = sin(dist * 20.0 - uTime * 8.0) * uKick * 0.3;
        kickWave = max(0.0, kickWave);
        
        // Multi-color gradient based on pattern value and position
        float colorMix1 = smoothstep(-0.5, 0.5, combined);
        float colorMix2 = smoothstep(0.0, 1.0, dist);
        vec3 baseColor = mix(uColor1, uColor2, colorMix1);
        baseColor = mix(baseColor, uColor3, colorMix2 * 0.4 + uHigh * 0.3);
        
        // Add glow color (brighter version)
        vec3 glowColor = baseColor * (1.0 + glow * 2.0) + vec3(0.1, 0.15, 0.2) * glow;
        
        // Sparkle adds white
        glowColor += vec3(1.0, 1.0, 0.9) * sparkle;
        
        // Kick wave adds brightness
        glowColor += baseColor * kickWave;
        
        // Final color with node intensity
        vec3 finalColor = glowColor * (node + glow * 0.5);
        
        // Circular fade with soft edge
        float fade = 1.0 - smoothstep(0.75, 1.0, dist);
        float alpha = (node * 0.9 + glow * 0.4 + sparkle + kickWave * 0.5) * fade;
        alpha = clamp(alpha, 0.0, 1.0);
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `
  }), []);

  // Outer glow layer shader (softer, larger)
  const glowShader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uM: { value: 3 },
      uN: { value: 2 },
      uBass: { value: 0 },
      uEnergy: { value: 0 },
      uColor1: { value: new THREE.Color("#ffffff") },
      uColor2: { value: new THREE.Color("#6600ff") },
      uIntensity: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uM;
      uniform float uN;
      uniform float uBass;
      uniform float uEnergy;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform float uIntensity;
      varying vec2 vUv;
      
      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        float dist = length(uv);
        
        // Soft Chladni pattern for outer glow
        float pattern1 = sin(uM * uv.x * 3.14159) * sin(uN * uv.y * 3.14159);
        float pattern2 = sin(uN * uv.x * 3.14159) * sin(uM * uv.y * 3.14159);
        float chladni = pattern1 - pattern2;
        
        // Very wide, soft glow
        float thickness = 0.4 + uBass * 0.2;
        float glow = 1.0 - smoothstep(0.0, thickness * uIntensity, abs(chladni));
        glow *= 0.2 + uEnergy * 0.15;
        
        // Color
        vec3 color = mix(uColor2, uColor1, glow);
        
        // Fade at edges
        float fade = 1.0 - smoothstep(0.6, 1.0, dist);
        
        gl_FragColor = vec4(color * glow, glow * fade * 0.4);
      }
    `
  }), []);

  // Node particles that follow the pattern (optimized count for performance)
  const particleCount = 800;
  const [particlePositions, particlePhases] = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      // Distribute on a disc
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 6;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = 0;
      phases[i] = Math.random();
    }
    return [positions, phases];
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Smooth audio interpolation
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smooth = smoothedAudioRef.current;
    smooth.sub = lerp(smooth.sub, audioRaw.sub, 0.06);
    smooth.bass = lerp(smooth.bass, audioRaw.bass, 0.1);
    smooth.mid = lerp(smooth.mid, audioRaw.mid, 0.12);
    smooth.high = lerp(smooth.high, audioRaw.high, 0.18);
    smooth.kick = lerp(smooth.kick, audioRaw.kick, 0.25);
    smooth.energy = lerp(smooth.energy, audioRaw.energy, 0.08);
    
    // Mode patterns for (m, n) - more complex patterns
    const patterns = [[2, 3], [3, 4], [4, 5], [3, 5], [4, 6], [5, 6], [5, 7], [6, 7], [7, 8], [4, 7]];
    const modeIndex = audioRaw.modeIndex || 1;
    const [m, n] = patterns[Math.max(0, Math.min(patterns.length - 1, modeIndex - 1))];
    
    // Update main shader
    if (mainMaterialRef.current) {
      const u = mainMaterialRef.current.uniforms;
      u.uTime.value = time;
      u.uM.value = m;
      u.uN.value = n;
      u.uSub.value = smooth.sub;
      u.uBass.value = smooth.bass;
      u.uMid.value = smooth.mid;
      u.uHigh.value = smooth.high;
      u.uKick.value = smooth.kick;
      u.uEnergy.value = smooth.energy;
      u.uIntensity.value = settings.intensity;
      u.uSpeed.value = settings.speed;
      
      const colors = settings.colorPalette;
      u.uColor1.value.set(colors[0] || "#ffffff");
      u.uColor2.value.set(colors[1] || "#6600ff");
      u.uColor3.value.set(colors[2] || "#00ffff");
    }
    
    // Update glow shader
    if (glowMaterialRef.current) {
      const u = glowMaterialRef.current.uniforms;
      u.uTime.value = time;
      u.uM.value = m;
      u.uN.value = n;
      u.uBass.value = smooth.bass;
      u.uEnergy.value = smooth.energy;
      u.uIntensity.value = settings.intensity;
      
      const colors = settings.colorPalette;
      u.uColor1.value.set(colors[0] || "#ffffff");
      u.uColor2.value.set(colors[1] || "#6600ff");
    }
    
    // Animate particles to follow node lines (optimized loop)
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.attributes.position;
      const material = particlesRef.current.material as THREE.PointsMaterial;
      
      // Dynamic particle size and color (material-level, affects all particles uniformly)
      material.size = 0.1 + smooth.energy * 0.08 + smooth.high * 0.05;
      const colorIdx = Math.floor(time * 0.2) % settings.colorPalette.length;
      tempColor.set(settings.colorPalette[colorIdx]);
      tempColor.offsetHSL(0, 0, smooth.energy * 0.2);
      material.color = tempColor;
      
      // Precompute constants outside loop
      const attractionStrength = 0.025 * settings.intensity * (1 + smooth.bass * 0.5);
      const turbulence = smooth.mid * 0.12 + smooth.high * 0.08;
      const kickForce = smooth.kick * 0.35;
      const mPi = m * Math.PI;
      const nPi = n * Math.PI;
      const maxDist = 6;
      const heightScale = smooth.bass * settings.intensity * 0.4;
      
      for (let i = 0; i < particleCount; i++) {
        let px = posAttr.getX(i);
        let py = posAttr.getY(i);
        const phase = particlePhases[i];
        
        // Normalize to -1 to 1 range
        const nx = px / 6;
        const ny = py / 6;
        
        // Optimized Chladni calculation (inline, fewer trig calls)
        const sinMX = Math.sin(mPi * nx);
        const sinNY = Math.sin(nPi * ny);
        const sinNX = Math.sin(nPi * nx);
        const sinMY = Math.sin(mPi * ny);
        const cv = sinMX * sinNY - sinNX * sinMY;
        
        // Approximate gradient using analytical derivative
        const cosMX = Math.cos(mPi * nx);
        const cosNY = Math.cos(nPi * ny);
        const cosNX = Math.cos(nPi * nx);
        const cosMY = Math.cos(mPi * ny);
        const dx = (mPi * cosMX * sinNY - nPi * cosNX * sinMY) / 6;
        const dy = (nPi * sinMX * cosNY - mPi * sinNX * cosMY) / 6;
        
        // Move towards nodes
        px -= dx * cv * attractionStrength;
        py -= dy * cv * attractionStrength;
        
        // Add turbulence from audio
        px += Math.sin(time * 2 + phase * 10) * turbulence;
        py += Math.cos(time * 1.8 + phase * 8) * turbulence;
        
        // Kick causes outward burst
        const distSq = px * px + py * py;
        if (distSq > 0.01 && kickForce > 0.01) {
          const invDist = 1 / Math.sqrt(distSq);
          px += px * invDist * kickForce;
          py += py * invDist * kickForce;
        }
        
        // Keep within bounds
        if (distSq > maxDist * maxDist) {
          const angle = phase * Math.PI * 2 + time;
          const radius = Math.sqrt(phase) * maxDist * 0.8;
          px = Math.cos(angle) * radius;
          py = Math.sin(angle) * radius;
        }
        
        // Height based on pattern value (reuse cv)
        const pz = Math.abs(cv) * heightScale;
        
        posAttr.setXYZ(i, px, py, pz);
      }
      posAttr.needsUpdate = true;
    }
    
    // Subtle group rotation
    groupRef.current.rotation.z = Math.sin(time * 0.1) * 0.05 * smooth.sub;
  });

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      {/* Outer glow layer (behind) */}
      <mesh ref={glowMeshRef} position={[0, 0, -0.1]}>
        <planeGeometry args={[16, 16, 1, 1]} />
        <shaderMaterial
          ref={glowMaterialRef}
          {...glowShader}
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      
      {/* Main Chladni pattern with 3D displacement */}
      <mesh ref={mainMeshRef}>
        <planeGeometry args={[12, 12, 64, 64]} />
        <shaderMaterial
          ref={mainMaterialRef}
          {...chladniShader}
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      
      {/* Node particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={particleCount} array={particlePositions} itemSize={3} usage={THREE.DynamicDrawUsage} />
        </bufferGeometry>
        <pointsMaterial
          size={0.1}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          depthWrite={false}
          depthTest={false}
        />
      </points>
    </group>
  );
}

// === PRESET 11: Resonant Field Lines ===
// Magnetic-field style curves that organize into symmetric lattices (optimized)
function ResonantFieldLines({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const lineCount = 36;
  const pointsPerLine = 35;
  
  // Pre-create line objects with reusable geometries
  const lineObjects = useMemo(() => {
    const lines: THREE.Line[] = [];
    for (let i = 0; i < lineCount; i++) {
      const positions = new Float32Array(pointsPerLine * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.75 
      });
      lines.push(new THREE.Line(geometry, material));
    }
    return lines;
  }, []);

  // Cleanup geometries and materials on unmount
  useEffect(() => {
    return () => {
      lineObjects.forEach((line) => {
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
    };
  }, [lineObjects]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const { sub, bass, mid, high, modeIndex, energy } = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    const symmetry = modeIndex + 2;
    const fieldStrength = (sub + bass) * 0.5 * settings.intensity;
    
    lineObjects.forEach((line, idx) => {
      const geometry = line.geometry as THREE.BufferGeometry;
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const angle = (idx / lineCount) * Math.PI * 2;
      
      for (let j = 0; j < pointsPerLine; j++) {
        const t = j / pointsPerLine;
        const baseRadius = 1.5 + t * 3;
        const symMod = Math.sin(angle * symmetry + time) * fieldStrength;
        const r = baseRadius * (1 + symMod * 0.3);
        const spiralAngle = angle + t * Math.PI * 2.5 + time * 0.15;
        const x = Math.cos(spiralAngle) * r;
        const y = (t - 0.5) * 7 + Math.sin(time * 0.7 + t * 4) * mid * 0.4;
        const z = Math.sin(spiralAngle) * r;
        posAttr.setXYZ(j, x, y, z);
      }
      posAttr.needsUpdate = true;
      
      const material = line.material as THREE.LineBasicMaterial;
      const colorIdx = idx % settings.colorPalette.length;
      const color = new THREE.Color(settings.colorPalette[colorIdx]);
      color.offsetHSL(Math.sin(time * 0.5 + idx * 0.2) * 0.05, 0, high * 0.15 + energy * 0.1);
      material.color = color;
    });
    
    groupRef.current.rotation.y = time * 0.08;
  });

  return (
    <group ref={groupRef}>
      {lineObjects.map((line, idx) => (
        <primitive key={idx} object={line} />
      ))}
    </group>
  );
}

// Psy trance shader material for background image
const PsyFilterMaterial = shaderMaterial(
  {
    uTexture: null,
    uTime: 0,
    uIntensity: 1.0,
    uFilterType: 0,
    uEnergy: 0,
  },
  // Vertex shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uIntensity;
    uniform int uFilterType;
    uniform float uEnergy;
    varying vec2 vUv;
    
    #define PI 3.14159265359
    
    vec2 kaleidoscope(vec2 uv, float segments) {
      vec2 centered = uv - 0.5;
      float angle = atan(centered.y, centered.x);
      float radius = length(centered);
      float segmentAngle = PI * 2.0 / segments;
      angle = mod(angle, segmentAngle);
      angle = abs(angle - segmentAngle * 0.5);
      return vec2(cos(angle), sin(angle)) * radius + 0.5;
    }
    
    vec2 mirror(vec2 uv) {
      vec2 centered = uv - 0.5;
      float angle = atan(centered.y, centered.x) + uTime * 0.3;
      float radius = length(centered);
      vec2 mirrored = vec2(abs(centered.x), abs(centered.y));
      float wave = sin(angle * 4.0 + uTime) * 0.1 * uIntensity;
      return mirrored + 0.5 + wave;
    }
    
    vec3 colorShift(vec3 color, float shift) {
      float r = color.r;
      float g = color.g;
      float b = color.b;
      float angle = shift * PI * 2.0;
      mat3 rotation = mat3(
        0.299 + 0.701 * cos(angle), 0.587 - 0.587 * cos(angle), 0.114 - 0.114 * cos(angle),
        0.299 - 0.299 * cos(angle), 0.587 + 0.413 * cos(angle), 0.114 - 0.114 * cos(angle),
        0.299 - 0.299 * cos(angle), 0.587 - 0.587 * cos(angle), 0.114 + 0.886 * cos(angle)
      );
      return rotation * color;
    }
    
    vec2 wave(vec2 uv) {
      float waveX = sin(uv.y * 10.0 + uTime * 2.0) * 0.02 * uIntensity;
      float waveY = cos(uv.x * 10.0 + uTime * 2.0) * 0.02 * uIntensity;
      return uv + vec2(waveX, waveY);
    }
    
    vec2 pixelate(vec2 uv, float pixels) {
      float dx = 1.0 / pixels;
      float dy = 1.0 / pixels;
      return vec2(dx * floor(uv.x / dx), dy * floor(uv.y / dy));
    }
    
    void main() {
      vec2 uv = vUv;
      vec3 color;
      float opacity = 0.35;
      
      // Filter type 0: None
      if (uFilterType == 0) {
        color = texture2D(uTexture, uv).rgb;
      }
      // Filter type 1: Kaleidoscope
      else if (uFilterType == 1) {
        float segments = 6.0 + uEnergy * 6.0;
        vec2 kUv = kaleidoscope(uv, segments);
        kUv = fract(kUv + uTime * 0.05);
        color = texture2D(uTexture, kUv).rgb;
        opacity = 0.5;
      }
      // Filter type 2: Mirror Fractal
      else if (uFilterType == 2) {
        vec2 mUv = mirror(uv);
        mUv = fract(mUv);
        color = texture2D(uTexture, mUv).rgb;
        color = mix(color, colorShift(color, uTime * 0.1), 0.3);
        opacity = 0.45;
      }
      // Filter type 3: Color Shift
      else if (uFilterType == 3) {
        color = texture2D(uTexture, uv).rgb;
        float shift = uTime * 0.2 + uEnergy * 0.5;
        color = colorShift(color, shift);
        color = mix(color, vec3(1.0) - color, sin(uTime) * 0.2 + 0.2);
        opacity = 0.4;
      }
      // Filter type 4: Invert Pulse
      else if (uFilterType == 4) {
        color = texture2D(uTexture, uv).rgb;
        float pulse = (sin(uTime * 2.0) * 0.5 + 0.5) * uEnergy;
        color = mix(color, vec3(1.0) - color, pulse);
        opacity = 0.4;
      }
      // Filter type 5: Pixelate
      else if (uFilterType == 5) {
        float pixels = 100.0 - uEnergy * 80.0;
        vec2 pUv = pixelate(uv, max(pixels, 10.0));
        color = texture2D(uTexture, pUv).rgb;
        opacity = 0.45;
      }
      // Filter type 6: RGB Split
      else if (uFilterType == 6) {
        float offset = 0.01 * uIntensity * (1.0 + uEnergy);
        float r = texture2D(uTexture, uv + vec2(offset, 0.0)).r;
        float g = texture2D(uTexture, uv).g;
        float b = texture2D(uTexture, uv - vec2(offset, 0.0)).b;
        color = vec3(r, g, b);
        opacity = 0.4;
      }
      // Filter type 7: Wave Distort
      else if (uFilterType == 7) {
        vec2 wUv = wave(uv);
        color = texture2D(uTexture, wUv).rgb;
        float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
        color *= 0.8 + pulse * 0.4;
        opacity = 0.45;
      }
      // Filter type 8: Zoom Pulse
      else if (uFilterType == 8) {
        float zoom = 1.0 + sin(uTime * 2.0) * 0.1 * uIntensity * (1.0 + uEnergy);
        vec2 centered = (uv - 0.5) / zoom + 0.5;
        color = texture2D(uTexture, centered).rgb;
        opacity = 0.4;
      }
      else {
        color = texture2D(uTexture, uv).rgb;
      }
      
      gl_FragColor = vec4(color, opacity);
    }
  `
);

extend({ PsyFilterMaterial });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      psyFilterMaterial: any;
    }
  }
}

const filterIdToType: Record<string, number> = {
  none: 0,
  kaleidoscope: 1,
  mirror: 2,
  colorshift: 3,
  invert: 4,
  pixelate: 5,
  rgbsplit: 6,
  wave: 7,
  zoompulse: 8,
};

// Background plane for thumbnail with psy trance filters
function BackgroundImage({ 
  imageUrl, 
  filterId = "none", 
  intensity = 1, 
  getAudioData,
  layerOffset = 0
}: { 
  imageUrl: string; 
  filterId?: string;
  intensity?: number;
  getAudioData?: () => AudioData;
  layerOffset?: number;
}) {
  const materialRef = useRef<any>(null);
  
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(imageUrl);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, [imageUrl]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uTime = state.clock.getElapsedTime() + layerOffset;
      materialRef.current.uFilterType = filterIdToType[filterId] || 0;
      materialRef.current.uIntensity = intensity;
      
      if (getAudioData) {
        const { energy } = getAudioData();
        materialRef.current.uEnergy = energy;
      }
    }
  });

  const opacity = layerOffset > 0 ? 0.4 : 1;

  return (
    <mesh position={[0, 0, -30 + layerOffset * 0.1]} scale={[60, 40, 1]}>
      <planeGeometry />
      <psyFilterMaterial 
        ref={materialRef}
        uTexture={texture}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

function ZoomableScene({ 
  zoom = 1, 
  children 
}: { 
  zoom?: number; 
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.scale.lerp(new THREE.Vector3(zoom, zoom, zoom), 0.1);
    }
  });
  
  return <group ref={groupRef}>{children}</group>;
}

function AudioReactiveEffects({ getAudioData, settings }: { getAudioData: () => AudioData; settings: any }) {
  const audioDataRef = useRef<AudioData>({ sub: 0, bass: 0, mid: 0, high: 0, energy: 0, kick: 0, dominantFreq: 200, modeIndex: 1, frequencyData: new Uint8Array(0) });
  
  useFrame(() => {
    audioDataRef.current = getAudioData();
  });
  
  const { sub, bass, mid, high, kick } = audioDataRef.current;
  
  return (
    <Effects
      sub={sub}
      bass={bass}
      mid={mid}
      high={high}
      kick={kick}
      intensity={settings.intensity}
      bloomOn={true}
      chromaOn={true}
      noiseOn={true}
      vignetteOn={true}
      kaleidoOn={settings.presetName === "Geometric Kaleidoscope"}
      afterimageOn={settings.trailsOn ?? false}
      trails={settings.trailsAmount ?? 0.75}
    />
  );
}

function PsyPresetWrapper({ 
  preset, 
  getAudioData, 
  intensity = 1.0,
  speed = 1.0,
  opacity = 0.9,
  blending = THREE.AdditiveBlending 
}: { 
  preset: PsyPresetName; 
  getAudioData: () => AudioData; 
  intensity?: number;
  speed?: number;
  opacity?: number;
  blending?: THREE.Blending;
}) {
  const audioDataRef = useRef<AudioData>({ sub: 0, bass: 0, mid: 0, high: 0, energy: 0, kick: 0, dominantFreq: 200, modeIndex: 1, frequencyData: new Uint8Array(0) });
  
  useFrame(() => {
    audioDataRef.current = getAudioData();
  });
  
  return (
    <PsyPresetLayer
      preset={preset}
      bass={audioDataRef.current.bass}
      mid={audioDataRef.current.mid}
      high={audioDataRef.current.high}
      intensity={intensity}
      speed={speed}
      opacity={opacity}
      blending={blending}
    />
  );
}

function PresetTransition({ children, presetName }: { children: React.ReactNode; presetName: string }) {
  const [opacity, setOpacity] = useState(1);
  const [currentPreset, setCurrentPreset] = useState(presetName);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  
  useEffect(() => {
    if (presetName !== currentPreset) {
      setOpacity(0);
      const timer = setTimeout(() => {
        setCurrentPreset(presetName);
        setDisplayedChildren(children);
        setOpacity(1);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setDisplayedChildren(children);
    }
  }, [presetName, children, currentPreset]);
  
  return (
    <group>
      <mesh position={[0, 0, 50]} renderOrder={9999}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial 
          color="#050508" 
          transparent 
          opacity={1 - opacity} 
          depthTest={false}
        />
      </mesh>
      {displayedChildren}
    </group>
  );
}

function ThreeScene({ getAudioData, settings, backgroundImage, zoom = 1 }: AudioVisualizerProps) {
  const [hasError, setHasError] = useState(false);
  
  const activeFilters = settings.imageFilters || ["none"];
  const activeOverlays = settings.psyOverlays || [];

  const isPsyPreset = ["Blue Tunnel", "BW Vortex", "Rainbow Spiral", "Red Mandala"].includes(settings.presetName);
  
  const presetToPsyPresetName = (name: string): PsyPresetName => {
    switch (name) {
      case "Blue Tunnel": return "blueTunnel";
      case "BW Vortex": return "bwVortex";
      case "Rainbow Spiral": return "rainbowSpiral";
      case "Red Mandala": return "redMandala";
      default: return "blueTunnel";
    }
  };

  if (hasError) {
    return <FallbackVisualizer settings={settings} backgroundImage={backgroundImage} />;
  }

  return (
    <div 
      style={{ 
        position: "absolute", 
        top: 0, 
        left: 0, 
        width: "100%", 
        height: "100%", 
        zIndex: 0, 
        pointerEvents: "none",
        touchAction: "none",
      }}
    >
      <Canvas
        gl={{ 
          antialias: true, 
          toneMapping: THREE.ACESFilmicToneMapping,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
          depth: true,
        }}
        camera={{ position: [0, 0, 15], fov: 45 }}
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
        dpr={[2, Math.min(window.devicePixelRatio, 3)]}
        events={() => ({ enabled: false, priority: 0 })}
        onCreated={({ gl }) => {
          if (!gl.getContext()) {
            setHasError(true);
          }
        }}
      >
        <color attach="background" args={['#050508']} />
      
      {backgroundImage && activeFilters.map((filterId, index) => (
        <BackgroundImage 
          key={`filter-${filterId}-${index}`}
          imageUrl={backgroundImage} 
          filterId={filterId}
          intensity={settings.intensity}
          getAudioData={getAudioData}
          layerOffset={index * 0.5}
        />
      ))}
      
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ff00ff" />
      
      <ZoomableScene zoom={zoom}>
        <PresetTransition presetName={settings.presetName}>
          {settings.presetEnabled !== false && (
            <>
              {settings.presetName === "Energy Rings" && <EnergyRings getAudioData={getAudioData} settings={settings} />}
              {settings.presetName === "Psy Tunnel" && <PsyTunnel getAudioData={getAudioData} settings={settings} />}
              {settings.presetName === "Particle Field" && <ParticleField getAudioData={getAudioData} settings={settings} />}
              {settings.presetName === "Waveform Sphere" && <WaveformSphere getAudioData={getAudioData} settings={settings} />}
              {settings.presetName === "Audio Bars" && <AudioBars getAudioData={getAudioData} settings={settings} />}
              {settings.presetName === "Geometric Kaleidoscope" && <GeometricKaleidoscope getAudioData={getAudioData} settings={settings} />}
              {settings.presetName === "Cosmic Web" && <CosmicWeb getAudioData={getAudioData} settings={settings} />}
              {settings.presetName === "Cymatic Sand Plate" && <CymaticSandPlate getAudioData={getAudioData} settings={settings} />}
              {settings.presetName === "Water Membrane Orb" && <WaterMembraneOrb getAudioData={getAudioData} settings={settings} />}
              {settings.presetName === "Chladni Geometry" && <ChladniGeometry getAudioData={getAudioData} settings={settings} />}
              {settings.presetName === "Resonant Field Lines" && <ResonantFieldLines getAudioData={getAudioData} settings={settings} />}
              
              {isPsyPreset && (
                <PsyPresetWrapper 
                  preset={presetToPsyPresetName(settings.presetName)} 
                  getAudioData={getAudioData}
                  intensity={settings.intensity}
                  speed={settings.speed}
                  opacity={0.95}
                />
              )}
            </>
          )}
        </PresetTransition>
      </ZoomableScene>

      {activeOverlays.map((overlayId) => (
        <PsyPresetWrapper
          key={`overlay-${overlayId}`}
          preset={overlayId as PsyPresetName}
          getAudioData={getAudioData}
          intensity={settings.intensity}
          speed={settings.speed}
          opacity={0.4}
          blending={THREE.AdditiveBlending}
        />
      ))}

      <AudioReactiveEffects getAudioData={getAudioData} settings={settings} />
    </Canvas>
    </div>
  );
}

export function AudioVisualizer({ getAudioData, settings, backgroundImage, zoom = 1 }: AudioVisualizerProps) {
  const [webglSupported] = useState(() => isWebGLAvailable());

  if (!webglSupported) {
    return <FallbackVisualizer settings={settings} backgroundImage={backgroundImage} />;
  }

  return <ThreeScene getAudioData={getAudioData} settings={settings} backgroundImage={backgroundImage} zoom={zoom} />;
}
