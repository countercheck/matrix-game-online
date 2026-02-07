import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockTransitionPhase, mockNotifyTimeoutOccurred } = vi.hoisted(() => {
  const mockDb = {
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
  };
  const mockTransitionPhase = vi.fn();
  const mockNotifyTimeoutOccurred = vi.fn().mockResolvedValue(undefined);
  return { mockDb, mockTransitionPhase, mockNotifyTimeoutOccurred };
});

vi.mock('../../../src/config/database.js', () => ({
  db: mockDb,
}));

vi.mock('../../../src/services/game.service.js', () => ({
  transitionPhase: mockTransitionPhase,
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

import {
  getTimedOutArgumentationActions,
  getTimedOutVotingActions,
  processArgumentationTimeout,
  processVotingTimeout,
  processAllTimeouts,
  getActionTimeoutStatus,
} from '../../../src/services/timeout.service.js';

describe('Timeout Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTimedOutArgumentationActions', () => {
    it('should query for ARGUING actions past the cutoff time', async () => {
      mockDb.action.findMany.mockResolvedValue([]);

      await getTimedOutArgumentationActions();

      expect(mockDb.action.findMany).toHaveBeenCalledOnce();
      const call = mockDb.action.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('ARGUING');
      expect(call.where.argumentationStartedAt.lt).toBeInstanceOf(Date);
      expect(call.select).toEqual({
        id: true,
        gameId: true,
        argumentationStartedAt: true,
      });
    });

    it('should use default 24-hour timeout', async () => {
      mockDb.action.findMany.mockResolvedValue([]);

      const before = Date.now();
      await getTimedOutArgumentationActions();
      const after = Date.now();

      const cutoff = mockDb.action.findMany.mock.calls[0][0].where.argumentationStartedAt.lt;
      const expectedCutoff24h = 24 * 60 * 60 * 1000;

      // Cutoff should be ~24 hours ago
      expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(expectedCutoff24h - 100);
      expect(after - cutoff.getTime()).toBeLessThanOrEqual(expectedCutoff24h + 100);
    });

    it('should respect custom timeout duration', async () => {
      mockDb.action.findMany.mockResolvedValue([]);

      const customMs = 1 * 60 * 60 * 1000; // 1 hour
      const before = Date.now();
      await getTimedOutArgumentationActions({ argumentationTimeoutMs: customMs });
      const after = Date.now();

      const cutoff = mockDb.action.findMany.mock.calls[0][0].where.argumentationStartedAt.lt;
      expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(customMs - 100);
      expect(after - cutoff.getTime()).toBeLessThanOrEqual(customMs + 100);
    });

    it('should filter out actions with null argumentationStartedAt', async () => {
      mockDb.action.findMany.mockResolvedValue([
        { id: 'a1', gameId: 'g1', argumentationStartedAt: new Date() },
        { id: 'a2', gameId: 'g2', argumentationStartedAt: null },
      ]);

      const result = await getTimedOutArgumentationActions();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });

    it('should return all actions with non-null timestamps', async () => {
      const actions = [
        { id: 'a1', gameId: 'g1', argumentationStartedAt: new Date('2024-01-01') },
        { id: 'a2', gameId: 'g2', argumentationStartedAt: new Date('2024-01-02') },
      ];
      mockDb.action.findMany.mockResolvedValue(actions);

      const result = await getTimedOutArgumentationActions();

      expect(result).toHaveLength(2);
    });
  });

  describe('getTimedOutVotingActions', () => {
    it('should query for VOTING actions past the cutoff time', async () => {
      mockDb.action.findMany.mockResolvedValue([]);

      await getTimedOutVotingActions();

      expect(mockDb.action.findMany).toHaveBeenCalledOnce();
      const call = mockDb.action.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('VOTING');
      expect(call.where.votingStartedAt.lt).toBeInstanceOf(Date);
      expect(call.select).toEqual({
        id: true,
        gameId: true,
        votingStartedAt: true,
      });
    });

    it('should respect custom voting timeout duration', async () => {
      mockDb.action.findMany.mockResolvedValue([]);

      const customMs = 2 * 60 * 60 * 1000;
      const before = Date.now();
      await getTimedOutVotingActions({ votingTimeoutMs: customMs });
      const after = Date.now();

      const cutoff = mockDb.action.findMany.mock.calls[0][0].where.votingStartedAt.lt;
      expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(customMs - 100);
      expect(after - cutoff.getTime()).toBeLessThanOrEqual(customMs + 100);
    });

    it('should filter out actions with null votingStartedAt', async () => {
      mockDb.action.findMany.mockResolvedValue([
        { id: 'a1', gameId: 'g1', votingStartedAt: new Date() },
        { id: 'a2', gameId: 'g2', votingStartedAt: null },
      ]);

      const result = await getTimedOutVotingActions();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });
  });

  describe('processArgumentationTimeout', () => {
    const mockAction = {
      id: 'action-1',
      gameId: 'game-1',
      status: 'ARGUING',
      game: {
        name: 'Test Game',
        players: [
          { id: 'player-1', userId: 'user-1', isActive: true },
          { id: 'player-2', userId: 'user-2', isActive: true },
          { id: 'player-3', userId: 'user-3', isActive: true },
        ],
      },
      arguments: [{ playerId: 'player-1' }],
    };

    beforeEach(() => {
      mockDb.action.findUnique.mockResolvedValue(mockAction);
      mockDb.argument.findFirst.mockResolvedValue({ sequence: 1 });
      mockDb.argument.createMany.mockResolvedValue({ count: 2 });
      mockDb.action.update.mockResolvedValue({});
      mockDb.gameEvent.create.mockResolvedValue({});
      mockTransitionPhase.mockResolvedValue({});
    });

    it('should throw if action is not found', async () => {
      mockDb.action.findUnique.mockResolvedValue(null);

      await expect(processArgumentationTimeout('missing-id')).rejects.toThrow(
        'Action not found: missing-id'
      );
    });

    it('should throw if action is not in ARGUING phase', async () => {
      mockDb.action.findUnique.mockResolvedValue({
        ...mockAction,
        status: 'VOTING',
      });

      await expect(processArgumentationTimeout('action-1')).rejects.toThrow(
        'not in argumentation phase'
      );
    });

    it('should create placeholder arguments for players who have not argued', async () => {
      await processArgumentationTimeout('action-1');

      expect(mockDb.argument.createMany).toHaveBeenCalledOnce();
      const createCall = mockDb.argument.createMany.mock.calls[0][0];
      expect(createCall.data).toHaveLength(2);

      const playerIds = createCall.data.map((d: any) => d.playerId);
      expect(playerIds).toContain('player-2');
      expect(playerIds).toContain('player-3');

      createCall.data.forEach((arg: any) => {
        expect(arg.actionId).toBe('action-1');
        expect(arg.argumentType).toBe('FOR');
        expect(arg.content).toBe('[No argument submitted - timed out]');
      });
    });

    it('should assign sequential sequence numbers starting after the last argument', async () => {
      mockDb.argument.findFirst.mockResolvedValue({ sequence: 5 });

      await processArgumentationTimeout('action-1');

      const createCall = mockDb.argument.createMany.mock.calls[0][0];
      const sequences = createCall.data.map((d: any) => d.sequence);
      expect(sequences).toEqual([6, 7]);
    });

    it('should start sequence at 1 if no prior arguments exist', async () => {
      mockDb.argument.findFirst.mockResolvedValue(null);

      await processArgumentationTimeout('action-1');

      const createCall = mockDb.argument.createMany.mock.calls[0][0];
      expect(createCall.data[0].sequence).toBe(1);
    });

    it('should update action status to VOTING with votingStartedAt', async () => {
      const before = new Date();
      await processArgumentationTimeout('action-1');
      const after = new Date();

      expect(mockDb.action.update).toHaveBeenCalledOnce();
      const updateCall = mockDb.action.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('action-1');
      expect(updateCall.data.status).toBe('VOTING');
      expect(updateCall.data.votingStartedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updateCall.data.votingStartedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should transition game phase to VOTING', async () => {
      await processArgumentationTimeout('action-1');

      expect(mockTransitionPhase).toHaveBeenCalledWith('game-1', 'VOTING');
    });

    it('should create a game event for the timeout', async () => {
      await processArgumentationTimeout('action-1');

      expect(mockDb.gameEvent.create).toHaveBeenCalledOnce();
      const eventCall = mockDb.gameEvent.create.mock.calls[0][0];
      expect(eventCall.data.gameId).toBe('game-1');
      expect(eventCall.data.eventType).toBe('ARGUMENTATION_TIMEOUT');
      expect(eventCall.data.eventData.actionId).toBe('action-1');
      expect(eventCall.data.eventData.autoArgumentedPlayerIds).toEqual(['player-2', 'player-3']);
    });

    it('should send timeout notification', async () => {
      await processArgumentationTimeout('action-1');

      expect(mockNotifyTimeoutOccurred).toHaveBeenCalledWith(
        'game-1',
        'Test Game',
        'ARGUMENTATION',
        ['user-2', 'user-3']
      );
    });

    it('should return correct TimeoutResult', async () => {
      const result = await processArgumentationTimeout('action-1');

      expect(result).toEqual({
        actionId: 'action-1',
        gameId: 'game-1',
        phase: 'ARGUMENTATION',
        playersAffected: 2,
        newPhase: 'VOTING',
      });
    });

    it('should skip creating arguments when all players have argued', async () => {
      mockDb.action.findUnique.mockResolvedValue({
        ...mockAction,
        arguments: [
          { playerId: 'player-1' },
          { playerId: 'player-2' },
          { playerId: 'player-3' },
        ],
      });

      const result = await processArgumentationTimeout('action-1');

      expect(mockDb.argument.createMany).not.toHaveBeenCalled();
      expect(result.playersAffected).toBe(0);
      // Should still transition phase
      expect(mockDb.action.update).toHaveBeenCalledOnce();
      expect(mockTransitionPhase).toHaveBeenCalledOnce();
    });
  });

  describe('processVotingTimeout', () => {
    const mockAction = {
      id: 'action-1',
      gameId: 'game-1',
      status: 'VOTING',
      game: {
        name: 'Test Game',
        players: [
          { id: 'player-1', userId: 'user-1', isActive: true },
          { id: 'player-2', userId: 'user-2', isActive: true },
          { id: 'player-3', userId: 'user-3', isActive: true },
        ],
      },
      votes: [{ playerId: 'player-1' }],
    };

    beforeEach(() => {
      mockDb.action.findUnique.mockResolvedValue(mockAction);
      mockDb.vote.createMany.mockResolvedValue({ count: 2 });
      mockDb.action.update.mockResolvedValue({});
      mockDb.gameEvent.create.mockResolvedValue({});
      mockTransitionPhase.mockResolvedValue({});
    });

    it('should throw if action is not found', async () => {
      mockDb.action.findUnique.mockResolvedValue(null);

      await expect(processVotingTimeout('missing-id')).rejects.toThrow(
        'Action not found: missing-id'
      );
    });

    it('should throw if action is not in VOTING phase', async () => {
      mockDb.action.findUnique.mockResolvedValue({
        ...mockAction,
        status: 'ARGUING',
      });

      await expect(processVotingTimeout('action-1')).rejects.toThrow(
        'not in voting phase'
      );
    });

    it('should create UNCERTAIN auto-votes for players who have not voted', async () => {
      await processVotingTimeout('action-1');

      expect(mockDb.vote.createMany).toHaveBeenCalledOnce();
      const createCall = mockDb.vote.createMany.mock.calls[0][0];
      expect(createCall.data).toHaveLength(2);

      const playerIds = createCall.data.map((d: any) => d.playerId);
      expect(playerIds).toContain('player-2');
      expect(playerIds).toContain('player-3');

      createCall.data.forEach((vote: any) => {
        expect(vote.actionId).toBe('action-1');
        expect(vote.voteType).toBe('UNCERTAIN');
        expect(vote.successTokens).toBe(1);
        expect(vote.failureTokens).toBe(1);
      });
    });

    it('should update action status to RESOLVED', async () => {
      await processVotingTimeout('action-1');

      expect(mockDb.action.update).toHaveBeenCalledOnce();
      const updateCall = mockDb.action.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('action-1');
      expect(updateCall.data.status).toBe('RESOLVED');
    });

    it('should transition game phase to RESOLUTION', async () => {
      await processVotingTimeout('action-1');

      expect(mockTransitionPhase).toHaveBeenCalledWith('game-1', 'RESOLUTION');
    });

    it('should create a game event for the timeout', async () => {
      await processVotingTimeout('action-1');

      expect(mockDb.gameEvent.create).toHaveBeenCalledOnce();
      const eventCall = mockDb.gameEvent.create.mock.calls[0][0];
      expect(eventCall.data.gameId).toBe('game-1');
      expect(eventCall.data.eventType).toBe('VOTING_TIMEOUT');
      expect(eventCall.data.eventData.actionId).toBe('action-1');
      expect(eventCall.data.eventData.autoVotedPlayerIds).toEqual(['player-2', 'player-3']);
    });

    it('should send timeout notification', async () => {
      await processVotingTimeout('action-1');

      expect(mockNotifyTimeoutOccurred).toHaveBeenCalledWith(
        'game-1',
        'Test Game',
        'VOTING',
        ['user-2', 'user-3']
      );
    });

    it('should return correct TimeoutResult', async () => {
      const result = await processVotingTimeout('action-1');

      expect(result).toEqual({
        actionId: 'action-1',
        gameId: 'game-1',
        phase: 'VOTING',
        playersAffected: 2,
        newPhase: 'RESOLUTION',
      });
    });

    it('should skip creating votes when all players have voted', async () => {
      mockDb.action.findUnique.mockResolvedValue({
        ...mockAction,
        votes: [
          { playerId: 'player-1' },
          { playerId: 'player-2' },
          { playerId: 'player-3' },
        ],
      });

      const result = await processVotingTimeout('action-1');

      expect(mockDb.vote.createMany).not.toHaveBeenCalled();
      expect(result.playersAffected).toBe(0);
      // Should still transition phase
      expect(mockDb.action.update).toHaveBeenCalledOnce();
      expect(mockTransitionPhase).toHaveBeenCalledOnce();
    });
  });

  describe('processAllTimeouts', () => {
    it('should process both argumentation and voting timeouts', async () => {
      // Mock getTimedOutArgumentationActions
      mockDb.action.findMany
        .mockResolvedValueOnce([
          { id: 'arg-action-1', gameId: 'g1', argumentationStartedAt: new Date() },
        ])
        // Mock getTimedOutVotingActions
        .mockResolvedValueOnce([
          { id: 'vote-action-1', gameId: 'g2', votingStartedAt: new Date() },
        ]);

      // Mock processArgumentationTimeout's findUnique
      mockDb.action.findUnique
        .mockResolvedValueOnce({
          id: 'arg-action-1',
          gameId: 'g1',
          status: 'ARGUING',
          game: { name: 'Game 1', players: [] },
          arguments: [],
        })
        // Mock processVotingTimeout's findUnique
        .mockResolvedValueOnce({
          id: 'vote-action-1',
          gameId: 'g2',
          status: 'VOTING',
          game: { name: 'Game 2', players: [] },
          votes: [],
        });

      mockDb.action.update.mockResolvedValue({});
      mockDb.gameEvent.create.mockResolvedValue({});
      mockTransitionPhase.mockResolvedValue({});

      const results = await processAllTimeouts();

      expect(results.argumentationTimeouts).toHaveLength(1);
      expect(results.argumentationTimeouts[0].actionId).toBe('arg-action-1');
      expect(results.votingTimeouts).toHaveLength(1);
      expect(results.votingTimeouts[0].actionId).toBe('vote-action-1');
      expect(results.errors).toHaveLength(0);
    });

    it('should collect errors without stopping the batch', async () => {
      mockDb.action.findMany
        .mockResolvedValueOnce([
          { id: 'action-1', gameId: 'g1', argumentationStartedAt: new Date() },
          { id: 'action-2', gameId: 'g2', argumentationStartedAt: new Date() },
        ])
        .mockResolvedValueOnce([]); // no voting timeouts

      // First action fails, second succeeds
      mockDb.action.findUnique
        .mockResolvedValueOnce(null) // action-1 not found
        .mockResolvedValueOnce({
          id: 'action-2',
          gameId: 'g2',
          status: 'ARGUING',
          game: { name: 'Game 2', players: [] },
          arguments: [],
        });

      mockDb.action.update.mockResolvedValue({});
      mockDb.gameEvent.create.mockResolvedValue({});
      mockTransitionPhase.mockResolvedValue({});

      const results = await processAllTimeouts();

      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].actionId).toBe('action-1');
      expect(results.errors[0].error).toContain('not found');
      expect(results.argumentationTimeouts).toHaveLength(1);
      expect(results.argumentationTimeouts[0].actionId).toBe('action-2');
    });

    it('should return empty results when no actions are timed out', async () => {
      mockDb.action.findMany.mockResolvedValue([]);

      const results = await processAllTimeouts();

      expect(results.argumentationTimeouts).toHaveLength(0);
      expect(results.votingTimeouts).toHaveLength(0);
      expect(results.errors).toHaveLength(0);
    });

    it('should pass config through to query functions', async () => {
      mockDb.action.findMany.mockResolvedValue([]);

      const config = { argumentationTimeoutMs: 5000, votingTimeoutMs: 10000 };
      await processAllTimeouts(config);

      // Two calls: one for argumentation, one for voting
      expect(mockDb.action.findMany).toHaveBeenCalledTimes(2);

      const argCutoff = mockDb.action.findMany.mock.calls[0][0].where.argumentationStartedAt.lt;
      const voteCutoff = mockDb.action.findMany.mock.calls[1][0].where.votingStartedAt.lt;

      // Argumentation cutoff should be more recent (shorter timeout)
      expect(argCutoff.getTime()).toBeGreaterThan(voteCutoff.getTime());
    });
  });

  describe('getActionTimeoutStatus', () => {
    it('should return null for non-existent action', async () => {
      mockDb.action.findUnique.mockResolvedValue(null);

      const result = await getActionTimeoutStatus('missing-id');

      expect(result).toBeNull();
    });

    it('should return argumentation timeout status for ARGUING action', async () => {
      const startedAt = new Date(Date.now() - 23 * 60 * 60 * 1000); // 23 hours ago
      mockDb.action.findUnique.mockResolvedValue({
        status: 'ARGUING',
        argumentationStartedAt: startedAt,
        votingStartedAt: null,
      });

      const result = await getActionTimeoutStatus('action-1');

      expect(result).not.toBeNull();
      expect(result!.phase).toBe('ARGUMENTATION');
      expect(result!.startedAt).toBe(startedAt);
      expect(result!.isTimedOut).toBe(false);
      // ~1 hour remaining
      expect(result!.remainingMs).toBeGreaterThan(50 * 60 * 1000);
      expect(result!.remainingMs).toBeLessThan(70 * 60 * 1000);
    });

    it('should show isTimedOut=true for expired argumentation action', async () => {
      const startedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      mockDb.action.findUnique.mockResolvedValue({
        status: 'ARGUING',
        argumentationStartedAt: startedAt,
        votingStartedAt: null,
      });

      const result = await getActionTimeoutStatus('action-1');

      expect(result!.isTimedOut).toBe(true);
      expect(result!.remainingMs).toBe(0);
    });

    it('should return voting timeout status for VOTING action', async () => {
      const startedAt = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      mockDb.action.findUnique.mockResolvedValue({
        status: 'VOTING',
        argumentationStartedAt: null,
        votingStartedAt: startedAt,
      });

      const result = await getActionTimeoutStatus('action-1');

      expect(result!.phase).toBe('VOTING');
      expect(result!.startedAt).toBe(startedAt);
      expect(result!.isTimedOut).toBe(false);
      // ~12 hours remaining
      expect(result!.remainingMs).toBeGreaterThan(11 * 60 * 60 * 1000);
      expect(result!.remainingMs).toBeLessThan(13 * 60 * 60 * 1000);
    });

    it('should respect custom timeout config', async () => {
      const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      mockDb.action.findUnique.mockResolvedValue({
        status: 'ARGUING',
        argumentationStartedAt: startedAt,
        votingStartedAt: null,
      });

      // With 1 hour timeout, should be timed out
      const result = await getActionTimeoutStatus('action-1', {
        argumentationTimeoutMs: 1 * 60 * 60 * 1000,
      });

      expect(result!.isTimedOut).toBe(true);
      expect(result!.remainingMs).toBe(0);
    });

    it('should return null timeout fields for actions not in a timed phase', async () => {
      mockDb.action.findUnique.mockResolvedValue({
        status: 'PROPOSED',
        argumentationStartedAt: null,
        votingStartedAt: null,
      });

      const result = await getActionTimeoutStatus('action-1');

      expect(result).not.toBeNull();
      expect(result!.phase).toBe('PROPOSED');
      expect(result!.startedAt).toBeNull();
      expect(result!.timeoutAt).toBeNull();
      expect(result!.isTimedOut).toBe(false);
      expect(result!.remainingMs).toBeNull();
    });
  });
});
