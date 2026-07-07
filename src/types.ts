/** A flat bag of custom properties. Values are coerced to strings on send. */
export type TelemetryProperties = Record<string, string | number | boolean | undefined>;

/** Numeric measurements attached to an event. */
export type TelemetryMeasurements = Record<string, number>;

export interface InitOptions {
  /**
   * Application Insights connection string. This is a public, client-side
   * ingestion key (write-only) — it is expected to ship in the browser bundle.
   */
  connectionString: string;
  /**
   * Master kill switch. When `false`, nothing initializes and no telemetry is
   * ever sent. Default `true`.
   */
  enabled?: boolean;
  /** Sampling rate 0..1 applied per item. Default `1` (send everything). */
  samplingRate?: number;
  /** Optional role name (surfaces as `cloud_RoleName` in Application Insights). */
  cloudRole?: string;
  /** Send a page view automatically on init. Default `true`. */
  autoPageView?: boolean;
  /** Beacon transport: max ms to buffer before flushing. Default `5000`. */
  flushIntervalMs?: number;
  /** Beacon transport: max buffered items before an immediate flush. Default `50`. */
  maxBatchSize?: number;
}

/** The uniform analytics API returned by every transport (beacon or SDK). */
export interface Analytics {
  /** Whether tracking is currently active. */
  readonly enabled: boolean;
  /** Enable/disable tracking at runtime. */
  setEnabled(enabled: boolean): void;
  /** Track a custom event with optional properties and numeric measurements. */
  trackEvent(name: string, properties?: TelemetryProperties, measurements?: TelemetryMeasurements): void;
  /** Track a page view (defaults to the current document title + URL in the browser). */
  trackPageView(name?: string, uri?: string, properties?: TelemetryProperties): void;
  /**
   * Debounced, keyed event — collapses a burst (slider drags, typing) into one
   * event once activity settles.
   */
  trackChangeDebounced(name: string, key: string, delayMs?: number): void;
  /** Force-send any buffered telemetry (beacon transport; SDK self-flushes). */
  flush(): void;
}
