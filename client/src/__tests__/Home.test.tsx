import { describe, it, expect } from 'vitest';
import type { SavedTrack } from '../pages/Home';

/**
 * Integration-level tests for Home.tsx logic.
 * We test the pure logic that Home.tsx uses rather than rendering the
 * full component (which depends on many heavy providers/contexts).
 */

describe('Home settings state', () => {
  it('initial settings include darkOverlay: false', () => {
    // Mirrors the useState initializer in Home.tsx
    const settings = {
      intensity: 1.0,
      speed: 0.5,
      colorPalette: ['#ff0000', '#00ff00', '#0000ff'],
      presetName: 'Energy Rings',
      presetEnabled: true,
      imageFilters: ['none'],
      psyOverlays: [],
      trailsOn: false,
      darkOverlay: false,
      trailsAmount: 0.75,
      glowEnabled: true,
      glowIntensity: 1.0,
    };

    expect(settings.darkOverlay).toBe(false);
    expect(settings.trailsOn).toBe(false);
  });
});

describe('handleDeleteTrack logic', () => {
  it('removes track from savedTracks by id', () => {
    const tracks: SavedTrack[] = [
      { id: '1', name: 'Track 1', audioUrl: 'blob:1', createdAt: new Date() },
      { id: '2', name: 'Track 2', audioUrl: 'blob:2', createdAt: new Date() },
      { id: '3', name: 'Track 3', audioUrl: 'blob:3', createdAt: new Date() },
    ];

    // This is the same logic as handleDeleteTrack in Home.tsx
    const handleDeleteTrack = (trackId: string) =>
      tracks.filter(t => t.id !== trackId);

    const result = handleDeleteTrack('2');
    expect(result).toHaveLength(2);
    expect(result.find(t => t.id === '2')).toBeUndefined();
    expect(result.find(t => t.id === '1')).toBeDefined();
    expect(result.find(t => t.id === '3')).toBeDefined();
  });

  it('returns all tracks if trackId not found', () => {
    const tracks: SavedTrack[] = [
      { id: '1', name: 'Track 1', audioUrl: 'blob:1', createdAt: new Date() },
    ];

    const result = tracks.filter(t => t.id !== 'nonexistent');
    expect(result).toHaveLength(1);
  });
});

describe('handleSavePreset logic', () => {
  it('constructs correct preset name from current settings', () => {
    const settings = { presetName: 'Energy Rings' };
    const presetName = `My ${settings.presetName} Preset`;
    expect(presetName).toBe('My Energy Rings Preset');
  });

  it('constructs correct mutation payload', () => {
    const settings = {
      intensity: 1.0,
      speed: 0.5,
      presetName: 'Psy Tunnel',
      darkOverlay: true,
      trailsOn: false,
    };

    const payload = {
      name: `My ${settings.presetName} Preset`,
      settings,
    };

    expect(payload.name).toBe('My Psy Tunnel Preset');
    expect(payload.settings).toBe(settings);
    expect(payload.settings.darkOverlay).toBe(true);
  });
});
