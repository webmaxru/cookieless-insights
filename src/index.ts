import { createBeaconClient } from './beacon';
import type { Analytics, InitOptions, TelemetryMeasurements, TelemetryProperties } from './types';

export type { Analytics, InitOptions, TelemetryMeasurements, TelemetryProperties } from './types';
export { createBeaconClient } from './beacon';
export { parseConnectionString } from './core';
export type { ParsedConnectionString } from './core';

let singleton: Analytics | null = null;

/**
 * Initialize the default (beacon) analytics client once. Safe to call
 * repeatedly — subsequent calls return the existing client. The returned client
 * is a safe no-op when disabled or outside a browser.
 */
export function init(options: InitOptions): Analytics {
  if (!singleton) singleton = createBeaconClient(options);
  return singleton;
}

/** The active client, or `null` if {@link init} hasn't been called yet. */
export function getClient(): Analytics | null {
  return singleton;
}

export function trackEvent(
  name: string,
  properties?: TelemetryProperties,
  measurements?: TelemetryMeasurements,
): void {
  singleton?.trackEvent(name, properties, measurements);
}

export function trackPageView(name?: string, uri?: string, properties?: TelemetryProperties): void {
  singleton?.trackPageView(name, uri, properties);
}

export function trackChangeDebounced(name: string, key: string, delayMs?: number): void {
  singleton?.trackChangeDebounced(name, key, delayMs);
}

export function flush(): void {
  singleton?.flush();
}

export function setEnabled(enabled: boolean): void {
  singleton?.setEnabled(enabled);
}
