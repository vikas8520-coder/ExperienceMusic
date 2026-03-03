import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver (needed by Radix UI)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as any;

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = IntersectionObserverMock as any;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Three.js / R3F Canvas
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => children,
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({
    gl: {},
    scene: {},
    camera: {},
    size: { width: 800, height: 600 },
  })),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Environment: () => null,
  useTexture: vi.fn(),
}));

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children }: any) => children,
  Bloom: () => null,
  ChromaticAberration: () => null,
  Noise: () => null,
  Vignette: () => null,
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => {
      if (prop === '__esModule') return true;
      // Return a simple component for any motion.element
      return ({ children, ...props }: any) => {
        const { initial, animate, exit, transition, whileHover, whileTap, layout, variants, ...domProps } = props;
        const tag = typeof prop === 'string' ? prop : 'div';
        const element = require('react').createElement(tag, domProps, children);
        return element;
      };
    },
  }),
  AnimatePresence: ({ children }: any) => children,
  useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
  useMotionValue: (v: number) => ({ get: () => v, set: vi.fn() }),
  useTransform: (v: any) => v,
}));

// Mock audio context
const AudioContextMock = vi.fn(() => ({
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 2048,
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  })),
  createMediaElementSource: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { value: 1 },
  })),
  destination: {},
  close: vi.fn(),
}));

global.AudioContext = AudioContextMock as any;
(global as any).webkitAudioContext = AudioContextMock;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();
