export type ChangeLogEntry = {
  id: number;
  timestamp: string;
  source: string;
  key: string;
  previous: unknown;
  next: unknown;
  meta?: Record<string, unknown>;
};

const STORAGE_KEY = "experience-change-log-v1";
const MAX_ENTRIES = 5000;
const FLUSH_DELAY_MS = 350;

let loaded = false;
let entries: ChangeLogEntry[] = [];
let nextId = 1;
let flushTimer: number | null = null;

function cloneSafe<T>(value: T): T {
  if (value === undefined) return value;
  try {
    // structuredClone keeps arrays/objects usable without accidental mutation leaks.
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return value;
    }
  }
}

function toStableString(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as ChangeLogEntry[];
    if (!Array.isArray(parsed)) return;
    entries = parsed.slice(-MAX_ENTRIES);
    const lastId = entries.length ? entries[entries.length - 1].id : 0;
    nextId = Number.isFinite(lastId) ? lastId + 1 : 1;
  } catch {
    entries = [];
    nextId = 1;
  }
}

function scheduleFlush() {
  if (typeof window === "undefined") return;
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch {
      // Ignore storage quota errors; logging should never break rendering.
    }
  }, FLUSH_DELAY_MS);
}

export function isTrackedEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  return toStableString(a) === toStableString(b);
}

export function trackChange(
  source: string,
  key: string,
  previous: unknown,
  next: unknown,
  meta?: Record<string, unknown>,
) {
  ensureLoaded();
  if (isTrackedEqual(previous, next)) return;

  const entry: ChangeLogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    source,
    key,
    previous: cloneSafe(previous),
    next: cloneSafe(next),
    meta: meta ? cloneSafe(meta) : undefined,
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  scheduleFlush();
}

export function trackObjectDiff(
  source: string,
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  meta?: Record<string, unknown>,
) {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  keys.forEach((key) => {
    trackChange(source, key, previous[key], next[key], meta);
  });
}

export function getChangeLog(): ChangeLogEntry[] {
  ensureLoaded();
  return entries.slice();
}

export function clearChangeLog() {
  ensureLoaded();
  entries = [];
  nextId = 1;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // no-op
    }
  }
}

declare global {
  interface Window {
    __EXPERIENCE_CHANGE_LOG__?: {
      get: () => ChangeLogEntry[];
      clear: () => void;
      export: () => string;
    };
  }
}

if (typeof window !== "undefined" && !window.__EXPERIENCE_CHANGE_LOG__) {
  window.__EXPERIENCE_CHANGE_LOG__ = {
    get: () => getChangeLog(),
    clear: () => clearChangeLog(),
    export: () => JSON.stringify(getChangeLog(), null, 2),
  };
}
