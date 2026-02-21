import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/utils/random.js', () => ({
  getSecureRandomInt: vi.fn(),
  rollDie: vi.fn(),
}));

import * as randomUtils from '../../../../src/utils/random.js';
import '../../../../src/services/resolution/strategies/arbiter.strategy.js';
import { getStrategy } from '../../../../src/services/resolution/registry.js';
import type { ArbiterResolutionStrategy } from '../../../../src/services/resolution/resolution-strategy.js';

describe('ArbiterStrategy', () => {
  const strategy = getStrategy('arbiter') as ArbiterResolutionStrategy;
  const mockRollDie = vi.mocked(randomUtils.rollDie);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('metadata', () => {
    it('has the correct id', () => {
      expect(strategy.id).toBe('arbiter');
    });

    it('has type "arbiter"', () => {
      expect(strategy.type).toBe('arbiter');
    });

    it('has phaseAfterArgumentation "ARBITER_REVIEW"', () => {
      expect(strategy.phaseAfterArgumentation).toBe('ARBITER_REVIEW');
    });

    it('has maxArgumentsPerSide 3', () => {
      expect(strategy.maxArgumentsPerSide).toBe(3);
    });

    it('has a display name and description', () => {
      expect(strategy.displayName).toBeTruthy();
      expect(strategy.description).toBeTruthy();
    });
  });

  describe('resolve', () => {
    it('[3,4] + 0 mods → modified=7 → FAILURE_BUT (not > 7)', () => {
      mockRollDie.mockReturnValueOnce(3).mockReturnValueOnce(4);
      const result = strategy.resolve({ strongProCount: 0, strongAntiCount: 0 });
      expect(result.resultType).toBe('FAILURE_BUT');
      expect(result.resultValue).toBe(-1);
      expect(result.strategyData).toMatchObject({ base: 7, modified: 7 });
    });

    it('[4,4] + 0 mods → modified=8 → SUCCESS_BUT', () => {
      mockRollDie.mockReturnValueOnce(4).mockReturnValueOnce(4);
      const result = strategy.resolve({ strongProCount: 0, strongAntiCount: 0 });
      expect(result.resultType).toBe('SUCCESS_BUT');
      expect(result.resultValue).toBe(1);
      expect(result.strategyData).toMatchObject({ base: 8, modified: 8 });
    });

    it('[3,3] + 2 strong PRO → modified=8 → SUCCESS_BUT', () => {
      mockRollDie.mockReturnValueOnce(3).mockReturnValueOnce(3);
      const result = strategy.resolve({ strongProCount: 2, strongAntiCount: 0 });
      expect(result.resultType).toBe('SUCCESS_BUT');
      expect(result.resultValue).toBe(1);
      expect(result.strategyData).toMatchObject({ base: 6, modified: 8 });
    });

    it('[5,4] − 3 strong ANTI → modified=6 → FAILURE_BUT', () => {
      mockRollDie.mockReturnValueOnce(5).mockReturnValueOnce(4);
      const result = strategy.resolve({ strongProCount: 0, strongAntiCount: 3 });
      expect(result.resultType).toBe('FAILURE_BUT');
      expect(result.resultValue).toBe(-1);
      expect(result.strategyData).toMatchObject({ base: 9, modified: 6 });
    });

    it('includes dice roll in strategyData', () => {
      mockRollDie.mockReturnValueOnce(2).mockReturnValueOnce(5);
      const result = strategy.resolve({ strongProCount: 0, strongAntiCount: 0 });
      expect(result.strategyData.diceRoll).toEqual([2, 5]);
    });

    it('combined mods: [2,3] + 3 PRO − 1 ANTI → modified=7 → FAILURE_BUT', () => {
      mockRollDie.mockReturnValueOnce(2).mockReturnValueOnce(3);
      const result = strategy.resolve({ strongProCount: 3, strongAntiCount: 1 });
      // base=5, +3, -1 = 7, not > 7
      expect(result.resultType).toBe('FAILURE_BUT');
      expect(result.strategyData).toMatchObject({ modified: 7 });
    });

    it('combined mods: [2,3] + 3 PRO − 0 ANTI → modified=8 → SUCCESS_BUT', () => {
      mockRollDie.mockReturnValueOnce(2).mockReturnValueOnce(3);
      const result = strategy.resolve({ strongProCount: 3, strongAntiCount: 0 });
      // base=5, +3 = 8 > 7
      expect(result.resultType).toBe('SUCCESS_BUT');
      expect(result.strategyData).toMatchObject({ modified: 8 });
    });

    it('calls rollDie twice for a 2d6 roll', () => {
      mockRollDie.mockReturnValue(4);
      strategy.resolve({ strongProCount: 0, strongAntiCount: 0 });
      expect(mockRollDie).toHaveBeenCalledTimes(2);
    });
  });
});
