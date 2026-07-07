import { describe, expect, it, vi } from 'vitest';
import {
  clamp01,
  cleanProperties,
  createDebouncer,
  parseConnectionString,
  uuid,
} from '../src/core';

describe('parseConnectionString', () => {
  it('parses key + ingestion endpoint and trims the trailing slash', () => {
    const p = parseConnectionString(
      'InstrumentationKey=00000000-0000-0000-0000-000000000abc;IngestionEndpoint=https://x.ingest.test/;LiveEndpoint=https://y/',
    );
    expect(p).toEqual({
      instrumentationKey: '00000000-0000-0000-0000-000000000abc',
      ingestionEndpoint: 'https://x.ingest.test',
    });
  });

  it('is case-insensitive on keys', () => {
    const p = parseConnectionString('instrumentationkey=abc;ingestionendpoint=https://z/');
    expect(p?.instrumentationKey).toBe('abc');
    expect(p?.ingestionEndpoint).toBe('https://z');
  });

  it('returns null without an instrumentation key', () => {
    expect(parseConnectionString('IngestionEndpoint=https://x/')).toBeNull();
    expect(parseConnectionString('')).toBeNull();
    expect(parseConnectionString(undefined)).toBeNull();
  });

  it('falls back to the classic endpoint when none is provided', () => {
    expect(parseConnectionString('InstrumentationKey=abc')?.ingestionEndpoint).toBe(
      'https://dc.services.visualstudio.com',
    );
  });
});

describe('cleanProperties', () => {
  it('coerces to strings and drops nullish', () => {
    expect(cleanProperties({ a: 1, b: true, c: 'x', d: undefined })).toEqual({
      a: '1',
      b: 'true',
      c: 'x',
    });
  });
  it('returns undefined for empty/absent input', () => {
    expect(cleanProperties(undefined)).toBeUndefined();
    expect(cleanProperties({ a: undefined })).toBeUndefined();
  });
});

describe('clamp01', () => {
  it('clamps to [0,1] and defaults non-finite to 1', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(NaN)).toBe(1);
  });
});

describe('uuid', () => {
  it('produces a v4-shaped id', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe('createDebouncer', () => {
  it('collapses a burst into a single trailing call', () => {
    vi.useFakeTimers();
    const debounce = createDebouncer();
    const fn = vi.fn();
    debounce('k', fn, 700);
    debounce('k', fn, 700);
    debounce('k', fn, 700);
    vi.advanceTimersByTime(699);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('keeps distinct keys independent', () => {
    vi.useFakeTimers();
    const debounce = createDebouncer();
    const fn = vi.fn();
    debounce('a', fn, 500);
    debounce('b', fn, 500);
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
