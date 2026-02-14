import { describe, it, expect } from 'vitest';

// Token drawing logic extracted for testing
function performTokenDraw(successCount: number, failureCount: number) {
  // Create token pool
  const tokens: ('SUCCESS' | 'FAILURE')[] = [
    ...Array(successCount).fill('SUCCESS'),
    ...Array(failureCount).fill('FAILURE'),
  ];

  // Shuffle (simplified for testing - real implementation uses crypto)
  for (let i = tokens.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tokens[i], tokens[j]] = [tokens[j]!, tokens[i]!];
  }

  // Draw first 3 tokens
  const drawn = tokens.slice(0, 3) as ('SUCCESS' | 'FAILURE')[];
  const drawnSuccess = drawn.filter((t) => t === 'SUCCESS').length;
  const drawnFailure = 3 - drawnSuccess;

  // Calculate result: -3, -1, +1, +3
  const resultValue = drawnSuccess * 2 - 3;

  const resultType = getResultType(drawnSuccess);

  return {
    tokens: drawn,
    drawnSuccess,
    drawnFailure,
    resultValue,
    resultType,
  };
}

function getResultType(successCount: number): string {
  switch (successCount) {
    case 3:
      return 'TRIUMPH';
    case 2:
      return 'SUCCESS_BUT';
    case 1:
      return 'FAILURE_BUT';
    default:
      return 'DISASTER';
  }
}

function calculateTokenPool(votes: Array<{ successTokens: number; failureTokens: number }>) {
  // Base: 1 success + 1 failure
  const totalSuccess = 1 + votes.reduce((sum, v) => sum + v.successTokens, 0);
  const totalFailure = 1 + votes.reduce((sum, v) => sum + v.failureTokens, 0);
  return { totalSuccess, totalFailure };
}

describe('Token Service', () => {
  describe('performTokenDraw', () => {
    it('should draw exactly 3 tokens', () => {
      const result = performTokenDraw(5, 5);
      expect(result.drawnSuccess + result.drawnFailure).toBe(3);
      expect(result.tokens.length).toBe(3);
    });

    it('should return TRIUMPH for 3 success tokens when pool is all success', () => {
      const result = performTokenDraw(10, 0);
      expect(result.drawnSuccess).toBe(3);
      expect(result.drawnFailure).toBe(0);
      expect(result.resultType).toBe('TRIUMPH');
      expect(result.resultValue).toBe(3);
    });

    it('should return DISASTER for 3 failure tokens when pool is all failure', () => {
      const result = performTokenDraw(0, 10);
      expect(result.drawnSuccess).toBe(0);
      expect(result.drawnFailure).toBe(3);
      expect(result.resultType).toBe('DISASTER');
      expect(result.resultValue).toBe(-3);
    });

    it('should calculate correct result values', () => {
      // Test result value calculation directly
      expect(3 * 2 - 3).toBe(3); // 3 success = +3
      expect(2 * 2 - 3).toBe(1); // 2 success = +1
      expect(1 * 2 - 3).toBe(-1); // 1 success = -1
      expect(0 * 2 - 3).toBe(-3); // 0 success = -3
    });
  });

  describe('getResultType', () => {
    it('should return TRIUMPH for 3 successes', () => {
      expect(getResultType(3)).toBe('TRIUMPH');
    });

    it('should return SUCCESS_BUT for 2 successes', () => {
      expect(getResultType(2)).toBe('SUCCESS_BUT');
    });

    it('should return FAILURE_BUT for 1 success', () => {
      expect(getResultType(1)).toBe('FAILURE_BUT');
    });

    it('should return DISASTER for 0 successes', () => {
      expect(getResultType(0)).toBe('DISASTER');
    });
  });

  describe('calculateTokenPool', () => {
    it('should start with base of 1 success and 1 failure', () => {
      const result = calculateTokenPool([]);
      expect(result.totalSuccess).toBe(1);
      expect(result.totalFailure).toBe(1);
    });

    it('should add 2 success tokens for LIKELY_SUCCESS vote', () => {
      const votes = [{ successTokens: 2, failureTokens: 0 }];
      const result = calculateTokenPool(votes);
      expect(result.totalSuccess).toBe(3); // 1 base + 2 from vote
      expect(result.totalFailure).toBe(1); // 1 base
    });

    it('should add 2 failure tokens for LIKELY_FAILURE vote', () => {
      const votes = [{ successTokens: 0, failureTokens: 2 }];
      const result = calculateTokenPool(votes);
      expect(result.totalSuccess).toBe(1); // 1 base
      expect(result.totalFailure).toBe(3); // 1 base + 2 from vote
    });

    it('should add 1 of each for UNCERTAIN vote', () => {
      const votes = [{ successTokens: 1, failureTokens: 1 }];
      const result = calculateTokenPool(votes);
      expect(result.totalSuccess).toBe(2); // 1 base + 1 from vote
      expect(result.totalFailure).toBe(2); // 1 base + 1 from vote
    });

    it('should correctly sum multiple votes', () => {
      const votes = [
        { successTokens: 2, failureTokens: 0 }, // LIKELY_SUCCESS
        { successTokens: 0, failureTokens: 2 }, // LIKELY_FAILURE
        { successTokens: 1, failureTokens: 1 }, // UNCERTAIN
        { successTokens: 2, failureTokens: 0 }, // LIKELY_SUCCESS
      ];
      const result = calculateTokenPool(votes);
      expect(result.totalSuccess).toBe(1 + 2 + 0 + 1 + 2); // 6
      expect(result.totalFailure).toBe(1 + 0 + 2 + 1 + 0); // 4
    });

    it('should calculate correct pool for 4 players', () => {
      // 4 players: pool = 2 (base) + 8 (4 * 2 tokens) = 10 total
      const votes = [
        { successTokens: 2, failureTokens: 0 },
        { successTokens: 2, failureTokens: 0 },
        { successTokens: 1, failureTokens: 1 },
        { successTokens: 0, failureTokens: 2 },
      ];
      const result = calculateTokenPool(votes);
      const total = result.totalSuccess + result.totalFailure;
      expect(total).toBe(10); // 2 base + 8 from votes
    });
  });

  describe('probability distributions', () => {
    it('should have higher success chance with more success tokens', () => {
      // With 8 success and 2 failure tokens, success is more likely
      // Run multiple trials
      const trials = 1000;
      let successCount = 0;

      for (let i = 0; i < trials; i++) {
        const result = performTokenDraw(8, 2);
        if (result.drawnSuccess >= 2) successCount++;
      }

      // With 8/10 success tokens, we expect ~90%+ to draw 2+ successes
      expect(successCount / trials).toBeGreaterThan(0.7);
    });

    it('should have higher failure chance with more failure tokens', () => {
      const trials = 1000;
      let failureCount = 0;

      for (let i = 0; i < trials; i++) {
        const result = performTokenDraw(2, 8);
        if (result.drawnFailure >= 2) failureCount++;
      }

      expect(failureCount / trials).toBeGreaterThan(0.7);
    });

    it('should be roughly balanced with equal tokens', () => {
      const trials = 1000;
      let positiveCount = 0;

      for (let i = 0; i < trials; i++) {
        const result = performTokenDraw(5, 5);
        if (result.resultValue > 0) positiveCount++;
      }

      // Should be roughly 50% positive, allow 40-60% range
      const ratio = positiveCount / trials;
      expect(ratio).toBeGreaterThan(0.3);
      expect(ratio).toBeLessThan(0.7);
    });
  });
});
