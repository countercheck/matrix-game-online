import { describe, it, expect } from 'vitest';

import '../../../../src/services/resolution/strategies/arbiter.strategy.js';
import { getStrategy } from '../../../../src/services/resolution/registry.js';
import type { ArbiterResolutionStrategy } from '../../../../src/services/resolution/resolution-strategy.js';

describe('ArbiterStrategy', () => {
  const strategy = getStrategy('arbiter') as ArbiterResolutionStrategy;

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
      const result = strategy.resolve({
        strongProCount: 0,
        strongAntiCount: 0,
        diceRoll: [3, 4],
      });
      expect(result.resultType).toBe('FAILURE_BUT');
      expect(result.resultValue).toBe(-1);
      expect(result.strategyData).toMatchObject({ base: 7, modified: 7 });
    });

    it('[4,4] + 0 mods → modified=8 → SUCCESS_BUT', () => {
      const result = strategy.resolve({
        strongProCount: 0,
        strongAntiCount: 0,
        diceRoll: [4, 4],
      });
      expect(result.resultType).toBe('SUCCESS_BUT');
      expect(result.resultValue).toBe(1);
      expect(result.strategyData).toMatchObject({ base: 8, modified: 8 });
    });

    it('[3,3] + 2 strong PRO → modified=8 → SUCCESS_BUT', () => {
      const result = strategy.resolve({
        strongProCount: 2,
        strongAntiCount: 0,
        diceRoll: [3, 3],
      });
      expect(result.resultType).toBe('SUCCESS_BUT');
      expect(result.resultValue).toBe(1);
      expect(result.strategyData).toMatchObject({ base: 6, modified: 8 });
    });

    it('[5,4] − 3 strong ANTI → modified=6 → FAILURE_BUT', () => {
      const result = strategy.resolve({
        strongProCount: 0,
        strongAntiCount: 3,
        diceRoll: [5, 4],
      });
      expect(result.resultType).toBe('FAILURE_BUT');
      expect(result.resultValue).toBe(-1);
      expect(result.strategyData).toMatchObject({ base: 9, modified: 6 });
    });

    it('includes dice roll in strategyData', () => {
      const diceRoll: [number, number] = [2, 5];
      const result = strategy.resolve({ strongProCount: 0, strongAntiCount: 0, diceRoll });
      expect(result.strategyData.diceRoll).toEqual(diceRoll);
    });

    it('combined mods: [2,3] + 3 PRO − 1 ANTI → modified=7 → FAILURE_BUT', () => {
      const result = strategy.resolve({
        strongProCount: 3,
        strongAntiCount: 1,
        diceRoll: [2, 3],
      });
      // base=5, +3, -1 = 7, not > 7
      expect(result.resultType).toBe('FAILURE_BUT');
      expect(result.strategyData).toMatchObject({ modified: 7 });
    });

    it('combined mods: [2,3] + 3 PRO − 0 ANTI → modified=8 → SUCCESS_BUT', () => {
      const result = strategy.resolve({
        strongProCount: 3,
        strongAntiCount: 0,
        diceRoll: [2, 3],
      });
      // base=5, +3 = 8 > 7
      expect(result.resultType).toBe('SUCCESS_BUT');
      expect(result.strategyData).toMatchObject({ modified: 8 });
    });
  });
});
