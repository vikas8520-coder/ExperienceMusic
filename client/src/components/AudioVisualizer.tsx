import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, extend } from "@react-three/fiber";
import { OrbitControls, Sphere, shaderMaterial } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, Bloom, ChromaticAberration, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { type AudioData } from "@/hooks/use-audio-analyzer";
import { type ImageFilterId } from "@/lib/visualizer-presets";

interface AudioVisualizerProps {
  getAudioData: () => AudioData;
  settings: {
    intensity: number;
    speed: number;
    colorPalette: string[];
    presetName: string;
    imageFilters?: ImageFilterId[];
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

// === PRESET 1: Energy Rings ===
function EnergyRings({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Mesh[]>([]);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const geometry = useMemo(() => new THREE.TorusGeometry(1, 0.02, 16, 100), []);
  const count = 15;

  const materials = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const colorIndex = i % settings.colorPalette.length;
      const mat = new THREE.MeshStandardMaterial({
        color: "#000000",
        roughness: 0.1,
        metalness: 0.8,
        emissive: new THREE.Color(settings.colorPalette[colorIndex]),
        emissiveIntensity: 1
      });
      return mat;
    });
  }, [settings.colorPalette]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const { bass, mid, high } = getAudioData();
    const time = state.clock.getElapsedTime();

    groupRef.current.rotation.z += delta * 0.1 * settings.speed;
    groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.2 * (mid * settings.intensity);

    ringsRef.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = time * settings.speed;
      const offset = i * 0.5;
      
      const scale = 1 + (bass * settings.intensity * 2) * (Math.sin(t + offset) * 0.5 + 0.5);
      mesh.scale.setScalar(scale * (i * 0.2 + 0.5));

      const mat = materialsRef.current[i];
      if (mat) {
        const colorIndex = i % settings.colorPalette.length;
        const color = new THREE.Color(settings.colorPalette[colorIndex]);
        const boost = high * settings.intensity * 5;
        mat.emissive.setRGB(
          color.r * (0.2 + boost),
          color.g * (0.2 + boost),
          color.b * (0.2 + boost)
        );
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

// === PRESET 2: Psy Tunnel ===
function PsyTunnel({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 200;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const { bass, mid, energy } = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;

    for (let i = 0; i < count; i++) {
      const z = (i * 1.5 + time * 20 * (0.5 + energy * settings.intensity)) % (count * 1.5) - 50;
      const radius = 5 + Math.sin(z * 0.1 + time) * 2 * (bass * settings.intensity);
      const angle = (i / count) * Math.PI * 12 + time * 0.2;
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      dummy.position.set(x, y, -z);
      dummy.rotation.set(0, 0, angle + time + mid * Math.PI);
      dummy.scale.setScalar(1 + mid * settings.intensity);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      const color = new THREE.Color(settings.colorPalette[i % settings.colorPalette.length]);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.5, 0.5, 4]} />
      <meshStandardMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// === PRESET 3: Particle Field ===
function ParticleField({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 2000;
  
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
      col[i * 3] = 1;
      col[i * 3 + 1] = 1;
      col[i * 3 + 2] = 1;
    }
    return [pos, col];
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const { bass, high, energy } = getAudioData();
    const time = state.clock.getElapsedTime();

    const positionsAttr = pointsRef.current.geometry.attributes.position;
    const colorsAttr = pointsRef.current.geometry.attributes.color;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      
      const amp = energy * settings.intensity * 2;
      
      positionsAttr.setXYZ(i, 
        x + Math.sin(time + z) * 0.02 * amp,
        y + Math.cos(time + x) * 0.02 * amp,
        z
      );

      const color = new THREE.Color(settings.colorPalette[i % settings.colorPalette.length]);
      color.offsetHSL(0, 0, (bass - 0.5) * 0.5);
      
      if (Math.random() < high * 0.1) {
        color.setScalar(1);
      }
      
      colorsAttr.setXYZ(i, color.r, color.g, color.b);
    }
    
    positionsAttr.needsUpdate = true;
    colorsAttr.needsUpdate = true;
    
    pointsRef.current.rotation.y = time * 0.05 * settings.speed;
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
        size={0.2}
        vertexColors
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// === PRESET 4: Waveform Sphere ===
function WaveformSphere({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const originalPositions = useRef<Float32Array | null>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const { bass, mid, high, frequencyData } = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;
    const geometry = meshRef.current.geometry as THREE.BufferGeometry;
    const positionAttr = geometry.attributes.position;

    if (!originalPositions.current) {
      originalPositions.current = new Float32Array(positionAttr.array);
    }

    for (let i = 0; i < positionAttr.count; i++) {
      const ox = originalPositions.current[i * 3];
      const oy = originalPositions.current[i * 3 + 1];
      const oz = originalPositions.current[i * 3 + 2];
      
      const freqIndex = Math.floor((i / positionAttr.count) * (frequencyData?.length || 128));
      const freqValue = (frequencyData?.[freqIndex] || 0) / 255;
      
      const displacement = freqValue * settings.intensity * 0.5;
      const wave = Math.sin(time * 2 + i * 0.1) * 0.1 * mid * settings.intensity;
      
      const length = Math.sqrt(ox * ox + oy * oy + oz * oz);
      const nx = ox / length;
      const ny = oy / length;
      const nz = oz / length;
      
      positionAttr.setXYZ(
        i,
        ox + nx * (displacement + wave),
        oy + ny * (displacement + wave),
        oz + nz * (displacement + wave)
      );
    }
    
    positionAttr.needsUpdate = true;
    
    meshRef.current.rotation.y = time * 0.3;
    meshRef.current.rotation.x = Math.sin(time * 0.5) * 0.2;
  });

  const colors = settings.colorPalette;
  
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[3, 4]} />
      <meshStandardMaterial
        color={colors[0]}
        emissive={colors[1]}
        emissiveIntensity={0.5}
        wireframe
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// === PRESET 5: Audio Bars ===
function AudioBars({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const barCount = 64;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const { frequencyData, energy } = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;

    for (let i = 0; i < barCount; i++) {
      const freqIndex = Math.floor((i / barCount) * (frequencyData?.length || 128));
      const freqValue = (frequencyData?.[freqIndex] || 0) / 255;
      
      const angle = (i / barCount) * Math.PI * 2;
      const radius = 5;
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const height = 0.5 + freqValue * 8 * settings.intensity;
      
      dummy.position.set(x, height / 2, z);
      dummy.scale.set(0.3, height, 0.3);
      dummy.rotation.set(0, -angle, 0);
      dummy.updateMatrix();
      
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      const color = new THREE.Color(settings.colorPalette[i % settings.colorPalette.length]);
      const hsl = { h: 0, s: 0, l: 0 };
      color.getHSL(hsl);
      color.setHSL(hsl.h, hsl.s, 0.3 + freqValue * 0.7);
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

// === PRESET 6: Geometric Kaleidoscope ===
function GeometricKaleidoscope({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const geometries = useMemo(() => [
    new THREE.OctahedronGeometry(1),
    new THREE.TetrahedronGeometry(1),
    new THREE.IcosahedronGeometry(1),
    new THREE.DodecahedronGeometry(0.8),
  ], []);

  const count = 24;

  useFrame((state) => {
    if (!groupRef.current) return;
    const { bass, mid, high, energy } = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;

    groupRef.current.rotation.y = time * 0.1;
    groupRef.current.rotation.x = Math.sin(time * 0.3) * 0.3 * mid;

    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      
      const layer = Math.floor(i / 6);
      const angleInLayer = (i % 6) / 6 * Math.PI * 2;
      const layerRadius = 2 + layer * 2.5;
      
      const x = Math.cos(angleInLayer + time * (0.5 + layer * 0.2)) * layerRadius;
      const y = Math.sin(time * 2 + i) * (bass * settings.intensity * 2);
      const z = Math.sin(angleInLayer + time * (0.5 + layer * 0.2)) * layerRadius;
      
      mesh.position.set(x, y, z);
      
      const rotSpeed = (layer + 1) * 0.5;
      mesh.rotation.x = time * rotSpeed + i;
      mesh.rotation.y = time * rotSpeed * 0.7;
      mesh.rotation.z = Math.sin(time + i) * 0.5;
      
      const scale = 0.5 + energy * settings.intensity + Math.sin(time * 3 + i) * 0.2;
      mesh.scale.setScalar(scale);
      
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        const color = new THREE.Color(settings.colorPalette[i % settings.colorPalette.length]);
        mat.emissive.copy(color);
        mat.emissiveIntensity = 0.3 + high * settings.intensity * 2;
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
            roughness={0.2}
            metalness={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

// === PRESET 7: Cosmic Web ===
function CosmicWeb({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const nodeCount = 100;
  
  const [nodePositions, velocities] = useMemo(() => {
    const pos = new Float32Array(nodeCount * 3);
    const vel = new Float32Array(nodeCount * 3);
    for (let i = 0; i < nodeCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5 + Math.random() * 10;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      vel[i * 3] = (Math.random() - 0.5) * 0.02;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }
    return [pos, vel];
  }, []);

  const linePositions = useMemo(() => {
    return new Float32Array(nodeCount * nodeCount * 6);
  }, []);

  const lineColors = useMemo(() => {
    return new Float32Array(nodeCount * nodeCount * 6);
  }, []);

  useFrame((state) => {
    if (!pointsRef.current || !linesRef.current) return;
    const { bass, mid, high, energy } = getAudioData();
    const time = state.clock.getElapsedTime() * settings.speed;

    const posAttr = pointsRef.current.geometry.attributes.position;
    const connectionThreshold = 4 + energy * settings.intensity * 3;
    
    for (let i = 0; i < nodeCount; i++) {
      const x = nodePositions[i * 3] + Math.sin(time + i) * velocities[i * 3] * energy * 10;
      const y = nodePositions[i * 3 + 1] + Math.cos(time + i * 1.3) * velocities[i * 3 + 1] * energy * 10;
      const z = nodePositions[i * 3 + 2] + Math.sin(time * 0.7 + i) * velocities[i * 3 + 2] * energy * 10;
      
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;

    let lineIndex = 0;
    const lineGeom = linesRef.current.geometry as THREE.BufferGeometry;
    const linePosAttr = lineGeom.attributes.position;
    const lineColorAttr = lineGeom.attributes.color;

    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const x1 = posAttr.getX(i);
        const y1 = posAttr.getY(i);
        const z1 = posAttr.getZ(i);
        const x2 = posAttr.getX(j);
        const y2 = posAttr.getY(j);
        const z2 = posAttr.getZ(j);
        
        const dist = Math.sqrt((x2-x1)**2 + (y2-y1)**2 + (z2-z1)**2);
        
        if (dist < connectionThreshold && lineIndex < nodeCount * nodeCount * 2) {
          linePosAttr.setXYZ(lineIndex * 2, x1, y1, z1);
          linePosAttr.setXYZ(lineIndex * 2 + 1, x2, y2, z2);
          
          const color = new THREE.Color(settings.colorPalette[(i + j) % settings.colorPalette.length]);
          const alpha = 1 - dist / connectionThreshold;
          lineColorAttr.setXYZ(lineIndex * 2, color.r * alpha, color.g * alpha, color.b * alpha);
          lineColorAttr.setXYZ(lineIndex * 2 + 1, color.r * alpha, color.g * alpha, color.b * alpha);
          
          lineIndex++;
        }
      }
    }
    
    for (let i = lineIndex * 2; i < linePosAttr.count; i++) {
      linePosAttr.setXYZ(i, 0, 0, 0);
    }
    
    linePosAttr.needsUpdate = true;
    lineColorAttr.needsUpdate = true;
    
    pointsRef.current.rotation.y = time * 0.1;
    linesRef.current.rotation.y = time * 0.1;
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
    
    // Static mirror - no animation
    vec2 mirror(vec2 uv) {
      vec2 centered = uv - 0.5;
      vec2 mirrored = vec2(abs(centered.x), abs(centered.y));
      return mirrored + 0.5;
    }
    
    vec3 colorShift(vec3 color, float shift) {
      float angle = shift * PI * 2.0;
      mat3 rotation = mat3(
        0.299 + 0.701 * cos(angle), 0.587 - 0.587 * cos(angle), 0.114 - 0.114 * cos(angle),
        0.299 - 0.299 * cos(angle), 0.587 + 0.413 * cos(angle), 0.114 - 0.114 * cos(angle),
        0.299 - 0.299 * cos(angle), 0.587 - 0.587 * cos(angle), 0.114 + 0.886 * cos(angle)
      );
      return rotation * color;
    }
    
    vec2 pixelate(vec2 uv, float pixels) {
      float dx = 1.0 / pixels;
      float dy = 1.0 / pixels;
      return vec2(dx * floor(uv.x / dx), dy * floor(uv.y / dy));
    }
    
    void main() {
      vec2 uv = vUv;
      vec3 color;
      float opacity = 0.6;
      
      // All filters now show static image - no animation
      // Filter type 0: None - just show the image
      if (uFilterType == 0) {
        color = texture2D(uTexture, uv).rgb;
        opacity = 0.7;
      }
      // Filter type 1: Kaleidoscope (static)
      else if (uFilterType == 1) {
        float segments = 8.0;
        vec2 kUv = kaleidoscope(uv, segments);
        color = texture2D(uTexture, kUv).rgb;
        opacity = 0.65;
      }
      // Filter type 2: Mirror Fractal (static)
      else if (uFilterType == 2) {
        vec2 centered = uv - 0.5;
        vec2 mirrored = vec2(abs(centered.x), abs(centered.y)) + 0.5;
        color = texture2D(uTexture, mirrored).rgb;
        opacity = 0.6;
      }
      // Filter type 3: Color Shift (static warm tint)
      else if (uFilterType == 3) {
        color = texture2D(uTexture, uv).rgb;
        color = colorShift(color, 0.1);
        opacity = 0.6;
      }
      // Filter type 4: Invert (static)
      else if (uFilterType == 4) {
        color = texture2D(uTexture, uv).rgb;
        color = vec3(1.0) - color;
        opacity = 0.5;
      }
      // Filter type 5: Pixelate (static)
      else if (uFilterType == 5) {
        float pixels = 60.0;
        vec2 pUv = pixelate(uv, pixels);
        color = texture2D(uTexture, pUv).rgb;
        opacity = 0.6;
      }
      // Filter type 6: RGB Split (static)
      else if (uFilterType == 6) {
        float offset = 0.008;
        float r = texture2D(uTexture, uv + vec2(offset, 0.0)).r;
        float g = texture2D(uTexture, uv).g;
        float b = texture2D(uTexture, uv - vec2(offset, 0.0)).b;
        color = vec3(r, g, b);
        opacity = 0.6;
      }
      // Filter type 7: Soft Blur Effect (static)
      else if (uFilterType == 7) {
        color = texture2D(uTexture, uv).rgb;
        color = color * 1.1;
        opacity = 0.55;
      }
      // Filter type 8: Vignette (static)
      else if (uFilterType == 8) {
        color = texture2D(uTexture, uv).rgb;
        float dist = distance(uv, vec2(0.5));
        color *= 1.0 - dist * 0.5;
        opacity = 0.6;
      }
      else {
        color = texture2D(uTexture, uv).rgb;
        opacity = 0.6;
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

  // Set filter type once - background is static, no animation
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uTime = 0; // Static - no time animation
      materialRef.current.uFilterType = filterIdToType[filterId] || 0;
      materialRef.current.uIntensity = intensity;
      materialRef.current.uEnergy = 0; // No audio reactivity for background
    }
  });

  const opacity = layerOffset > 0 ? 0.4 : 1;

  return (
    <mesh position={[0, 0, -30 + layerOffset * 0.1]} scale={[100, 100, 1]}>
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

// Static background image rendered as HTML (completely fixed, no animation)
function StaticBackgroundImage({ imageUrl, filterId }: { imageUrl: string; filterId: string }) {
  const filterStyle = useMemo(() => {
    switch (filterId) {
      case 'kaleidoscope':
        return { filter: 'hue-rotate(30deg) saturate(1.5)' };
      case 'mirror':
        return { transform: 'scaleX(-1)' };
      case 'colorshift':
        return { filter: 'hue-rotate(60deg)' };
      case 'invert':
        return { filter: 'invert(1)' };
      case 'pixelate':
        return { filter: 'contrast(1.2) saturate(0.8)' };
      case 'rgbsplit':
        return { filter: 'saturate(1.3) contrast(1.1)' };
      case 'wave':
        return { filter: 'blur(1px) saturate(1.2)' };
      case 'zoompulse':
        return { transform: 'scale(1.05)' };
      default:
        return {};
    }
  }, [filterId]);

  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: 0.6,
        ...filterStyle,
      }}
    />
  );
}

function ThreeScene({ getAudioData, settings, backgroundImage, zoom = 1 }: AudioVisualizerProps) {
  const [hasError, setHasError] = useState(false);
  
  const activeFilters = settings.imageFilters || ["none"];
  const primaryFilter = activeFilters[0] || "none";

  if (hasError) {
    return <FallbackVisualizer settings={settings} backgroundImage={backgroundImage} />;
  }

  return (
    <>
      {/* Static background image - completely fixed, no animation */}
      {backgroundImage && (
        <StaticBackgroundImage imageUrl={backgroundImage} filterId={primaryFilter} />
      )}
      
      <Canvas
        gl={{ antialias: true, toneMapping: THREE.ReinhardToneMapping, alpha: true }}
        camera={{ position: [0, 0, 15], fov: 45 }}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1, background: 'transparent' }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          if (!gl.getContext()) {
            setHasError(true);
          }
        }}
      >
        <OrbitControls makeDefault enableZoom={false} enablePan={false} enableRotate={false} />
      
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ff00ff" />
      
      <ZoomableScene zoom={zoom}>
        {settings.presetName === "Energy Rings" && <EnergyRings getAudioData={getAudioData} settings={settings} />}
        {settings.presetName === "Psy Tunnel" && <PsyTunnel getAudioData={getAudioData} settings={settings} />}
        {settings.presetName === "Particle Field" && <ParticleField getAudioData={getAudioData} settings={settings} />}
        {settings.presetName === "Waveform Sphere" && <WaveformSphere getAudioData={getAudioData} settings={settings} />}
        {settings.presetName === "Audio Bars" && <AudioBars getAudioData={getAudioData} settings={settings} />}
        {settings.presetName === "Geometric Kaleidoscope" && <GeometricKaleidoscope getAudioData={getAudioData} settings={settings} />}
        {settings.presetName === "Cosmic Web" && <CosmicWeb getAudioData={getAudioData} settings={settings} />}
      </ZoomableScene>

      <EffectComposer>
        <Bloom 
          luminanceThreshold={0.5} 
          luminanceSmoothing={0.9} 
          intensity={1.5 * settings.intensity} 
        />
        <ChromaticAberration 
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.002 * settings.intensity, 0.002 * settings.intensity)}
          radialModulation={false}
          modulationOffset={0}
        />
        <Noise opacity={0.05} />
      </EffectComposer>
    </Canvas>
    </>
  );
}

export function AudioVisualizer({ getAudioData, settings, backgroundImage, zoom = 1 }: AudioVisualizerProps) {
  const [webglSupported] = useState(() => isWebGLAvailable());

  if (!webglSupported) {
    return <FallbackVisualizer settings={settings} backgroundImage={backgroundImage} />;
  }

  return <ThreeScene getAudioData={getAudioData} settings={settings} backgroundImage={backgroundImage} zoom={zoom} />;
}
