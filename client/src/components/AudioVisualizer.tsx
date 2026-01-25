import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Environment } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, Bloom, ChromaticAberration, Noise } from "@react-three/postprocessing";
import { type AudioData } from "@/hooks/use-audio-analyzer";
import { presets } from "@/lib/visualizer-presets";

interface AudioVisualizerProps {
  getAudioData: () => AudioData;
  settings: {
    intensity: number;
    speed: number;
    colorPalette: string[];
    presetName: string;
  };
}

// === PRESET 1: Energy Rings ===
function EnergyRings({ getAudioData, settings }: { getAudioData: () => AudioData, settings: any }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Mesh[]>([]);

  // Create static geometry references
  const geometry = useMemo(() => new THREE.TorusGeometry(1, 0.02, 16, 100), []);
  const count = 15;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const { bass, mid, high, energy } = getAudioData();
    const time = state.clock.getElapsedTime();

    // Rotate entire group
    groupRef.current.rotation.z += delta * 0.1 * settings.speed;
    groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.2 * (mid * settings.intensity);

    ringsRef.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = time * settings.speed;
      const offset = i * 0.5;
      
      // Scale based on bass
      const scale = 1 + (bass * settings.intensity * 2) * (Math.sin(t + offset) * 0.5 + 0.5);
      mesh.scale.setScalar(scale * (i * 0.2 + 0.5));

      // Color pulsing
      const colorIndex = i % settings.colorPalette.length;
      const color = new THREE.Color(settings.colorPalette[colorIndex]);
      const boost = high * settings.intensity * 5;
      mesh.material.emissive.setRGB(
        color.r * (0.2 + boost),
        color.g * (0.2 + boost),
        color.b * (0.2 + boost)
      );
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh 
          key={i} 
          ref={(el) => (ringsRef.current[i] = el!)} 
          geometry={geometry}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial 
            color="#000000" 
            roughness={0.1} 
            metalness={0.8}
            emissiveIntensity={1}
          />
        </mesh>
      ))}
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
      // Wiggle effect
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      
      const noise = Math.sin(x * 0.1 + time * settings.speed) * Math.cos(y * 0.1 + time);
      const amp = energy * settings.intensity * 2;
      
      positionsAttr.setXYZ(i, 
        x + Math.sin(time + z) * 0.02 * amp,
        y + Math.cos(time + x) * 0.02 * amp,
        z
      );

      // Color shift
      const color = new THREE.Color(settings.colorPalette[i % settings.colorPalette.length]);
      color.offsetHSL(0, 0, (bass - 0.5) * 0.5); // Shift lightness with bass
      
      // Sparkle on highs
      if (Math.random() < high * 0.1) {
        color.setScalar(1); // flash white
      }
      
      colorsAttr.setXYZ(i, color.r, color.g, color.b);
    }
    
    positionsAttr.needsUpdate = true;
    colorsAttr.needsUpdate = true;
    
    // Rotate whole field
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

export function AudioVisualizer({ getAudioData, settings }: AudioVisualizerProps) {
  return (
    <Canvas
      gl={{ antialias: true, toneMapping: THREE.ReinhardToneMapping }}
      camera={{ position: [0, 0, 15], fov: 45 }}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#050508']} />
      <OrbitControls makeDefault />
      
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      {/* Visualizer Presets */}
      {settings.presetName === "Energy Rings" && <EnergyRings getAudioData={getAudioData} settings={settings} />}
      {settings.presetName === "Psy Tunnel" && <PsyTunnel getAudioData={getAudioData} settings={settings} />}
      {settings.presetName === "Particle Field" && <ParticleField getAudioData={getAudioData} settings={settings} />}

      {/* Post Processing */}
      <EffectComposer disableNormalPass>
        <Bloom 
          luminanceThreshold={0.5} 
          luminanceSmoothing={0.9} 
          intensity={1.5 * settings.intensity} 
          radius={0.8}
        />
        <ChromaticAberration 
          offset={new THREE.Vector2(0.002 * settings.intensity, 0.002 * settings.intensity)} 
        />
        <Noise opacity={0.05} />
      </EffectComposer>
    </Canvas>
  );
}
