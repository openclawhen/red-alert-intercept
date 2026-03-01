import { describe, expect, it } from 'vitest';
import { isPointInsideRadius } from './hit';

describe('isPointInsideRadius', () => {
  it('returns true for points inside circle', () => {
    expect(isPointInsideRadius(10, 10, 10, 10, 5)).toBe(true);
    expect(isPointInsideRadius(13, 14, 10, 10, 5)).toBe(true);
  });

  it('returns false for points outside circle', () => {
    expect(isPointInsideRadius(20, 20, 10, 10, 5)).toBe(false);
  });
});
