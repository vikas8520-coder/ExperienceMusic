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

// === PRESET 3: Particle Field (PREMIUM) ===
function ParticleField({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 5000; // Premium: More particles for denser field
  const smoothedAudioRef = useRef({ sub: 0, bass: 0, mid: 0, high: 0, kick: 0, energy: 0 });
  const tempColor = useMemo(() => new THREE.Color(), []);
  const tempColor2 = useMemo(() => new THREE.Color(), []);
  
  const [positions, colors, basePositions] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const basePos = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      // Premium: Spherical distribution for more organic look
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const radius = 15 + Math.random() * 25;
      
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
    }
    return [pos, col, basePos];
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const audioRaw = getAudioData();
    const time = state.clock.getElapsedTime();
    
    // Premium: Smooth audio interpolation
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smooth = smoothedAudioRef.current;
    smooth.sub = lerp(smooth.sub, audioRaw.sub, 0.06);
    smooth.bass = lerp(smooth.bass, audioRaw.bass, 0.1);
    smooth.mid = lerp(smooth.mid, audioRaw.mid, 0.12);
    smooth.high = lerp(smooth.high, audioRaw.high, 0.18);
    smooth.kick = lerp(smooth.kick, audioRaw.kick, 0.2);
    smooth.energy = lerp(smooth.energy, audioRaw.energy, 0.08);

    const positionsAttr = pointsRef.current.geometry.attributes.position;
    const colorsAttr = pointsRef.current.geometry.attributes.color;
    
    // Premium: Dynamic global size based on audio
    const material = pointsRef.current.material as THREE.PointsMaterial;
    if (material) {
      material.size = 0.12 + smooth.energy * 0.15 * settings.intensity + smooth.bass * 0.08;
    }

    // Premium: Complex audio-driven motion
    const breathScale = 1 + smooth.sub * 0.2;
    const pulseScale = 1 + smooth.bass * 0.3 * settings.intensity;
    const turbulenceAmp = (smooth.mid * 0.4 + smooth.high * 0.3) * settings.intensity;

    for (let i = 0; i < count; i++) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];
      const bz = basePositions[i * 3 + 2];
      
      // Premium: Layered noise motion
      const noiseX = Math.sin(time * 0.5 + bz * 0.1) * turbulenceAmp * 2;
      const noiseY = Math.cos(time * 0.4 + bx * 0.1) * turbulenceAmp * 2;
      const noiseZ = Math.sin(time * 0.3 + by * 0.1) * turbulenceAmp;
      
      // Spiral motion on kick
      const spiralAngle = smooth.kick * 0.3 * (i / count);
      const sx = bx * Math.cos(spiralAngle) - by * Math.sin(spiralAngle);
      const sy = bx * Math.sin(spiralAngle) + by * Math.cos(spiralAngle);
      
      positionsAttr.setXYZ(i, 
        sx * breathScale * pulseScale + noiseX,
        sy * breathScale * pulseScale + noiseY,
        bz * breathScale + noiseZ
      );

      // Premium: Dynamic color with smooth transitions (reusing Color objects)
      const colorPhase = (i / count + time * 0.1 * settings.speed) % 1;
      const colorIdx = Math.floor(colorPhase * settings.colorPalette.length);
      const nextColorIdx = (colorIdx + 1) % settings.colorPalette.length;
      const colorBlend = (colorPhase * settings.colorPalette.length) % 1;
      
      tempColor.set(settings.colorPalette[colorIdx]);
      tempColor2.set(settings.colorPalette[nextColorIdx]);
      tempColor.lerp(tempColor2, colorBlend);
      
      // High frequencies add sparkle
      const sparkle = smooth.high * 0.4 + smooth.kick * 0.5;
      if (Math.random() < sparkle * 0.05) {
        tempColor.offsetHSL(0, -0.5, 0.4);
      }
      
      colorsAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
    }
    
    positionsAttr.needsUpdate = true;
    colorsAttr.needsUpdate = true;
    
    // Premium: Smooth multi-axis rotation
    pointsRef.current.rotation.y += 0.002 * settings.speed * (1 + smooth.mid * 0.5);
    pointsRef.current.rotation.x = smooth.sub * 0.15 * Math.sin(time * 0.2);
    pointsRef.current.rotation.z = smooth.high * 0.05 * Math.cos(time * 0.3);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
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
  const meshRef = useRef<THREE.Mesh>(null);
  const originalPositions = useRef<Float32Array | null>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const { sub, bass, mid, high, modeIndex, energy } = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    const geometry = meshRef.current.geometry as THREE.BufferGeometry;
    const positionAttr = geometry.attributes.position;
    
    if (!originalPositions.current) {
      originalPositions.current = new Float32Array(positionAttr.array);
    }
    
    // Mode controls the number of lobes
    const lobes = modeIndex + 2;
    const breathScale = 1 + sub * 0.15;
    
    for (let i = 0; i < positionAttr.count; i++) {
      const ox = originalPositions.current[i * 3];
      const oy = originalPositions.current[i * 3 + 1];
      const oz = originalPositions.current[i * 3 + 2];
      
      // Spherical coordinates
      const r = Math.sqrt(ox * ox + oy * oy + oz * oz);
      const theta = Math.atan2(oy, ox);
      const phi = Math.acos(oz / (r || 1));
      
      // Standing wave on sphere surface (spherical harmonics simplified)
      const wave1 = Math.sin(lobes * theta + time) * Math.sin(phi * 3);
      const wave2 = Math.cos((lobes + 1) * theta - time * 0.7) * Math.sin(phi * 2);
      const displacement = (wave1 * mid + wave2 * bass) * settings.intensity * 0.3;
      
      // Caustic shimmer from highs
      const shimmer = high * 0.05 * Math.sin(time * 8 + i * 0.1);
      
      const newR = (r + displacement + shimmer) * breathScale;
      const nx = ox / r || 0;
      const ny = oy / r || 0;
      const nz = oz / r || 0;
      
      positionAttr.setXYZ(i, nx * newR, ny * newR, nz * newR);
    }
    
    positionAttr.needsUpdate = true;
    
    // Slow rotation
    meshRef.current.rotation.y = time * 0.2;
    meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;
  });

  const colors = settings.colorPalette;
  
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[3, 5]} />
      <meshStandardMaterial
        color={colors[0] || "#00ccff"}
        emissive={colors[1] || "#0066aa"}
        emissiveIntensity={0.4}
        transparent
        opacity={0.7}
        metalness={0.3}
        roughness={0.2}
      />
    </mesh>
  );
}

// === PRESET 10: Chladni Geometry ===
// Clean sacred-geometry style node lines on a plate
function ChladniGeometry({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const chladniShader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uM: { value: 3 },
      uN: { value: 2 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
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
      uniform float uMid;
      uniform float uHigh;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform float uIntensity;
      varying vec2 vUv;
      
      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        
        // Chladni pattern: sin(m*x)*sin(n*y) - sin(n*x)*sin(m*y) = 0 at nodes
        float m = uM;
        float n = uN;
        float pattern1 = sin(m * uv.x * 3.14159) * sin(n * uv.y * 3.14159);
        float pattern2 = sin(n * uv.x * 3.14159) * sin(m * uv.y * 3.14159);
        float chladni = pattern1 - pattern2;
        
        // Node lines (where chladni ≈ 0)
        float thickness = 0.1 + uBass * 0.1;
        float node = 1.0 - smoothstep(0.0, thickness * uIntensity, abs(chladni));
        
        // Edge shimmer from highs
        float shimmer = uHigh * 0.3 * sin(uTime * 5.0 + length(uv) * 10.0);
        node = clamp(node + shimmer, 0.0, 1.0);
        
        // Color blend
        vec3 color = mix(uColor2, uColor1, node);
        
        // Fade edges
        float dist = length(uv);
        float fade = 1.0 - smoothstep(0.8, 1.0, dist);
        
        gl_FragColor = vec4(color, node * fade * 0.9);
      }
    `
  }), []);

  useFrame((state) => {
    if (!materialRef.current) return;
    const { bass, mid, high, modeIndex } = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    
    // Mode patterns for (m, n)
    const patterns = [[2, 3], [3, 4], [4, 5], [3, 5], [4, 6], [5, 6], [5, 7], [6, 7]];
    const [m, n] = patterns[Math.max(0, Math.min(7, modeIndex - 1))];
    
    materialRef.current.uniforms.uTime.value = time;
    materialRef.current.uniforms.uM.value = m;
    materialRef.current.uniforms.uN.value = n;
    materialRef.current.uniforms.uBass.value = bass;
    materialRef.current.uniforms.uMid.value = mid;
    materialRef.current.uniforms.uHigh.value = high;
    materialRef.current.uniforms.uIntensity.value = settings.intensity;
    
    const colors = settings.colorPalette;
    materialRef.current.uniforms.uColor1.value.set(colors[0] || "#ffffff");
    materialRef.current.uniforms.uColor2.value.set(colors[1] || "#6600ff");
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <planeGeometry args={[12, 12, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        {...chladniShader}
        transparent
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
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
