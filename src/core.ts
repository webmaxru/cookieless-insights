import type { TelemetryProperties } from './types';

export interface ParsedConnectionString {
  instrumentationKey: string;
  /** Ingestion endpoint with any trailing slash removed. */
  ingestionEndpoint: string;
}

/** Parse an Application Insights connection string into its key + ingestion endpoint. */
export function parseConnectionString(cs: string | undefined | null): ParsedConnectionString | null {
  if (!cs) return null;
  const parts: Record<string, string> = {};
  for (const kv of cs.split(';')) {
    const i = kv.indexOf('=');
    if (i > 0) parts[kv.slice(0, i).trim().toLowerCase()] = kv.slice(i + 1).trim();
  }
  const instrumentationKey = parts['instrumentationkey'];
  if (!instrumentationKey) return null;
  const endpoint = parts['ingestionendpoint'] || 'https://dc.services.visualstudio.com';
  return { instrumentationKey, ingestionEndpoint: endpoint.replace(/\/+$/, '') };
}

/** True only in a real browser context (guards SSR / Node / test environments). */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** RFC-4122-ish id; prefers `crypto.randomUUID` and falls back to Math.random. */
export function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

/** Drop nullish props and coerce values to strings (Application Insights properties are strings). */
export function cleanProperties(props?: TelemetryProperties): Record<string, string> | undefined {
  if (!props) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Create a per-client debouncer keyed by an id. */
export function createDebouncer(): (id: string, fn: () => void, delayMs: number) => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return (id, fn, delayMs) => {
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    timers.set(id, setTimeout(() => {
      timers.delete(id);
      fn();
    }, delayMs));
  };
}
