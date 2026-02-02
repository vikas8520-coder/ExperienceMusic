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

// Option 4: Attack/Release temporal smoothing for audio bands
// Attack = fast response to increases (beat hits), Release = slow decay
function smoothAR(prev: number, next: number, dt: number, attack: number = 18, release: number = 6): number {
  const speed = next > prev ? attack : release;
  const a = 1 - Math.exp(-speed * dt);
  return prev + (next - prev) * a;
}

// Standard exponential smoothing
function smoothExp(prev: number, next: number, dt: number, speed: number = 10): number {
  const a = 1 - Math.exp(-speed * dt);
  return prev + (next - prev) * a;
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
  const arcsRef = useRef<THREE.Line[]>([]);
  const trailsRef = useRef<THREE.Points>(null);
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  const tempColor = useMemo(() => new THREE.Color(), []);

  const geometry = useMemo(() => new THREE.TorusGeometry(1, 0.035, 32, 128), []);
  const count = 24;
  const arcCount = 12;
  const arcPointsPerArc = 30;
  
  // Electric arc lines between rings
  const arcLines = useMemo(() => {
    const lines: THREE.Line[] = [];
    for (let i = 0; i < arcCount; i++) {
      const positions = new Float32Array(arcPointsPerArc * 3);
      const colors = new Float32Array(arcPointsPerArc * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.LineBasicMaterial({ 
        vertexColors: true,
        transparent: true, 
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      lines.push(new THREE.Line(geometry, material));
    }
    return lines;
  }, []);
  
  // Energy trail particles that spiral around rings
  const trailCount = 600;
  const trailData = useMemo(() => {
    const positions = new Float32Array(trailCount * 3);
    const phases = new Float32Array(trailCount);
    const ringIndices = new Float32Array(trailCount);
    for (let i = 0; i < trailCount; i++) {
      phases[i] = Math.random() * Math.PI * 2;
      ringIndices[i] = Math.floor(Math.random() * count);
    }
    return { positions, phases, ringIndices };
  }, [count]);

  const materials = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const colorIndex = i % settings.colorPalette.length;
      const mat = new THREE.MeshStandardMaterial({
        color: "#000000",
        roughness: 0.02,
        metalness: 0.99,
        emissive: new THREE.Color(settings.colorPalette[colorIndex]),
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.88
      });
      return mat;
    });
  }, [settings.colorPalette]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      arcLines.forEach((line) => {
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
    };
  }, [arcLines]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime();
    const dt = Math.min(delta, 0.1); // Cap delta to prevent jumps
    
    // Option 4: Attack/release smoothing for each audio band
    // Bass: Strong but smooth (avoid jitter) - slower attack/release
    // High: Faster response but still smoothed
    const smooth = smoothedAudioRef.current;
    smooth.sub = smoothAR(smooth.sub, audioRaw.sub, dt, 12, 5);
    smooth.bass = smoothAR(smooth.bass, audioRaw.bass, dt, 14, 6);
    smooth.mid = smoothAR(smooth.mid, audioRaw.mid, dt, 16, 8);
    smooth.high = smoothAR(smooth.high, audioRaw.high, dt, 20, 10);
    smooth.kick = smoothAR(smooth.kick, audioRaw.kick, dt, 25, 8); // Fast attack for punchy kicks
    smooth.energy = smoothExp(smooth.energy, audioRaw.energy, dt, 8);

    const baseSpeed = 0.12 * settings.speed;
    groupRef.current.rotation.z += delta * (baseSpeed + smooth.sub * 0.3 + smooth.kick * 0.6);
    groupRef.current.rotation.x = Math.sin(time * 0.12) * 0.35 * (1 + smooth.mid * settings.intensity);
    groupRef.current.rotation.y = Math.cos(time * 0.08) * 0.25 * (1 + smooth.sub * settings.intensity * 0.5);
    
    // Update electric arcs - lightning bolts between rings
    arcLines.forEach((line, arcIdx) => {
      const geometry = line.geometry as THREE.BufferGeometry;
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const colorAttr = geometry.attributes.color as THREE.BufferAttribute;
      
      const startRing = arcIdx % (count - 4);
      const endRing = startRing + 3 + Math.floor(smooth.kick * 3);
      const startRadius = (startRing * 0.14 + 0.35) * (1 + smooth.bass * 0.5);
      const endRadius = (endRing * 0.14 + 0.35) * (1 + smooth.bass * 0.5);
      const arcAngle = (arcIdx / arcCount) * Math.PI * 2 + time * 0.5;
      
      for (let j = 0; j < arcPointsPerArc; j++) {
        const t = j / (arcPointsPerArc - 1);
        const r = startRadius + (endRadius - startRadius) * t;
        const jitter = (smooth.high + smooth.kick) * 0.15 * Math.sin(time * 20 + j * 3 + arcIdx);
        const angle = arcAngle + t * 0.3;
        
        posAttr.setXYZ(
          j,
          Math.cos(angle) * r + jitter * (Math.random() - 0.5),
          (t - 0.5) * 0.3 + jitter * (Math.random() - 0.5),
          Math.sin(angle) * r + jitter * (Math.random() - 0.5)
        );
        
        // Gradient color - bright center, fading ends
        const brightness = 1 - Math.abs(t - 0.5) * 1.8;
        const colorIdx = arcIdx % settings.colorPalette.length;
        tempColor.set(settings.colorPalette[colorIdx]);
        tempColor.offsetHSL(0, 0, brightness * 0.3);
        colorAttr.setXYZ(j, tempColor.r * brightness, tempColor.g * brightness, tempColor.b * brightness);
      }
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = 0.5 + smooth.energy * 0.5 + smooth.kick * 0.3;
    });
    
    // Energy trail particles spiraling around rings
    if (trailsRef.current) {
      const pAttr = trailsRef.current.geometry.attributes.position;
      for (let i = 0; i < trailCount; i++) {
        const phase = trailData.phases[i];
        const ringIdx = trailData.ringIndices[i];
        const ringScale = (ringIdx * 0.14 + 0.35) * (1 + smooth.bass * 0.4);
        const spiralAngle = phase + time * (2 + smooth.mid * 3) * settings.speed;
        const tubeAngle = spiralAngle * 3;
        
        const mainRadius = ringScale;
        const tubeRadius = 0.035 + smooth.high * 0.02;
        
        pAttr.setXYZ(
          i,
          Math.cos(spiralAngle) * (mainRadius + Math.cos(tubeAngle) * tubeRadius),
          Math.sin(tubeAngle) * tubeRadius * 2,
          Math.sin(spiralAngle) * (mainRadius + Math.cos(tubeAngle) * tubeRadius)
        );
      }
      pAttr.needsUpdate = true;
      
      const mat = trailsRef.current.material as THREE.PointsMaterial;
      mat.size = 0.025 + smooth.energy * 0.015;
      mat.opacity = 0.7 + smooth.high * 0.3;
    }

    ringsRef.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = time * settings.speed;
      const offset = i * 0.26;
      const layerDepth = i / count;
      
      const breathing = 1 + smooth.sub * 0.35 * Math.sin(t * 0.5 + offset);
      const pulse = smooth.bass * settings.intensity * 2.0 * (Math.sin(t * 1.8 + offset) * 0.5 + 0.5);
      const waveform = smooth.mid * 0.4 * Math.sin(t * 2.5 + i * 0.25);
      const kickPop = smooth.kick * 1.0 * (1 - layerDepth * 0.4);
      const baseScale = (i * 0.14 + 0.35);
      const scale = baseScale * (breathing + pulse + waveform + kickPop);
      mesh.scale.setScalar(scale);
      
      // Staggered ring rotations for 3D depth
      mesh.rotation.x = Math.PI / 2 + Math.sin(t * 0.4 + offset) * 0.2 * smooth.mid + (i % 3) * 0.1;
      mesh.rotation.y = Math.cos(t * 0.3 + offset) * 0.15 * smooth.high;
      mesh.rotation.z = Math.sin(t * 0.2 + i * 0.5) * 0.08;

      const mat = materialsRef.current[i];
      if (mat) {
        const colorIndex = i % settings.colorPalette.length;
        mat.emissive.set(settings.colorPalette[colorIndex]);
        const hueShift = smooth.high * 0.08 * Math.sin(t + i * 0.6);
        mat.emissive.offsetHSL(hueShift, 0, smooth.energy * 0.15);
        
        const boost = (smooth.high * 4 + smooth.kick * 3.5 + smooth.energy * 1.5) * settings.intensity;
        mat.emissive.multiplyScalar(0.25 + boost);
        mat.emissive.r = Math.min(mat.emissive.r, 1);
        mat.emissive.g = Math.min(mat.emissive.g, 1);
        mat.emissive.b = Math.min(mat.emissive.b, 1);
        mat.emissiveIntensity = 1.8 + smooth.bass * settings.intensity * 1.5;
        mat.opacity = 0.7 + smooth.energy * 0.28;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {/* Electric arc lines between rings */}
      {arcLines.map((line, idx) => (
        <primitive key={`arc-${idx}`} object={line} />
      ))}
      
      {/* Energy trail particles spiraling around rings */}
      <points ref={trailsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={trailCount}
            array={trailData.positions}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.03}
          color={settings.colorPalette[0]}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      
      {/* Energy rings */}
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
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    varying vec3 vLocalPosition;
    void main() {
      // Compute world-space normal for consistent Fresnel calculation
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vLocalPosition = position;
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
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    varying vec3 vLocalPosition;
    
    void main() {
      // Both normal and view direction in world space for correct Fresnel
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - clamp(dot(viewDir, vWorldNormal), 0.0, 1.0), 3.0);
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

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime();
    
    // Option 4: Attack/release smoothing for musical response
    const dt = Math.min(delta, 0.1);
    const smooth = smoothedAudioRef.current;
    smooth.sub = smoothAR(smooth.sub, audioRaw.sub, dt, 10, 4);
    smooth.bass = smoothAR(smooth.bass, audioRaw.bass, dt, 14, 6);
    smooth.mid = smoothAR(smooth.mid, audioRaw.mid, dt, 16, 8);
    smooth.high = smoothAR(smooth.high, audioRaw.high, dt, 20, 10);
    smooth.kick = smoothAR(smooth.kick, audioRaw.kick, dt, 25, 8);
    smooth.energy = smoothExp(smooth.energy, audioRaw.energy, dt, 6);

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
// WaveformSphere custom glow shader for inner core
const WaveformCoreShader = {
  uniforms: {
    uTime: { value: 0 },
    uBass: { value: 0 },
    uEnergy: { value: 0 },
    uKick: { value: 0 },
    uColor1: { value: new THREE.Color("#ffffff") },
    uColor2: { value: new THREE.Color("#6600ff") },
  },
  vertexShader: `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    void main() {
      // Compute world-space normal for consistent Fresnel calculation
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
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
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    
    void main() {
      // Both normal and view direction in world space
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - clamp(dot(viewDir, vWorldNormal), 0.0, 1.0), 2.5);
      
      float pulse = 0.5 + 0.5 * sin(uTime * 2.0 + uBass * 4.0);
      vec3 color = mix(uColor2, uColor1, fresnel * 0.7 + pulse * 0.3);
      color += vec3(1.0) * uKick * 0.4;
      
      float alpha = fresnel * 0.9 + 0.3 + uEnergy * 0.2;
      alpha = clamp(alpha, 0.0, 1.0);
      
      gl_FragColor = vec4(color, alpha);
    }
  `
};

function WaveformSphere({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const auroraRibbonsRef = useRef<THREE.Line[]>([]);
  const surfaceWavesRef = useRef<THREE.Mesh>(null);
  const originalPositions = useRef<Float32Array | null>(null);
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  const tempColor = useMemo(() => new THREE.Color(), []);
  
  // Aurora ribbon lines wrapping around sphere
  const ribbonCount = 8;
  const ribbonPoints = 80;
  const auroraLines = useMemo(() => {
    const lines: THREE.Line[] = [];
    for (let i = 0; i < ribbonCount; i++) {
      const positions = new Float32Array(ribbonPoints * 3);
      const colors = new Float32Array(ribbonPoints * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.LineBasicMaterial({ 
        vertexColors: true,
        transparent: true, 
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        linewidth: 2
      });
      lines.push(new THREE.Line(geometry, material));
    }
    return lines;
  }, []);
  
  // Surface wave mesh (inner chromatic layer)
  const waveGeometry = useMemo(() => {
    return new THREE.IcosahedronGeometry(2.8, 5);
  }, []);
  
  // Cleanup
  useEffect(() => {
    return () => {
      auroraLines.forEach((line) => {
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
    };
  }, [auroraLines]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    const geometry = meshRef.current.geometry as THREE.BufferGeometry;
    const positionAttr = geometry.attributes.position;

    // Option 4: Attack/release smoothing for musical response
    const dt = Math.min(delta, 0.1);
    const smooth = smoothedAudioRef.current;
    smooth.sub = smoothAR(smooth.sub, audioRaw.sub, dt, 12, 5);
    smooth.bass = smoothAR(smooth.bass, audioRaw.bass, dt, 14, 6);
    smooth.mid = smoothAR(smooth.mid, audioRaw.mid, dt, 16, 8);
    smooth.high = smoothAR(smooth.high, audioRaw.high, dt, 20, 10);
    smooth.kick = smoothAR(smooth.kick, audioRaw.kick, dt, 25, 8);
    smooth.energy = smoothExp(smooth.energy, audioRaw.energy, dt, 8);

    if (!originalPositions.current) {
      originalPositions.current = new Float32Array(positionAttr.array);
    }

    const globalScale = 1 + smooth.sub * 0.15 + smooth.kick * 0.25 + smooth.energy * 0.1;

    for (let i = 0; i < positionAttr.count; i++) {
      const ox = originalPositions.current[i * 3];
      const oy = originalPositions.current[i * 3 + 1];
      const oz = originalPositions.current[i * 3 + 2];
      
      const freqIndex = Math.floor((i / positionAttr.count) * (audioRaw.frequencyData?.length || 128));
      const freqValue = (audioRaw.frequencyData?.[freqIndex] || 0) / 255;
      
      const bassDisp = smooth.bass * 0.4 * Math.sin(time * 0.5 + i * 0.02);
      const midDisp = smooth.mid * 0.3 * Math.sin(time * 1.5 + i * 0.05);
      const highDisp = smooth.high * 0.2 * Math.sin(time * 4 + i * 0.1);
      const freqDisp = freqValue * settings.intensity * 0.6;
      const kickPulse = smooth.kick * 0.5;
      
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
    
    // Update aurora ribbons - flowing energy bands wrapping around sphere
    auroraLines.forEach((line, ribbonIdx) => {
      const geometry = line.geometry as THREE.BufferGeometry;
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const colorAttr = geometry.attributes.color as THREE.BufferAttribute;
      
      const baseLatitude = (ribbonIdx / ribbonCount) * Math.PI - Math.PI / 2;
      const latitudeOffset = Math.sin(time * 0.5 + ribbonIdx) * 0.3 * smooth.mid;
      
      for (let j = 0; j < ribbonPoints; j++) {
        const t = j / (ribbonPoints - 1);
        const longitude = t * Math.PI * 2 + time * 0.3 + ribbonIdx * 0.5;
        const latitude = baseLatitude + latitudeOffset + Math.sin(longitude * 3 + time) * 0.2 * smooth.high;
        
        // Radius waves based on audio
        const waveDisp = smooth.bass * 0.4 * Math.sin(longitude * 4 + time * 2) +
                         smooth.high * 0.2 * Math.sin(longitude * 8 + time * 4);
        const r = 3.3 + waveDisp + smooth.kick * 0.3;
        
        const x = r * Math.cos(latitude) * Math.cos(longitude);
        const y = r * Math.sin(latitude);
        const z = r * Math.cos(latitude) * Math.sin(longitude);
        
        posAttr.setXYZ(j, x, y, z);
        
        // Chromatic color shifting along ribbon
        const colorIdx = ribbonIdx % settings.colorPalette.length;
        tempColor.set(settings.colorPalette[colorIdx]);
        const hueShift = t * 0.2 + time * 0.1 + smooth.high * 0.15;
        tempColor.offsetHSL(hueShift, 0, smooth.energy * 0.15);
        const brightness = 0.6 + Math.sin(t * Math.PI) * 0.4 + smooth.bass * 0.3;
        colorAttr.setXYZ(j, tempColor.r * brightness, tempColor.g * brightness, tempColor.b * brightness);
      }
      
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = 0.6 + smooth.energy * 0.35;
    });
    
    // Update surface wave mesh (chromatic inner layer)
    if (surfaceWavesRef.current) {
      surfaceWavesRef.current.rotation.y = time * 0.2;
      surfaceWavesRef.current.rotation.x = Math.sin(time * 0.3) * 0.2;
      const scale = 0.95 + smooth.bass * 0.1;
      surfaceWavesRef.current.scale.setScalar(scale);
      
      const mat = surfaceWavesRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 0.5 + smooth.energy * 0.8;
      }
    }
    
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.004 * (1 + smooth.mid * 0.6);
      groupRef.current.rotation.x = Math.sin(time * 0.3) * 0.18 * (1 + smooth.sub * 0.4);
      groupRef.current.rotation.z = Math.cos(time * 0.25) * 0.1 * smooth.high;
    }
    
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (mat) {
      mat.emissiveIntensity = 0.7 + smooth.energy * 1.2 * settings.intensity;
    }
  });

  const colors = settings.colorPalette;
  
  return (
    <group ref={groupRef}>
      {/* Inner chromatic surface layer */}
      <mesh ref={surfaceWavesRef} geometry={waveGeometry}>
        <meshStandardMaterial
          color={colors[1] || colors[0]}
          emissive={colors[0]}
          emissiveIntensity={0.5}
          transparent
          opacity={0.5}
          metalness={0.7}
          roughness={0.3}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Main wireframe sphere */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[3, 6]} />
        <meshStandardMaterial
          color={colors[0]}
          emissive={colors[1] || colors[0]}
          emissiveIntensity={0.7}
          wireframe
          transparent
          opacity={0.95}
          metalness={0.4}
          roughness={0.4}
        />
      </mesh>
      
      {/* Aurora ribbons wrapping around sphere */}
      {auroraLines.map((line, idx) => {
        auroraRibbonsRef.current[idx] = line;
        return <primitive key={`aurora-${idx}`} object={line} />;
      })}
    </group>
  );
}

// === PRESET 5: Audio Bars (PREMIUM - Holographic Volumetric) ===
function AudioBars({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const holoOutlineRef = useRef<THREE.InstancedMesh>(null);
  const scanLinesRef = useRef<THREE.Line[]>([]);
  const barCount = 128;
  const scanLineCount = 6;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const smoothedHeights = useRef<Float32Array>(new Float32Array(barCount));
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  const tempColor = useMemo(() => new THREE.Color(), []);
  
  // Horizontal scan lines that sweep through the bars
  const scanLines = useMemo(() => {
    const lines: THREE.Line[] = [];
    for (let i = 0; i < scanLineCount; i++) {
      const positions = new Float32Array(barCount * 3);
      const colors = new Float32Array(barCount * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.LineBasicMaterial({ 
        vertexColors: true,
        transparent: true, 
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });
      lines.push(new THREE.Line(geometry, material));
    }
    return lines;
  }, []);
  
  // Cleanup
  useEffect(() => {
    return () => {
      scanLines.forEach((line) => {
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
    };
  }, [scanLines]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Option 4: Attack/release smoothing for musical response
    const dt = Math.min(delta, 0.1);
    const smooth = smoothedAudioRef.current;
    smooth.sub = smoothAR(smooth.sub, audioRaw.sub, dt, 14, 6);
    smooth.bass = smoothAR(smooth.bass, audioRaw.bass, dt, 18, 8);
    smooth.mid = smoothAR(smooth.mid, audioRaw.mid, dt, 20, 10);
    smooth.high = smoothAR(smooth.high, audioRaw.high, dt, 24, 12);
    smooth.kick = smoothAR(smooth.kick, audioRaw.kick, dt, 28, 10);
    smooth.energy = smoothExp(smooth.energy, audioRaw.energy, dt, 10);

    const breathScale = 1 + smooth.sub * 0.18;
    const radiusPulse = 5.5 + smooth.bass * 1.8 * settings.intensity;

    for (let i = 0; i < barCount; i++) {
      const freqIndex = Math.floor((i / barCount) * (audioRaw.frequencyData?.length || 128));
      const freqValue = (audioRaw.frequencyData?.[freqIndex] || 0) / 255;
      
      const targetHeight = 0.4 + freqValue * 14 * settings.intensity + smooth.kick * 3;
      smoothedHeights.current[i] = smoothExp(smoothedHeights.current[i], targetHeight, dt, 22);
      const height = smoothedHeights.current[i];
      
      const angle = (i / barCount) * Math.PI * 2;
      const waveOffset = Math.sin(time * 2.5 + i * 0.15) * 0.5 * smooth.mid;
      
      const x = Math.cos(angle) * (radiusPulse + waveOffset);
      const z = Math.sin(angle) * (radiusPulse + waveOffset);
      
      // Main bars - volumetric feel
      dummy.position.set(x * breathScale, height / 2, z * breathScale);
      dummy.scale.set(0.25, height, 0.25);
      dummy.rotation.set(0, -angle, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Holographic outline bars (slightly larger, wireframe-like feel)
      if (holoOutlineRef.current) {
        dummy.scale.set(0.35, height * 1.02, 0.35);
        dummy.updateMatrix();
        holoOutlineRef.current.setMatrixAt(i, dummy.matrix);
      }
      
      const colorPhase = (i / barCount + time * 0.06) % 1;
      const colorIdx = Math.floor(colorPhase * settings.colorPalette.length);
      tempColor.set(settings.colorPalette[colorIdx % settings.colorPalette.length]);
      tempColor.offsetHSL(smooth.high * 0.03, 0, freqValue * 0.35 + smooth.energy * 0.25);
      meshRef.current.setColorAt(i, tempColor);
      
      // Holographic outline - brighter, shifted hue
      if (holoOutlineRef.current) {
        tempColor.offsetHSL(0.1, 0.1, 0.2);
        holoOutlineRef.current.setColorAt(i, tempColor);
      }
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    
    if (holoOutlineRef.current) {
      holoOutlineRef.current.instanceMatrix.needsUpdate = true;
      if (holoOutlineRef.current.instanceColor) holoOutlineRef.current.instanceColor.needsUpdate = true;
    }
    
    // Update scan lines - horizontal slices that sweep up and down
    scanLines.forEach((line, scanIdx) => {
      const geometry = line.geometry as THREE.BufferGeometry;
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const colorAttr = geometry.attributes.color as THREE.BufferAttribute;
      
      // Each scan line at different height, moving up/down
      const scanPhase = (scanIdx / scanLineCount) * Math.PI * 2;
      const scanHeight = (Math.sin(time * 2 + scanPhase) * 0.5 + 0.5) * 12 + 0.5;
      
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2;
        const barHeight = smoothedHeights.current[i];
        const waveOffset = Math.sin(time * 2.5 + i * 0.15) * 0.5 * smooth.mid;
        const r = (radiusPulse + waveOffset) * breathScale;
        
        // Only show scan line where it intersects with bars
        const heightClip = scanHeight < barHeight ? scanHeight : barHeight * 0.8;
        
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        
        posAttr.setXYZ(i, x, heightClip, z);
        
        // Color gradient along scan line
        const colorIdx = (scanIdx + Math.floor(i / 20)) % settings.colorPalette.length;
        tempColor.set(settings.colorPalette[colorIdx]);
        const brightness = 0.7 + smooth.energy * 0.3 + (barHeight > scanHeight ? 0.3 : 0);
        tempColor.offsetHSL(time * 0.02, 0, smooth.high * 0.2);
        colorAttr.setXYZ(i, tempColor.r * brightness, tempColor.g * brightness, tempColor.b * brightness);
      }
      
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = 0.5 + smooth.energy * 0.4;
    });
    
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.25;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main volumetric bars */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, barCount]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial 
          toneMapped={false} 
          metalness={0.5} 
          roughness={0.2}
          transparent
          opacity={0.85}
        />
      </instancedMesh>
      
      {/* Holographic outline bars */}
      <instancedMesh ref={holoOutlineRef} args={[undefined, undefined, barCount]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial 
          toneMapped={false} 
          transparent 
          opacity={0.25}
          wireframe
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      
      {/* Horizontal scan lines */}
      {scanLines.map((line, idx) => {
        scanLinesRef.current[idx] = line;
        return <primitive key={`scan-${idx}`} object={line} />;
      })}
      
      {/* Grid floor for holographic feel */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[3, 14, 64, 8]} />
        <meshBasicMaterial
          color={settings.colorPalette[0]}
          transparent
          opacity={0.15}
          wireframe
        />
      </mesh>
    </group>
  );
}

// === PRESET 6: Geometric Kaleidoscope (PREMIUM - Fractal Morphing) ===
function GeometricKaleidoscope({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const mirrorPlanesRef = useRef<THREE.Mesh[]>([]);
  const trailLinesRef = useRef<THREE.Line[]>([]);
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  const tempColor = useMemo(() => new THREE.Color(), []);
  const morphPhaseRef = useRef(0);
  
  const geometries = useMemo(() => [
    new THREE.OctahedronGeometry(1, 2),
    new THREE.TetrahedronGeometry(1, 2),
    new THREE.IcosahedronGeometry(1, 2),
    new THREE.DodecahedronGeometry(0.8, 2),
    new THREE.TorusKnotGeometry(0.5, 0.2, 96, 12),
    new THREE.TorusGeometry(0.6, 0.25, 24, 48),
  ], []);

  const count = 42;
  const symmetryFolds = 6;
  const trailPointCount = 30;
  
  // Motion trail lines following each shape
  const trailLines = useMemo(() => {
    const lines: THREE.Line[] = [];
    for (let i = 0; i < count; i++) {
      const positions = new Float32Array(trailPointCount * 3);
      const colors = new Float32Array(trailPointCount * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.LineBasicMaterial({ 
        vertexColors: true,
        transparent: true, 
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      lines.push(new THREE.Line(geometry, material));
    }
    return lines;
  }, [count]);
  
  // Trail history for each shape
  const trailHistoryRef = useRef<Float32Array[]>(
    Array.from({ length: count }, () => new Float32Array(trailPointCount * 3))
  );
  
  // Cleanup
  useEffect(() => {
    return () => {
      trailLines.forEach((line) => {
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
    };
  }, [trailLines]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Option 4: Attack/release smoothing for musical response
    const dt = Math.min(delta, 0.1);
    const smooth = smoothedAudioRef.current;
    smooth.sub = smoothAR(smooth.sub, audioRaw.sub, dt, 12, 5);
    smooth.bass = smoothAR(smooth.bass, audioRaw.bass, dt, 14, 6);
    smooth.mid = smoothAR(smooth.mid, audioRaw.mid, dt, 16, 8);
    smooth.high = smoothAR(smooth.high, audioRaw.high, dt, 20, 10);
    smooth.kick = smoothAR(smooth.kick, audioRaw.kick, dt, 25, 8);
    smooth.energy = smoothExp(smooth.energy, audioRaw.energy, dt, 8);
    
    // Morph phase for geometry transitions
    morphPhaseRef.current += 0.01 * (1 + smooth.kick * 3);

    groupRef.current.rotation.y += 0.003 * (1 + smooth.mid * 0.6);
    groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.3 * (1 + smooth.sub * 0.4);
    groupRef.current.rotation.z = Math.cos(time * 0.15) * 0.15 * smooth.high;
    
    // Update mirror planes (symmetry reflections)
    mirrorPlanesRef.current.forEach((mesh, i) => {
      if (!mesh) return;
      const planeAngle = (i / symmetryFolds) * Math.PI * 2;
      mesh.rotation.y = planeAngle + time * 0.1;
      mesh.rotation.x = Math.sin(time * 0.3 + i) * 0.2 * smooth.mid;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = 0.08 + smooth.energy * 0.1;
      }
    });

    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      
      const layer = Math.floor(i / 7);
      const angleInLayer = (i % 7) / 7 * Math.PI * 2;
      const layerRadius = 2.2 + layer * 2.2;
      
      // Kaleidoscopic symmetry - shapes mirror across fold lines
      const foldAngle = Math.floor(i / (count / symmetryFolds)) * (Math.PI * 2 / symmetryFolds);
      const localAngle = angleInLayer + foldAngle;
      
      const orbitSpeed = 0.3 + layer * 0.08;
      const bassWave = smooth.bass * 1.2 * Math.sin(time * 1.8 + i * 0.35);
      const midWave = smooth.mid * 0.6 * Math.cos(time * 2.5 + i * 0.6);
      const fractalOffset = Math.sin(time * 3 + i * 0.8) * smooth.high * 0.5;
      
      const x = Math.cos(localAngle + time * orbitSpeed) * (layerRadius + bassWave + fractalOffset);
      const y = Math.sin(time * 1.8 + i * 0.5) * (1.8 + smooth.bass * settings.intensity * 3) + midWave;
      const z = Math.sin(localAngle + time * orbitSpeed) * (layerRadius + bassWave + fractalOffset);
      
      mesh.position.set(x, y, z);
      
      // Update trail history (shift old positions, add new)
      const trail = trailHistoryRef.current[i];
      for (let j = trailPointCount - 1; j > 0; j--) {
        trail[j * 3] = trail[(j - 1) * 3];
        trail[j * 3 + 1] = trail[(j - 1) * 3 + 1];
        trail[j * 3 + 2] = trail[(j - 1) * 3 + 2];
      }
      trail[0] = x;
      trail[1] = y;
      trail[2] = z;
      
      // Update trail line geometry
      const line = trailLines[i];
      if (line) {
        const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
        const colorAttr = line.geometry.attributes.color as THREE.BufferAttribute;
        for (let j = 0; j < trailPointCount; j++) {
          posAttr.setXYZ(j, trail[j * 3], trail[j * 3 + 1], trail[j * 3 + 2]);
          const colorIdx = i % settings.colorPalette.length;
          tempColor.set(settings.colorPalette[colorIdx]);
          const fade = 1 - (j / trailPointCount);
          colorAttr.setXYZ(j, tempColor.r * fade, tempColor.g * fade, tempColor.b * fade);
        }
        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        const mat = line.material as THREE.LineBasicMaterial;
        mat.opacity = 0.4 + smooth.energy * 0.4;
      }
      
      const rotSpeed = (layer + 1) * 0.3;
      mesh.rotation.x += 0.015 * rotSpeed * (1 + smooth.mid * 0.6);
      mesh.rotation.y += 0.012 * rotSpeed * (1 + smooth.high * 0.4);
      mesh.rotation.z = Math.sin(time * 0.6 + i * 0.25) * 0.6 * (1 + smooth.kick * 0.6);
      
      // Morphing scale based on geometry transition
      const morphCycle = (morphPhaseRef.current + i * 0.2) % (Math.PI * 2);
      const morphScale = 1 + Math.sin(morphCycle) * 0.2 * smooth.energy;
      
      const baseScale = 0.5 + (layer * 0.1);
      const energyScale = smooth.energy * settings.intensity * 0.8;
      const kickPop = smooth.kick * 0.6;
      const breathe = Math.sin(time * 1.8 + i * 0.35) * 0.2;
      mesh.scale.setScalar((baseScale + energyScale + kickPop + breathe) * morphScale);
      
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        const colorPhase = (i / count + time * 0.025) % 1;
        const colorIdx = Math.floor(colorPhase * settings.colorPalette.length);
        tempColor.set(settings.colorPalette[colorIdx % settings.colorPalette.length]);
        tempColor.offsetHSL(smooth.high * 0.04, 0, smooth.energy * 0.18);
        mat.emissive.copy(tempColor);
        mat.emissiveIntensity = 0.6 + smooth.high * settings.intensity * 2 + smooth.kick * 0.7;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {/* Symmetry mirror planes - subtle reflective guides */}
      {Array.from({ length: symmetryFolds }).map((_, i) => (
        <mesh
          key={`mirror-${i}`}
          ref={(el) => { if (el) mirrorPlanesRef.current[i] = el; }}
          rotation={[0, (i / symmetryFolds) * Math.PI * 2, 0]}
        >
          <planeGeometry args={[15, 15]} />
          <meshBasicMaterial
            color={settings.colorPalette[i % settings.colorPalette.length]}
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {/* Motion trails following shapes */}
      {trailLines.map((line, idx) => {
        trailLinesRef.current[idx] = line;
        return <primitive key={`trail-${idx}`} object={line} />;
      })}
      
      {/* Orbiting shapes */}
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
            roughness={0.1}
            metalness={0.95}
            transparent
            opacity={0.95}
          />
        </mesh>
      ))}
    </group>
  );
}

// === PRESET 7: Cosmic Web (PREMIUM - Energy Flow Network) ===
function CosmicWeb({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const energyPulsesRef = useRef<THREE.Points>(null);
  const nebulaCloudRef = useRef<THREE.Points>(null);
  const nodeCount = 120;
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  const tempColor = useMemo(() => new THREE.Color(), []);
  const energyFlowRef = useRef<Float32Array>(new Float32Array(200 * 4)); // x, y, z, progress
  
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
      vel[i * 3] = (Math.random() - 0.5) * 0.05;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    }
    return [pos, vel, base];
  }, []);

  const linePositions = useMemo(() => new Float32Array(nodeCount * nodeCount * 6), []);
  const lineColors = useMemo(() => new Float32Array(nodeCount * nodeCount * 6), []);
  
  // Energy pulses that travel along connections
  const pulseCount = 200;
  const pulsePositions = useMemo(() => new Float32Array(pulseCount * 3), []);
  const pulseData = useMemo(() => {
    const data = new Float32Array(pulseCount * 4); // startNode, endNode, progress, speed
    for (let i = 0; i < pulseCount; i++) {
      data[i * 4] = Math.floor(Math.random() * nodeCount);
      data[i * 4 + 1] = Math.floor(Math.random() * nodeCount);
      data[i * 4 + 2] = Math.random();
      data[i * 4 + 3] = 0.5 + Math.random() * 1.5;
    }
    return data;
  }, []);
  
  // Nebula cloud particles (scattered throughout)
  const cloudCount = 500;
  const cloudPositions = useMemo(() => {
    const pos = new Float32Array(cloudCount * 3);
    for (let i = 0; i < cloudCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 20;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current || !linesRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Option 4: Attack/release smoothing for musical response
    const dt = Math.min(delta, 0.1);
    const smooth = smoothedAudioRef.current;
    smooth.sub = smoothAR(smooth.sub, audioRaw.sub, dt, 12, 5);
    smooth.bass = smoothAR(smooth.bass, audioRaw.bass, dt, 14, 6);
    smooth.mid = smoothAR(smooth.mid, audioRaw.mid, dt, 16, 8);
    smooth.high = smoothAR(smooth.high, audioRaw.high, dt, 20, 10);
    smooth.kick = smoothAR(smooth.kick, audioRaw.kick, dt, 25, 8);
    smooth.energy = smoothExp(smooth.energy, audioRaw.energy, dt, 8);

    const posAttr = pointsRef.current.geometry.attributes.position;
    const connectionThreshold = 5.0 + smooth.energy * settings.intensity * 3.5 + smooth.bass * 2.5;
    const breathScale = 1 + smooth.sub * 0.2;
    
    for (let i = 0; i < nodeCount; i++) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];
      const bz = basePositions[i * 3 + 2];
      
      const noise1 = Math.sin(time * 0.5 + i * 0.1) * velocities[i * 3] * smooth.energy * 20;
      const noise2 = Math.cos(time * 0.7 + i * 0.13) * velocities[i * 3 + 1] * smooth.mid * 12;
      const noise3 = Math.sin(time * 0.3 + i * 0.17) * velocities[i * 3 + 2] * smooth.bass * 10;
      
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
    
    // Store active connections for energy pulses
    const connections: [number, number, number, number, number, number][] = [];

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
          
          connections.push([x1, y1, z1, x2, y2, z2]);
          
          // Energy flow color gradient along connection
          const colorPhase = ((i + j) / nodeCount + time * 0.03) % 1;
          const colorIdx = Math.floor(colorPhase * settings.colorPalette.length);
          tempColor.set(settings.colorPalette[colorIdx % settings.colorPalette.length]);
          
          const flowPulse = Math.sin(time * 4 + lineIndex * 0.1) * 0.3 + 0.7;
          const alpha = (1 - dist / connectionThreshold) * (0.6 + smooth.high * 0.4) * flowPulse;
          tempColor.offsetHSL(smooth.high * 0.04, 0, smooth.energy * 0.15);
          
          lineColorAttr.setXYZ(lineIndex * 2, tempColor.r * alpha, tempColor.g * alpha, tempColor.b * alpha);
          lineColorAttr.setXYZ(lineIndex * 2 + 1, tempColor.r * alpha * 0.5, tempColor.g * alpha * 0.5, tempColor.b * alpha * 0.5);
          
          lineIndex++;
        }
      }
    }
    
    for (let i = lineIndex * 2; i < linePosAttr.count; i++) {
      linePosAttr.setXYZ(i, 0, 0, 0);
    }
    
    linePosAttr.needsUpdate = true;
    lineColorAttr.needsUpdate = true;
    
    // Energy pulses traveling along connections
    if (energyPulsesRef.current && connections.length > 0) {
      const pulseAttr = energyPulsesRef.current.geometry.attributes.position;
      for (let i = 0; i < pulseCount; i++) {
        pulseData[i * 4 + 2] += pulseData[i * 4 + 3] * 0.02 * (1 + smooth.energy * 2);
        
        if (pulseData[i * 4 + 2] > 1) {
          pulseData[i * 4 + 2] = 0;
          const connIdx = Math.floor(Math.random() * connections.length);
          pulseData[i * 4] = connIdx;
        }
        
        const connIdx = Math.floor(pulseData[i * 4]) % connections.length;
        const conn = connections[connIdx];
        const t = pulseData[i * 4 + 2];
        
        const x = conn[0] + (conn[3] - conn[0]) * t;
        const y = conn[1] + (conn[4] - conn[1]) * t;
        const z = conn[2] + (conn[5] - conn[2]) * t;
        
        pulseAttr.setXYZ(i, x, y, z);
      }
      pulseAttr.needsUpdate = true;
      
      const mat = energyPulsesRef.current.material as THREE.PointsMaterial;
      mat.size = 0.15 + smooth.kick * 0.1;
      mat.opacity = 0.8 + smooth.energy * 0.2;
    }
    
    // Nebula cloud particles drift slowly
    if (nebulaCloudRef.current) {
      const cloudAttr = nebulaCloudRef.current.geometry.attributes.position;
      for (let i = 0; i < cloudCount; i++) {
        const ox = cloudPositions[i * 3];
        const oy = cloudPositions[i * 3 + 1];
        const oz = cloudPositions[i * 3 + 2];
        const drift = Math.sin(time * 0.3 + i * 0.1) * 0.5 + 1;
        const twinkle = 1 + Math.sin(time * 2 + i * 0.3) * 0.1 * smooth.high;
        cloudAttr.setXYZ(i, ox * drift * twinkle, oy * twinkle, oz * drift * twinkle);
      }
      cloudAttr.needsUpdate = true;
      nebulaCloudRef.current.rotation.y = time * 0.05;
      nebulaCloudRef.current.rotation.x = time * 0.03;
    }
    
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0025 * (1 + smooth.mid * 0.4);
      groupRef.current.rotation.x = smooth.sub * 0.12 * Math.sin(time * 0.25);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Nebula cloud particles */}
      <points ref={nebulaCloudRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={cloudCount}
            array={cloudPositions}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.08}
          color={settings.colorPalette[1] || settings.colorPalette[0]}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      
      {/* Main web nodes */}
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
          size={0.5}
          color={settings.colorPalette[0]}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
        />
      </points>
      
      {/* Energy pulses traveling along connections */}
      <points ref={energyPulsesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={pulseCount}
            array={pulsePositions}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.2}
          color={settings.colorPalette[2] || settings.colorPalette[0]}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      
      {/* Connection lines */}
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
          opacity={0.75}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

// === PRESET 8: Cymatic Sand Plate (PREMIUM - Standing Wave Membrane) ===
function CymaticSandPlate({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const membraneRef = useRef<THREE.Mesh>(null);
  const interferenceRingsRef = useRef<THREE.Line[]>([]);
  const velocitiesRef = useRef<Float32Array | null>(null);
  const lastKickRef = useRef(0);
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  const particleCount = 3000;
  const ringCount = 12;
  const tempColor = useMemo(() => new THREE.Color(), []);
  
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = Math.random() * 5.5;
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.sin(theta) * r;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    return pos;
  }, []);

  const colors = useMemo(() => {
    const col = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      col[i * 3] = 0.8;
      col[i * 3 + 1] = 0.7;
      col[i * 3 + 2] = 0.6;
    }
    return col;
  }, []);
  
  // Interference pattern rings
  const ringLines = useMemo(() => {
    const lines: THREE.Line[] = [];
    const ringPointCount = 80;
    for (let i = 0; i < ringCount; i++) {
      const positions = new Float32Array(ringPointCount * 3);
      const colors = new Float32Array(ringPointCount * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.LineBasicMaterial({ 
        vertexColors: true,
        transparent: true, 
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      lines.push(new THREE.Line(geometry, material));
    }
    return lines;
  }, []);

  useEffect(() => {
    velocitiesRef.current = new Float32Array(particleCount * 3);
  }, []);
  
  // Cleanup
  useEffect(() => {
    return () => {
      ringLines.forEach((line) => {
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
    };
  }, [ringLines]);

  useFrame((state, delta) => {
    if (!pointsRef.current || !velocitiesRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime();
    
    // Option 4: Attack/release smoothing for musical response
    const dt = Math.min(delta, 0.1);
    const smooth = smoothedAudioRef.current;
    smooth.sub = smoothAR(smooth.sub, audioRaw.sub, dt, 14, 6);
    smooth.bass = smoothAR(smooth.bass, audioRaw.bass, dt, 18, 8);
    smooth.mid = smoothAR(smooth.mid, audioRaw.mid, dt, 20, 10);
    smooth.high = smoothAR(smooth.high, audioRaw.high, dt, 24, 12);
    smooth.kick = smoothAR(smooth.kick, audioRaw.kick, dt, 28, 10);
    smooth.energy = smoothExp(smooth.energy, audioRaw.energy, dt, 10);
    
    const posAttr = pointsRef.current.geometry.attributes.position;
    const colorAttr = pointsRef.current.geometry.attributes.color;
    const vel = velocitiesRef.current;
    
    const modePatterns = [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4], [5, 5], [6, 5]];
    const [m, n] = modePatterns[Math.max(0, Math.min(7, audioRaw.modeIndex - 1))];
    
    const kickBurst = audioRaw.kick > 0.3 && audioRaw.kick > lastKickRef.current + 0.1 ? audioRaw.kick * 0.5 : 0;
    lastKickRef.current = audioRaw.kick;
    
    const vibration = smooth.bass * settings.intensity * 0.5;
    
    for (let i = 0; i < particleCount; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      
      const waveValue = Math.sin(m * x * 0.5) * Math.sin(n * y * 0.5);
      const dx = 0.5 * m * Math.cos(m * x * 0.5) * Math.sin(n * y * 0.5);
      const dy = 0.5 * n * Math.sin(m * x * 0.5) * Math.cos(n * y * 0.5);
      
      const settleSpeed = 0.03 * settings.speed * smooth.energy;
      const forceX = -Math.sign(waveValue) * dx * settleSpeed;
      const forceY = -Math.sign(waveValue) * dy * settleSpeed;
      
      vel[i * 3] += forceX;
      vel[i * 3 + 1] += forceY;
      
      if (kickBurst > 0) {
        const angle = Math.atan2(y, x) + i * 0.01;
        vel[i * 3] += Math.cos(angle) * kickBurst * 0.6;
        vel[i * 3 + 1] += Math.sin(angle) * kickBurst * 0.6;
      }
      
      // 3D height response to wave nodes
      const heightWave = waveValue * vibration * 0.8 + Math.sin(time * 4 + i * 0.1) * vibration * 0.15;
      vel[i * 3 + 2] = heightWave;
      
      vel[i * 3] *= 0.88;
      vel[i * 3 + 1] *= 0.88;
      
      const maxR = 6;
      let newX = x + vel[i * 3];
      let newY = y + vel[i * 3 + 1];
      const newDist = Math.sqrt(newX * newX + newY * newY);
      
      if (newDist > maxR) {
        const scale = maxR / newDist;
        newX *= scale;
        newY *= scale;
      }
      
      posAttr.setXYZ(i, newX, newY, z * 0.8 + vel[i * 3 + 2]);
      
      // Color based on wave position
      const nodeProximity = 1 - Math.min(1, Math.abs(waveValue));
      const colorIdx = i % settings.colorPalette.length;
      tempColor.set(settings.colorPalette[colorIdx]);
      tempColor.offsetHSL(smooth.high * 0.03 + Math.abs(heightWave) * 0.1, 0, nodeProximity * 0.4 + smooth.high * 0.25);
      colorAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
    }
    
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    
    // Interference pattern rings - concentric waves emanating from center
    ringLines.forEach((line, ringIdx) => {
      const geometry = line.geometry as THREE.BufferGeometry;
      const posAttr2 = geometry.attributes.position as THREE.BufferAttribute;
      const colorAttr2 = geometry.attributes.color as THREE.BufferAttribute;
      
      const ringPointCount = 80;
      const baseR = (ringIdx + 1) * 0.5 + Math.sin(time * 3 - ringIdx * 0.5) * 0.3 * smooth.bass;
      const waveHeight = Math.sin(time * 4 - ringIdx * 0.8) * 0.3 * smooth.mid;
      
      for (let j = 0; j < ringPointCount; j++) {
        const t = j / (ringPointCount - 1);
        const angle = t * Math.PI * 2;
        const r = baseR + Math.sin(angle * m + time * 2) * 0.2 * smooth.energy;
        
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        const z = waveHeight + Math.sin(angle * n + time * 3) * 0.15 * smooth.high;
        
        posAttr2.setXYZ(j, x, y, z);
        
        const colorIdx = ringIdx % settings.colorPalette.length;
        tempColor.set(settings.colorPalette[colorIdx]);
        const brightness = 0.5 + Math.sin(angle * 4 + time * 2) * 0.3 + smooth.energy * 0.3;
        colorAttr2.setXYZ(j, tempColor.r * brightness, tempColor.g * brightness, tempColor.b * brightness);
      }
      
      posAttr2.needsUpdate = true;
      colorAttr2.needsUpdate = true;
      
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = 0.4 + smooth.energy * 0.4 - ringIdx * 0.03;
    });
    
    // Membrane deformation
    if (membraneRef.current) {
      const geom = membraneRef.current.geometry as THREE.BufferGeometry;
      const meshPos = geom.attributes.position;
      for (let i = 0; i < meshPos.count; i++) {
        const x = meshPos.getX(i);
        const y = meshPos.getY(i);
        const z = Math.sin(m * x * 0.3 + time) * Math.sin(n * y * 0.3 + time) * vibration * 0.5;
        meshPos.setZ(i, z);
      }
      meshPos.needsUpdate = true;
      geom.computeVertexNormals();
      
      const mat = membraneRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 0.3 + smooth.energy * 0.5;
      }
    }
    
    if (groupRef.current) {
      groupRef.current.rotation.x = -0.75;
      groupRef.current.rotation.z = time * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Vibrating membrane surface */}
      <mesh ref={membraneRef} rotation={[0, 0, 0]} position={[0, 0, -0.15]}>
        <planeGeometry args={[14, 14, 32, 32]} />
        <meshStandardMaterial
          color={settings.colorPalette[1] || settings.colorPalette[0]}
          emissive={settings.colorPalette[0]}
          emissiveIntensity={0.3}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      
      {/* Interference pattern rings */}
      {ringLines.map((line, idx) => {
        interferenceRingsRef.current[idx] = line;
        return <primitive key={`ring-${idx}`} object={line} />;
      })}
      
      {/* Sand particles */}
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
          size={0.12}
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
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

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const audio = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Option 4: Attack/release smoothing for musical response
    const dt = Math.min(delta, 0.1);
    smoothedAudio.current.sub = smoothAR(smoothedAudio.current.sub, audio.sub, dt, 12, 5);
    smoothedAudio.current.bass = smoothAR(smoothedAudio.current.bass, audio.bass, dt, 14, 6);
    smoothedAudio.current.mid = smoothAR(smoothedAudio.current.mid, audio.mid, dt, 16, 8);
    smoothedAudio.current.high = smoothAR(smoothedAudio.current.high, audio.high, dt, 20, 10);
    smoothedAudio.current.energy = smoothExp(smoothedAudio.current.energy, audio.energy, dt, 8);
    
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

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Option 4: Attack/release smoothing for musical response
    const dt = Math.min(delta, 0.1);
    const smooth = smoothedAudioRef.current;
    smooth.sub = smoothAR(smooth.sub, audioRaw.sub, dt, 10, 4);
    smooth.bass = smoothAR(smooth.bass, audioRaw.bass, dt, 14, 6);
    smooth.mid = smoothAR(smooth.mid, audioRaw.mid, dt, 16, 7);
    smooth.high = smoothAR(smooth.high, audioRaw.high, dt, 20, 10);
    smooth.kick = smoothAR(smooth.kick, audioRaw.kick, dt, 28, 10);
    smooth.energy = smoothExp(smooth.energy, audioRaw.energy, dt, 7);
    
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

// === PRESET 11: Resonant Field Lines (PREMIUM - Electromagnetic Force Visualization) ===
function ResonantFieldLines({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const fieldPolesRef = useRef<THREE.Mesh[]>([]);
  const ionTrailsRef = useRef<THREE.Points>(null);
  const lineCount = 54;
  const pointsPerLine = 60;
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  const tempColor = useMemo(() => new THREE.Color(), []);
  
  // Ionized particles following field lines
  const ionCount = 400;
  const ionData = useMemo(() => {
    const positions = new Float32Array(ionCount * 3);
    const phases = new Float32Array(ionCount * 2); // lineIndex, progress along line
    for (let i = 0; i < ionCount; i++) {
      phases[i * 2] = Math.floor(Math.random() * lineCount);
      phases[i * 2 + 1] = Math.random();
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    return { positions, phases };
  }, []);
  
  // Dipole pole positions (computed dynamically)
  const polePositionsRef = useRef<{ north: THREE.Vector3, south: THREE.Vector3 }>({
    north: new THREE.Vector3(0, 4, 0),
    south: new THREE.Vector3(0, -4, 0)
  });
  
  // Pre-create line objects with reusable geometries
  const lineObjects = useMemo(() => {
    const lines: THREE.Line[] = [];
    for (let i = 0; i < lineCount; i++) {
      const positions = new Float32Array(pointsPerLine * 3);
      const colors = new Float32Array(pointsPerLine * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.LineBasicMaterial({ 
        vertexColors: true,
        transparent: true, 
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      lines.push(new THREE.Line(geometry, material));
    }
    return lines;
  }, []);
  
  // Store computed line positions for ion particles
  const linePositionsCache = useRef<Float32Array[]>(
    Array.from({ length: lineCount }, () => new Float32Array(pointsPerLine * 3))
  );

  // Cleanup geometries and materials on unmount
  useEffect(() => {
    return () => {
      lineObjects.forEach((line) => {
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
    };
  }, [lineObjects]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Option 4: Attack/release smoothing for musical response
    const dt = Math.min(delta, 0.1);
    const smooth = smoothedAudioRef.current;
    smooth.sub = smoothAR(smooth.sub, audioRaw.sub, dt, 12, 5);
    smooth.bass = smoothAR(smooth.bass, audioRaw.bass, dt, 14, 6);
    smooth.mid = smoothAR(smooth.mid, audioRaw.mid, dt, 16, 8);
    smooth.high = smoothAR(smooth.high, audioRaw.high, dt, 20, 10);
    smooth.kick = smoothAR(smooth.kick, audioRaw.kick, dt, 25, 8);
    smooth.energy = smoothExp(smooth.energy, audioRaw.energy, dt, 8);
    
    const symmetry = audioRaw.modeIndex + 2;
    const fieldStrength = (smooth.sub + smooth.bass) * 0.7 * settings.intensity;
    
    // Dynamic pole separation based on bass
    const poleSeparation = 4.5 + smooth.bass * 2;
    polePositionsRef.current.north.set(0, poleSeparation, 0);
    polePositionsRef.current.south.set(0, -poleSeparation, 0);
    
    // Update pole meshes
    fieldPolesRef.current.forEach((pole, idx) => {
      if (!pole) return;
      const isNorth = idx === 0;
      const poleY = isNorth ? poleSeparation : -poleSeparation;
      pole.position.y = poleY;
      const pulseScale = 0.5 + smooth.kick * 0.4 + smooth.energy * 0.2;
      pole.scale.setScalar(pulseScale);
      pole.rotation.y = time * (isNorth ? 0.5 : -0.5);
    });
    
    // Calculate field lines as magnetic dipole curves
    lineObjects.forEach((line, idx) => {
      const geometry = line.geometry as THREE.BufferGeometry;
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const colorAttr = geometry.attributes.color as THREE.BufferAttribute;
      const angle = (idx / lineCount) * Math.PI * 2;
      const cache = linePositionsCache.current[idx];
      
      for (let j = 0; j < pointsPerLine; j++) {
        const t = j / (pointsPerLine - 1);
        
        // Parametric curve from north pole to south pole
        // Classic magnetic field line shape
        const theta = t * Math.PI; // 0 to π (north to south)
        const startRadius = 0.5 + (idx % 6) * 0.4;
        const r = startRadius * Math.sin(theta) * (1 + fieldStrength * 0.5);
        
        // Add audio-reactive perturbations
        const symMod = Math.sin(angle * symmetry + time * 0.5) * fieldStrength * 0.3;
        const spiralOffset = Math.sin(t * 6 + time * 2) * smooth.mid * 0.2;
        
        const x = Math.cos(angle + spiralOffset) * (r + symMod);
        const y = poleSeparation * Math.cos(theta) + Math.sin(time + t * 3) * smooth.high * 0.3;
        const z = Math.sin(angle + spiralOffset) * (r + symMod);
        
        posAttr.setXYZ(j, x, y, z);
        cache[j * 3] = x;
        cache[j * 3 + 1] = y;
        cache[j * 3 + 2] = z;
        
        // Color gradient: warm near poles, cool in middle
        const colorIdx = idx % settings.colorPalette.length;
        tempColor.set(settings.colorPalette[colorIdx]);
        const poleProximity = 1 - Math.abs(t - 0.5) * 2; // 0 at poles, 1 at equator
        const brightness = 0.5 + poleProximity * 0.4 + smooth.high * 0.3;
        tempColor.offsetHSL((1 - poleProximity) * 0.08, 0, poleProximity * 0.15);
        colorAttr.setXYZ(j, tempColor.r * brightness, tempColor.g * brightness, tempColor.b * brightness);
      }
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      
      const material = line.material as THREE.LineBasicMaterial;
      material.opacity = 0.55 + smooth.energy * 0.4;
    });
    
    // Ionized particles following field lines
    if (ionTrailsRef.current) {
      const ionAttr = ionTrailsRef.current.geometry.attributes.position;
      const { phases } = ionData;
      
      for (let i = 0; i < ionCount; i++) {
        // Progress along the line
        phases[i * 2 + 1] += 0.008 * (1 + smooth.energy * 2);
        
        if (phases[i * 2 + 1] > 1) {
          phases[i * 2 + 1] = 0;
          phases[i * 2] = Math.floor(Math.random() * lineCount);
        }
        
        const lineIdx = Math.floor(phases[i * 2]) % lineCount;
        const progress = phases[i * 2 + 1];
        const cache = linePositionsCache.current[lineIdx];
        
        // Interpolate position along the cached line
        const linePos = progress * (pointsPerLine - 1);
        const idx1 = Math.floor(linePos);
        const idx2 = Math.min(idx1 + 1, pointsPerLine - 1);
        const frac = linePos - idx1;
        
        const x = cache[idx1 * 3] * (1 - frac) + cache[idx2 * 3] * frac;
        const y = cache[idx1 * 3 + 1] * (1 - frac) + cache[idx2 * 3 + 1] * frac;
        const z = cache[idx1 * 3 + 2] * (1 - frac) + cache[idx2 * 3 + 2] * frac;
        
        // Add small offset for visual depth
        const jitter = Math.sin(time * 10 + i) * 0.05 * smooth.high;
        ionAttr.setXYZ(i, x + jitter, y, z + jitter);
      }
      ionAttr.needsUpdate = true;
      
      const mat = ionTrailsRef.current.material as THREE.PointsMaterial;
      mat.size = 0.08 + smooth.kick * 0.05;
      mat.opacity = 0.7 + smooth.energy * 0.3;
    }
    
    groupRef.current.rotation.y = time * 0.08;
    groupRef.current.rotation.x = Math.sin(time * 0.15) * 0.15 * smooth.sub;
  });

  return (
    <group ref={groupRef}>
      {/* North magnetic pole */}
      <mesh ref={(el) => { if (el) fieldPolesRef.current[0] = el; }} position={[0, 4, 0]}>
        <octahedronGeometry args={[0.5, 2]} />
        <meshBasicMaterial
          color={settings.colorPalette[0]}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* South magnetic pole */}
      <mesh ref={(el) => { if (el) fieldPolesRef.current[1] = el; }} position={[0, -4, 0]}>
        <octahedronGeometry args={[0.5, 2]} />
        <meshBasicMaterial
          color={settings.colorPalette[1] || settings.colorPalette[0]}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Ionized particles following field lines */}
      <points ref={ionTrailsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={ionCount}
            array={ionData.positions}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.1}
          color={settings.colorPalette[2] || settings.colorPalette[0]}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      
      {/* Field lines */}
      {lineObjects.map((line, idx) => (
        <primitive key={idx} object={line} />
      ))}
    </group>
  );
}

// Premium Image Filter Shader Material
const PsyFilterMaterial = shaderMaterial(
  {
    uTexture: null,
    uTime: 0,
    uIntensity: 1.0,
    uFilterType: 0,
    uEnergy: 0,
    uBass: 0,
    uMid: 0,
    uHigh: 0,
  },
  // Vertex shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader - Premium Quality Filters
  `
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uIntensity;
    uniform int uFilterType;
    uniform float uEnergy;
    uniform float uBass;
    uniform float uMid;
    uniform float uHigh;
    varying vec2 vUv;
    
    #define PI 3.14159265359
    #define TAU 6.28318530718
    
    // High-quality noise function
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f); // Smoothstep
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    // Fractal brownian motion for organic textures
    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;
      for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }
    
    // Premium kaleidoscope with smooth edges
    vec2 kaleidoscopePremium(vec2 uv, float segments, float rotation) {
      vec2 centered = uv - 0.5;
      float angle = atan(centered.y, centered.x) + rotation;
      float radius = length(centered);
      float segmentAngle = TAU / segments;
      angle = mod(angle, segmentAngle);
      angle = abs(angle - segmentAngle * 0.5);
      // Smooth edge blending
      float edgeFade = smoothstep(0.0, 0.02, abs(angle - segmentAngle * 0.25));
      vec2 result = vec2(cos(angle), sin(angle)) * radius + 0.5;
      return result;
    }
    
    // Premium fractal mirror with multiple reflections
    vec2 fractalMirror(vec2 uv, float time) {
      vec2 centered = uv - 0.5;
      float angle = atan(centered.y, centered.x);
      float radius = length(centered);
      
      // Multiple reflection layers
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        centered = abs(centered) - 0.2 * (1.0 + sin(time * 0.5 + fi));
        float a = time * 0.2 * (fi + 1.0);
        mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
        centered *= rot;
      }
      
      return centered + 0.5;
    }
    
    // HSL to RGB conversion for premium color manipulation
    vec3 hsl2rgb(vec3 hsl) {
      float h = hsl.x;
      float s = hsl.y;
      float l = hsl.z;
      float c = (1.0 - abs(2.0 * l - 1.0)) * s;
      float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
      float m = l - c / 2.0;
      vec3 rgb;
      if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
      else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
      else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
      else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
      else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
      else rgb = vec3(c, 0.0, x);
      return rgb + m;
    }
    
    // RGB to HSL for premium color shifts
    vec3 rgb2hsl(vec3 rgb) {
      float maxC = max(rgb.r, max(rgb.g, rgb.b));
      float minC = min(rgb.r, min(rgb.g, rgb.b));
      float l = (maxC + minC) / 2.0;
      float s = 0.0;
      float h = 0.0;
      if (maxC != minC) {
        float d = maxC - minC;
        s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
        if (maxC == rgb.r) h = (rgb.g - rgb.b) / d + (rgb.g < rgb.b ? 6.0 : 0.0);
        else if (maxC == rgb.g) h = (rgb.b - rgb.r) / d + 2.0;
        else h = (rgb.r - rgb.g) / d + 4.0;
        h /= 6.0;
      }
      return vec3(h, s, l);
    }
    
    // Premium chromatic aberration
    vec3 chromaticAberration(sampler2D tex, vec2 uv, float amount) {
      vec2 dir = normalize(uv - 0.5);
      float dist = length(uv - 0.5);
      float aberration = amount * dist * dist;
      float r = texture2D(tex, uv + dir * aberration).r;
      float g = texture2D(tex, uv).g;
      float b = texture2D(tex, uv - dir * aberration).b;
      return vec3(r, g, b);
    }
    
    // Barrel distortion for premium lens effects
    vec2 barrelDistort(vec2 uv, float amount) {
      vec2 centered = uv - 0.5;
      float dist = length(centered);
      float distortion = 1.0 + dist * dist * amount;
      return centered * distortion + 0.5;
    }
    
    // Film grain effect
    float filmGrain(vec2 uv, float time, float amount) {
      return (hash(uv * 1000.0 + time * 100.0) - 0.5) * amount;
    }
    
    // Vignette effect
    float vignette(vec2 uv, float radius, float softness) {
      float dist = length(uv - 0.5);
      return 1.0 - smoothstep(radius - softness, radius + softness, dist);
    }
    
    // Luminance calculation for noise gating (Option 2)
    float calcLuma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }
    
    // Luminance-aware noise gate - reduces grain/shimmer on dark pixels
    float noiseGate(vec3 color) {
      float l = calcLuma(color);
      // Dark pixels = 0, bright pixels = 1
      // Lower threshold for dark images, higher for bright areas
      return smoothstep(0.08, 0.30, l);
    }
    
    // Luminance-gated film grain
    float filmGrainGated(vec2 uv, float time, float amount, vec3 color) {
      float gate = noiseGate(color);
      return (hash(uv * 1000.0 + time * 100.0) - 0.5) * amount * gate;
    }
    
    // Luminance-gated chromatic aberration
    vec3 chromaticAberrationGated(sampler2D tex, vec2 uv, float amount, float gate) {
      vec2 dir = normalize(uv - 0.5);
      float dist = length(uv - 0.5);
      float aberration = amount * dist * dist * gate; // Gate the aberration amount
      float r = texture2D(tex, uv + dir * aberration).r;
      float g = texture2D(tex, uv).g;
      float b = texture2D(tex, uv - dir * aberration).b;
      return vec3(r, g, b);
    }
    
    void main() {
      vec2 uv = vUv;
      vec3 color;
      float opacity = 0.4;
      float audioMod = uEnergy * 0.5 + uBass * 0.3 + uMid * 0.2;
      
      // Filter type 0: None (Enhanced with subtle vignette)
      if (uFilterType == 0) {
        color = texture2D(uTexture, uv).rgb;
        color *= vignette(uv, 0.85, 0.3);
      }
      
      // Filter type 1: Premium Kaleidoscope with glow
      else if (uFilterType == 1) {
        float segments = 6.0 + floor(uEnergy * 6.0);
        float rotation = uTime * 0.2 + uBass * 0.5;
        vec2 kUv = kaleidoscopePremium(uv, segments, rotation);
        
        // Multi-layer sampling for glow effect
        vec3 baseColor = texture2D(uTexture, fract(kUv + uTime * 0.03)).rgb;
        vec3 glowColor = texture2D(uTexture, fract(kUv * 1.02 + uTime * 0.03)).rgb;
        color = mix(baseColor, glowColor, 0.3 + uHigh * 0.2);
        
        // Add radial glow
        float radialGlow = 1.0 - length(uv - 0.5) * 1.5;
        color += color * radialGlow * 0.3 * uEnergy;
        color *= vignette(uv, 0.7, 0.4);
        opacity = 0.55;
      }
      
      // Filter type 2: Premium Fractal Mirror
      else if (uFilterType == 2) {
        vec2 mUv = fractalMirror(uv, uTime);
        mUv = fract(mUv);
        
        // Chromatic aberration on mirror
        color = chromaticAberration(uTexture, mUv, 0.02 * uIntensity);
        
        // Color cycling based on position
        vec3 hsl = rgb2hsl(color);
        hsl.x = fract(hsl.x + uTime * 0.05 + length(uv - 0.5) * 0.2);
        hsl.y = min(1.0, hsl.y * (1.0 + uMid * 0.3));
        color = hsl2rgb(hsl);
        
        color *= vignette(uv, 0.75, 0.35);
        opacity = 0.5;
      }
      
      // Filter type 3: Premium Color Shift with gradient mapping
      else if (uFilterType == 3) {
        vec2 distortUv = uv + vec2(
          sin(uv.y * 8.0 + uTime * 2.0) * 0.01 * uBass,
          cos(uv.x * 8.0 + uTime * 2.0) * 0.01 * uBass
        );
        color = texture2D(uTexture, distortUv).rgb;
        
        // Premium HSL-based color cycling
        vec3 hsl = rgb2hsl(color);
        hsl.x = fract(hsl.x + uTime * 0.15 + uEnergy * 0.3);
        hsl.s = min(1.0, hsl.s * (1.2 + uHigh * 0.3));
        hsl.z = hsl.z * (0.9 + uEnergy * 0.2);
        color = hsl2rgb(hsl);
        
        // Add subtle grain
        color += filmGrain(uv, uTime, 0.03);
        color *= vignette(uv, 0.8, 0.3);
        opacity = 0.45;
      }
      
      // Filter type 4: Premium Invert with smooth transitions
      else if (uFilterType == 4) {
        color = texture2D(uTexture, uv).rgb;
        
        // Smooth wave-based inversion
        float wave = sin(uv.x * 6.0 + uTime * 3.0) * sin(uv.y * 6.0 + uTime * 2.0);
        float invertAmount = smoothstep(-0.5, 0.5, wave) * (0.5 + uEnergy * 0.5);
        
        vec3 inverted = vec3(1.0) - color;
        color = mix(color, inverted, invertAmount);
        
        // Add subtle color tint based on audio
        color.r += uBass * 0.1;
        color.b += uHigh * 0.1;
        
        color *= vignette(uv, 0.8, 0.3);
        opacity = 0.45;
      }
      
      // Filter type 5: Premium Mosaic with smooth tiles
      else if (uFilterType == 5) {
        float tileSize = mix(80.0, 12.0, uEnergy);
        vec2 tileUv = floor(uv * tileSize) / tileSize;
        vec2 tileCenter = tileUv + 0.5 / tileSize;
        
        // Smooth tile edges
        vec2 tilePos = fract(uv * tileSize);
        float tileFade = smoothstep(0.0, 0.1, tilePos.x) * smoothstep(1.0, 0.9, tilePos.x);
        tileFade *= smoothstep(0.0, 0.1, tilePos.y) * smoothstep(1.0, 0.9, tilePos.y);
        
        vec3 tileColor = texture2D(uTexture, tileCenter).rgb;
        vec3 originalColor = texture2D(uTexture, uv).rgb;
        color = mix(originalColor, tileColor, tileFade * 0.8);
        
        // Add tile glow
        color += tileColor * (1.0 - tileFade) * 0.2 * uHigh;
        color *= vignette(uv, 0.8, 0.3);
        opacity = 0.5;
      }
      
      // Filter type 6: Premium RGB Split with radial distortion (no mirror artifacts)
      else if (uFilterType == 6) {
        // Reduced base amount, stronger near center, weaker at edges
        float edgeDist = length(uv - 0.5);
        float edgeFade = 1.0 - smoothstep(0.2, 0.5, edgeDist);
        float amount = 0.012 * uIntensity * (1.0 + uEnergy * 1.5) * edgeFade;
        
        // Radial chromatic aberration - depth-aware split
        vec2 dir = uv - 0.5;
        float dist = length(dir);
        vec2 offset = (dist > 0.001 ? normalize(dir) : vec2(0.0)) * amount * (0.5 + dist * 0.5);
        
        // Sample with barrel distortion - clamp UVs to prevent edge sampling
        vec2 rUv = clamp(barrelDistort(uv + offset, 0.08 * uBass), 0.001, 0.999);
        vec2 gUv = clamp(uv, 0.001, 0.999);
        vec2 bUv = clamp(barrelDistort(uv - offset, 0.08 * uBass), 0.001, 0.999);
        
        float r = texture2D(uTexture, rUv).r;
        float g = texture2D(uTexture, gUv).g;
        float b = texture2D(uTexture, bUv).b;
        color = vec3(r, g, b);
        
        // Soft edge vignette to hide any remaining edge artifacts
        float edgeVignette = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x) *
                            smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.92, uv.y);
        color *= edgeVignette;
        
        // Subtle scan lines for texture - gated for dark protection (Option 2)
        float rgbGate = noiseGate(color);
        float scanLine = sin(uv.y * 300.0 + uTime * 4.0) * 0.02;
        color += scanLine * uHigh * 0.5 * rgbGate;
        
        color *= vignette(uv, 0.75, 0.35);
        opacity = 0.45;
      }
      
      // Filter type 7: Premium Liquid Wave with Smoke/Fog effect
      else if (uFilterType == 7) {
        // Reduced wave amplitude - subtle and dreamy
        vec2 waveUv = uv;
        float waveAmount = 0.012 * uIntensity; // Reduced from 0.03
        
        // Slower, broader waves - less aggressive oscillation
        waveUv.x += sin(uv.y * 4.0 + uTime * 1.2) * waveAmount * (0.5 + uBass * 0.5);
        waveUv.y += cos(uv.x * 4.0 + uTime * 1.0) * waveAmount * (0.5 + uBass * 0.5);
        waveUv.x += sin(uv.y * 2.0 - uTime * 0.8) * waveAmount * 0.3 * uMid;
        waveUv.y += cos(uv.x * 2.0 - uTime * 0.6) * waveAmount * 0.3 * uMid;
        
        // Clamp UVs to prevent edge artifacts
        waveUv = clamp(waveUv, 0.001, 0.999);
        
        // Multi-layer smoke/fog effect
        float smokeNoise1 = fbm(uv * 2.0 + uTime * 0.15);
        float smokeNoise2 = fbm(uv * 3.5 + vec2(uTime * 0.1, -uTime * 0.08));
        float smokeNoise3 = fbm(uv * 1.5 - uTime * 0.12);
        float combinedSmoke = (smokeNoise1 + smokeNoise2 * 0.6 + smokeNoise3 * 0.4) / 2.0;
        
        // Subtle wave depth from bass
        waveUv += (combinedSmoke - 0.5) * 0.008 * uEnergy;
        
        // Base image with subtle chromatic aberration from highs
        vec3 baseColor = texture2D(uTexture, waveUv).rgb;
        float waveGate = noiseGate(baseColor); // Luminance gate for dark protection
        color = chromaticAberrationGated(uTexture, waveUv, 0.004 * uHigh, waveGate);
        
        // Volumetric smoke overlay - dominant mood element
        vec3 smokeColor = vec3(0.9, 0.92, 1.0); // Slight cool tint
        float smokeIntensity = combinedSmoke * 0.35 * (0.6 + uMid * 0.4);
        color = mix(color, smokeColor, smokeIntensity * 0.4 * waveGate); // Reduce smoke on dark areas
        
        // Soft smoke shimmer from highs - gated for dark protection
        float shimmer = pow(smokeNoise2, 2.0) * uHigh * 0.15 * waveGate;
        color += shimmer;
        
        // Dreamy soft glow
        float softGlow = smoothstep(0.3, 0.7, combinedSmoke) * 0.1;
        color += softGlow * vec3(1.0, 0.98, 0.95);
        
        color *= vignette(uv, 0.85, 0.25);
        opacity = 0.55;
      }
      
      // Filter type 8: Premium Zoom Pulse - Audio-reactive with multi-directional motion
      else if (uFilterType == 8) {
        // Audio-reactive zoom: Bass controls intensity, with asymmetric easing
        float bassZoom = uBass * 0.08 * uIntensity;
        float midSpeed = 1.0 + uMid * 0.5;
        float highJitter = uHigh * 0.015;
        
        // Non-linear zoom with phase offsets to break repetition
        float phase1 = sin(uTime * 1.3 * midSpeed) * 0.6;
        float phase2 = sin(uTime * 0.7 * midSpeed + 1.5) * 0.4;
        float zoomAmount = (phase1 + phase2) * bassZoom + highJitter * sin(uTime * 8.0);
        
        // Lateral motion - organic parallax drift tied to mids
        float driftX = sin(uTime * 0.4 + uMid) * 0.02 * uIntensity;
        float driftY = cos(uTime * 0.35 + uMid * 0.8) * 0.015 * uIntensity;
        
        // Occasional diagonal movement synced to beat energy
        float diagonalPhase = sin(uTime * 0.8) * uEnergy * 0.01;
        driftX += diagonalPhase;
        driftY += diagonalPhase * 0.7;
        
        // Dynamic focal point - not always center
        vec2 focalPoint = vec2(0.5 + sin(uTime * 0.2) * 0.05 * uMid, 
                               0.5 + cos(uTime * 0.25) * 0.04 * uMid);
        
        // Slight rotation during zoom for organic feel
        float rotAngle = sin(uTime * 0.5) * 0.02 * uIntensity * uEnergy;
        
        // Multi-sample radial blur toward dynamic focal point
        vec3 blurColor = vec3(0.0);
        int samples = 8;
        for (int i = 0; i < 8; i++) {
          float t = float(i) / float(samples);
          float zoom = 1.0 + zoomAmount * t;
          
          // Apply zoom from dynamic focal point
          vec2 zoomUv = (uv - focalPoint) / zoom + focalPoint;
          
          // Add lateral drift
          zoomUv += vec2(driftX, driftY) * t;
          
          // Apply subtle rotation
          vec2 rotCenter = zoomUv - 0.5;
          float c = cos(rotAngle * t);
          float s = sin(rotAngle * t);
          zoomUv = vec2(rotCenter.x * c - rotCenter.y * s, 
                       rotCenter.x * s + rotCenter.y * c) + 0.5;
          
          // Clamp to prevent edge artifacts
          zoomUv = clamp(zoomUv, 0.001, 0.999);
          
          blurColor += texture2D(uTexture, zoomUv).rgb;
        }
        color = blurColor / float(samples);
        
        // Radial glow tied to bass - gated for dark protection
        float zoomGate = noiseGate(color); // Luminance gate
        float radialIntensity = 1.0 - length(uv - focalPoint) * 1.6;
        radialIntensity = max(0.0, radialIntensity);
        color += color * radialIntensity * 0.25 * uBass * zoomGate;
        
        // Chromatic edges on highs - gated for dark protection
        color = mix(color, chromaticAberrationGated(uTexture, uv, 0.004 * uHigh, zoomGate), 0.25);
        
        color *= vignette(uv, 0.75, 0.35);
        opacity = 0.5;
      }
      
      else {
        color = texture2D(uTexture, uv).rgb;
      }
      
      // Global enhancements for all filters
      // Luminance-gated film grain - no grain on dark pixels (Option 2)
      color += filmGrainGated(uv, uTime, 0.015, color);
      
      // Clamp to valid range
      color = clamp(color, 0.0, 1.0);
      
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
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    // Option 5: Ensure proper sRGB colorSpace for linear workflow
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [imageUrl]);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime = state.clock.getElapsedTime() + layerOffset;
      materialRef.current.uFilterType = filterIdToType[filterId] || 0;
      materialRef.current.uIntensity = intensity;
      
      if (getAudioData) {
        const audioData = getAudioData();
        materialRef.current.uEnergy = audioData.energy;
        materialRef.current.uBass = audioData.bass;
        materialRef.current.uMid = audioData.mid;
        materialRef.current.uHigh = audioData.high;
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
      glowIntensity={settings.glowIntensity ?? 1.0}
      bloomOn={settings.glowEnabled ?? true}
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
          // Option 5: Ensure proper sRGB output for linear workflow
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMappingExposure = 1.0;
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
