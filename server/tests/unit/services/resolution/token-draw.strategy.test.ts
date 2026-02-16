import { describe, it, expect } from 'vitest';

// Import strategy module to trigger self-registration, then use the registry
import '../../../../src/services/resolution/strategies/token-draw.strategy.js';
import { getStrategy } from '../../../../src/services/resolution/registry.js';
import type { ResolutionVotes } from '../../../../src/services/resolution/resolution-strategy.js';

describe('TokenDrawStrategy', () => {
  const strategy = getStrategy('token_draw');

  describe('metadata', () => {
    it('has the correct id', () => {
      expect(strategy.id).toBe('token_draw');
    });

    it('has a display name and description', () => {
      expect(strategy.displayName).toBeTruthy();
      expect(strategy.description).toBeTruthy();
    });
  });

  describe('mapVoteToTokens', () => {
    it('maps LIKELY_SUCCESS to 2 success, 0 failure', () => {
      const result = strategy.mapVoteToTokens('LIKELY_SUCCESS');
      expect(result).toEqual({ successTokens: 2, failureTokens: 0 });
    });

    it('maps LIKELY_FAILURE to 0 success, 2 failure', () => {
      const result = strategy.mapVoteToTokens('LIKELY_FAILURE');
      expect(result).toEqual({ successTokens: 0, failureTokens: 2 });
    });

    it('maps UNCERTAIN to 1 success, 1 failure', () => {
      const result = strategy.mapVoteToTokens('UNCERTAIN');
      expect(result).toEqual({ successTokens: 1, failureTokens: 1 });
    });
  });

  describe('resolve', () => {
    it('returns a valid result with base pool only (no votes)', () => {
      const votes: ResolutionVotes = { votes: [] };
      const result = strategy.resolve(votes);

      expect(result.resultType).toBeDefined();
      expect(['TRIUMPH', 'SUCCESS_BUT', 'FAILURE_BUT', 'DISASTER']).toContain(result.resultType);
      expect([-3, -1, 1, 3]).toContain(result.resultValue);
      expect(result.strategyData).toBeDefined();
      expect(result.strategyData.seed).toBeTruthy();
      expect(result.strategyData.totalSuccessTokens).toBe(1);
      expect(result.strategyData.totalFailureTokens).toBe(1);
    });

    it('includes correct token counts from votes', () => {
      const votes: ResolutionVotes = {
        votes: [
          { playerId: 'p1', voteType: 'LIKELY_SUCCESS', successTokens: 2, failureTokens: 0 },
          { playerId: 'p2', voteType: 'LIKELY_FAILURE', successTokens: 0, failureTokens: 2 },
          { playerId: 'p3', voteType: 'UNCERTAIN', successTokens: 1, failureTokens: 1 },
        ],
      };

      const result = strategy.resolve(votes);

      // Base 1 + votes: 2+0+1 = 4
      expect(result.strategyData.totalSuccessTokens).toBe(4);
      // Base 1 + votes: 0+2+1 = 4
      expect(result.strategyData.totalFailureTokens).toBe(4);
    });

    it('always draws exactly 3 tokens', () => {
      const votes: ResolutionVotes = {
        votes: [
          { playerId: 'p1', voteType: 'LIKELY_SUCCESS', successTokens: 2, failureTokens: 0 },
        ],
      };

      const result = strategy.resolve(votes);
      const drawnTokens = result.strategyData.drawnTokens as Array<{
        drawSequence: number;
        tokenType: string;
      }>;

      expect(drawnTokens).toHaveLength(3);
      drawnTokens.forEach((token, i) => {
        expect(token.drawSequence).toBe(i + 1);
        expect(['SUCCESS', 'FAILURE']).toContain(token.tokenType);
      });
    });

    it('drawnSuccess + drawnFailure equals 3', () => {
      const votes: ResolutionVotes = { votes: [] };
      const result = strategy.resolve(votes);

      const ds = result.strategyData.drawnSuccess as number;
      const df = result.strategyData.drawnFailure as number;
      expect(ds + df).toBe(3);
    });

    it('resultValue matches drawn success count', () => {
      // Run multiple times to get different outcomes
      for (let i = 0; i < 20; i++) {
        const result = strategy.resolve({ votes: [] });
        const ds = result.strategyData.drawnSuccess as number;
        expect(result.resultValue).toBe(ds * 2 - 3);
      }
    });

    it('resultType matches resultValue', () => {
      const typeMap: Record<number, string> = {
        3: 'TRIUMPH',
        1: 'SUCCESS_BUT',
        '-1': 'FAILURE_BUT',
        '-3': 'DISASTER',
      };

      for (let i = 0; i < 20; i++) {
        const result = strategy.resolve({ votes: [] });
        expect(result.resultType).toBe(typeMap[result.resultValue]);
      }
    });
  });
});
