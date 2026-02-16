import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockGetGameTimeoutSettings, mockNotifyTimeoutOccurred } = vi.hoisted(() => {
  const mockDb = {
    game: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    action: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gamePlayer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    argument: {
      findFirst: vi.fn(),
      createMany: vi.fn(),
    },
    vote: {
      createMany: vi.fn(),
    },
    gameEvent: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  const mockGetGameTimeoutSettings = vi.fn();
  const mockNotifyTimeoutOccurred = vi.fn().mockResolvedValue(undefined);
  return { mockDb, mockGetGameTimeoutSettings, mockNotifyTimeoutOccurred };
});

vi.mock('../../../src/config/database.js', () => ({
  db: mockDb,
}));

vi.mock('../../../src/services/game.service.js', () => ({
  transitionPhase: vi.fn(),
  getGameTimeoutSettings: mockGetGameTimeoutSettings,
}));

vi.mock('../../../src/services/notification.service.js', () => ({
  notifyTimeoutOccurred: mockNotifyTimeoutOccurred,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { processAllTimeouts } from '../../../src/services/timeout.service.js';

describe('Timeout Service (Refactored)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processAllTimeouts', () => {
    it('should query for ACTIVE games with phaseStartedAt not null', async () => {
      mockDb.game.findMany.mockResolvedValue([]);

      await processAllTimeouts();

      expect(mockDb.game.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          currentPhase: {
            in: ['PROPOSAL', 'ARGUMENTATION', 'VOTING', 'NARRATION'],
          },
          phaseStartedAt: { not: null },
        },
        select: {
          id: true,
          name: true,
          currentPhase: true,
          phaseStartedAt: true,
          currentActionId: true,
          settings: true,
        },
      });
    });

    it('should return empty results when no games are timed out', async () => {
      mockDb.game.findMany.mockResolvedValue([]);

      const result = await processAllTimeouts();

      expect(result.results).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should skip games without timeout configured', async () => {
      const futureTime = new Date(Date.now() + 3600000); // 1 hour in future

      mockDb.game.findMany.mockResolvedValue([
        {
          id: 'game-1',
          name: 'Test Game',
          currentPhase: 'PROPOSAL',
          phaseStartedAt: futureTime,
          currentActionId: null,
          settings: { proposalTimeoutHours: -1 }, // No timeout
        },
      ]);

      mockGetGameTimeoutSettings.mockReturnValue({
        proposalTimeoutMs: null, // -1 converts to null
        argumentationTimeoutMs: null,
        votingTimeoutMs: null,
        narrationTimeoutMs: null,
      });

      const result = await processAllTimeouts();

      expect(result.results).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should skip games that have not timed out yet', async () => {
      const recentTime = new Date(Date.now() - 3600000); // 1 hour ago

      mockDb.game.findMany.mockResolvedValue([
        {
          id: 'game-1',
          name: 'Test Game',
          currentPhase: 'PROPOSAL',
          phaseStartedAt: recentTime,
          currentActionId: null,
          settings: { proposalTimeoutHours: 24 }, // 24 hour timeout
        },
      ]);

      mockGetGameTimeoutSettings.mockReturnValue({
        proposalTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
        argumentationTimeoutMs: null,
        votingTimeoutMs: null,
        narrationTimeoutMs: null,
      });

      const result = await processAllTimeouts();

      expect(result.results).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should process PROPOSAL timeout and notify host', async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      mockDb.game.findMany.mockResolvedValue([
        {
          id: 'game-1',
          name: 'Test Game',
          currentPhase: 'PROPOSAL',
          phaseStartedAt: oldTime,
          currentActionId: null,
          settings: { proposalTimeoutHours: 24 },
        },
      ]);

      mockGetGameTimeoutSettings.mockReturnValue({
        proposalTimeoutMs: 24 * 60 * 60 * 1000,
        argumentationTimeoutMs: null,
        votingTimeoutMs: null,
        narrationTimeoutMs: null,
      });

      mockDb.gameEvent.findFirst.mockResolvedValue(null);
      mockDb.gamePlayer.findFirst.mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        isHost: true,
        isActive: true,
      });
      mockDb.gameEvent.create.mockResolvedValue({});

      const result = await processAllTimeouts();

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        gameId: 'game-1',
        phase: 'PROPOSAL',
        playersAffected: 0,
        hostNotified: true,
      });
      expect(mockNotifyTimeoutOccurred).toHaveBeenCalledWith('game-1', 'Test Game', 'PROPOSAL', [
        'user-1',
      ]);
    });

    it('should handle PROPOSAL timeout without host', async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);

      mockDb.game.findMany.mockResolvedValue([
        {
          id: 'game-1',
          name: 'Test Game',
          currentPhase: 'PROPOSAL',
          phaseStartedAt: oldTime,
          currentActionId: null,
          settings: { proposalTimeoutHours: 24 },
        },
      ]);

      mockGetGameTimeoutSettings.mockReturnValue({
        proposalTimeoutMs: 24 * 60 * 60 * 1000,
        argumentationTimeoutMs: null,
        votingTimeoutMs: null,
        narrationTimeoutMs: null,
      });

      mockDb.gameEvent.findFirst.mockResolvedValue(null);
      mockDb.gamePlayer.findFirst.mockResolvedValue(null); // No host
      mockDb.gameEvent.create.mockResolvedValue({});

      const result = await processAllTimeouts();

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        gameId: 'game-1',
        phase: 'PROPOSAL',
        playersAffected: 0,
        hostNotified: false, // No host to notify
      });
      expect(mockNotifyTimeoutOccurred).not.toHaveBeenCalled();
    });

    it('should skip PROPOSAL timeout if already notified for this phase instance', async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);

      mockDb.game.findMany.mockResolvedValue([
        {
          id: 'game-1',
          name: 'Test Game',
          currentPhase: 'PROPOSAL',
          phaseStartedAt: oldTime,
          currentActionId: null,
          settings: { proposalTimeoutHours: 24 },
        },
      ]);

      mockGetGameTimeoutSettings.mockReturnValue({
        proposalTimeoutMs: 24 * 60 * 60 * 1000,
        argumentationTimeoutMs: null,
        votingTimeoutMs: null,
        narrationTimeoutMs: null,
      });

      // Already notified - event created after phaseStartedAt
      mockDb.gameEvent.findFirst.mockResolvedValue({
        createdAt: new Date(oldTime.getTime() + 1000),
      });
      mockDb.game.findUnique.mockResolvedValue({ phaseStartedAt: oldTime });

      const result = await processAllTimeouts();

      expect(result.results).toEqual([]);
    });

    it('should process ARGUMENTATION timeout', async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);

      mockDb.game.findMany.mockResolvedValue([
        {
          id: 'game-1',
          name: 'Test Game',
          currentPhase: 'ARGUMENTATION',
          phaseStartedAt: oldTime,
          currentActionId: 'action-1',
          settings: { argumentationTimeoutHours: 24 },
        },
      ]);

      mockGetGameTimeoutSettings.mockReturnValue({
        proposalTimeoutMs: null,
        argumentationTimeoutMs: 24 * 60 * 60 * 1000,
        votingTimeoutMs: null,
        narrationTimeoutMs: null,
      });

      mockDb.action.findUnique.mockResolvedValue({
        id: 'action-1',
        status: 'ARGUING',
        gameId: 'game-1',
        game: {
          name: 'Test Game',
          players: [
            { id: 'player-1', userId: 'user-1', isActive: true },
            { id: 'player-2', userId: 'user-2', isActive: true },
          ],
        },
        arguments: [{ playerId: 'player-1' }], // Only player-1 has argued
      });
      mockDb.argument.findFirst.mockResolvedValue({ sequence: 2 });
      mockDb.argument.createMany.mockResolvedValue({ count: 1 });
      mockDb.action.update.mockResolvedValue({});
      mockDb.gameEvent.create.mockResolvedValue({});

      const result = await processAllTimeouts();

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        actionId: 'action-1',
        gameId: 'game-1',
        phase: 'ARGUMENTATION',
        playersAffected: 1,
        newPhase: 'VOTING',
      });
      expect(mockDb.argument.createMany).toHaveBeenCalled();
    });

    it('should process VOTING timeout with auto-votes', async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);

      mockDb.game.findMany.mockResolvedValue([
        {
          id: 'game-1',
          name: 'Test Game',
          currentPhase: 'VOTING',
          phaseStartedAt: oldTime,
          currentActionId: 'action-1',
          settings: { votingTimeoutHours: 24 },
        },
      ]);

      mockGetGameTimeoutSettings.mockReturnValue({
        proposalTimeoutMs: null,
        argumentationTimeoutMs: null,
        votingTimeoutMs: 24 * 60 * 60 * 1000,
        narrationTimeoutMs: null,
      });

      mockDb.action.findUnique.mockResolvedValue({
        id: 'action-1',
        status: 'VOTING',
        gameId: 'game-1',
        game: {
          name: 'Test Game',
          players: [
            { id: 'player-1', userId: 'user-1', isActive: true },
            { id: 'player-2', userId: 'user-2', isActive: true },
          ],
        },
        votes: [{ playerId: 'player-1' }], // Only player-1 voted
      });
      mockDb.vote.createMany.mockResolvedValue({ count: 1 });
      mockDb.action.update.mockResolvedValue({});
      mockDb.gameEvent.create.mockResolvedValue({});

      const result = await processAllTimeouts();

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        actionId: 'action-1',
        gameId: 'game-1',
        phase: 'VOTING',
        playersAffected: 1,
        newPhase: 'RESOLUTION',
      });
      expect(mockDb.vote.createMany).toHaveBeenCalledWith({
        data: [
          {
            actionId: 'action-1',
            playerId: 'player-2',
            voteType: 'UNCERTAIN',
            successTokens: 1,
            failureTokens: 1,
          },
        ],
      });
    });

    it('should process NARRATION timeout and notify host', async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);

      mockDb.game.findMany.mockResolvedValue([
        {
          id: 'game-1',
          name: 'Test Game',
          currentPhase: 'NARRATION',
          phaseStartedAt: oldTime,
          currentActionId: null,
          settings: { narrationTimeoutHours: 24 },
        },
      ]);

      mockGetGameTimeoutSettings.mockReturnValue({
        proposalTimeoutMs: null,
        argumentationTimeoutMs: null,
        votingTimeoutMs: null,
        narrationTimeoutMs: 24 * 60 * 60 * 1000,
      });

      mockDb.gameEvent.findFirst.mockResolvedValue(null);
      mockDb.game.findUnique.mockResolvedValue({ phaseStartedAt: oldTime });
      mockDb.gamePlayer.findFirst.mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        isHost: true,
        isActive: true,
      });
      mockDb.gameEvent.create.mockResolvedValue({});

      const result = await processAllTimeouts();

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        gameId: 'game-1',
        phase: 'NARRATION',
        playersAffected: 0,
        hostNotified: true,
      });
    });

    it('should skip ARGUMENTATION timeout when no currentActionId', async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);

      mockDb.game.findMany.mockResolvedValue([
        {
          id: 'game-1',
          name: 'Test Game',
          currentPhase: 'ARGUMENTATION',
          phaseStartedAt: oldTime,
          currentActionId: null, // No action
          settings: { argumentationTimeoutHours: 24 },
        },
      ]);

      mockGetGameTimeoutSettings.mockReturnValue({
        proposalTimeoutMs: null,
        argumentationTimeoutMs: 24 * 60 * 60 * 1000,
        votingTimeoutMs: null,
        narrationTimeoutMs: null,
      });

      const result = await processAllTimeouts();

      expect(result.results).toEqual([]);
    });

    it('should collect errors without stopping the batch', async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);

      mockDb.game.findMany.mockResolvedValue([
        {
          id: 'game-1',
          name: 'Game 1',
          currentPhase: 'PROPOSAL',
          phaseStartedAt: oldTime,
          currentActionId: null,
          settings: { proposalTimeoutHours: 24 },
        },
        {
          id: 'game-2',
          name: 'Game 2',
          currentPhase: 'ARGUMENTATION',
          phaseStartedAt: oldTime,
          currentActionId: 'action-2',
          settings: { argumentationTimeoutHours: 24 },
        },
      ]);

      mockGetGameTimeoutSettings.mockReturnValue({
        proposalTimeoutMs: 24 * 60 * 60 * 1000,
        argumentationTimeoutMs: 24 * 60 * 60 * 1000,
        votingTimeoutMs: null,
        narrationTimeoutMs: null,
      });

      // First game succeeds
      mockDb.gameEvent.findFirst.mockResolvedValueOnce(null);
      mockDb.gamePlayer.findFirst.mockResolvedValueOnce({
        id: 'player-1',
        userId: 'user-1',
        isHost: true,
      });
      mockDb.gameEvent.create.mockResolvedValueOnce({});

      // Second game fails
      mockDb.action.findUnique.mockRejectedValueOnce(new Error('Database error'));

      const result = await processAllTimeouts();

      expect(result.results).toHaveLength(1); // Only first succeeded
      expect(result.errors).toHaveLength(1); // Second failed
      expect(result.errors[0]).toMatchObject({
        gameId: 'game-2',
      });
    });
  });
});
