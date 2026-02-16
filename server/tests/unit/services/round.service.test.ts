import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockRequireMember, mockLogGameEvent, mockNotifyNewRound } = vi.hoisted(() => {
  const mockDb = {
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
  };
  const mockRequireMember = vi.fn();
  const mockLogGameEvent = vi.fn();
  const mockNotifyNewRound = vi.fn().mockResolvedValue(undefined);
  return { mockDb, mockRequireMember, mockLogGameEvent, mockNotifyNewRound };
});

vi.mock('../../../src/config/database.js', () => ({
  db: mockDb,
}));

vi.mock('../../../src/services/game.service.js', () => ({
  requireMember: mockRequireMember,
  logGameEvent: mockLogGameEvent,
}));

vi.mock('../../../src/services/notification.service.js', () => ({
  notifyNewRound: mockNotifyNewRound,
}));

vi.mock('../../../src/middleware/errorHandler.js', () => ({
  BadRequestError: class BadRequestError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'BadRequestError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  getRound,
  submitRoundSummary,
  getRoundSummary,
} from '../../../src/services/round.service.js';

describe('Round Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireMember.mockResolvedValue(undefined);
    mockLogGameEvent.mockResolvedValue(undefined);
  });

  describe('getRound', () => {
    const mockRound = {
      id: 'round-1',
      gameId: 'game-1',
      roundNumber: 1,
      actionsCompleted: 1,
      totalActionsRequired: 3,
      actions: [
        {
          initiator: { userId: 'user-1', user: { displayName: 'Player 1' } },
          tokenDraw: null,
          narration: null,
          sequenceNumber: 1,
        },
      ],
      game: {
        players: [
          {
            id: 'p1',
            userId: 'user-1',
            playerName: 'Player 1',
            user: { id: 'user-1', displayName: 'Player 1' },
          },
          {
            id: 'p2',
            userId: 'user-2',
            playerName: 'Player 2',
            user: { id: 'user-2', displayName: 'Player 2' },
          },
          {
            id: 'p3',
            userId: 'user-3',
            playerName: 'Player 3',
            user: { id: 'user-3', displayName: 'Player 3' },
          },
        ],
      },
      summary: null,
    };

    beforeEach(() => {
      mockDb.round.findUnique.mockResolvedValue(mockRound);
    });

    it('should throw NotFoundError when round does not exist', async () => {
      mockDb.round.findUnique.mockResolvedValue(null);

      await expect(getRound('missing', 'user-1')).rejects.toThrow('Round not found');
    });

    it('should call requireMember with the game id and user id', async () => {
      await getRound('round-1', 'user-1');

      expect(mockRequireMember).toHaveBeenCalledWith('game-1', 'user-1');
    });

    it('should return progress calculation', async () => {
      const result = await getRound('round-1', 'user-1');

      expect(result.progress).toEqual({
        actionsCompleted: 1,
        totalRequired: 3,
        remaining: 2,
        isComplete: false,
        percentage: 33,
      });
    });

    it('should return 100% progress when round is complete', async () => {
      mockDb.round.findUnique.mockResolvedValue({
        ...mockRound,
        actionsCompleted: 3,
        totalActionsRequired: 3,
      });

      const result = await getRound('round-1', 'user-1');

      expect(result.progress.isComplete).toBe(true);
      expect(result.progress.remaining).toBe(0);
      expect(result.progress.percentage).toBe(100);
    });

    it('should separate players who have and have not proposed', async () => {
      const result = await getRound('round-1', 'user-1');

      expect(result.playersWhoProposed).toHaveLength(1);
      expect(result.playersWhoProposed[0].userId).toBe('user-1');
      expect(result.playersWhoHaventProposed).toHaveLength(2);
      expect(result.playersWhoHaventProposed.map((p: any) => p.userId)).toContain('user-2');
      expect(result.playersWhoHaventProposed.map((p: any) => p.userId)).toContain('user-3');
    });
  });

  describe('submitRoundSummary', () => {
    const mockRound = {
      id: 'round-1',
      gameId: 'game-1',
      roundNumber: 1,
      actionsCompleted: 3,
      totalActionsRequired: 3,
      game: {
        name: 'Test Game',
        currentPhase: 'ROUND_SUMMARY',
        players: [
          { id: 'p1', userId: 'user-1', isActive: true },
          { id: 'p2', userId: 'user-2', isActive: true },
        ],
      },
      actions: [
        { tokenDraw: { resultValue: 3, resultType: 'TRIUMPH' } },
        { tokenDraw: { resultValue: -1, resultType: 'FAILURE_BUT' } },
        { tokenDraw: { resultValue: 1, resultType: 'SUCCESS_BUT' } },
      ],
      summary: null,
    };

    const mockNextRoundGame = {
      id: 'game-1',
      deletedAt: null,
      players: [
        { id: 'p1', userId: 'user-1', isActive: true },
        { id: 'p2', userId: 'user-2', isActive: true },
      ],
    };

    beforeEach(() => {
      mockDb.round.findUnique.mockResolvedValue(mockRound);
      mockDb.gamePlayer.findFirst.mockResolvedValue({ id: 'p1' });
      mockDb.roundSummary.create.mockResolvedValue({ id: 'summary-1', content: 'Test' });
      mockDb.round.update.mockResolvedValue({});
      mockDb.game.findUnique.mockResolvedValue(mockNextRoundGame);
      mockDb.round.create.mockResolvedValue({
        id: 'round-2',
        roundNumber: 2,
        status: 'IN_PROGRESS',
      });
      mockDb.game.update.mockResolvedValue({});
    });

    it('should throw if round is not complete', async () => {
      mockDb.round.findUnique.mockResolvedValue({
        ...mockRound,
        actionsCompleted: 2,
      });

      await expect(submitRoundSummary('round-1', 'user-1', { content: 'Summary' })).rejects.toThrow(
        'not complete'
      );
    });

    it('should throw if game is not in ROUND_SUMMARY phase', async () => {
      mockDb.round.findUnique.mockResolvedValue({
        ...mockRound,
        game: { ...mockRound.game, currentPhase: 'NARRATION' },
      });

      await expect(submitRoundSummary('round-1', 'user-1', { content: 'Summary' })).rejects.toThrow(
        'round summary phase'
      );
    });

    it('should throw if summary already exists', async () => {
      mockDb.round.findUnique.mockResolvedValue({
        ...mockRound,
        summary: { id: 'existing-summary' },
      });

      await expect(submitRoundSummary('round-1', 'user-1', { content: 'Summary' })).rejects.toThrow(
        'already submitted'
      );
    });

    it('should create summary with computed statistics', async () => {
      await submitRoundSummary('round-1', 'user-1', { content: 'Round summary text' });

      expect(mockDb.roundSummary.create).toHaveBeenCalledOnce();
      const call = mockDb.roundSummary.create.mock.calls[0][0];
      expect(call.data.roundId).toBe('round-1');
      expect(call.data.content).toBe('Round summary text');
      // Net result: 3 + (-1) + 1 = 3
      expect(call.data.outcomes.netMomentum).toBe(3);
      expect(call.data.outcomes.totalTriumphs).toBe(1);
      expect(call.data.outcomes.totalDisasters).toBe(0);
    });

    it('should allow overriding computed stats with provided outcomes', async () => {
      await submitRoundSummary('round-1', 'user-1', {
        content: 'Summary',
        outcomes: { totalTriumphs: 5, totalDisasters: 2, netMomentum: 10, keyEvents: ['Event 1'] },
      });

      const call = mockDb.roundSummary.create.mock.calls[0][0];
      expect(call.data.outcomes.totalTriumphs).toBe(5);
      expect(call.data.outcomes.totalDisasters).toBe(2);
      expect(call.data.outcomes.netMomentum).toBe(10);
      expect(call.data.outcomes.keyEvents).toEqual(['Event 1']);
    });

    it('should mark round as completed', async () => {
      await submitRoundSummary('round-1', 'user-1', { content: 'Summary' });

      expect(mockDb.round.update).toHaveBeenCalledWith({
        where: { id: 'round-1' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should create the next round with correct round number', async () => {
      await submitRoundSummary('round-1', 'user-1', { content: 'Summary' });

      expect(mockDb.round.create).toHaveBeenCalledOnce();
      const call = mockDb.round.create.mock.calls[0][0];
      expect(call.data.gameId).toBe('game-1');
      expect(call.data.roundNumber).toBe(2);
      expect(call.data.status).toBe('IN_PROGRESS');
      expect(call.data.totalActionsRequired).toBe(2); // 2 active players
    });

    it('should use acting units count for totalActionsRequired with shared personas', async () => {
      // 2 players share persona-1, 1 solo = 2 acting units
      const sharedPlayers = [
        { id: 'p1', userId: 'user-1', isActive: true, isNpc: false, personaId: 'persona-1' },
        { id: 'p2', userId: 'user-2', isActive: true, isNpc: false, personaId: 'persona-1' },
        { id: 'p3', userId: 'user-3', isActive: true, isNpc: false, personaId: null },
      ];
      mockDb.game.findUnique.mockResolvedValue({
        id: 'game-1',
        deletedAt: null,
        players: sharedPlayers,
      });

      await submitRoundSummary('round-1', 'user-1', { content: 'Summary' });

      const createCall = mockDb.round.create.mock.calls[0][0];
      expect(createCall.data.totalActionsRequired).toBe(2); // 2 acting units, not 3 players
    });

    it('should update game to point to next round with PROPOSAL phase', async () => {
      mockDb.round.create.mockResolvedValue({ id: 'new-round-id', roundNumber: 2 });

      await submitRoundSummary('round-1', 'user-1', { content: 'Summary' });

      expect(mockDb.game.update).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        data: {
          currentRoundId: 'new-round-id',
          currentPhase: 'PROPOSAL',
          currentActionId: null,
          phaseStartedAt: expect.any(Date),
        },
      });
    });

    it('should log game events for summary and new round', async () => {
      await submitRoundSummary('round-1', 'user-1', { content: 'Summary' });

      expect(mockLogGameEvent).toHaveBeenCalledTimes(2);
      expect(mockLogGameEvent).toHaveBeenCalledWith(
        'game-1',
        'user-1',
        'ROUND_SUMMARY_SUBMITTED',
        expect.objectContaining({ roundId: 'round-1', roundNumber: 1 })
      );
      expect(mockLogGameEvent).toHaveBeenCalledWith(
        'game-1',
        null,
        'ROUND_STARTED',
        expect.objectContaining({ roundNumber: 2 })
      );
    });

    it('should notify players about the new round', async () => {
      mockDb.round.create.mockResolvedValue({ id: 'round-2', roundNumber: 2 });

      await submitRoundSummary('round-1', 'user-1', { content: 'Summary' });

      expect(mockNotifyNewRound).toHaveBeenCalledWith('game-1', 'Test Game', 2);
    });

    it('should return summary and next round', async () => {
      mockDb.roundSummary.create.mockResolvedValue({ id: 'summary-1', content: 'Test' });
      mockDb.round.create.mockResolvedValue({ id: 'round-2', roundNumber: 2 });

      const result = await submitRoundSummary('round-1', 'user-1', { content: 'Test' });

      expect(result.summary).toEqual({ id: 'summary-1', content: 'Test' });
      expect(result.nextRound).toEqual({ id: 'round-2', roundNumber: 2 });
    });
  });

  describe('getRoundSummary', () => {
    it('should throw if round does not exist', async () => {
      mockDb.round.findUnique.mockResolvedValue(null);

      await expect(getRoundSummary('missing', 'user-1')).rejects.toThrow('Round not found');
    });

    it('should call requireMember for access control', async () => {
      mockDb.round.findUnique.mockResolvedValue({ id: 'round-1', gameId: 'game-1' });
      mockDb.roundSummary.findUnique.mockResolvedValue({ id: 'summary-1', content: 'Test' });

      await getRoundSummary('round-1', 'user-1');

      expect(mockRequireMember).toHaveBeenCalledWith('game-1', 'user-1');
    });

    it('should throw if summary does not exist', async () => {
      mockDb.round.findUnique.mockResolvedValue({ id: 'round-1', gameId: 'game-1' });
      mockDb.roundSummary.findUnique.mockResolvedValue(null);

      await expect(getRoundSummary('round-1', 'user-1')).rejects.toThrow('Round summary not found');
    });

    it('should return the summary when found', async () => {
      mockDb.round.findUnique.mockResolvedValue({ id: 'round-1', gameId: 'game-1' });
      const mockSummary = {
        id: 'summary-1',
        content: 'Great round!',
        author: { user: { displayName: 'Player 1' } },
      };
      mockDb.roundSummary.findUnique.mockResolvedValue(mockSummary);

      const result = await getRoundSummary('round-1', 'user-1');

      expect(result).toEqual(mockSummary);
    });
  });
});
