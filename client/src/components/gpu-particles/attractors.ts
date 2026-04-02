/**
 * Attractor definitions for GPU particle system.
 * Each attractor has tuned GLSL force code + audio mappings for dramatic visuals.
 */

export type AttractorType = "lorenz" | "blackhole" | "halvorsen" | "thomas" | "aizawa" | "dnahelix" | "galaxy" | "tesseract" | "tornado" | "interference";

export interface AttractorConfig {
  type: AttractorType;
  name: string;
  params: Record<string, number>;
  glslForce: string;
}

export const ATTRACTOR_CONFIGS: Record<AttractorType, AttractorConfig> = {
  lorenz: {
    type: "lorenz",
    name: "GPU: Lorenz",
    params: { sigma: 10.0, rho: 28.0, beta: 2.667 },
    glslForce: `
      // Classic Lorenz butterfly — chaos incarnate
      float sigma = 10.0 + u_bass * 20.0 + u_kick * 15.0;
      float rho = 28.0 + u_mid * 15.0 + u_kick * 30.0;
      float beta = 2.667 + u_high * 2.0;
      float scale = 0.025;
      vec3 p = pos / scale;
      vec3 force;
      force.x = sigma * (p.y - p.x);
      force.y = p.x * (rho - p.z) - p.y;
      force.z = p.x * p.y - beta * p.z;
      acc = force * scale * 0.5;

      // Periodic perturbation for variety
      acc.x += sin(u_time * 0.7 + p.y * 0.1) * u_energy * 0.02;
      acc.z += cos(u_time * 0.5 + p.x * 0.1) * u_energy * 0.02;
    `,
  },

  blackhole: {
    type: "blackhole",
    name: "GPU: Black Hole",
    params: { mass: 8.0 },
    glslForce: `
      // Gravitational singularity with accretion disk
      float mass = 8.0 + u_bass * 20.0 + u_kick * 40.0;
      float r = length(pos) + 0.001;
      float r2 = r * r;
      float r3 = r2 * r;

      // Gravitational pull (inverse square)
      vec3 radial = -normalize(pos) * mass / r2;

      // Tangential orbital velocity — creates accretion disk
      vec3 up = vec3(0.0, 1.0, 0.0);
      vec3 tangent = normalize(cross(pos, up));
      float orbitalSpeed = (2.0 + u_mid * 5.0) * sqrt(mass / r);
      vec3 orbital = tangent * orbitalSpeed;

      // Disk flattening force — pushes toward orbital plane
      float flattenForce = 2.0 + u_energy * 3.0;
      vec3 flatten = vec3(0.0, -pos.y * flattenForce, 0.0);

      // Relativistic frame-dragging effect (spiral)
      float dragAngle = u_time * 0.5 + r * 2.0;
      vec3 frameDrag = vec3(
        cos(dragAngle) * pos.z - sin(dragAngle) * pos.x,
        0.0,
        sin(dragAngle) * pos.x + cos(dragAngle) * pos.z
      ) * 0.1 / (r + 0.5);

      acc = radial + orbital * 0.15 + flatten + frameDrag;

      // Event horizon: particles inside get violently ejected as jets
      if (r < 0.25) {
        // Bipolar jets along Y axis
        float jetDir = pos.y > 0.0 ? 1.0 : -1.0;
        acc = vec3(0.0, jetDir * 30.0, 0.0) + normalize(pos) * 5.0;
      }

      // High frequencies create ripples in spacetime
      acc += normalize(pos) * sin(r * 10.0 - u_time * 4.0) * u_high * 0.3;
    `,
  },

  halvorsen: {
    type: "halvorsen",
    name: "GPU: Halvorsen",
    params: { a: 1.4 },
    glslForce: `
      // Halvorsen attractor — twisted 3-fold symmetric chaos
      float a = 1.4 + u_bass * 0.8 + sin(u_time * 0.3) * 0.2;
      float scale = 0.18;
      vec3 p = pos / scale;
      vec3 force;
      force.x = -a * p.x - 4.0 * p.y - 4.0 * p.z - p.y * p.y;
      force.y = -a * p.y - 4.0 * p.z - 4.0 * p.x - p.z * p.z;
      force.z = -a * p.z - 4.0 * p.x - 4.0 * p.y - p.x * p.x;
      acc = force * scale * 0.35;

      // Audio-reactive axis rotation
      float rotAngle = u_mid * 0.5;
      float cx = cos(rotAngle), sx = sin(rotAngle);
      vec3 rotated = vec3(acc.x, acc.y * cx - acc.z * sx, acc.y * sx + acc.z * cx);
      acc = mix(acc, rotated, u_mid);

      // Energy-based outward breathing
      acc += normalize(pos + 0.001) * sin(u_time * 2.0) * u_energy * 0.15;
    `,
  },

  thomas: {
    type: "thomas",
    name: "GPU: Thomas",
    params: { b: 0.208186 },
    glslForce: `
      // Thomas attractor — sinusoidal flow, slow elegant orbits
      float b = 0.208186 + (1.0 - u_energy) * 0.12 - u_bass * 0.08;
      float scale = 0.35;
      vec3 p = pos / scale;
      vec3 force;
      force.x = sin(p.y) - b * p.x;
      force.y = sin(p.z) - b * p.y;
      force.z = sin(p.x) - b * p.z;
      acc = force * scale * 1.0;

      // Add secondary harmonic for complexity
      float h = 0.3 + u_mid * 0.5;
      acc.x += sin(p.z * 2.0 + u_time * 0.5) * h * scale * 0.3;
      acc.y += sin(p.x * 2.0 + u_time * 0.7) * h * scale * 0.3;
      acc.z += sin(p.y * 2.0 + u_time * 0.3) * h * scale * 0.3;

      // Kick creates vortex burst
      if (u_kick > 0.3) {
        vec3 vortex = cross(normalize(pos + 0.001), vec3(0.0, 1.0, 0.0));
        acc += vortex * u_kick * 3.0;
      }
    `,
  },

  aizawa: {
    type: "aizawa",
    name: "GPU: Aizawa",
    params: { a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1 },
    glslForce: `
      // Aizawa attractor — beautiful toroidal chaos
      float a = 0.95;
      float b = 0.7 + u_bass * 0.4;
      float c = 0.6 + u_high * 0.2;
      float d = 3.5 + u_mid * 2.0;
      float e = 0.25 + sin(u_time * 0.4) * 0.1;
      float f = 0.1;
      float scale = 0.3;
      vec3 p = pos / scale;
      vec3 force;
      force.x = (p.z - b) * p.x - d * p.y;
      force.y = d * p.x + (p.z - b) * p.y;
      force.z = c + a * p.z - (p.z * p.z * p.z) / 3.0
                - (p.x * p.x + p.y * p.y) * (1.0 + e * p.z)
                + f * p.z * p.x * p.x * p.x;
      acc = force * scale * 0.5;

      // Torus breathing on beat
      float torusR = length(vec2(p.x, p.y));
      if (u_kick > 0.3 && torusR > 0.01) {
        vec3 radialOut = normalize(vec3(p.x, p.y, 0.0));
        acc += radialOut * u_kick * scale * 2.0;
      }

      // Vertical oscillation from energy
      acc.z += sin(u_time * 1.5 + torusR * 2.0) * u_energy * scale * 0.4;
    `,
  },

  dnahelix: {
    type: "dnahelix",
    name: "GPU: DNA Helix",
    params: {},
    glslForce: `
      // Double helix — two intertwined spirals connected by rungs
      float idx = gl_FragCoord.x + gl_FragCoord.y * resolution.x;
      float norm = idx / (resolution.x * resolution.y);
      float strand = step(0.5, fract(norm * 2.0)); // 0 or 1 — which strand

      // Target position on the helix
      float helixRadius = 1.2 + u_bass * 0.5;
      float helixPitch = 0.15 + u_mid * 0.1;
      float phase = norm * 40.0 + u_time * (0.8 + u_energy * 0.5);
      float strandOffset = strand * 3.14159;

      float targetX = cos(phase + strandOffset) * helixRadius;
      float targetZ = sin(phase + strandOffset) * helixRadius;
      float targetY = (norm - 0.5) * 12.0 + sin(u_time * 0.3) * 2.0;

      // Spring force toward target
      vec3 target = vec3(targetX, targetY, targetZ);
      vec3 delta = target - pos;
      float springK = 3.0 + u_energy * 2.0;
      acc = delta * springK;

      // Damping
      acc -= vel * 1.5;

      // Kick unwinds the helix
      if (u_kick > 0.3) {
        acc += normalize(vec3(pos.x, 0.0, pos.z) + 0.001) * u_kick * 5.0;
      }

      // High frequencies add shimmer perpendicular to helix
      acc.x += sin(phase * 3.0 + u_time * 5.0) * u_high * 0.4;
      acc.z += cos(phase * 3.0 + u_time * 5.0) * u_high * 0.4;
    `,
  },

  galaxy: {
    type: "galaxy",
    name: "GPU: Galaxy",
    params: {},
    glslForce: `
      // Spiral galaxy with arms, bulge, and rotation
      float idx = gl_FragCoord.x + gl_FragCoord.y * resolution.x;
      float norm = idx / (resolution.x * resolution.y);

      // Galaxy parameters
      float numArms = 3.0 + u_mid * 2.0;
      float armTightness = 0.4 + u_bass * 0.3;
      float diskRadius = 3.0 + u_energy;

      // Particle's radial position in galaxy
      float r_target = pow(norm, 0.5) * diskRadius;
      float armAngle = norm * numArms * 6.28318;
      float spiralAngle = armAngle + log(r_target + 0.1) * armTightness * 6.0;
      float rotation = u_time * (0.3 + u_energy * 0.2);

      // Target position
      float tx = cos(spiralAngle + rotation) * r_target;
      float tz = sin(spiralAngle + rotation) * r_target;
      // Disk thickness decreases with radius, bass puffs it up
      float diskThick = (0.1 + u_bass * 0.3) * exp(-r_target * 0.5);
      float ty = sin(norm * 137.0 + u_time * 0.5) * diskThick;

      vec3 target = vec3(tx, ty, tz);
      vec3 delta = target - pos;
      acc = delta * (2.0 + u_energy);

      // Orbital velocity (tangential)
      float r = length(vec2(pos.x, pos.z)) + 0.01;
      vec3 tangent = normalize(cross(vec3(pos.x, 0.0, pos.z), vec3(0.0, 1.0, 0.0)));
      acc += tangent * (1.5 / sqrt(r)) * (1.0 + u_mid);

      // Kick creates starburst
      if (u_kick > 0.3) {
        acc += normalize(pos + 0.001) * u_kick * 8.0;
      }

      acc -= vel * 0.8;
    `,
  },

  tesseract: {
    type: "tesseract",
    name: "GPU: Tesseract",
    params: {},
    glslForce: `
      // 4D hypercube projected to 3D — rotates in 4D space
      float idx = gl_FragCoord.x + gl_FragCoord.y * resolution.x;
      float norm = idx / (resolution.x * resolution.y);

      // Map particles to edges of a 4D hypercube
      float edgeCount = 32.0;
      float edgeIdx = floor(norm * edgeCount);
      float edgeT = fract(norm * edgeCount);

      // 4D vertices of hypercube (±1, ±1, ±1, ±1)
      float v1_x = mod(edgeIdx, 2.0) * 2.0 - 1.0;
      float v1_y = mod(floor(edgeIdx / 2.0), 2.0) * 2.0 - 1.0;
      float v1_z = mod(floor(edgeIdx / 4.0), 2.0) * 2.0 - 1.0;
      float v1_w = mod(floor(edgeIdx / 8.0), 2.0) * 2.0 - 1.0;

      // Connected vertex (flip one dimension)
      float flipDim = mod(floor(edgeIdx / 16.0), 4.0);
      float v2_x = v1_x * (flipDim == 0.0 ? -1.0 : 1.0);
      float v2_y = v1_y * (flipDim == 1.0 ? -1.0 : 1.0);
      float v2_z = v1_z * (flipDim == 2.0 ? -1.0 : 1.0);
      float v2_w = v1_w * (flipDim == 3.0 ? -1.0 : 1.0);

      // Interpolate along edge
      float px = mix(v1_x, v2_x, edgeT);
      float py = mix(v1_y, v2_y, edgeT);
      float pz = mix(v1_z, v2_z, edgeT);
      float pw = mix(v1_w, v2_w, edgeT);

      // 4D rotation (XW and YZ planes)
      float rotSpeed = 0.5 + u_mid * 0.5;
      float a1 = u_time * rotSpeed;
      float a2 = u_time * rotSpeed * 0.7 + u_bass;
      float c1 = cos(a1); float s1 = sin(a1);
      float c2 = cos(a2); float s2 = sin(a2);

      // Rotate XW plane
      float rx = px * c1 - pw * s1;
      float rw = px * s1 + pw * c1;
      // Rotate YZ plane
      float ry = py * c2 - pz * s2;
      float rz = py * s2 + pz * c2;

      // Perspective project 4D → 3D (w controls scale)
      float wScale = 1.5 / (2.5 - rw);
      float scale = 1.5 + u_energy * 0.5;
      vec3 target = vec3(rx * wScale, ry * wScale, rz * wScale) * scale;

      // Breathing on bass
      target *= 1.0 + u_bass * 0.3 * sin(u_time * 2.0);

      vec3 delta = target - pos;
      acc = delta * (4.0 + u_energy * 2.0);
      acc -= vel * 2.0;

      // Kick explodes outward
      if (u_kick > 0.3) {
        acc += normalize(pos + 0.001) * u_kick * 6.0;
      }
    `,
  },

  tornado: {
    type: "tornado",
    name: "GPU: Tornado",
    params: {},
    glslForce: `
      // Particle tornado / vortex funnel
      float idx = gl_FragCoord.x + gl_FragCoord.y * resolution.x;
      float norm = idx / (resolution.x * resolution.y);

      // Height along the tornado
      float height = (norm - 0.5) * 8.0;

      // Radius expands with height (funnel shape)
      float funnelBase = 0.3;
      float funnelExpand = 0.6 + u_bass * 0.3;
      float targetR = funnelBase + abs(height) * funnelExpand;

      // Rotation speed increases near the base
      float rotSpeed = (3.0 + u_energy * 3.0) / (abs(height) + 0.5);
      float angle = norm * 20.0 + u_time * rotSpeed;

      float tx = cos(angle) * targetR;
      float tz = sin(angle) * targetR;
      float ty = height + sin(u_time * 0.5) * 0.5;

      vec3 target = vec3(tx, ty, tz);
      vec3 delta = target - pos;
      acc = delta * (2.5 + u_mid);

      // Strong tangential force (spinning)
      float r = length(vec2(pos.x, pos.z)) + 0.01;
      vec3 tangent = vec3(-pos.z, 0.0, pos.x) / r;
      acc += tangent * rotSpeed * 0.8;

      // Upward draft
      acc.y += 0.5 + u_energy * 1.0;

      // Mid frequencies create wobble
      acc.x += sin(u_time * 2.0 + pos.y * 0.5) * u_mid * 0.5;
      acc.z += cos(u_time * 2.0 + pos.y * 0.5) * u_mid * 0.5;

      // Kick flings particles outward
      if (u_kick > 0.3) {
        acc += vec3(pos.x, 0.0, pos.z) * u_kick * 4.0 / (r + 0.1);
      }

      acc -= vel * 1.0;
    `,
  },

  interference: {
    type: "interference",
    name: "GPU: Interference",
    params: {},
    glslForce: `
      // 3D wave interference pattern — particles form standing wave nodes
      float idx = gl_FragCoord.x + gl_FragCoord.y * resolution.x;
      float norm = idx / (resolution.x * resolution.y);

      // Grid position
      float gridSize = 30.0;
      float gx = mod(idx, gridSize) / gridSize;
      float gy = floor(idx / gridSize) / (resolution.x * resolution.y / gridSize);

      // Map to 3D space
      float sx = (gx - 0.5) * 6.0;
      float sz = (gy - 0.5) * 6.0;

      // Two wave sources
      float freq1 = 3.0 + u_bass * 2.0;
      float freq2 = 3.5 + u_mid * 2.0;
      float speed = 2.0 + u_energy;

      // Source positions move with time
      float s1x = sin(u_time * 0.3) * 2.0;
      float s1z = cos(u_time * 0.4) * 2.0;
      float s2x = -sin(u_time * 0.25) * 2.0;
      float s2z = -cos(u_time * 0.35) * 2.0;

      float d1 = length(vec2(sx - s1x, sz - s1z));
      float d2 = length(vec2(sx - s2x, sz - s2z));

      // Interference: sum of two circular waves
      float wave1 = sin(d1 * freq1 - u_time * speed) / (d1 + 0.3);
      float wave2 = sin(d2 * freq2 - u_time * speed * 1.1) / (d2 + 0.3);
      float combined = (wave1 + wave2) * (1.0 + u_energy);

      // Height from interference
      float ty = combined * (0.8 + u_bass * 0.5);

      // High frequencies add ripples
      ty += sin(sx * 8.0 + u_time * 6.0) * u_high * 0.1;
      ty += cos(sz * 8.0 + u_time * 5.0) * u_high * 0.1;

      vec3 target = vec3(sx, ty, sz);
      vec3 delta = target - pos;
      acc = delta * (5.0 + u_energy * 3.0);
      acc -= vel * 2.5;

      // Kick creates shockwave from center
      if (u_kick > 0.3) {
        float r = length(pos.xz) + 0.01;
        acc.y += u_kick * 5.0 * sin(r * 4.0 - u_time * 10.0) / (r + 0.3);
      }
    `,
  },
};

export function getAttractorType(presetName: string): AttractorType | null {
  for (const [type, config] of Object.entries(ATTRACTOR_CONFIGS)) {
    if (config.name === presetName) return type as AttractorType;
  }
  return null;
}

export const GPU_PRESET_NAMES = Object.values(ATTRACTOR_CONFIGS).map((c) => c.name);
