import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AudioData } from "@/hooks/use-audio-analyzer";
import type { EvolutionSignals } from "@/engine/evolution/types";

type DropFXProps = {
  enabled: boolean;
  aiStrength: number;
  colorPalette?: string[];
  getSignals: () => EvolutionSignals;
  getAudio: () => AudioData;
};

const PARTICLE_COUNT = 1200;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function DropFX({ enabled, aiStrength, colorPalette = [], getSignals, getAudio }: DropFXProps) {
  const auraRef = useRef<THREE.Mesh>(null);
  const trailRefs = useRef<Array<THREE.Mesh | null>>([]);

  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const seeds = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = i * 3;
      positions[p + 0] = (Math.random() - 0.5) * 0.36;
      positions[p + 1] = (Math.random() - 0.5) * 0.36;
      positions[p + 2] = (Math.random() - 0.5) * 0.36;

      velocities[p + 0] = (Math.random() - 0.5) * 0.95;
      velocities[p + 1] = (Math.random() - 0.5) * 0.95;
      velocities[p + 2] = (Math.random() - 0.5) * 0.95;
      seeds[i] = Math.random();
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aVelocity", new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return geometry;
  }, []);

  const particleMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.023,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        color: new THREE.Color("#ffffff"),
        sizeAttenuation: true,
      }),
    [],
  );

  const auraMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        color: new THREE.Color("#8fdcff"),
      }),
    [],
  );

  const trailMaterials = useMemo(
    () =>
      Array.from({ length: 3 }, () =>
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          color: new THREE.Color("#8fdcff"),
          wireframe: true,
        }),
      ),
    [],
  );

  useFrame((_, dt) => {
    const strength = clamp01(aiStrength);

    if (!enabled || strength <= 0.001) {
      particleMaterial.opacity = THREE.MathUtils.lerp(particleMaterial.opacity, 0, 0.12);
      auraMaterial.opacity = THREE.MathUtils.lerp(auraMaterial.opacity, 0, 0.12);
      trailMaterials.forEach((mat) => {
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0, 0.12);
      });
      return;
    }

    const signals = getSignals();
    const audio = getAudio();

    const dropIntensity = clamp01(signals.dropIntensity);
    const active = signals.isDrop && dropIntensity > 0.34;
    const bass = clamp01(audio.bass);
    const mid = clamp01(audio.mid);
    const high = clamp01(audio.high);
    const energy = clamp01(audio.energy);
    const kick = clamp01(audio.kick ?? 0);

    const drive = clamp01(dropIntensity * 0.62 + bass * 0.22 + kick * 0.16);
    const burst = active ? (0.72 * kick + 0.34 * bass) * strength : 0;

    const c0 = new THREE.Color(colorPalette[0] || "#d946ef");
    const c1 = new THREE.Color(colorPalette[1] || "#06b6d4");
    const c2 = new THREE.Color(colorPalette[2] || colorPalette[1] || "#60a5fa");
    const c3 = new THREE.Color(colorPalette[3] || colorPalette[2] || "#f0abfc");

    particleMaterial.color.copy(c0.clone().lerp(c2, 0.34 + high * 0.3));
    auraMaterial.color.copy(c1.clone().lerp(c3, 0.36 + drive * 0.42));

    const particleTargetOpacity = active ? (0.1 + 0.55 * drive) * strength : 0;
    particleMaterial.opacity = THREE.MathUtils.lerp(particleMaterial.opacity, particleTargetOpacity, 0.1);
    particleMaterial.size = THREE.MathUtils.lerp(
      particleMaterial.size,
      0.018 + 0.036 * drive * strength + 0.01 * high,
      0.12,
    );

    const positionAttr = particleGeometry.getAttribute("position") as THREE.BufferAttribute;
    const velocityAttr = particleGeometry.getAttribute("aVelocity") as THREE.BufferAttribute;
    const seedAttr = particleGeometry.getAttribute("aSeed") as THREE.BufferAttribute;

    const positions = positionAttr.array as Float32Array;
    const velocities = velocityAttr.array as Float32Array;
    const seeds = seedAttr.array as Float32Array;

    const swirl = active ? (0.65 + 1.25 * drive) * strength : 0;
    const jitter = active ? high * 0.0032 * strength : 0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = i * 3;
      let x = positions[p + 0];
      let y = positions[p + 1];
      let z = positions[p + 2];

      const vx = velocities[p + 0];
      const vy = velocities[p + 1];
      const vz = velocities[p + 2];
      const seed = seeds[i];

      const ang = swirl * dt * (0.8 + seed * 1.6);
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      const rx = x * cs - y * sn;
      const ry = x * sn + y * cs;

      x = rx + vx * dt * (0.2 + 0.62 * drive) + vx * dt * burst;
      y = ry + vy * dt * (0.2 + 0.62 * drive) + vy * dt * burst;
      z = z + vz * dt * (0.14 + 0.4 * drive);

      if (jitter > 0) {
        x += (Math.random() - 0.5) * jitter;
        y += (Math.random() - 0.5) * jitter;
      }

      const radius = Math.sqrt(x * x + y * y + z * z);
      if (radius > 2.35) {
        x = (Math.random() - 0.5) * 0.3;
        y = (Math.random() - 0.5) * 0.3;
        z = (Math.random() - 0.5) * 0.3;
      }

      positions[p + 0] = x;
      positions[p + 1] = y;
      positions[p + 2] = z;
    }

    positionAttr.needsUpdate = true;

    const aura = auraRef.current;
    if (aura) {
      const auraTargetOpacity = active ? (0.08 + 0.2 * drive + 0.08 * energy) * strength : 0;
      auraMaterial.opacity = THREE.MathUtils.lerp(auraMaterial.opacity, auraTargetOpacity, 0.1);

      const pulse = 1 + drive * 0.35 + Math.sin(signals.dropAge * (4 + high * 3)) * (0.05 + 0.08 * drive);
      const nextScale = THREE.MathUtils.lerp(aura.scale.x, pulse, 0.12);
      aura.scale.set(nextScale, nextScale, nextScale);
      aura.rotation.z += dt * (0.24 + 0.5 * mid + 0.3 * drive);
    }

    trailMaterials.forEach((material, idx) => {
      const trail = trailRefs.current[idx];
      if (!trail) return;

      const idxFade = 1 - idx * 0.18;
      const targetOpacity = active ? (0.05 + 0.2 * drive) * idxFade * strength : 0;
      material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.09);
      material.color.copy(c0.clone().lerp(c3, 0.28 + idx * 0.22 + high * 0.16));

      trail.rotation.z += dt * (0.22 + 0.75 * drive + idx * 0.2);
      trail.rotation.x = Math.sin(signals.dropAge * (1.6 + idx * 0.36) + idx * 1.7) * (0.1 + 0.26 * drive);
      trail.rotation.y = Math.cos(signals.dropAge * (1.3 + idx * 0.3) + idx * 1.1) * (0.08 + 0.2 * drive);

      const baseScale = 1 + drive * (0.16 + idx * 0.07) + Math.sin(signals.dropAge * (3 + idx)) * 0.035;
      const currentScale = trail.scale.x;
      const nextScale = THREE.MathUtils.lerp(currentScale, baseScale, 0.12);
      trail.scale.set(nextScale, nextScale, nextScale);
    });
  });

  return (
    <group renderOrder={980} frustumCulled={false}>
      <points geometry={particleGeometry} material={particleMaterial} frustumCulled={false} />

      <mesh ref={auraRef} frustumCulled={false} material={auraMaterial}>
        <ringGeometry args={[0.48, 0.95, 128]} />
      </mesh>

      {trailMaterials.map((material, idx) => (
        <mesh
          key={`drop-trail-${idx}`}
          ref={(node) => {
            trailRefs.current[idx] = node;
          }}
          material={material}
          frustumCulled={false}
        >
          <torusGeometry args={[1.18 + idx * 0.2, 0.018 + idx * 0.004, 20, 180]} />
        </mesh>
      ))}
    </group>
  );
}
