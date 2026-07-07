import type { ApplicationInsights } from '@microsoft/applicationinsights-web';
import type { Analytics, InitOptions } from './types';
import { clamp01, cleanProperties, createDebouncer, isBrowser } from './core';

/**
 * Application Insights JavaScript SDK adapter — the same {@link Analytics} API
 * as the beacon client, but backed by `@microsoft/applicationinsights-web`
 * (install it as a dependency). Configured cookieless: `disableCookiesUsage`
 * plus no session/local storage, so there is no persistent identifier and no
 * consent banner is required. Returns a no-op client when disabled, outside a
 * browser, or when the peer dependency is missing.
 */
export async function initAppInsights(options: InitOptions): Promise<Analytics> {
  const debounce = createDebouncer();
  let enabled = options.enabled !== false && isBrowser() && !!options.connectionString;
  let ai: ApplicationInsights | null = null;

  if (enabled) {
    try {
      const mod = await import('@microsoft/applicationinsights-web');
      ai = new mod.ApplicationInsights({
        config: {
          connectionString: options.connectionString,
          disableCookiesUsage: true,
          enableSessionStorageBuffer: false,
          autoTrackPageVisitTime: true,
          enableAutoRouteTracking: false,
          disableAjaxTracking: true,
          disableFetchTracking: true,
          enableUnhandledPromiseRejectionTracking: true,
          samplingPercentage: Math.round(clamp01(options.samplingRate ?? 1) * 100),
        },
      });
      ai.loadAppInsights();
      if (options.cloudRole) {
        const role = options.cloudRole;
        ai.addTelemetryInitializer((item) => {
          const it = item as { tags?: Record<string, unknown> };
          it.tags = it.tags || {};
          it.tags['ai.cloud.role'] = role;
        });
      }
      if (options.autoPageView !== false) ai.trackPageView();
    } catch {
      // Peer dependency missing or failed to load — degrade to a safe no-op.
      ai = null;
      enabled = false;
    }
  }

  const api: Analytics = {
    get enabled() {
      return enabled && !!ai;
    },
    setEnabled(next: boolean) {
      enabled = next && !!ai;
    },
    trackEvent(name, properties, measurements) {
      if (enabled) ai?.trackEvent({ name, properties: cleanProperties(properties), measurements });
    },
    trackPageView(name, uri, properties) {
      if (enabled) ai?.trackPageView({ name, uri, properties: cleanProperties(properties) });
    },
    trackChangeDebounced(name, key, delayMs = 700) {
      if (!enabled) return;
      debounce(`${name}::${key}`, () => api.trackEvent(name, { key }), delayMs);
    },
    flush() {
      ai?.flush();
    },
  };

  return api;
}
