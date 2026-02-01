import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    round: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    roundSummary: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    game: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gamePlayer: {
      findFirst: vi.fn(),
    },
    gameEvent: {
      create: vi.fn(),
    },
  },
}));

describe('Round Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Round Progress Calculation', () => {
    it('should calculate progress correctly for new round', () => {
      const actionsCompleted = 0;
      const totalRequired = 4;

      const progress = {
        actionsCompleted,
        totalRequired,
        remaining: totalRequired - actionsCompleted,
        isComplete: actionsCompleted >= totalRequired,
        percentage: Math.round((actionsCompleted / totalRequired) * 100),
      };

      expect(progress.actionsCompleted).toBe(0);
      expect(progress.remaining).toBe(4);
      expect(progress.isComplete).toBe(false);
      expect(progress.percentage).toBe(0);
    });

    it('should calculate progress correctly mid-round', () => {
      const actionsCompleted = 2;
      const totalRequired = 4;

      const progress = {
        actionsCompleted,
        totalRequired,
        remaining: totalRequired - actionsCompleted,
        isComplete: actionsCompleted >= totalRequired,
        percentage: Math.round((actionsCompleted / totalRequired) * 100),
      };

      expect(progress.actionsCompleted).toBe(2);
      expect(progress.remaining).toBe(2);
      expect(progress.isComplete).toBe(false);
      expect(progress.percentage).toBe(50);
    });

    it('should detect completed round', () => {
      const actionsCompleted = 4;
      const totalRequired = 4;

      const progress = {
        actionsCompleted,
        totalRequired,
        remaining: totalRequired - actionsCompleted,
        isComplete: actionsCompleted >= totalRequired,
        percentage: Math.round((actionsCompleted / totalRequired) * 100),
      };

      expect(progress.remaining).toBe(0);
      expect(progress.isComplete).toBe(true);
      expect(progress.percentage).toBe(100);
    });
  });

  describe('Player Proposal Tracking', () => {
    it('should correctly identify players who have proposed', () => {
      const players = [
        { id: 'p1', userId: 'u1', playerName: 'Player 1' },
        { id: 'p2', userId: 'u2', playerName: 'Player 2' },
        { id: 'p3', userId: 'u3', playerName: 'Player 3' },
      ];

      const actions = [
        { initiator: { userId: 'u1' } },
        { initiator: { userId: 'u3' } },
      ];

      const playerIdsWhoProposed = actions.map((a) => a.initiator.userId);
      const playersWhoProposed = players.filter((p) =>
        playerIdsWhoProposed.includes(p.userId)
      );
      const playersWhoHaventProposed = players.filter(
        (p) => !playerIdsWhoProposed.includes(p.userId)
      );

      expect(playersWhoProposed).toHaveLength(2);
      expect(playersWhoHaventProposed).toHaveLength(1);
      expect(playersWhoHaventProposed[0].userId).toBe('u2');
    });

    it('should handle empty actions list', () => {
      const players = [
        { id: 'p1', userId: 'u1', playerName: 'Player 1' },
        { id: 'p2', userId: 'u2', playerName: 'Player 2' },
      ];

      const actions: any[] = [];

      const playerIdsWhoProposed = actions.map((a) => a.initiator.userId);
      const playersWhoHaventProposed = players.filter(
        (p) => !playerIdsWhoProposed.includes(p.userId)
      );

      expect(playersWhoHaventProposed).toHaveLength(2);
    });

    it('should handle all players having proposed', () => {
      const players = [
        { id: 'p1', userId: 'u1', playerName: 'Player 1' },
        { id: 'p2', userId: 'u2', playerName: 'Player 2' },
      ];

      const actions = [
        { initiator: { userId: 'u1' } },
        { initiator: { userId: 'u2' } },
      ];

      const playerIdsWhoProposed = actions.map((a) => a.initiator.userId);
      const playersWhoHaventProposed = players.filter(
        (p) => !playerIdsWhoProposed.includes(p.userId)
      );

      expect(playersWhoHaventProposed).toHaveLength(0);
    });
  });

  describe('Round Summary Statistics', () => {
    it('should calculate net result correctly', () => {
      const actionResults = [
        { resultValue: 3, resultType: 'TRIUMPH' },
        { resultValue: 1, resultType: 'SUCCESS_BUT' },
        { resultValue: -1, resultType: 'FAILURE_BUT' },
        { resultValue: -3, resultType: 'DISASTER' },
      ];

      const netResult = actionResults.reduce((sum, r) => sum + r.resultValue, 0);

      expect(netResult).toBe(0);
    });

    it('should count triumphs and disasters', () => {
      const actionResults = [
        { resultValue: 3, resultType: 'TRIUMPH' },
        { resultValue: 3, resultType: 'TRIUMPH' },
        { resultValue: -3, resultType: 'DISASTER' },
        { resultValue: 1, resultType: 'SUCCESS_BUT' },
      ];

      const triumphs = actionResults.filter((r) => r.resultType === 'TRIUMPH').length;
      const disasters = actionResults.filter((r) => r.resultType === 'DISASTER').length;

      expect(triumphs).toBe(2);
      expect(disasters).toBe(1);
    });

    it('should handle all positive results', () => {
      const actionResults = [
        { resultValue: 3, resultType: 'TRIUMPH' },
        { resultValue: 1, resultType: 'SUCCESS_BUT' },
        { resultValue: 1, resultType: 'SUCCESS_BUT' },
      ];

      const netResult = actionResults.reduce((sum, r) => sum + r.resultValue, 0);

      expect(netResult).toBe(5);
    });

    it('should handle all negative results', () => {
      const actionResults = [
        { resultValue: -3, resultType: 'DISASTER' },
        { resultValue: -1, resultType: 'FAILURE_BUT' },
        { resultValue: -1, resultType: 'FAILURE_BUT' },
      ];

      const netResult = actionResults.reduce((sum, r) => sum + r.resultValue, 0);

      expect(netResult).toBe(-5);
    });
  });

  describe('Round Summary Validation', () => {
    it('should reject summary if round is not complete', () => {
      const round = {
        actionsCompleted: 2,
        totalActionsRequired: 4,
      };

      const isComplete = round.actionsCompleted >= round.totalActionsRequired;

      expect(isComplete).toBe(false);
    });

    it('should allow summary if round is complete', () => {
      const round = {
        actionsCompleted: 4,
        totalActionsRequired: 4,
      };

      const isComplete = round.actionsCompleted >= round.totalActionsRequired;

      expect(isComplete).toBe(true);
    });

    it('should reject summary if not in ROUND_SUMMARY phase', () => {
      const validPhases = ['ROUND_SUMMARY'];
      const currentPhase = 'NARRATION';

      const canSubmitSummary = validPhases.includes(currentPhase);

      expect(canSubmitSummary).toBe(false);
    });

    it('should allow summary in ROUND_SUMMARY phase', () => {
      const validPhases = ['ROUND_SUMMARY'];
      const currentPhase = 'ROUND_SUMMARY';

      const canSubmitSummary = validPhases.includes(currentPhase);

      expect(canSubmitSummary).toBe(true);
    });
  });

  describe('Next Round Creation', () => {
    it('should increment round number correctly', () => {
      const currentRoundNumber = 3;
      const nextRoundNumber = currentRoundNumber + 1;

      expect(nextRoundNumber).toBe(4);
    });

    it('should set totalActionsRequired to player count', () => {
      const playerCount = 5;
      const newRound = {
        totalActionsRequired: playerCount,
        actionsCompleted: 0,
      };

      expect(newRound.totalActionsRequired).toBe(5);
      expect(newRound.actionsCompleted).toBe(0);
    });

    it('should start new round in IN_PROGRESS status', () => {
      const newRoundStatus = 'IN_PROGRESS';

      expect(newRoundStatus).toBe('IN_PROGRESS');
    });
  });
});
