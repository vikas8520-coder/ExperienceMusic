import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { useVisualizerStore } from '../stores/visualizerStore';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';
import type { VisualPreset } from '../types';

const { width, height } = Dimensions.get('window');

const VERTEX_SHADER = `
  attribute vec4 position;
  void main() {
    gl_Position = position;
  }
`;

const FRAGMENT_SHADERS: Record<string, string> = {
  'energy-rings': `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform float bass;
    uniform float mid;
    uniform float high;
    uniform float energy;
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
      float dist = length(uv);
      
      float rings = 0.0;
      for (float i = 0.0; i < 6.0; i++) {
        float radius = 0.1 + i * 0.12 + bass * 0.1;
        float width = 0.02 + high * 0.02;
        float ring = smoothstep(width, 0.0, abs(dist - radius));
        ring *= 0.5 + 0.5 * sin(time * 2.0 + i * 0.5);
        rings += ring;
      }
      
      vec3 col = mix(color1, color2, dist * 2.0);
      col = mix(col, color3, rings);
      col *= 0.5 + energy * 0.5;
      
      float glow = exp(-dist * 3.0) * (0.5 + bass * 0.5);
      col += color1 * glow;
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'psy-tunnel': `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform float bass;
    uniform float mid;
    uniform float high;
    uniform float energy;
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
      float angle = atan(uv.y, uv.x);
      float dist = length(uv);
      
      float tunnel = 1.0 / dist;
      tunnel = fract(tunnel * 0.5 - time * (0.5 + bass * 0.3));
      
      float segments = 8.0 + mid * 4.0;
      float pattern = sin(angle * segments + time * 2.0) * 0.5 + 0.5;
      pattern *= tunnel;
      
      vec3 col = mix(color1, color2, pattern);
      col = mix(col, color3, sin(time + dist * 5.0) * 0.5 + 0.5);
      
      col *= smoothstep(0.0, 0.3, dist);
      col *= 1.0 - smoothstep(0.8, 1.5, dist);
      col *= 0.6 + energy * 0.4;
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'particle-field': `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform float bass;
    uniform float mid;
    uniform float high;
    uniform float energy;
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
      
      vec3 col = vec3(0.0);
      
      for (float i = 0.0; i < 50.0; i++) {
        vec2 pos = vec2(
          hash(vec2(i, 0.0)) * 2.0 - 1.0,
          hash(vec2(0.0, i)) * 2.0 - 1.0
        );
        
        float speed = 0.3 + hash(vec2(i, i)) * 0.4;
        pos.x += sin(time * speed + i) * 0.3 * (1.0 + bass);
        pos.y += cos(time * speed * 0.7 + i) * 0.3 * (1.0 + mid);
        
        float dist = length(uv - pos);
        float size = 0.01 + high * 0.02;
        float particle = smoothstep(size, 0.0, dist);
        
        vec3 particleCol = mix(color1, color2, hash(vec2(i * 2.0, i)));
        particleCol = mix(particleCol, color3, hash(vec2(i, i * 3.0)));
        
        col += particleCol * particle * (0.5 + energy * 0.5);
      }
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'waveform-sphere': `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform float bass;
    uniform float mid;
    uniform float high;
    uniform float energy;
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
      float angle = atan(uv.y, uv.x);
      float dist = length(uv);
      
      float wave = sin(angle * 8.0 + time * 3.0) * 0.05 * (1.0 + bass);
      wave += sin(angle * 12.0 - time * 2.0) * 0.03 * (1.0 + mid);
      wave += sin(angle * 16.0 + time * 4.0) * 0.02 * (1.0 + high);
      
      float sphere = smoothstep(0.35 + wave, 0.33 + wave, dist);
      sphere -= smoothstep(0.25 + wave * 0.5, 0.23 + wave * 0.5, dist) * 0.5;
      
      vec3 col = mix(color1, color2, sphere);
      col = mix(col, color3, sin(angle * 4.0 + time) * 0.5 + 0.5);
      col *= 0.5 + energy * 0.5;
      
      float glow = exp(-dist * 2.0) * energy * 0.5;
      col += color1 * glow;
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'audio-bars': `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform float bass;
    uniform float mid;
    uniform float high;
    uniform float energy;
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      uv.x = uv.x * 2.0 - 1.0;
      uv.y = uv.y * 2.0 - 1.0;
      
      float barCount = 16.0;
      float barIndex = floor((uv.x + 1.0) * barCount * 0.5);
      float barPos = fract((uv.x + 1.0) * barCount * 0.5);
      
      float barHeight = 0.0;
      if (barIndex < barCount * 0.33) {
        barHeight = bass * 0.8;
      } else if (barIndex < barCount * 0.66) {
        barHeight = mid * 0.8;
      } else {
        barHeight = high * 0.8;
      }
      barHeight += sin(time * 2.0 + barIndex * 0.5) * 0.1;
      barHeight = abs(barHeight);
      
      float bar = step(abs(uv.y), barHeight) * step(0.1, barPos) * step(barPos, 0.9);
      
      vec3 col = mix(color1, color2, abs(uv.y));
      col = mix(col, color3, barIndex / barCount);
      col *= bar;
      col *= 0.7 + energy * 0.3;
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'geometric-kaleidoscope': `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform float bass;
    uniform float mid;
    uniform float high;
    uniform float energy;
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
      
      float segments = 6.0 + mid * 4.0;
      float angle = atan(uv.y, uv.x);
      angle = mod(angle, 6.28318 / segments);
      angle = abs(angle - 3.14159 / segments);
      
      float dist = length(uv);
      vec2 newUv = vec2(cos(angle), sin(angle)) * dist;
      
      float pattern = sin(newUv.x * 10.0 + time * 2.0) * sin(newUv.y * 10.0 - time);
      pattern += sin(dist * 20.0 - time * 3.0 * (1.0 + bass * 0.5)) * 0.5;
      pattern = pattern * 0.5 + 0.5;
      
      vec3 col = mix(color1, color2, pattern);
      col = mix(col, color3, sin(time + dist * 5.0) * 0.5 + 0.5);
      col *= 0.5 + energy * 0.5;
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  
  'cosmic-web': `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform float bass;
    uniform float mid;
    uniform float high;
    uniform float energy;
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
      
      vec3 col = vec3(0.0);
      
      for (float i = 0.0; i < 8.0; i++) {
        for (float j = 0.0; j < 8.0; j++) {
          vec2 node = vec2(
            (i - 4.0) * 0.25 + sin(time * 0.5 + i) * 0.1 * (1.0 + bass),
            (j - 4.0) * 0.25 + cos(time * 0.5 + j) * 0.1 * (1.0 + mid)
          );
          
          float dist = length(uv - node);
          float glow = 0.01 / (dist * dist + 0.001);
          
          vec3 nodeCol = mix(color1, color2, hash(vec2(i, j)));
          col += nodeCol * glow * (0.3 + high * 0.2);
        }
      }
      
      col *= 0.5 + energy * 0.5;
      col = clamp(col, 0.0, 1.0);
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
    ];
  }
  return [1, 0, 1];
}

export function GLVisualizer() {
  const { settings } = useVisualizerStore();
  const audioBands = useAudioAnalysis();
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const startTimeRef = useRef(Date.now());
  const animationFrameRef = useRef<number | null>(null);

  const getFragmentShader = (preset: VisualPreset): string => {
    return FRAGMENT_SHADERS[preset] || FRAGMENT_SHADERS['energy-rings'];
  };

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    glRef.current = gl;
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, VERTEX_SHADER);
    gl.compileShader(vertexShader);
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, getFragmentShader(settings.preset));
    gl.compileShader(fragmentShader);
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);
    programRef.current = program;
    
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    
    render();
  };

  const render = () => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    const time = (Date.now() - startTimeRef.current) / 1000;
    
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const colors = settings.colorPalette;
    const color1 = hexToRgb(colors[0] || '#ff006e');
    const color2 = hexToRgb(colors[1] || '#8338ec');
    const color3 = hexToRgb(colors[2] || '#3a86ff');

    gl.uniform2f(gl.getUniformLocation(program, 'resolution'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(gl.getUniformLocation(program, 'time'), time * settings.speed);
    gl.uniform1f(gl.getUniformLocation(program, 'bass'), audioBands.bass * settings.intensity);
    gl.uniform1f(gl.getUniformLocation(program, 'mid'), audioBands.mid * settings.intensity);
    gl.uniform1f(gl.getUniformLocation(program, 'high'), audioBands.high * settings.intensity);
    gl.uniform1f(gl.getUniformLocation(program, 'energy'), audioBands.energy * settings.intensity);
    gl.uniform3f(gl.getUniformLocation(program, 'color1'), color1[0], color1[1], color1[2]);
    gl.uniform3f(gl.getUniformLocation(program, 'color2'), color2[0], color2[1], color2[2]);
    gl.uniform3f(gl.getUniformLocation(program, 'color3'), color3[0], color3[1], color3[2]);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.endFrameEXP();

    animationFrameRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const gl = glRef.current;
    if (!gl) return;
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, getFragmentShader(settings.preset));
    gl.compileShader(fragmentShader);
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, VERTEX_SHADER);
    gl.compileShader(vertexShader);
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);
    
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    
    programRef.current = program;
  }, [settings.preset]);

  return (
    <View style={styles.container}>
      <GLView
        style={styles.glView}
        onContextCreate={onContextCreate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  glView: {
    flex: 1,
  },
});
