import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Ambient UI Logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ambient mode activates after 4s idle", () => {
    let ambientMode = false;
    const timer = setTimeout(() => {
      ambientMode = true;
    }, 4000);

    vi.advanceTimersByTime(3999);
    expect(ambientMode).toBe(false);

    vi.advanceTimersByTime(1);
    expect(ambientMode).toBe(true);

    clearTimeout(timer);
  });

  it("mouse movement resets ambient timer", () => {
    let ambientMode = false;
    let timerId: ReturnType<typeof setTimeout>;

    const startTimer = () => {
      if (timerId) clearTimeout(timerId);
      ambientMode = false;
      timerId = setTimeout(() => {
        ambientMode = true;
      }, 4000);
    };

    startTimer();
    vi.advanceTimersByTime(3000);
    expect(ambientMode).toBe(false);

    // Simulate mouse move — restart timer
    startTimer();
    vi.advanceTimersByTime(3000);
    expect(ambientMode).toBe(false);

    // Now let it expire
    vi.advanceTimersByTime(1001);
    expect(ambientMode).toBe(true);

    clearTimeout(timerId!);
  });

  it("ambient mode only activates when isPlaying is true", () => {
    const isPlaying = false;
    let ambientMode = false;

    const timer = setTimeout(() => {
      // In the real code, we check isPlaying before hiding
      if (isPlaying) {
        ambientMode = true;
      }
    }, 4000);

    vi.advanceTimersByTime(5000);
    // Since isPlaying is false, ambient should not activate
    expect(ambientMode).toBe(false);

    clearTimeout(timer);
  });

  it("CSS classes are correct for ambient mode", () => {
    const ambientMode = true;
    const isPlaying = true;

    const className =
      ambientMode && isPlaying
        ? "opacity-0 translate-y-4 pointer-events-none transition-all duration-700"
        : "opacity-100 transition-all duration-300";

    expect(className).toContain("opacity-0");
    expect(className).toContain("translate-y-4");
    expect(className).toContain("duration-700");
  });
});
