import type { Analytics, InitOptions, TelemetryMeasurements, TelemetryProperties } from './types';
import { clamp01, cleanProperties, createDebouncer, isBrowser, parseConnectionString, uuid } from './core';

const SDK_VERSION = 'cookieless-insights-beacon:0.1.0';

interface Envelope {
  name: string;
  time: string;
  iKey: string;
  tags: Record<string, string>;
  data: { baseType: string; baseData: Record<string, unknown> };
}

/**
 * Ultra-lite, dependency-free transport. Builds Application Insights envelopes
 * and posts them to the ingestion endpoint via `navigator.sendBeacon` (or
 * `fetch` with `keepalive`). Cookieless by construction: it never reads or
 * writes cookies, localStorage, or sessionStorage, and keeps only an in-memory
 * session id — so no consent banner is required.
 */
export function createBeaconClient(options: InitOptions): Analytics {
  const parsed = parseConnectionString(options.connectionString);
  const samplingRate = clamp01(options.samplingRate ?? 1);
  const flushIntervalMs = options.flushIntervalMs ?? 5000;
  const maxBatchSize = options.maxBatchSize ?? 50;

  const ikey = parsed?.instrumentationKey ?? '';
  const normalizedIkey = ikey.replace(/-/g, '');
  const trackUrl = parsed ? `${parsed.ingestionEndpoint}/v2.1/track` : '';
  const sessionId = uuid();
  const debounce = createDebouncer();

  let enabled = options.enabled !== false && !!parsed && isBrowser();
  let buffer: Envelope[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const baseTags = (): Record<string, string> => {
    const tags: Record<string, string> = {
      'ai.session.id': sessionId,
      'ai.device.type': 'Browser',
      'ai.internal.sdkVersion': SDK_VERSION,
    };
    if (options.cloudRole) tags['ai.cloud.role'] = options.cloudRole;
    if (isBrowser()) tags['ai.operation.name'] = document.title || location.pathname;
    return tags;
  };

  const envelope = (typeName: string, baseType: string, baseData: Record<string, unknown>): Envelope => ({
    name: `Microsoft.ApplicationInsights.${normalizedIkey}.${typeName}`,
    time: new Date().toISOString(),
    iKey: ikey,
    tags: baseTags(),
    data: { baseType, baseData },
  });

  // text/plain avoids a CORS preflight and lets sendBeacon carry the payload.
  const post = (body: string): void => {
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    if (nav && typeof nav.sendBeacon === 'function') {
      try {
        if (nav.sendBeacon(trackUrl, body)) return;
      } catch {
        /* fall through to fetch */
      }
    }
    try {
      void fetch(trackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
        keepalive: true,
        credentials: 'omit',
        mode: 'cors',
      }).catch(() => {
        /* analytics must never throw */
      });
    } catch {
      /* ignore */
    }
  };

  const flush = (): void => {
    if (!buffer.length || !trackUrl) return;
    const items = buffer;
    buffer = [];
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    post(JSON.stringify(items));
  };

  const scheduleFlush = (): void => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, flushIntervalMs);
  };

  const enqueue = (e: Envelope): void => {
    if (!enabled) return;
    if (samplingRate < 1 && Math.random() > samplingRate) return;
    buffer.push(e);
    if (buffer.length >= maxBatchSize) flush();
    else scheduleFlush();
  };

  // Flush on tab hide / page unload so short visits aren't lost.
  if (enabled && isBrowser()) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
  }

  const api: Analytics = {
    get enabled() {
      return enabled;
    },
    setEnabled(next: boolean) {
      enabled = next && !!parsed && isBrowser();
      if (!enabled) buffer = [];
    },
    trackEvent(name: string, properties?: TelemetryProperties, measurements?: TelemetryMeasurements) {
      enqueue(envelope('Event', 'EventData', {
        ver: 2,
        name,
        properties: cleanProperties(properties),
        measurements,
      }));
    },
    trackPageView(name?: string, uri?: string, properties?: TelemetryProperties) {
      enqueue(envelope('PageView', 'PageViewData', {
        ver: 2,
        name: name ?? (isBrowser() ? document.title : 'page'),
        url: uri ?? (isBrowser() ? location.href : undefined),
        id: uuid(),
        properties: cleanProperties(properties),
      }));
    },
    trackChangeDebounced(name: string, key: string, delayMs = 700) {
      if (!enabled) return;
      debounce(`${name}::${key}`, () => api.trackEvent(name, { key }), delayMs);
    },
    flush,
  };

  if (options.autoPageView !== false) api.trackPageView();
  return api;
}
