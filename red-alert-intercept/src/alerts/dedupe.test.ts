import { describe, expect, it } from 'vitest';
import { AlertDeduper } from './dedupe';
import type { AlertEvent } from '../types';

describe('AlertDeduper', () => {
  it('emits first event and blocks duplicate id+timestamp', () => {
    const d = new AlertDeduper();
    const event: AlertEvent = { id: 'a', timestamp: 1, areas: [], level: 'red', raw: {} };

    expect(d.shouldEmit(event)).toBe(true);
    expect(d.shouldEmit(event)).toBe(false);
  });
});
