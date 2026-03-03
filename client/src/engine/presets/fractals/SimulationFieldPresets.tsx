import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { FractalPreset, PresetContext, UniformSpec, UniformValues } from "../types";

const quadVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const paletteFns = /* glsl */ `
#define TAU 6.28318530718

vec3 iqPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

const grayScottSimFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D u_state;
uniform vec2 u_texel;
uniform float u_time;
uniform float u_dt;
uniform float u_frame;
uniform float u_feed;
uniform float u_kill;
uniform float u_diffA;
uniform float u_diffB;
uniform float u_seedStrength;
uniform float u_audioEnergy;
uniform float u_audioBass;
uniform float u_audioHigh;

${paletteFns}

vec2 laplaceAB(vec2 uv) {
  vec2 c = texture2D(u_state, uv).rg;
  vec2 n = texture2D(u_state, uv + vec2(0.0, u_texel.y)).rg;
  vec2 s = texture2D(u_state, uv - vec2(0.0, u_texel.y)).rg;
  vec2 e = texture2D(u_state, uv + vec2(u_texel.x, 0.0)).rg;
  vec2 w = texture2D(u_state, uv - vec2(u_texel.x, 0.0)).rg;
  vec2 ne = texture2D(u_state, uv + vec2(u_texel.x, u_texel.y)).rg;
  vec2 nw = texture2D(u_state, uv + vec2(-u_texel.x, u_texel.y)).rg;
  vec2 se = texture2D(u_state, uv + vec2(u_texel.x, -u_texel.y)).rg;
  vec2 sw = texture2D(u_state, uv + vec2(-u_texel.x, -u_texel.y)).rg;

  return (
    0.2 * (n + s + e + w) +
    0.05 * (ne + nw + se + sw) -
    c
  );
}

void main() {
  vec2 uv = vUv;

  if (u_frame < 1.5) {
    float d = length(uv - vec2(0.5));
    float n = hash12(uv * 120.0 + u_time * 0.7);
    float seed = smoothstep(0.18, 0.02, d) * (0.35 + n * 0.65);
    seed += smoothstep(0.1, 0.01, length(uv - vec2(0.34, 0.63))) * 0.45;
    seed += smoothstep(0.08, 0.01, length(uv - vec2(0.65, 0.41))) * 0.35;
    seed = clamp(seed, 0.0, 1.0);
    gl_FragColor = vec4(1.0 - seed * 0.6, seed, 0.0, 1.0);
    return;
  }

  vec2 ab = texture2D(u_state, uv).rg;
  float A = ab.r;
  float B = ab.g;

  vec2 lap = laplaceAB(uv);
  float reaction = A * B * B;

  float feed = u_feed + u_audioEnergy * 0.015 + u_audioBass * 0.008;
  float kill = u_kill + u_audioHigh * 0.01;
  feed = clamp(feed, 0.0, 0.12);
  kill = clamp(kill, 0.0, 0.12);

  float dA = u_diffA;
  float dB = u_diffB;

  float nextA = A + (dA * lap.r - reaction + feed * (1.0 - A)) * u_dt;
  float nextB = B + (dB * lap.g + reaction - (kill + feed) * B) * u_dt;

  float pulseSeed = exp(-dot(uv - vec2(0.5), uv - vec2(0.5)) * 90.0)
    * (0.0005 + u_seedStrength * 0.018 * (0.35 + 0.65 * u_audioBass));
  nextB += pulseSeed;
  nextA -= pulseSeed * 0.35;

  nextA = clamp(nextA, 0.0, 1.0);
  nextB = clamp(nextB, 0.0, 1.0);

  gl_FragColor = vec4(nextA, nextB, 0.0, 1.0);
}
`;

const grayScottViewFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D u_state;
uniform vec2 u_center;
uniform float u_zoom;
uniform float u_time;
uniform float u_colorCycle;
uniform float u_colorSpeed;
uniform vec3 u_paletteA;
uniform vec3 u_paletteB;
uniform vec3 u_paletteC;
uniform vec3 u_paletteD;
uniform float u_saturation;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_opacity;

${paletteFns}

void main() {
  vec2 uv = (vUv - 0.5) / max(0.3, u_zoom) + 0.5 + u_center * 0.15;
  vec2 ab = texture2D(u_state, fract(uv)).rg;
  float field = clamp((ab.g - ab.r) * 1.8 + 0.5, 0.0, 1.0);
  float cycle = u_colorCycle + u_time * u_colorSpeed * 0.035;
  float idx = fract(field * 1.7 + cycle);
  vec3 col = iqPalette(idx, u_paletteA, u_paletteB, u_paletteC, u_paletteD);

  float edge = smoothstep(0.2, 0.8, abs(dFdx(field)) + abs(dFdy(field)) * 2.8);
  col += edge * vec3(0.18, 0.2, 0.25);

  col *= u_brightness;
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, u_saturation);
  col = mix(vec3(0.5), col, 1.0 + (u_contrast - 0.5) * 0.7);
  col = clamp(col, 0.0, 1.0);

  gl_FragColor = vec4(col, u_opacity);
}
`;

const curlFlowSimFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D u_state;
uniform vec2 u_texel;
uniform float u_time;
uniform float u_dt;
uniform float u_frame;
uniform float u_flowSpeed;
uniform float u_turbulence;
uniform float u_curlStrength;
uniform float u_advection;
uniform float u_trailDecay;
uniform float u_colorCycle;
uniform float u_colorSpeed;
uniform vec3 u_paletteA;
uniform vec3 u_paletteB;
uniform vec3 u_paletteC;
uniform vec3 u_paletteD;
uniform float u_audioBass;
uniform float u_audioMid;
uniform float u_audioHigh;
uniform float u_audioBeat;

${paletteFns}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec2 curl(vec2 p) {
  float e = 0.002;
  float n1 = noise(p + vec2(e, 0.0));
  float n2 = noise(p - vec2(e, 0.0));
  float n3 = noise(p + vec2(0.0, e));
  float n4 = noise(p - vec2(0.0, e));
  vec2 g = vec2(n1 - n2, n3 - n4) / (2.0 * e);
  return vec2(g.y, -g.x);
}

void main() {
  vec2 uv = vUv;

  if (u_frame < 1.5) {
    float ring = smoothstep(0.36, 0.05, length(uv - vec2(0.5)));
    float n = noise(uv * 12.0 + vec2(1.7, -2.1));
    vec3 seedInk = iqPalette(
      fract(u_colorCycle + n * 0.25),
      u_paletteA, u_paletteB, u_paletteC, u_paletteD
    );
    gl_FragColor = vec4(seedInk * ring * 0.09, 1.0);
    return;
  }

  float t = u_time * (0.18 + u_flowSpeed * 0.82);
  vec2 p = uv * (2.2 + u_turbulence * 3.1);
  vec2 c1 = curl(p + vec2(t * 0.34, -t * 0.21));
  vec2 c2 = curl(p * 1.73 - vec2(t * 0.17, t * 0.26));
  vec2 vel = (c1 + c2 * 0.65);
  float velLen = max(length(vel), 1e-4);
  vel = vel / velLen;
  vel *= (0.0009 + 0.0052 * u_curlStrength + u_audioBass * 0.0026 + u_audioMid * 0.0014);

  vec2 advUv = fract(uv - vel * (0.15 + u_advection) * max(0.25, u_dt * 60.0));
  vec3 col = texture2D(u_state, advUv).rgb;
  col *= clamp(u_trailDecay, 0.86, 0.9995);

  vec2 emitter = vec2(0.5) + vec2(sin(t * 0.7), cos(t * 0.63)) * 0.2 * (0.3 + 0.7 * u_turbulence);
  float dist = length(uv - emitter);
  float inject = exp(-dist * (26.0 - u_turbulence * 8.0))
    * (0.010 + u_audioBeat * 0.045 + u_audioHigh * 0.014);

  float cycle = u_colorCycle + u_time * u_colorSpeed * 0.03;
  vec3 ink = iqPalette(
    fract(cycle + noise(uv * 9.0 + t) * 0.18 + dist * 0.22),
    u_paletteA, u_paletteB, u_paletteC, u_paletteD
  );
  col += ink * inject;

  float sparkle = smoothstep(0.92, 1.0, noise(uv * 75.0 + t * 2.2));
  col += ink * sparkle * u_audioHigh * 0.002;
  col = clamp(col, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

const curlFlowViewFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D u_state;
uniform vec2 u_center;
uniform float u_zoom;
uniform float u_time;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_opacity;

void main() {
  vec2 uv = (vUv - 0.5) / max(0.35, u_zoom) + 0.5 + u_center * 0.2;
  vec3 col = texture2D(u_state, fract(uv)).rgb;

  // Device-safe fallback: keep a visible flow-like field if sim texture is near black.
  if (dot(col, col) < 0.00004) {
    vec2 p = uv * 2.0 - 1.0;
    float a = atan(p.y, p.x);
    float r = length(p);
    float w = 0.5 + 0.5 * sin(8.0 * a - 11.0 * r + u_time * 0.55);
    vec3 base = vec3(0.08, 0.05, 0.14);
    vec3 accent = vec3(0.24, 0.48, 0.92);
    col = mix(base, accent, w) * (0.32 + 0.68 * smoothstep(1.25, 0.0, r));
  }

  col += vec3(0.012, 0.01, 0.018);
  col += col * col * 0.25;
  col *= u_brightness;
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, u_saturation);
  col = mix(vec3(0.5), col, 1.0 + (u_contrast - 0.5) * 0.75);
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, u_opacity);
}
`;

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothAR(prev: number, next: number, dt: number, attack = 18, release = 6): number {
  const speed = next > prev ? attack : release;
  const alpha = 1 - Math.exp(-speed * dt);
  return prev + (next - prev) * alpha;
}

function vec2Or(value: unknown, fallbackX: number, fallbackY: number): [number, number] {
  if (Array.isArray(value) && value.length >= 2) {
    return [num(value[0], fallbackX), num(value[1], fallbackY)];
  }
  return [fallbackX, fallbackY];
}

function vec3FromHex(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

function usePingPong(gl: THREE.WebGLRenderer, simResolution: number, wrap: THREE.Wrapping) {
  const supportsRenderableHalfFloat =
    gl.capabilities.isWebGL2 &&
    (gl.extensions.has("EXT_color_buffer_float") ||
      gl.extensions.has("EXT_color_buffer_half_float"));

  const options = useMemo<THREE.RenderTargetOptions>(
    () => ({
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      // Fall back to UnsignedByte when half-float render targets are unsupported.
      type: supportsRenderableHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
    }),
    [supportsRenderableHalfFloat],
  );

  const rtA = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(simResolution, simResolution, options);
    rt.texture.wrapS = wrap;
    rt.texture.wrapT = wrap;
    rt.texture.generateMipmaps = false;
    return rt;
  }, [simResolution, options, wrap]);

  const rtB = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(simResolution, simResolution, options);
    rt.texture.wrapS = wrap;
    rt.texture.wrapT = wrap;
    rt.texture.generateMipmaps = false;
    return rt;
  }, [simResolution, options, wrap]);

  useEffect(() => {
    return () => {
      rtA.dispose();
      rtB.dispose();
    };
  }, [rtA, rtB]);

  return { rtA, rtB };
}

const GrayScottRender: React.FC<{ uniforms: UniformValues; state: any }> = ({ uniforms, state }) => {
  const { gl, viewport } = useThree();
  const simResolution = Math.round(num(uniforms.u_simResolution, 512));
  const simRes = Math.max(128, Math.min(1024, simResolution));
  const { rtA, rtB } = usePingPong(gl, simRes, THREE.ClampToEdgeWrapping);

  const simMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: quadVert,
        fragmentShader: grayScottSimFrag,
        uniforms: {
          u_state: { value: rtA.texture },
          u_texel: { value: new THREE.Vector2(1 / simRes, 1 / simRes) },
          u_time: { value: 0 },
          u_dt: { value: 1.0 },
          u_frame: { value: 0 },
          u_feed: { value: 0.026 },
          u_kill: { value: 0.055 },
          u_diffA: { value: 1.0 },
          u_diffB: { value: 0.5 },
          u_seedStrength: { value: 0.35 },
          u_audioEnergy: { value: 0 },
          u_audioBass: { value: 0 },
          u_audioHigh: { value: 0 },
        },
      }),
    [simRes],
  );

  useEffect(() => () => simMat.dispose(), [simMat]);

  const simScene = useMemo(() => new THREE.Scene(), []);
  const simCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const simQuad = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat), [simMat]);

  useEffect(() => {
    simScene.add(simQuad);
    return () => {
      simScene.remove(simQuad);
      simQuad.geometry.dispose();
    };
  }, [simScene, simQuad]);

  const displayMatRef = useRef<THREE.ShaderMaterial>(null!);
  const displayUniforms = useMemo(
    () => ({
      u_state: { value: rtA.texture },
      u_center: { value: new THREE.Vector2(0, 0) },
      u_zoom: { value: num(uniforms.u_zoom, 1.0) },
      u_time: { value: 0 },
      u_colorCycle: { value: 0 },
      u_colorSpeed: { value: 0.3 },
      u_paletteA: { value: new THREE.Vector3(0.07, 0.05, 0.12) },
      u_paletteB: { value: new THREE.Vector3(0.26, 0.13, 0.5) },
      u_paletteC: { value: new THREE.Vector3(0.34, 0.84, 1.0) },
      u_paletteD: { value: new THREE.Vector3(0.95, 0.5, 0.8) },
      u_saturation: { value: 1.0 },
      u_brightness: { value: 1.0 },
      u_contrast: { value: 0.55 },
      u_opacity: { value: 1.0 },
    }),
    [],
  );

  const pingRef = useRef({ read: rtA, write: rtB });
  const frameRef = useRef(0);
  useEffect(() => {
    pingRef.current = { read: rtA, write: rtB };
    frameRef.current = 0;
  }, [rtA, rtB, simRes]);

  useFrame(({ clock }, delta) => {
    const displayMat = displayMatRef.current;
    if (!displayMat) return;

    const prevTarget = gl.getRenderTarget();
    const pp = pingRef.current;

    const steps = Math.max(1, Math.min(30, Math.round(num(uniforms.u_stepsPerFrame, 10))));
    const dt = Math.min(delta, 0.05);
    simMat.uniforms.u_time.value = clock.getElapsedTime();
    simMat.uniforms.u_texel.value.set(1 / simRes, 1 / simRes);
    simMat.uniforms.u_feed.value = num(uniforms.u_feed, 0.026);
    simMat.uniforms.u_kill.value = num(uniforms.u_kill, 0.055);
    simMat.uniforms.u_diffA.value = num(uniforms.u_diffA, 1.0);
    simMat.uniforms.u_diffB.value = num(uniforms.u_diffB, 0.5);
    simMat.uniforms.u_seedStrength.value = num(uniforms.u_seedStrength, 0.35);
    simMat.uniforms.u_audioEnergy.value = num(state.audioEnergy, 0);
    simMat.uniforms.u_audioBass.value = num(state.audioBass, 0);
    simMat.uniforms.u_audioHigh.value = num(state.audioHigh, 0);

    for (let i = 0; i < steps; i += 1) {
      simMat.uniforms.u_state.value = pp.read.texture;
      simMat.uniforms.u_dt.value = dt * 60 / steps;
      simMat.uniforms.u_frame.value = frameRef.current;
      gl.setRenderTarget(pp.write);
      gl.render(simScene, simCamera);
      const tmp = pp.read;
      pp.read = pp.write;
      pp.write = tmp;
      frameRef.current += 1;
    }

    gl.setRenderTarget(prevTarget);
    pingRef.current = pp;

    displayUniforms.u_state.value = pp.read.texture;
    displayUniforms.u_center.value.set(...vec2Or(uniforms.u_center, 0, 0));
    displayUniforms.u_zoom.value = num(uniforms.u_zoom, 1.0);
    displayUniforms.u_time.value = clock.getElapsedTime();
    displayUniforms.u_colorCycle.value = num(uniforms.u_colorCycle, 0);
    displayUniforms.u_colorSpeed.value = num(uniforms.u_colorSpeed, 0.3);
    displayUniforms.u_saturation.value = num(uniforms.u_saturation, 1.0);
    displayUniforms.u_brightness.value = num(uniforms.u_brightness, 1.0);
    displayUniforms.u_contrast.value = num(uniforms.u_contrast, 0.55);
    displayUniforms.u_opacity.value = num(uniforms.u_opacity, 1.0);
    displayUniforms.u_paletteA.value.copy(vec3FromHex(typeof uniforms.u_paletteA === "string" ? uniforms.u_paletteA : "#120C1E"));
    displayUniforms.u_paletteB.value.copy(vec3FromHex(typeof uniforms.u_paletteB === "string" ? uniforms.u_paletteB : "#4A2D8F"));
    displayUniforms.u_paletteC.value.copy(vec3FromHex(typeof uniforms.u_paletteC === "string" ? uniforms.u_paletteC : "#4FD7FF"));
    displayUniforms.u_paletteD.value.copy(vec3FromHex(typeof uniforms.u_paletteD === "string" ? uniforms.u_paletteD : "#F56BC3"));
  });

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={displayMatRef}
        vertexShader={quadVert}
        fragmentShader={grayScottViewFrag}
        uniforms={displayUniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
};

const CurlFlowRender: React.FC<{ uniforms: UniformValues; state: any }> = ({ uniforms, state }) => {
  const { gl, viewport } = useThree();
  const simResolution = Math.round(num(uniforms.u_simResolution, 512));
  const simRes = Math.max(128, Math.min(1024, simResolution));
  const { rtA, rtB } = usePingPong(gl, simRes, THREE.RepeatWrapping);

  const simMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: quadVert,
        fragmentShader: curlFlowSimFrag,
        uniforms: {
          u_state: { value: rtA.texture },
          u_texel: { value: new THREE.Vector2(1 / simRes, 1 / simRes) },
          u_time: { value: 0 },
          u_dt: { value: 1.0 },
          u_frame: { value: 0 },
          u_flowSpeed: { value: 0.55 },
          u_turbulence: { value: 0.5 },
          u_curlStrength: { value: 0.7 },
          u_advection: { value: 0.9 },
          u_trailDecay: { value: 0.972 },
          u_colorCycle: { value: 0.0 },
          u_colorSpeed: { value: 0.4 },
          u_paletteA: { value: new THREE.Vector3(0.06, 0.05, 0.14) },
          u_paletteB: { value: new THREE.Vector3(0.31, 0.15, 0.63) },
          u_paletteC: { value: new THREE.Vector3(0.28, 0.79, 1.0) },
          u_paletteD: { value: new THREE.Vector3(0.96, 0.54, 0.86) },
          u_audioBass: { value: 0 },
          u_audioMid: { value: 0 },
          u_audioHigh: { value: 0 },
          u_audioBeat: { value: 0 },
        },
      }),
    [simRes],
  );

  useEffect(() => () => simMat.dispose(), [simMat]);

  const simScene = useMemo(() => new THREE.Scene(), []);
  const simCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const simQuad = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat), [simMat]);

  useEffect(() => {
    simScene.add(simQuad);
    return () => {
      simScene.remove(simQuad);
      simQuad.geometry.dispose();
    };
  }, [simScene, simQuad]);

  const displayMatRef = useRef<THREE.ShaderMaterial>(null!);
  const displayUniforms = useMemo(
    () => ({
      u_state: { value: rtA.texture },
      u_center: { value: new THREE.Vector2(0, 0) },
      u_zoom: { value: num(uniforms.u_zoom, 1.0) },
      u_time: { value: 0.0 },
      u_brightness: { value: 1.0 },
      u_contrast: { value: 0.55 },
      u_saturation: { value: 1.0 },
      u_opacity: { value: 1.0 },
    }),
    [],
  );

  const pingRef = useRef({ read: rtA, write: rtB });
  const frameRef = useRef(0);
  useEffect(() => {
    pingRef.current = { read: rtA, write: rtB };
    frameRef.current = 0;
  }, [rtA, rtB, simRes]);

  useFrame(({ clock }, delta) => {
    const displayMat = displayMatRef.current;
    if (!displayMat) return;

    const prevTarget = gl.getRenderTarget();
    const pp = pingRef.current;

    const steps = Math.max(1, Math.min(30, Math.round(num(uniforms.u_stepsPerFrame, 8))));
    const dt = Math.min(delta, 0.05);

    simMat.uniforms.u_time.value = clock.getElapsedTime();
    simMat.uniforms.u_texel.value.set(1 / simRes, 1 / simRes);
    simMat.uniforms.u_flowSpeed.value = num(uniforms.u_flowSpeed, 0.55);
    simMat.uniforms.u_turbulence.value = num(uniforms.u_turbulence, 0.5);
    simMat.uniforms.u_curlStrength.value = num(uniforms.u_curlStrength, 0.7);
    simMat.uniforms.u_advection.value = num(uniforms.u_advection, 0.9);
    simMat.uniforms.u_trailDecay.value = num(uniforms.u_trailDecay, 0.972);
    simMat.uniforms.u_colorCycle.value = num(uniforms.u_colorCycle, 0.0);
    simMat.uniforms.u_colorSpeed.value = num(uniforms.u_colorSpeed, 0.4);
    simMat.uniforms.u_audioBass.value = num(state.audioBass, 0);
    simMat.uniforms.u_audioMid.value = num(state.audioMid, 0);
    simMat.uniforms.u_audioHigh.value = num(state.audioHigh, 0);
    simMat.uniforms.u_audioBeat.value = num(state.audioBeat, 0);
    simMat.uniforms.u_paletteA.value.copy(vec3FromHex(typeof uniforms.u_paletteA === "string" ? uniforms.u_paletteA : "#120C1E"));
    simMat.uniforms.u_paletteB.value.copy(vec3FromHex(typeof uniforms.u_paletteB === "string" ? uniforms.u_paletteB : "#4A2D8F"));
    simMat.uniforms.u_paletteC.value.copy(vec3FromHex(typeof uniforms.u_paletteC === "string" ? uniforms.u_paletteC : "#4FD7FF"));
    simMat.uniforms.u_paletteD.value.copy(vec3FromHex(typeof uniforms.u_paletteD === "string" ? uniforms.u_paletteD : "#F56BC3"));

    for (let i = 0; i < steps; i += 1) {
      simMat.uniforms.u_state.value = pp.read.texture;
      simMat.uniforms.u_dt.value = dt * 60 / steps;
      simMat.uniforms.u_frame.value = frameRef.current;
      gl.setRenderTarget(pp.write);
      gl.render(simScene, simCamera);
      const tmp = pp.read;
      pp.read = pp.write;
      pp.write = tmp;
      frameRef.current += 1;
    }

    gl.setRenderTarget(prevTarget);
    pingRef.current = pp;

    displayUniforms.u_state.value = pp.read.texture;
    displayUniforms.u_center.value.set(...vec2Or(uniforms.u_center, 0, 0));
    displayUniforms.u_zoom.value = num(uniforms.u_zoom, 1.0);
    displayUniforms.u_time.value = clock.getElapsedTime();
    displayUniforms.u_brightness.value = num(uniforms.u_brightness, 1.0);
    displayUniforms.u_contrast.value = num(uniforms.u_contrast, 0.55);
    displayUniforms.u_saturation.value = num(uniforms.u_saturation, 1.0);
    displayUniforms.u_opacity.value = num(uniforms.u_opacity, 1.0);
  });

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={displayMatRef}
        vertexShader={quadVert}
        fragmentShader={curlFlowViewFrag}
        uniforms={displayUniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
};

const grayScottSpecs: UniformSpec[] = [
  { key: "u_center", label: "Center", type: "vec2", group: "Fractal", default: [0, 0] },
  { key: "u_zoom", label: "Zoom", type: "float", group: "Fractal", min: 0.35, max: 4, step: 0.01, default: 1.0, macro: true },
  { key: "u_opacity", label: "Opacity", type: "float", group: "Fractal", min: 0, max: 1, step: 0.01, default: 1.0 },
  { key: "u_feed", label: "Feed", type: "float", group: "Fractal", min: 0.0, max: 0.1, step: 0.0001, default: 0.026 },
  { key: "u_kill", label: "Kill", type: "float", group: "Fractal", min: 0.0, max: 0.1, step: 0.0001, default: 0.055 },
  { key: "u_diffA", label: "Diffusion A", type: "float", group: "Fractal", min: 0.0, max: 2.0, step: 0.001, default: 1.0 },
  { key: "u_diffB", label: "Diffusion B", type: "float", group: "Fractal", min: 0.0, max: 2.0, step: 0.001, default: 0.5 },
  { key: "u_seedStrength", label: "Seed Strength", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.35 },
  { key: "u_stepsPerFrame", label: "Steps / Frame", type: "int", group: "Quality", min: 1, max: 30, step: 1, default: 10 },
  { key: "u_simResolution", label: "Sim Resolution", type: "int", group: "Quality", min: 128, max: 1024, step: 128, default: 512 },

  { key: "u_paletteA", label: "Base Tone", type: "color", group: "Color", default: "#120C1E" },
  { key: "u_paletteB", label: "Amplitude", type: "color", group: "Color", default: "#4A2D8F" },
  { key: "u_paletteC", label: "Frequency", type: "color", group: "Color", default: "#4FD7FF" },
  { key: "u_paletteD", label: "Phase", type: "color", group: "Color", default: "#F56BC3" },
  { key: "u_colorCycle", label: "Color Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.001, default: 0.0, macro: true },
  { key: "u_colorSpeed", label: "Auto Cycle Speed", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 0.32 },
  { key: "u_saturation", label: "Saturation", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 1.05 },
  { key: "u_brightness", label: "Brightness", type: "float", group: "Color", min: 0.2, max: 2, step: 0.01, default: 1.0 },
  { key: "u_contrast", label: "Contrast", type: "float", group: "Color", min: 0, max: 1, step: 0.01, default: 0.55 },

  { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
  { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
  { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.5, macro: true },
  { key: "u_trebleShimmer", label: "Treble Shimmer", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
  { key: "u_beatPunch", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
];

const curlFlowSpecs: UniformSpec[] = [
  { key: "u_center", label: "Center", type: "vec2", group: "Fractal", default: [0, 0] },
  { key: "u_zoom", label: "Zoom", type: "float", group: "Fractal", min: 0.35, max: 4, step: 0.01, default: 1.0, macro: true },
  { key: "u_opacity", label: "Opacity", type: "float", group: "Fractal", min: 0, max: 1, step: 0.01, default: 1.0 },
  { key: "u_flowSpeed", label: "Flow Speed", type: "float", group: "Motion", min: 0, max: 2, step: 0.01, default: 0.55, macro: true },
  { key: "u_turbulence", label: "Turbulence", type: "float", group: "Motion", min: 0, max: 2, step: 0.01, default: 0.5 },
  { key: "u_curlStrength", label: "Curl Strength", type: "float", group: "Motion", min: 0, max: 2, step: 0.01, default: 0.7, macro: true },
  { key: "u_advection", label: "Advection", type: "float", group: "Motion", min: 0, max: 2, step: 0.01, default: 0.9 },
  { key: "u_trailDecay", label: "Trail Decay", type: "float", group: "Effects", min: 0.85, max: 0.9995, step: 0.0001, default: 0.972 },
  { key: "u_stepsPerFrame", label: "Steps / Frame", type: "int", group: "Quality", min: 1, max: 30, step: 1, default: 8 },
  { key: "u_simResolution", label: "Sim Resolution", type: "int", group: "Quality", min: 128, max: 1024, step: 128, default: 512 },

  { key: "u_paletteA", label: "Base Tone", type: "color", group: "Color", default: "#120C1E" },
  { key: "u_paletteB", label: "Amplitude", type: "color", group: "Color", default: "#4A2D8F" },
  { key: "u_paletteC", label: "Frequency", type: "color", group: "Color", default: "#4FD7FF" },
  { key: "u_paletteD", label: "Phase", type: "color", group: "Color", default: "#F56BC3" },
  { key: "u_colorCycle", label: "Color Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.001, default: 0.0, macro: true },
  { key: "u_colorSpeed", label: "Auto Cycle Speed", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 0.4 },
  { key: "u_saturation", label: "Saturation", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 1.1 },
  { key: "u_brightness", label: "Brightness", type: "float", group: "Color", min: 0.2, max: 2, step: 0.01, default: 1.0 },
  { key: "u_contrast", label: "Contrast", type: "float", group: "Color", min: 0, max: 1, step: 0.01, default: 0.55 },

  { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
  { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
  { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.5, macro: true },
  { key: "u_trebleShimmer", label: "Treble Shimmer", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
  { key: "u_beatPunch", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
];

function updateAudioState(ctx: PresetContext, audio: { rms: number; bass: number; mid: number; treble: number; beat: number }, uniforms: UniformValues, state: any) {
  const dt = Math.max(ctx.dt, 1 / 120);
  const gain = num(uniforms.u_audioGain, 1.0);
  const bassTarget = clamp01(audio.bass * gain * num(uniforms.u_bassImpact, 0.8));
  const midTarget = clamp01(audio.mid * gain * num(uniforms.u_midMorph, 0.5));
  const highTarget = clamp01(audio.treble * gain * num(uniforms.u_trebleShimmer, 0.6));
  const beatTarget = clamp01(audio.beat * gain * num(uniforms.u_beatPunch, 0.8));
  const energyTarget = clamp01(audio.rms * gain);

  state.audioBass = smoothAR(num(state.audioBass, 0), bassTarget, dt, 14, 5);
  state.audioMid = smoothAR(num(state.audioMid, 0), midTarget, dt, 16, 6);
  state.audioHigh = smoothAR(num(state.audioHigh, 0), highTarget, dt, 20, 8);
  state.audioBeat = smoothAR(num(state.audioBeat, 0), beatTarget, dt, 24, 8);
  state.audioEnergy = smoothAR(num(state.audioEnergy, 0), energyTarget, dt, 12, 6);
}

export const GrayScottPreset: FractalPreset = {
  id: "gray-scott",
  name: "Gray Scott",
  category: "Fractals/Noise",
  kind: "shader2d",
  uniformSpecs: grayScottSpecs,
  init() {},
  update({ ctx, audio, uniforms, state }) {
    updateAudioState(ctx, audio, uniforms, state);
  },
  dispose() {},
  Render: GrayScottRender,
};

export const CurlFlowPreset: FractalPreset = {
  id: "curl-flow",
  name: "Curl Flow",
  category: "Fractals/Noise",
  kind: "shader2d",
  uniformSpecs: curlFlowSpecs,
  init() {},
  update({ ctx, audio, uniforms, state }) {
    updateAudioState(ctx, audio, uniforms, state);
  },
  dispose() {},
  Render: CurlFlowRender,
};
