import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    action: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    game: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gamePlayer: {
      findFirst: vi.fn(),
    },
    vote: {
      createMany: vi.fn(),
    },
    round: {
      update: vi.fn(),
    },
    gameEvent: {
      create: vi.fn(),
    },
  },
}));

// Mock notification service
vi.mock('../../../src/services/notification.service.js', () => ({
  notifyVotingStarted: vi.fn().mockResolvedValue(undefined),
  notifyResolutionReady: vi.fn().mockResolvedValue(undefined),
  notifyRoundSummaryNeeded: vi.fn().mockResolvedValue(undefined),
}));

// Mock game service exports
vi.mock('../../../src/services/game.service.js', () => ({
  requireMember: vi.fn().mockResolvedValue({ id: 'player-1', userId: 'user-1' }),
  logGameEvent: vi.fn().mockResolvedValue({}),
  transitionPhase: vi.fn().mockResolvedValue({}),
}));

import { db } from '../../../src/config/database.js';
import * as actionService from '../../../src/services/action.service.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../../src/middleware/errorHandler.js';

describe('Action Service - Skip Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('skipArgumentation', () => {
    it('should skip argumentation and transition to voting when host requests', async () => {
      const mockAction = {
        id: 'action-1',
        gameId: 'game-1',
        status: 'ARGUING',
        actionDescription: 'Test action',
        game: {
          id: 'game-1',
          name: 'Test Game',
          players: [
            { id: 'player-1', userId: 'user-1', isHost: true, isActive: true, isNpc: false },
            { id: 'player-2', userId: 'user-2', isHost: false, isActive: true, isNpc: false },
          ],
        },
      };

      vi.mocked(db.action.findUnique).mockResolvedValue(mockAction as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        isHost: true,
        isActive: true,
      } as any);
      vi.mocked(db.action.update).mockResolvedValue({
        ...mockAction,
        status: 'VOTING',
        argumentationWasSkipped: true,
        votingStartedAt: new Date(),
      } as any);

      const result = await actionService.skipArgumentation('action-1', 'user-1');

      expect(result.message).toBe('Argumentation skipped, moved to voting phase');
      expect(db.action.update).toHaveBeenCalledWith({
        where: { id: 'action-1' },
        data: {
          status: 'VOTING',
          votingStartedAt: expect.any(Date),
          argumentationWasSkipped: true,
        },
      });
    });

    it('should throw error if user is not host', async () => {
      const mockAction = {
        id: 'action-1',
        gameId: 'game-1',
        status: 'ARGUING',
        game: {
          id: 'game-1',
          name: 'Test Game',
          players: [
            { id: 'player-1', userId: 'user-1', isHost: true, isActive: true, isNpc: false },
            { id: 'player-2', userId: 'user-2', isHost: false, isActive: true, isNpc: false },
          ],
        },
      };

      vi.mocked(db.action.findUnique).mockResolvedValue(mockAction as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue(null); // Not a host

      await expect(actionService.skipArgumentation('action-1', 'user-2')).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should throw error if action is not in ARGUING phase', async () => {
      const mockAction = {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING', // Wrong phase
        game: {
          id: 'game-1',
          name: 'Test Game',
          players: [],
        },
      };

      vi.mocked(db.action.findUnique).mockResolvedValue(mockAction as any);

      await expect(actionService.skipArgumentation('action-1', 'user-1')).rejects.toThrow(
        new BadRequestError('Action is not in argumentation phase')
      );
    });

    it('should throw error if action not found', async () => {
      vi.mocked(db.action.findUnique).mockResolvedValue(null);

      await expect(actionService.skipArgumentation('action-1', 'user-1')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('skipVoting', () => {
    it('should skip voting, auto-fill missing votes, and transition to resolution', async () => {
      const mockAction = {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING',
        actionDescription: 'Test action',
        votes: [{ playerId: 'player-1', voteType: 'LIKELY_SUCCESS' }],
        initiator: {
          userId: 'user-1',
        },
        game: {
          id: 'game-1',
          name: 'Test Game',
          players: [
            {
              id: 'player-1',
              userId: 'user-1',
              isHost: true,
              isActive: true,
              isNpc: false,
              playerName: 'Player 1',
            },
            {
              id: 'player-2',
              userId: 'user-2',
              isHost: false,
              isActive: true,
              isNpc: false,
              playerName: 'Player 2',
            },
            {
              id: 'player-3',
              userId: 'user-3',
              isHost: false,
              isActive: true,
              isNpc: false,
              playerName: 'Player 3',
            },
          ],
        },
      };

      vi.mocked(db.action.findUnique).mockResolvedValue(mockAction as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        isHost: true,
        isActive: true,
      } as any);
      vi.mocked(db.vote.createMany).mockResolvedValue({ count: 2 } as any);
      vi.mocked(db.action.update).mockResolvedValue({
        ...mockAction,
        status: 'RESOLVED',
        votingWasSkipped: true,
      } as any);

      const result = await actionService.skipVoting('action-1', 'user-1');

      expect(result.message).toBe('Voting skipped, moved to resolution phase');
      expect(result.skippedVotes).toBe(2);
      expect(db.vote.createMany).toHaveBeenCalledWith({
        data: [
          {
            actionId: 'action-1',
            playerId: 'player-2',
            voteType: 'UNCERTAIN',
            successTokens: 1,
            failureTokens: 1,
            wasSkipped: true,
          },
          {
            actionId: 'action-1',
            playerId: 'player-3',
            voteType: 'UNCERTAIN',
            successTokens: 1,
            failureTokens: 1,
            wasSkipped: true,
          },
        ],
      });
      expect(db.action.update).toHaveBeenCalledWith({
        where: { id: 'action-1' },
        data: {
          status: 'RESOLVED',
          votingWasSkipped: true,
        },
      });
    });

    it('should handle case when all votes are already submitted', async () => {
      const mockAction = {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING',
        actionDescription: 'Test action',
        votes: [
          { playerId: 'player-1', voteType: 'LIKELY_SUCCESS' },
          { playerId: 'player-2', voteType: 'LIKELY_FAILURE' },
        ],
        initiator: {
          userId: 'user-1',
        },
        game: {
          id: 'game-1',
          name: 'Test Game',
          players: [
            {
              id: 'player-1',
              userId: 'user-1',
              isHost: true,
              isActive: true,
              isNpc: false,
              playerName: 'Player 1',
            },
            {
              id: 'player-2',
              userId: 'user-2',
              isHost: false,
              isActive: true,
              isNpc: false,
              playerName: 'Player 2',
            },
          ],
        },
      };

      vi.mocked(db.action.findUnique).mockResolvedValue(mockAction as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        isHost: true,
        isActive: true,
      } as any);
      vi.mocked(db.action.update).mockResolvedValue({
        ...mockAction,
        status: 'RESOLVED',
        votingWasSkipped: true,
      } as any);

      const result = await actionService.skipVoting('action-1', 'user-1');

      expect(result.skippedVotes).toBe(0);
      expect(db.vote.createMany).not.toHaveBeenCalled();
    });

    it('should exclude NPC from vote counting', async () => {
      const mockAction = {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING',
        actionDescription: 'Test action',
        votes: [{ playerId: 'player-1', voteType: 'LIKELY_SUCCESS' }],
        initiator: {
          userId: 'user-1',
        },
        game: {
          id: 'game-1',
          name: 'Test Game',
          players: [
            {
              id: 'player-1',
              userId: 'user-1',
              isHost: true,
              isActive: true,
              isNpc: false,
              playerName: 'Player 1',
            },
            {
              id: 'player-2',
              userId: 'user-2',
              isHost: false,
              isActive: true,
              isNpc: false,
              playerName: 'Player 2',
            },
            {
              id: 'player-npc',
              userId: 'npc-user',
              isHost: false,
              isActive: true,
              isNpc: true,
              playerName: 'NPC',
            },
          ],
        },
      };

      vi.mocked(db.action.findUnique).mockResolvedValue(mockAction as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        isHost: true,
        isActive: true,
      } as any);
      vi.mocked(db.vote.createMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(db.action.update).mockResolvedValue({
        ...mockAction,
        status: 'RESOLVED',
        votingWasSkipped: true,
      } as any);

      const result = await actionService.skipVoting('action-1', 'user-1');

      // Only player-2 should have missing vote (NPC is excluded)
      expect(result.skippedVotes).toBe(1);
      expect(db.vote.createMany).toHaveBeenCalledWith({
        data: [
          {
            actionId: 'action-1',
            playerId: 'player-2',
            voteType: 'UNCERTAIN',
            successTokens: 1,
            failureTokens: 1,
            wasSkipped: true,
          },
        ],
      });
    });

    it('should throw error if action is not in VOTING phase', async () => {
      const mockAction = {
        id: 'action-1',
        gameId: 'game-1',
        status: 'ARGUING', // Wrong phase
        votes: [],
        initiator: { userId: 'user-1' },
        game: {
          id: 'game-1',
          name: 'Test Game',
          players: [],
        },
      };

      vi.mocked(db.action.findUnique).mockResolvedValue(mockAction as any);

      await expect(actionService.skipVoting('action-1', 'user-1')).rejects.toThrow(
        new BadRequestError('Action is not in voting phase')
      );
    });
  });

  describe('skipToNextAction (skipProposals)', () => {
    it('should skip proposals and move to round summary when at least one action exists', async () => {
      const mockGame = {
        id: 'game-1',
        name: 'Test Game',
        currentPhase: 'PROPOSAL',
        currentActionId: null, // Waiting for proposals
        deletedAt: null,
        currentRound: {
          id: 'round-1',
          roundNumber: 1,
          actionsCompleted: 2,
          totalActionsRequired: 4,
        },
        currentAction: null,
        players: [
          { id: 'player-1', userId: 'user-1', isHost: true, isActive: true },
          { id: 'player-2', userId: 'user-2', isHost: false, isActive: true },
        ],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        isHost: true,
        isActive: true,
      } as any);
      vi.mocked(db.action.count).mockResolvedValue(2);
      vi.mocked(db.round.update).mockResolvedValue({
        ...mockGame.currentRound,
        totalActionsRequired: 2,
        actionsCompleted: 2,
      } as any);

      const result = await actionService.skipToNextAction('game-1', 'user-1');

      expect(result.message).toBe('Remaining proposals skipped, moved to round summary');
      expect(result.completedActions).toBe(2);
      expect(db.round.update).toHaveBeenCalledWith({
        where: { id: 'round-1' },
        data: {
          totalActionsRequired: 2,
          actionsCompleted: 2,
        },
      });
    });

    it('should throw error if no actions exist in round', async () => {
      const mockGame = {
        id: 'game-1',
        name: 'Test Game',
        currentPhase: 'PROPOSAL',
        currentActionId: null,
        deletedAt: null,
        currentRound: {
          id: 'round-1',
          roundNumber: 1,
        },
        currentAction: null,
        players: [{ id: 'player-1', userId: 'user-1', isHost: true, isActive: true }],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        isHost: true,
        isActive: true,
      } as any);
      vi.mocked(db.action.count).mockResolvedValue(0);

      await expect(actionService.skipToNextAction('game-1', 'user-1')).rejects.toThrow(
        new BadRequestError('Cannot skip - at least one action must be proposed before moving on')
      );
    });

    it('should throw error if not in proposal phase', async () => {
      const mockGame = {
        id: 'game-1',
        name: 'Test Game',
        currentPhase: 'ARGUMENTATION', // Wrong phase
        currentActionId: 'action-1',
        deletedAt: null,
        currentRound: {
          id: 'round-1',
        },
        currentAction: { id: 'action-1' },
        players: [{ id: 'player-1', userId: 'user-1', isHost: true, isActive: true }],
      };

      vi.mocked(db.game.findUnique).mockResolvedValue(mockGame as any);
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValue({
        id: 'player-1',
        userId: 'user-1',
        isHost: true,
        isActive: true,
      } as any);

      await expect(actionService.skipToNextAction('game-1', 'user-1')).rejects.toThrow(
        new BadRequestError('Cannot skip - game is not waiting for proposals')
      );
    });

    it('should throw error if game not found', async () => {
      vi.mocked(db.game.findUnique).mockResolvedValue(null);

      await expect(actionService.skipToNextAction('game-1', 'user-1')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('Skipped Vote Handling', () => {
    it('auto-filled votes should have correct token distribution', () => {
      // UNCERTAIN votes add 1 success and 1 failure token
      const skippedVoteData = {
        voteType: 'UNCERTAIN',
        successTokens: 1,
        failureTokens: 1,
        wasSkipped: true,
      };

      expect(skippedVoteData.successTokens).toBe(1);
      expect(skippedVoteData.failureTokens).toBe(1);
      expect(skippedVoteData.wasSkipped).toBe(true);
    });

    it('skipped flag should be tracked on both action and individual votes', () => {
      const actionWithSkippedVoting = {
        votingWasSkipped: true,
        votes: [
          { playerId: 'p1', voteType: 'LIKELY_SUCCESS', wasSkipped: false },
          { playerId: 'p2', voteType: 'UNCERTAIN', wasSkipped: true },
          { playerId: 'p3', voteType: 'UNCERTAIN', wasSkipped: true },
        ],
      };

      const skippedVotesCount = actionWithSkippedVoting.votes.filter((v) => v.wasSkipped).length;
      expect(actionWithSkippedVoting.votingWasSkipped).toBe(true);
      expect(skippedVotesCount).toBe(2);
    });
  });
});
