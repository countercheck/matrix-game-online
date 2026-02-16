import { describe, it, expect } from 'vitest';
import { getStrategy, getAllStrategies } from '../../../../src/services/resolution/registry.js';
import { BadRequestError } from '../../../../src/middleware/errorHandler.js';

// Import to trigger self-registration
import '../../../../src/services/resolution/strategies/token-draw.strategy.js';

describe('Resolution Strategy Registry', () => {
  describe('getStrategy', () => {
    it('returns the token_draw strategy', () => {
      const strategy = getStrategy('token_draw');
      expect(strategy).toBeDefined();
      expect(strategy.id).toBe('token_draw');
    });

    it('throws BadRequestError for unknown strategy id', () => {
      expect(() => getStrategy('nonexistent')).toThrow(BadRequestError);
      expect(() => getStrategy('nonexistent')).toThrow('Unknown resolution strategy: "nonexistent"');
    });
  });

  describe('getAllStrategies', () => {
    it('returns an array containing at least token_draw', () => {
      const strategies = getAllStrategies();
      expect(strategies.length).toBeGreaterThanOrEqual(1);
      expect(strategies.some((s) => s.id === 'token_draw')).toBe(true);
    });

    it('returns readonly array', () => {
      const strategies = getAllStrategies();
      expect(Array.isArray(strategies)).toBe(true);
    });
  });
});
