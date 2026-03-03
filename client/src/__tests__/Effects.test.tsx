import { describe, it, expect } from 'vitest';

/**
 * Tests for the afterimage/darkOverlay logic used in AudioVisualizer.
 * The logic is:
 *   afterimageOn = (settings.trailsOn ?? false) || (settings.darkOverlay ?? false)
 *   trails = (settings.darkOverlay && !settings.trailsOn) ? 0.3 : (settings.trailsAmount ?? 0.75)
 */

function computeAfterimageOn(trailsOn: boolean, darkOverlay: boolean): boolean {
  return trailsOn || darkOverlay;
}

function computeTrailsAmount(trailsOn: boolean, darkOverlay: boolean, trailsAmount: number): number {
  return (darkOverlay && !trailsOn) ? 0.3 : trailsAmount;
}

describe('Effects afterimage/darkOverlay logic', () => {
  it('afterimageOn is true when trailsOn=true and darkOverlay=false', () => {
    expect(computeAfterimageOn(true, false)).toBe(true);
  });

  it('afterimageOn is true when trailsOn=false and darkOverlay=true', () => {
    expect(computeAfterimageOn(false, true)).toBe(true);
  });

  it('afterimageOn is true when both trailsOn=true and darkOverlay=true', () => {
    expect(computeAfterimageOn(true, true)).toBe(true);
  });

  it('afterimageOn is false when both are false', () => {
    expect(computeAfterimageOn(false, false)).toBe(false);
  });

  it('trails amount is 0.3 for darkOverlay-only (no trailsOn)', () => {
    expect(computeTrailsAmount(false, true, 0.75)).toBe(0.3);
  });

  it('trails amount is full trailsAmount when trailsOn is true', () => {
    expect(computeTrailsAmount(true, false, 0.75)).toBe(0.75);
    expect(computeTrailsAmount(true, true, 0.75)).toBe(0.75);
  });

  it('trails amount is full trailsAmount when both are off', () => {
    expect(computeTrailsAmount(false, false, 0.75)).toBe(0.75);
  });
});
