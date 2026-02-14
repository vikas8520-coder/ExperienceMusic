import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type AudioData } from "@/hooks/use-audio-analyzer";

const vert = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uRms;
uniform float uMorph;
uniform float uBeatPulse;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;
varying float vFieldMask;

#define TAU 6.28318530718

void main() {
  vUv = uv;

  // Base sphere
  vec3 n = normalize(position);
  float ripple = sin((uv.x * 32.0 + uv.y * 24.0) + uTime * 2.0) * 0.04 * (0.35 + uHigh);
  vec3 pSphere = n * (1.15 + ripple);

  // Ellipsoid stretch follows low/mid energy
  vec3 eScale = vec3(1.0 + uMid * 0.55, 1.0 + uBass * 0.95, 1.0 + uHigh * 0.35);
  vec3 pEllipsoid = pSphere * eScale;

  // Procedural torus target
  float theta = uv.x * TAU;
  float phi = uv.y * TAU;
  float R = 1.15 + uBass * 0.55;
  float r = 0.28 + uMid * 0.28 + uBeatPulse * 0.06;
  vec3 pTorus = vec3(
    (R + r * cos(phi)) * cos(theta),
    r * sin(phi),
    (R + r * cos(phi)) * sin(theta)
  );

  // Two-stage morph: sphere -> ellipsoid -> torus
  float m1 = smoothstep(0.02, 0.55, uMorph);
  float m2 = smoothstep(0.45, 0.95, uMorph);
  vec3 p = mix(pSphere, pEllipsoid, m1);
  p = mix(p, pTorus, m2);

  // Gentle breathing prevents static frames in low energy sections
  float breathe = 1.0 + sin(uTime * 1.3) * 0.015 * (0.3 + uRms);
  p *= breathe;

  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorldPos = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normalize(p));
  vFieldMask = 0.35 + 0.65 * (1.0 - m2);

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const frag = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uRms;
uniform float uBeatPulse;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;
varying float vFieldMask;

void main() {
  vec3 V = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - max(dot(normalize(vNormalW), V), 0.0), 2.3);

  // Animated field lines
  float polar = atan(vWorldPos.z, vWorldPos.x);
  float lineA = sin(polar * 16.0 + uTime * (1.0 + uMid * 1.8));
  float lineB = sin(vUv.y * 140.0 - uTime * (1.4 + uHigh * 2.0));
  float lines = smoothstep(0.68, 1.0, abs(lineA * 0.55 + lineB * 0.45));

  vec3 deep = vec3(0.03, 0.12, 0.20);
  vec3 cyan = vec3(0.10, 0.75, 0.95);
  vec3 warm = vec3(0.85, 0.70, 0.35);

  vec3 base = mix(deep, cyan, 0.35 + 0.65 * uRms);
  vec3 field = mix(base, warm, clamp(uBass * 0.7 + uBeatPulse * 0.5, 0.0, 1.0));

  vec3 color = field;
  color += lines * (0.22 + uHigh * 0.5) * vec3(0.75, 0.95, 1.0);
  color += fres * (0.35 + uMid * 0.4) * vec3(0.4, 0.8, 1.0);

  float alpha = 0.78 + 0.18 * fres + 0.08 * lines;
  gl_FragColor = vec4(color, alpha * vFieldMask);
}
`;

const coreVert = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vW = world.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const coreFrag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uRms;
uniform float uBeatPulse;
varying vec3 vN;
varying vec3 vW;

void main() {
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(normalize(vN), V), 0.0), 3.0);
  float pulse = 0.65 + 0.35 * sin(uTime * 2.3 + uBeatPulse * 4.0);
  vec3 col = mix(vec3(0.05, 0.35, 0.65), vec3(0.65, 0.95, 1.0), uRms);
  col += fres * 0.9;
  gl_FragColor = vec4(col * pulse, 0.75 + fres * 0.2);
}
`;

const expLerp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export function PremiumField({
  getAudioData,
  settings,
}: {
  getAudioData: () => AudioData;
  settings: {
    intensity: number;
    speed: number;
  };
}) {
  const fieldMat = useRef<THREE.ShaderMaterial>(null);
  const coreMat = useRef<THREE.ShaderMaterial>(null);
  const coreMesh = useRef<THREE.Mesh>(null);
  const particleGeom = useRef<THREE.BufferGeometry>(null);

  // Smooth state avoids hard jumps and black-like transition pops
  const smooth = useRef({ bass: 0, mid: 0, high: 0, rms: 0, beatPulse: 0 });
  const beatLatch = useRef(false);

  const particleCount = 420;
  const particleData = useMemo(() => {
    const seeds = new Float32Array(particleCount * 4); // angle, radius, speed, phase
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      seeds[i * 4 + 0] = Math.random() * Math.PI * 2;
      seeds[i * 4 + 1] = 1.4 + Math.random() * 1.2;
      seeds[i * 4 + 2] = 0.2 + Math.random() * 0.8;
      seeds[i * 4 + 3] = Math.random() * Math.PI * 2;
    }
    return { seeds, pos };
  }, []);

  const fieldUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uRms: { value: 0 },
      uMorph: { value: 0 },
      uBeatPulse: { value: 0 },
    }),
    []
  );

  const coreUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRms: { value: 0 },
      uBeatPulse: { value: 0 },
    }),
    []
  );

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const audio = getAudioData();
    const bass = THREE.MathUtils.clamp(audio.bass, 0, 1);
    const mid = THREE.MathUtils.clamp(audio.mid, 0, 1);
    const high = THREE.MathUtils.clamp(audio.high, 0, 1);
    const rms = THREE.MathUtils.clamp(audio.energy, 0, 1);
    const beatDetected = audio.kick > 0.55;

    // Audio -> visual smoothing (attack/release)
    smooth.current.bass = expLerp(smooth.current.bass, bass, bass > smooth.current.bass ? 18 : 8, dt);
    smooth.current.mid = expLerp(smooth.current.mid, mid, mid > smooth.current.mid ? 16 : 7, dt);
    smooth.current.high = expLerp(smooth.current.high, high, high > smooth.current.high ? 20 : 9, dt);
    smooth.current.rms = expLerp(smooth.current.rms, rms, rms > smooth.current.rms ? 14 : 6, dt);

    if (beatDetected && !beatLatch.current) smooth.current.beatPulse = 1.0;
    beatLatch.current = beatDetected;
    smooth.current.beatPulse = Math.max(0, smooth.current.beatPulse * Math.exp(-dt * 6.5));

    // Morph driver: sphere -> ellipsoid -> torus
    const morphTarget = THREE.MathUtils.clamp(
      smooth.current.rms * 0.85 + smooth.current.bass * 0.35 + smooth.current.beatPulse * 0.25,
      0,
      1
    );

    if (fieldMat.current) {
      fieldMat.current.uniforms.uTime.value = t;
      fieldMat.current.uniforms.uBass.value = smooth.current.bass;
      fieldMat.current.uniforms.uMid.value = smooth.current.mid;
      fieldMat.current.uniforms.uHigh.value = smooth.current.high;
      fieldMat.current.uniforms.uRms.value = smooth.current.rms;
      fieldMat.current.uniforms.uMorph.value = morphTarget;
      fieldMat.current.uniforms.uBeatPulse.value = smooth.current.beatPulse;
    }

    if (coreMat.current) {
      coreMat.current.uniforms.uTime.value = t;
      coreMat.current.uniforms.uRms.value = smooth.current.rms;
      coreMat.current.uniforms.uBeatPulse.value = smooth.current.beatPulse;
    }

    if (coreMesh.current) {
      const s = 0.36 + smooth.current.rms * 0.08 + smooth.current.beatPulse * 0.06;
      coreMesh.current.scale.setScalar(s);
    }

    // Orbiting particles speed up on beat + mids
    const pos = particleData.pos;
    const seeds = particleData.seeds;
    const accel = (0.6 + smooth.current.mid * 1.1 + smooth.current.beatPulse * 2.2) * (0.7 + settings.speed * 0.6);

    for (let i = 0; i < particleCount; i++) {
      const a0 = seeds[i * 4 + 0];
      const r0 = seeds[i * 4 + 1];
      const sp = seeds[i * 4 + 2];
      const ph = seeds[i * 4 + 3];

      const a = a0 + t * sp * accel;
      const r = r0 + Math.sin(t * 0.9 + ph) * (0.06 + smooth.current.rms * 0.08);
      const y = Math.sin(a * 2.0 + ph + t * 0.7) * (0.2 + smooth.current.high * 0.4);

      pos[i * 3 + 0] = Math.cos(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }

    if (particleGeom.current) {
      particleGeom.current.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1.2, 160, 160]} />
        <shaderMaterial
          ref={fieldMat}
          uniforms={fieldUniforms}
          vertexShader={vert}
          fragmentShader={frag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={coreMesh}>
        <sphereGeometry args={[0.36, 64, 64]} />
        <shaderMaterial
          ref={coreMat}
          uniforms={coreUniforms}
          vertexShader={coreVert}
          fragmentShader={coreFrag}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <points>
        <bufferGeometry ref={particleGeom}>
          <bufferAttribute
            attach="attributes-position"
            array={particleData.pos}
            count={particleCount}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#9be7ff"
          size={0.03 * (0.8 + settings.intensity * 0.4)}
          sizeAttenuation
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
