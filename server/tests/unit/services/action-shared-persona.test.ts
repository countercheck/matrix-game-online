import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockRequireMember, mockLogGameEvent, mockTransitionPhase } = vi.hoisted(() => {
  const mockDb = {
    game: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gamePlayer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    action: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    argument: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    argumentationComplete: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    vote: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    gameEvent: {
      create: vi.fn(),
    },
  };
  const mockRequireMember = vi.fn();
  const mockLogGameEvent = vi.fn();
  const mockTransitionPhase = vi.fn();
  return { mockDb, mockRequireMember, mockLogGameEvent, mockTransitionPhase };
});

vi.mock('../../../src/config/database.js', () => ({
  db: mockDb,
}));

vi.mock('../../../src/services/game.service.js', () => ({
  requireMember: mockRequireMember,
  logGameEvent: mockLogGameEvent,
  transitionPhase: mockTransitionPhase,
}));

vi.mock('../../../src/services/notification.service.js', () => ({
  notifyActionProposed: vi.fn().mockResolvedValue(undefined),
  notifyVotingStarted: vi.fn().mockResolvedValue(undefined),
  notifyResolutionReady: vi.fn().mockResolvedValue(undefined),
  notifyNarrationNeeded: vi.fn().mockResolvedValue(undefined),
  notifyRoundSummaryNeeded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/services/resolution/index.js', () => ({
  getStrategy: () => ({
    mapVoteToTokens: (voteType: string) => {
      if (voteType === 'LIKELY_SUCCESS') return { successTokens: 2, failureTokens: 0 };
      if (voteType === 'LIKELY_FAILURE') return { successTokens: 0, failureTokens: 2 };
      return { successTokens: 1, failureTokens: 1 };
    },
  }),
}));

vi.mock('../../../src/middleware/errorHandler.js', async () => {
  const actual = await vi.importActual('../../../src/middleware/errorHandler.js');
  return actual;
});

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  proposeAction,
  addArgument,
  completeArgumentation,
  submitVote,
} from '../../../src/services/action.service.js';
import {
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from '../../../src/middleware/errorHandler.js';

describe('Action Service - Shared Personas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireMember.mockResolvedValue(undefined);
    mockLogGameEvent.mockResolvedValue(undefined);
    mockTransitionPhase.mockResolvedValue(undefined);
  });

  describe('proposeAction - lead enforcement', () => {
    it('should reject non-lead from proposing when shared personas enabled', async () => {
      const nonLeadPlayer = {
        id: 'p2',
        userId: 'u2',
        personaId: 'persona-1',
        isPersonaLead: false,
        isActive: true,
        isNpc: false,
      };

      mockDb.gamePlayer.findFirst.mockResolvedValue(nonLeadPlayer);
      mockDb.game.findUnique.mockResolvedValue({
        id: 'game-1',
        name: 'Test',
        deletedAt: null,
        currentPhase: 'PROPOSAL',
        currentRound: { id: 'round-1' },
        settings: { allowSharedPersonas: true },
        players: [
          nonLeadPlayer,
          {
            id: 'p1',
            userId: 'u1',
            personaId: 'persona-1',
            isPersonaLead: true,
            isActive: true,
            isNpc: false,
          },
        ],
      });

      await expect(
        proposeAction('game-1', 'u2', {
          actionDescription: 'Attack',
          desiredOutcome: 'Win',
          initialArguments: ['We are strong'],
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should allow lead to propose when shared personas enabled', async () => {
      const leadPlayer = {
        id: 'p1',
        userId: 'u1',
        personaId: 'persona-1',
        isPersonaLead: true,
        isActive: true,
        isNpc: false,
      };

      mockDb.gamePlayer.findFirst.mockResolvedValue(leadPlayer);
      mockDb.game.findUnique.mockResolvedValue({
        id: 'game-1',
        name: 'Test',
        deletedAt: null,
        currentPhase: 'PROPOSAL',
        currentRound: { id: 'round-1' },
        settings: { allowSharedPersonas: true },
        players: [leadPlayer],
      });
      // No existing persona action
      mockDb.action.findFirst.mockResolvedValueOnce(null);
      // Last action for sequence
      mockDb.action.findFirst.mockResolvedValueOnce(null);
      mockDb.action.create.mockResolvedValue({
        id: 'action-1',
        initiator: { user: { displayName: 'Alice' } },
        arguments: [],
      });
      mockDb.game.update.mockResolvedValue({});

      const result = await proposeAction('game-1', 'u1', {
        actionDescription: 'Attack',
        desiredOutcome: 'Win',
        initialArguments: ['We are strong'],
      });

      expect(result.id).toBe('action-1');
    });

    it('should reject if persona already proposed this round', async () => {
      const leadPlayer = {
        id: 'p1',
        userId: 'u1',
        personaId: 'persona-1',
        isPersonaLead: true,
        isActive: true,
        isNpc: false,
      };
      const memberPlayer = {
        id: 'p2',
        userId: 'u2',
        personaId: 'persona-1',
        isPersonaLead: false,
        isActive: true,
        isNpc: false,
      };

      mockDb.gamePlayer.findFirst.mockResolvedValue(leadPlayer);
      mockDb.game.findUnique.mockResolvedValue({
        id: 'game-1',
        name: 'Test',
        deletedAt: null,
        currentPhase: 'PROPOSAL',
        currentRound: { id: 'round-1' },
        settings: { allowSharedPersonas: true },
        players: [leadPlayer, memberPlayer],
      });
      // Existing persona action found
      mockDb.action.findFirst.mockResolvedValueOnce({ id: 'existing-action' });

      await expect(
        proposeAction('game-1', 'u1', {
          actionDescription: 'Attack again',
          desiredOutcome: 'Win again',
          initialArguments: ['Second try'],
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('addArgument - shared_pool', () => {
    it('should count arguments across all persona members in shared_pool mode', async () => {
      const player = {
        id: 'p2',
        userId: 'u2',
        personaId: 'persona-1',
        isActive: true,
        isNpc: false,
      };

      mockDb.action.findUnique.mockResolvedValue({
        id: 'action-1',
        status: 'ARGUING',
        initiatorId: 'p-other',
        game: {
          id: 'game-1',
          settings: {
            argumentLimit: 3,
            allowSharedPersonas: true,
            sharedPersonaArguments: 'shared_pool',
          },
        },
      });
      mockDb.gamePlayer.findFirst.mockResolvedValue(player);

      // All persona members
      mockDb.gamePlayer.findMany.mockResolvedValue([
        { id: 'p1', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p2', personaId: 'persona-1', isActive: true, isNpc: false },
      ]);

      // Pool already has 3 arguments
      mockDb.argument.count.mockResolvedValue(3);

      await expect(
        addArgument('action-1', 'u2', { argumentType: 'FOR', content: 'Good idea' })
      ).rejects.toThrow(BadRequestError);
    });

    it('should allow argument when shared pool has room', async () => {
      const player = {
        id: 'p2',
        userId: 'u2',
        personaId: 'persona-1',
        isActive: true,
        isNpc: false,
      };

      mockDb.action.findUnique.mockResolvedValue({
        id: 'action-1',
        status: 'ARGUING',
        gameId: 'game-1',
        initiatorId: 'p-other',
        game: {
          id: 'game-1',
          settings: {
            argumentLimit: 3,
            allowSharedPersonas: true,
            sharedPersonaArguments: 'shared_pool',
          },
        },
      });
      mockDb.gamePlayer.findFirst.mockResolvedValue(player);

      mockDb.gamePlayer.findMany.mockResolvedValue([
        { id: 'p1', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p2', personaId: 'persona-1', isActive: true, isNpc: false },
      ]);

      // Pool has 1 argument, under limit
      mockDb.argument.count.mockResolvedValue(1);
      mockDb.argument.findFirst.mockResolvedValue({ sequence: 1 });
      mockDb.argument.create.mockResolvedValue({
        id: 'arg-1',
        player: { user: { displayName: 'Bob' } },
      });

      const result = await addArgument('action-1', 'u2', {
        argumentType: 'FOR',
        content: 'Good idea',
      });

      expect(result.id).toBe('arg-1');
    });
  });

  describe('completeArgumentation - acting units threshold', () => {
    it('should use acting units threshold when shared personas enabled', async () => {
      const player = {
        id: 'p2',
        userId: 'u2',
        personaId: 'persona-1',
        isActive: true,
        isNpc: false,
      };

      // 2 players share persona-1, 1 solo player = 2 acting units
      const players = [
        { id: 'p1', userId: 'u1', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p2', userId: 'u2', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p3', userId: 'u3', personaId: null, isActive: true, isNpc: false },
      ];

      mockDb.action.findUnique.mockResolvedValue({
        id: 'action-1',
        status: 'ARGUING',
        gameId: 'game-1',
        game: {
          id: 'game-1',
          settings: { allowSharedPersonas: true },
          players,
        },
        arguments: [],
      });
      mockDb.gamePlayer.findFirst.mockResolvedValue(player);
      mockDb.argumentationComplete.upsert.mockResolvedValue({});

      // Only persona-1 member completed (counts as 1 unit), solo player not done yet
      mockDb.argumentationComplete.findMany.mockResolvedValue([{ playerId: 'p2' }]);

      const result = await completeArgumentation('action-1', 'u2');

      expect(result.message).toContain('Waiting');
      expect(result.playersRemaining).toBe(1); // solo player still pending
    });

    it('should transition to voting when all acting units done', async () => {
      const player = {
        id: 'p3',
        userId: 'u3',
        personaId: null,
        isActive: true,
        isNpc: false,
      };

      const players = [
        { id: 'p1', userId: 'u1', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p2', userId: 'u2', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p3', userId: 'u3', personaId: null, isActive: true, isNpc: false },
      ];

      mockDb.action.findUnique.mockResolvedValue({
        id: 'action-1',
        status: 'ARGUING',
        gameId: 'game-1',
        actionDescription: 'Test',
        game: {
          id: 'game-1',
          name: 'Test Game',
          settings: { allowSharedPersonas: true },
          players,
        },
        arguments: [],
      });
      mockDb.gamePlayer.findFirst.mockResolvedValue(player);
      mockDb.argumentationComplete.upsert.mockResolvedValue({});

      // Both acting units completed: persona-1 member + solo
      mockDb.argumentationComplete.findMany.mockResolvedValue([
        { playerId: 'p1' },
        { playerId: 'p3' },
      ]);

      mockDb.action.update.mockResolvedValue({});

      const result = await completeArgumentation('action-1', 'u3');

      expect(result.message).toContain('voting');
      expect(mockDb.action.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'action-1' },
          data: expect.objectContaining({ status: 'VOTING' }),
        })
      );
    });
  });

  describe('submitVote - one_per_persona', () => {
    it('should block second persona member from voting in one_per_persona mode', async () => {
      const player2 = {
        id: 'p2',
        userId: 'u2',
        personaId: 'persona-1',
        isActive: true,
        isNpc: false,
      };

      mockDb.action.findUnique.mockResolvedValue({
        id: 'action-1',
        status: 'VOTING',
        gameId: 'game-1',
      });
      mockDb.gamePlayer.findFirst.mockResolvedValue(player2);

      // No personal vote
      mockDb.vote.findUnique.mockResolvedValue(null);

      const players = [
        { id: 'p1', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p2', personaId: 'persona-1', isActive: true, isNpc: false },
      ];

      mockDb.game.findUnique.mockResolvedValue({
        id: 'game-1',
        deletedAt: null,
        settings: {
          allowSharedPersonas: true,
          sharedPersonaVoting: 'one_per_persona',
        },
        players,
      });

      // Another member already voted
      mockDb.vote.findFirst.mockResolvedValue({ id: 'vote-1', playerId: 'p1' });

      await expect(
        submitVote('action-1', 'u2', { voteType: 'LIKELY_SUCCESS' })
      ).rejects.toThrow(ConflictError);
    });

    it('should allow first persona member to vote in one_per_persona mode', async () => {
      const player1 = {
        id: 'p1',
        userId: 'u1',
        personaId: 'persona-1',
        isActive: true,
        isNpc: false,
      };

      mockDb.action.findUnique.mockResolvedValue({
        id: 'action-1',
        status: 'VOTING',
        gameId: 'game-1',
      });
      mockDb.gamePlayer.findFirst.mockResolvedValue(player1);
      mockDb.vote.findUnique.mockResolvedValue(null); // No personal vote

      const players = [
        { id: 'p1', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p2', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p3', personaId: null, isActive: true, isNpc: false },
      ];

      mockDb.game.findUnique.mockResolvedValue({
        id: 'game-1',
        deletedAt: null,
        name: 'Test',
        settings: {
          allowSharedPersonas: true,
          sharedPersonaVoting: 'one_per_persona',
        },
        players,
      });

      // No persona member voted yet
      mockDb.vote.findFirst.mockResolvedValue(null);
      mockDb.vote.create.mockResolvedValue({ id: 'vote-1' });
      mockDb.vote.count.mockResolvedValue(1); // Only 1 vote so far

      const result = await submitVote('action-1', 'u1', { voteType: 'LIKELY_SUCCESS' });

      expect(result.id).toBe('vote-1');
    });

    it('should use acting units as vote threshold in one_per_persona mode', async () => {
      const player = {
        id: 'p3',
        userId: 'u3',
        personaId: null,
        isActive: true,
        isNpc: false,
      };

      mockDb.action.findUnique.mockResolvedValue({
        id: 'action-1',
        status: 'VOTING',
        gameId: 'game-1',
      });
      mockDb.gamePlayer.findFirst.mockResolvedValue(player);
      mockDb.vote.findUnique.mockResolvedValue(null);

      // 2 players share persona-1, 1 solo = 2 acting units
      const players = [
        { id: 'p1', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p2', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p3', personaId: null, isActive: true, isNpc: false },
      ];

      mockDb.game.findUnique.mockResolvedValue({
        id: 'game-1',
        deletedAt: null,
        name: 'Test',
        settings: {
          allowSharedPersonas: true,
          sharedPersonaVoting: 'one_per_persona',
        },
        players,
      });

      mockDb.vote.findFirst.mockResolvedValue(null);
      mockDb.vote.create.mockResolvedValue({ id: 'vote-2' });
      // 2 votes = threshold met (2 acting units)
      mockDb.vote.count.mockResolvedValue(2);

      mockDb.action.findUnique.mockResolvedValueOnce({
        id: 'action-1',
        status: 'VOTING',
        gameId: 'game-1',
      });
      mockDb.action.findUnique.mockResolvedValueOnce({
        id: 'action-1',
        actionDescription: 'Test',
        initiator: { userId: 'u1', user: { id: 'u1' } },
      });
      mockDb.action.update.mockResolvedValue({});

      await submitVote('action-1', 'u3', { voteType: 'LIKELY_FAILURE' });

      // Should transition to resolution since threshold met
      expect(mockDb.action.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'RESOLVED' },
        })
      );
      expect(mockTransitionPhase).toHaveBeenCalled();
    });
  });

  describe('each_member voting (default)', () => {
    it('should allow all persona members to vote independently', async () => {
      const player2 = {
        id: 'p2',
        userId: 'u2',
        personaId: 'persona-1',
        isActive: true,
        isNpc: false,
      };

      mockDb.action.findUnique.mockResolvedValue({
        id: 'action-1',
        status: 'VOTING',
        gameId: 'game-1',
      });
      mockDb.gamePlayer.findFirst.mockResolvedValue(player2);
      mockDb.vote.findUnique.mockResolvedValue(null);

      const players = [
        { id: 'p1', personaId: 'persona-1', isActive: true, isNpc: false },
        { id: 'p2', personaId: 'persona-1', isActive: true, isNpc: false },
      ];

      mockDb.game.findUnique.mockResolvedValue({
        id: 'game-1',
        deletedAt: null,
        name: 'Test',
        settings: {
          allowSharedPersonas: true,
          sharedPersonaVoting: 'each_member', // default
        },
        players,
      });

      mockDb.vote.create.mockResolvedValue({ id: 'vote-2' });
      mockDb.vote.count.mockResolvedValue(1); // Not all voted yet

      const result = await submitVote('action-1', 'u2', { voteType: 'LIKELY_SUCCESS' });

      expect(result.id).toBe('vote-2');
    });
  });
});
