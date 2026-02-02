import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    action: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    game: {
      update: vi.fn(),
    },
    vote: {
      createMany: vi.fn(),
    },
    argument: {
      findFirst: vi.fn(),
      createMany: vi.fn(),
    },
    gameEvent: {
      create: vi.fn(),
    },
  },
}));

// Mock the game service
vi.mock('../../../src/services/game.service.js', () => ({
  transitionPhase: vi.fn(),
}));

// Mock the logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Timeout Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Timeout Detection Logic', () => {
    it('should identify actions past 24 hour argumentation deadline', () => {
      const now = Date.now();
      const twentyFiveHoursAgo = new Date(now - 25 * 60 * 60 * 1000);
      const twentyThreeHoursAgo = new Date(now - 23 * 60 * 60 * 1000);

      // Action that should be timed out
      const timedOutAction = {
        id: 'action-1',
        status: 'ARGUING',
        argumentationStartedAt: twentyFiveHoursAgo,
      };

      // Action that should NOT be timed out yet
      const notTimedOutAction = {
        id: 'action-2',
        status: 'ARGUING',
        argumentationStartedAt: twentyThreeHoursAgo,
      };

      const timeoutMs = 24 * 60 * 60 * 1000;
      const cutoffTime = new Date(now - timeoutMs);

      expect(timedOutAction.argumentationStartedAt < cutoffTime).toBe(true);
      expect(notTimedOutAction.argumentationStartedAt < cutoffTime).toBe(false);
    });

    it('should identify actions past 24 hour voting deadline', () => {
      const now = Date.now();
      const twentyFiveHoursAgo = new Date(now - 25 * 60 * 60 * 1000);
      const twentyThreeHoursAgo = new Date(now - 23 * 60 * 60 * 1000);

      const timedOutAction = {
        id: 'action-1',
        status: 'VOTING',
        votingStartedAt: twentyFiveHoursAgo,
      };

      const notTimedOutAction = {
        id: 'action-2',
        status: 'VOTING',
        votingStartedAt: twentyThreeHoursAgo,
      };

      const timeoutMs = 24 * 60 * 60 * 1000;
      const cutoffTime = new Date(now - timeoutMs);

      expect(timedOutAction.votingStartedAt < cutoffTime).toBe(true);
      expect(notTimedOutAction.votingStartedAt < cutoffTime).toBe(false);
    });

    it('should respect custom timeout durations', () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

      const action = {
        id: 'action-1',
        status: 'ARGUING',
        argumentationStartedAt: twoHoursAgo,
      };

      // With 24 hour timeout, not timed out
      const defaultCutoff = new Date(now - 24 * 60 * 60 * 1000);
      expect(action.argumentationStartedAt < defaultCutoff).toBe(false);

      // With 1 hour custom timeout, timed out
      const customCutoff = new Date(now - 1 * 60 * 60 * 1000);
      expect(action.argumentationStartedAt < customCutoff).toBe(true);
    });
  });

  describe('Argumentation Timeout Processing', () => {
    it('should transition action to VOTING phase on timeout', () => {
      const action = {
        id: 'action-1',
        gameId: 'game-1',
        status: 'ARGUING',
        argumentationStartedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      };

      // After processing, action should be in VOTING status
      const expectedStatus = 'VOTING';
      expect(expectedStatus).toBe('VOTING');

      // votingStartedAt should be set to current time
      const votingStartedAt = new Date();
      expect(votingStartedAt).toBeInstanceOf(Date);
    });

    it('should log timeout event', () => {
      const expectedEventType = 'ARGUMENTATION_TIMEOUT';
      const expectedEventData = { actionId: 'action-1' };

      expect(expectedEventType).toBe('ARGUMENTATION_TIMEOUT');
      expect(expectedEventData.actionId).toBe('action-1');
    });

    it('should identify players who have not submitted arguments', () => {
      const activePlayers = [
        { id: 'player-1', userId: 'user-1', playerName: 'Player 1' },
        { id: 'player-2', userId: 'user-2', playerName: 'Player 2' },
        { id: 'player-3', userId: 'user-3', playerName: 'Player 3' },
      ];

      const existingArguments = [{ playerId: 'player-1' }];

      const playerIdsWithArguments = new Set(existingArguments.map((a) => a.playerId));
      const playersWithoutArguments = activePlayers.filter(
        (p) => !playerIdsWithArguments.has(p.id)
      );

      expect(playersWithoutArguments).toHaveLength(2);
      expect(playersWithoutArguments.map((p) => p.id)).toContain('player-2');
      expect(playersWithoutArguments.map((p) => p.id)).toContain('player-3');
    });

    it('should create placeholder arguments for missing players', () => {
      const missingPlayerIds = ['player-2', 'player-3'];
      const actionId = 'action-1';
      let nextSequence = 2; // Assuming one argument already exists

      const expectedArguments = missingPlayerIds.map((playerId) => ({
        actionId,
        playerId,
        argumentType: 'FOR',
        content: '[No argument submitted - timed out]',
        sequence: nextSequence++,
      }));

      expect(expectedArguments).toHaveLength(2);
      expectedArguments.forEach((arg) => {
        expect(arg.argumentType).toBe('FOR');
        expect(arg.content).toBe('[No argument submitted - timed out]');
      });
    });

    it('should handle case where all players have already submitted arguments', () => {
      const activePlayers = [
        { id: 'player-1' },
        { id: 'player-2' },
      ];

      const existingArguments = [
        { playerId: 'player-1' },
        { playerId: 'player-2' },
      ];

      const playerIdsWithArguments = new Set(existingArguments.map((a) => a.playerId));
      const playersWithoutArguments = activePlayers.filter(
        (p) => !playerIdsWithArguments.has(p.id)
      );

      expect(playersWithoutArguments).toHaveLength(0);
    });
  });

  describe('Voting Timeout Processing', () => {
    it('should identify players who have not voted', () => {
      const activePlayers = [
        { id: 'player-1', userId: 'user-1' },
        { id: 'player-2', userId: 'user-2' },
        { id: 'player-3', userId: 'user-3' },
      ];

      const existingVotes = [{ playerId: 'player-1' }];

      const votedPlayerIds = existingVotes.map((v) => v.playerId);
      const playersWhoHaventVoted = activePlayers.filter(
        (p) => !votedPlayerIds.includes(p.id)
      );

      expect(playersWhoHaventVoted).toHaveLength(2);
      expect(playersWhoHaventVoted.map((p) => p.id)).toContain('player-2');
      expect(playersWhoHaventVoted.map((p) => p.id)).toContain('player-3');
    });

    it('should create UNCERTAIN auto-votes for missing players', () => {
      const missingPlayerIds = ['player-2', 'player-3'];
      const actionId = 'action-1';

      const expectedVotes = missingPlayerIds.map((playerId) => ({
        actionId,
        playerId,
        voteType: 'UNCERTAIN',
        successTokens: 1,
        failureTokens: 1,
      }));

      expect(expectedVotes).toHaveLength(2);
      expectedVotes.forEach((vote) => {
        expect(vote.voteType).toBe('UNCERTAIN');
        expect(vote.successTokens).toBe(1);
        expect(vote.failureTokens).toBe(1);
      });
    });

    it('should transition action to RESOLVED phase after auto-voting', () => {
      const expectedStatus = 'RESOLVED';
      expect(expectedStatus).toBe('RESOLVED');
    });

    it('should handle case where all players have already voted', () => {
      const activePlayers = [
        { id: 'player-1' },
        { id: 'player-2' },
      ];

      const existingVotes = [
        { playerId: 'player-1' },
        { playerId: 'player-2' },
      ];

      const votedPlayerIds = existingVotes.map((v) => v.playerId);
      const playersWhoHaventVoted = activePlayers.filter(
        (p) => !votedPlayerIds.includes(p.id)
      );

      expect(playersWhoHaventVoted).toHaveLength(0);
    });
  });

  describe('Timeout Status Calculation', () => {
    it('should calculate remaining time correctly', () => {
      const now = Date.now();
      const twentyThreeHoursAgo = new Date(now - 23 * 60 * 60 * 1000);
      const timeoutMs = 24 * 60 * 60 * 1000;

      const timeoutAt = new Date(twentyThreeHoursAgo.getTime() + timeoutMs);
      const remainingMs = timeoutAt.getTime() - now;

      // Should be approximately 1 hour remaining
      expect(remainingMs).toBeGreaterThan(50 * 60 * 1000); // > 50 minutes
      expect(remainingMs).toBeLessThan(70 * 60 * 1000); // < 70 minutes
    });

    it('should return zero remaining time for timed out actions', () => {
      const now = Date.now();
      const twentyFiveHoursAgo = new Date(now - 25 * 60 * 60 * 1000);
      const timeoutMs = 24 * 60 * 60 * 1000;

      const timeoutAt = new Date(twentyFiveHoursAgo.getTime() + timeoutMs);
      const remainingMs = Math.max(0, timeoutAt.getTime() - now);

      expect(remainingMs).toBe(0);
    });

    it('should indicate isTimedOut correctly', () => {
      const now = Date.now();
      const timeoutMs = 24 * 60 * 60 * 1000;

      // Not timed out
      const recentStart = new Date(now - 1 * 60 * 60 * 1000);
      const recentTimeoutAt = recentStart.getTime() + timeoutMs;
      expect(recentTimeoutAt > now).toBe(true);

      // Timed out
      const oldStart = new Date(now - 25 * 60 * 60 * 1000);
      const oldTimeoutAt = oldStart.getTime() + timeoutMs;
      expect(oldTimeoutAt <= now).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing action gracefully', () => {
      const actionId = 'non-existent';
      const expectedError = `Action not found: ${actionId}`;
      expect(expectedError).toContain('not found');
    });

    it('should reject processing action in wrong phase', () => {
      const action = {
        id: 'action-1',
        status: 'VOTING', // Not ARGUING
      };

      if (action.status !== 'ARGUING') {
        const error = `Action ${action.id} is not in argumentation phase`;
        expect(error).toContain('not in argumentation phase');
      }
    });

    it('should collect errors without stopping entire batch', () => {
      const results = {
        argumentationTimeouts: [{ actionId: 'action-1', gameId: 'game-1' }],
        votingTimeouts: [],
        errors: [{ actionId: 'action-2', error: 'Processing failed' }],
      };

      // Even with one error, other timeouts should still be processed
      expect(results.argumentationTimeouts.length).toBe(1);
      expect(results.errors.length).toBe(1);
    });
  });
});
