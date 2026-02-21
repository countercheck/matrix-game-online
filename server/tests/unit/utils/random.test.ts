import { describe, it, expect } from 'vitest';
import { rollDie, getSecureRandomInt } from '../../../src/utils/random.js';

describe('rollDie', () => {
  it('returns values in [1, 6] for default face count over many rolls', () => {
    for (let i = 0; i < 500; i++) {
      const result = rollDie();
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    }
  });

  it('returns values in [1, faces] for a custom face count', () => {
    const faces = 20;
    for (let i = 0; i < 500; i++) {
      const result = rollDie(faces);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(faces);
    }
  });

  it('covers the full range of a standard six-sided die', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      seen.add(rollDie());
    }
    expect(seen.size).toBe(6);
  });
});

describe('getSecureRandomInt', () => {
  it('returns values in [min, max] inclusive', () => {
    const min = 3;
    const max = 10;
    for (let i = 0; i < 500; i++) {
      const result = getSecureRandomInt(min, max);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
    }
  });

  it('returns exactly min when min === max', () => {
    const result = getSecureRandomInt(7, 7);
    expect(result).toBe(7);
  });

  it('works correctly for a range starting at 0', () => {
    for (let i = 0; i < 200; i++) {
      const result = getSecureRandomInt(0, 4);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(4);
    }
  });

  it('throws RangeError when min > max', () => {
    expect(() => getSecureRandomInt(10, 5)).toThrowError(RangeError);
    expect(() => getSecureRandomInt(10, 5)).toThrowError(
      'getSecureRandomInt: invalid range [10, 5]',
    );
  });

  it('throws RangeError for non-integer min', () => {
    expect(() => getSecureRandomInt(1.5, 5)).toThrowError(RangeError);
    expect(() => getSecureRandomInt(1.5, 5)).toThrowError(
      'getSecureRandomInt: invalid range [1.5, 5]',
    );
  });

  it('throws RangeError for non-integer max', () => {
    expect(() => getSecureRandomInt(1, 5.9)).toThrowError(RangeError);
    expect(() => getSecureRandomInt(1, 5.9)).toThrowError(
      'getSecureRandomInt: invalid range [1, 5.9]',
    );
  });

  it('throws RangeError for both inputs non-integer', () => {
    expect(() => getSecureRandomInt(0.5, 2.5)).toThrowError(RangeError);
  });
});
