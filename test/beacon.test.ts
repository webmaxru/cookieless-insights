import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBeaconClient } from '../src/beacon';

const CS =
  'InstrumentationKey=abcd1234-0000-0000-0000-00000000abcd;IngestionEndpoint=https://example.ingest.test/';
const TRACK_URL = 'https://example.ingest.test/v2.1/track';

let beaconMock: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  beaconMock = vi.fn(() => true);
  try {
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beaconMock });
  } catch {
    /* jsdom may lock it; fetch path is covered instead */
  }
  fetchMock = vi.fn(async () => ({ status: 200, text: async () => '' }));
  vi.stubGlobal('fetch', fetchMock);
  document.title = 'Test Page';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Items sent via whichever transport was used (sendBeacon preferred, else fetch). */
function sentItems(): Array<Record<string, unknown>> {
  const b = beaconMock.mock.calls.at(-1);
  if (b) return JSON.parse(b[1] as string);
  const f = fetchMock.mock.calls.at(-1);
  if (f) return JSON.parse((f[1] as { body: string }).body);
  return [];
}
function sendCount(): number {
  return beaconMock.mock.calls.length + fetchMock.mock.calls.length;
}
function sentUrl(): string | undefined {
  const b = beaconMock.mock.calls.at(-1);
  if (b) return b[0] as string;
  const f = fetchMock.mock.calls.at(-1);
  return f?.[0] as string | undefined;
}

describe('createBeaconClient', () => {
  it('sends an auto page view on init to /v2.1/track', () => {
    const a = createBeaconClient({ connectionString: CS });
    a.flush();
    expect(sendCount()).toBe(1);
    expect(sentUrl()).toBe(TRACK_URL);
    const items = sentItems();
    expect(items[0]!.name).toContain('.PageView');
    expect(items[0]!.iKey).toBe('abcd1234-0000-0000-0000-00000000abcd');
    expect((items[0]!.data as { baseType: string }).baseType).toBe('PageViewData');
    // envelope name uses the dash-stripped ikey
    const nik = 'abcd1234-0000-0000-0000-00000000abcd'.replace(/-/g, '');
    expect(items[0]!.name).toBe(`Microsoft.ApplicationInsights.${nik}.PageView`);
  });

  it('tracks an event, coerces properties to strings, shares a session id', () => {
    const a = createBeaconClient({ connectionString: CS, autoPageView: false });
    a.trackEvent('Clicked', { count: 3, ok: true, skip: undefined });
    a.trackEvent('Second');
    a.flush();
    const items = sentItems();
    expect(items).toHaveLength(2);
    const first = items[0] as { data: { baseType: string; baseData: Record<string, unknown> }; tags: Record<string, string> };
    expect(first.data.baseType).toBe('EventData');
    expect(first.data.baseData.name).toBe('Clicked');
    expect(first.data.baseData.properties).toEqual({ count: '3', ok: 'true' });
    const s1 = first.tags['ai.session.id'];
    const s2 = (items[1] as { tags: Record<string, string> }).tags['ai.session.id'];
    expect(s1).toBeTruthy();
    expect(s1).toBe(s2);
  });

  it('is cookieless — never touches cookies, localStorage, or sessionStorage', () => {
    const a = createBeaconClient({ connectionString: CS });
    a.trackEvent('X', { a: 1 });
    a.trackPageView();
    a.flush();
    expect(document.cookie).toBe('');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('kill switch: enabled=false sends nothing', () => {
    const a = createBeaconClient({ connectionString: CS, enabled: false });
    a.trackEvent('X');
    a.trackPageView();
    a.flush();
    expect(sendCount()).toBe(0);
    expect(a.enabled).toBe(false);
  });

  it('setEnabled(false) stops sending', () => {
    const a = createBeaconClient({ connectionString: CS, autoPageView: false });
    a.setEnabled(false);
    a.trackEvent('X');
    a.flush();
    expect(sendCount()).toBe(0);
  });

  it('sampling rate 0 drops everything', () => {
    const a = createBeaconClient({ connectionString: CS, autoPageView: false, samplingRate: 0 });
    a.trackEvent('X');
    a.flush();
    expect(sendCount()).toBe(0);
  });

  it('is a no-op with an invalid connection string', () => {
    const a = createBeaconClient({ connectionString: 'garbage' });
    a.trackEvent('X');
    a.flush();
    expect(sendCount()).toBe(0);
    expect(a.enabled).toBe(false);
  });

  it('is a no-op when connectionString is omitted', () => {
    const a = createBeaconClient({});
    a.trackEvent('X');
    a.flush();
    expect(sendCount()).toBe(0);
    expect(a.enabled).toBe(false);
  });
});
