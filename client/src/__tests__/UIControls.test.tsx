import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock all the heavy dependencies before importing UIControls
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/visualizer-presets', () => ({
  colorPalettes: [{ name: 'Neon', colors: ['#ff0000', '#00ff00', '#0000ff'] }],
  presets: [],
  presetCategories: [],
  imageFilters: [],
  psyOverlays: [],
  colorModes: [],
  moodPresets: [],
  defaultColorSettings: {
    mode: 'gradient' as const,
    primaryColor: '#ff0000',
    secondaryColor: '#0000ff',
    tertiaryColor: '#00ff00',
    moodPreset: 'energetic' as const,
    spectrumSpeed: 1,
  },
  generateColorPalette: () => ['#ff0000', '#00ff00', '#0000ff'],
}));

vi.mock('@/engine/presets/ControlPanel', () => ({
  ControlPanel: () => null,
}));

vi.mock('@/engine/presets/PerformOverlay', () => ({
  PerformOverlay: () => null,
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/'],
}));

import { UIControls } from '../components/UIControls';

const defaultSettings = {
  intensity: 1.0,
  speed: 0.5,
  colorPalette: ['#ff0000', '#00ff00', '#0000ff'],
  presetName: 'Energy Rings' as any,
  presetEnabled: true,
  imageFilters: ['none' as any],
  psyOverlays: [] as any[],
  trailsOn: false,
  darkOverlay: false,
  trailsAmount: 0.75,
  glowEnabled: true,
  glowIntensity: 1.0,
};

const defaultColorSettings = {
  mode: 'gradient' as const,
  primaryColor: '#ff0000',
  secondaryColor: '#0000ff',
  tertiaryColor: '#00ff00',
  moodPreset: 'energetic' as const,
  customColors: [] as string[],
  aiColors: [] as string[],
  spectrumSpeed: 1,
  spectrumOffset: 0,
};

function renderUIControls(overrides: Record<string, any> = {}) {
  const setSettings = vi.fn((updater: any) => {
    if (typeof updater === 'function') {
      return updater(defaultSettings);
    }
    return updater;
  });
  const onSavePreset = vi.fn();

  const props = {
    isPlaying: false,
    onPlayPause: vi.fn(),
    onFileUpload: vi.fn(),
    settings: { ...defaultSettings, ...overrides.settings },
    setSettings,
    colorSettings: defaultColorSettings,
    setColorSettings: vi.fn(),
    isRecording: false,
    onToggleRecording: vi.fn(),
    onSavePreset,
    activeTab: 'create' as const,
    onActiveTabChange: vi.fn(),
    ...overrides,
  };

  const result = render(<UIControls {...props} />);
  return { ...result, setSettings, onSavePreset };
}

/** Helper: open a collapsed accordion section by clicking its toggle */
async function openSection(user: ReturnType<typeof userEvent.setup>, testId: string) {
  await user.click(screen.getByTestId(`button-toggle-section-${testId}`));
}

describe('UIControls', () => {
  describe('Save Preset button', () => {
    it('renders Save Preset button in Create tab (always visible)', () => {
      renderUIControls();
      expect(screen.getByTestId('button-save-preset')).toBeInTheDocument();
      expect(screen.getByTestId('button-save-preset')).toHaveTextContent('Save Preset');
    });

    it('calls onSavePreset when Save Preset button is clicked', async () => {
      const user = userEvent.setup();
      const { onSavePreset } = renderUIControls();
      await user.click(screen.getByTestId('button-save-preset'));
      expect(onSavePreset).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dark Overlay toggle', () => {
    it('renders Dark Overlay toggle after opening Effects section', async () => {
      const user = userEvent.setup();
      renderUIControls();
      await openSection(user, 'effects');
      expect(screen.getByTestId('toggle-dark-overlay')).toBeInTheDocument();
    });

    it('Dark Overlay toggle is unchecked by default', async () => {
      const user = userEvent.setup();
      renderUIControls();
      await openSection(user, 'effects');
      const toggle = screen.getByTestId('toggle-dark-overlay');
      expect(toggle).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('Motion Trails toggle', () => {
    it('renders Motion Trails toggle after opening Effects section', async () => {
      const user = userEvent.setup();
      renderUIControls();
      await openSection(user, 'effects');
      expect(screen.getByTestId('toggle-trails')).toBeInTheDocument();
    });

    it('Motion Trails toggle is unchecked by default', async () => {
      const user = userEvent.setup();
      renderUIControls();
      await openSection(user, 'effects');
      const toggle = screen.getByTestId('toggle-trails');
      expect(toggle).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('CollapsibleSection accordion', () => {
    it('Presets section is open by default', () => {
      renderUIControls();
      expect(screen.getByTestId('section-presets')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-preset-enabled')).toBeInTheDocument();
    });

    it('Effects section is collapsed by default', () => {
      renderUIControls();
      expect(screen.getByTestId('section-effects')).toBeInTheDocument();
      expect(screen.queryByTestId('toggle-dark-overlay')).not.toBeInTheDocument();
    });

    it('clicking section header toggles content visibility', async () => {
      const user = userEvent.setup();
      renderUIControls();
      // Effects is collapsed — open it
      expect(screen.queryByTestId('toggle-trails')).not.toBeInTheDocument();
      await openSection(user, 'effects');
      expect(screen.getByTestId('toggle-trails')).toBeInTheDocument();
      // Close it again
      await openSection(user, 'effects');
      expect(screen.queryByTestId('toggle-trails')).not.toBeInTheDocument();
    });
  });
});
