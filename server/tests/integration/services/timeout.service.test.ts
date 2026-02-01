import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock data stores - defined at module level before mocks
let actions: Map<string, any>;
let games: Map<string, any>;
let players: Map<string, any[]>;
let votes: Map<string, any[]>;
let gameEvents: any[];

// Initialize stores
function resetStores() {
  actions = new Map();
  games = new Map();
  players = new Map();
  votes = new Map();
  gameEvents = [];
}

// Mock modules - use factory functions that reference the stores
vi.mock('../../../src/config/database.js', () => ({
  db: {
    action: {
      findMany: vi.fn(async ({ where, select }: any) => {
        const results: any[] = [];
        actions.forEach((action) => {
          if (where.status && action.status !== where.status) return;
          if (where.argumentationStartedAt?.lt) {
            if (
              !action.argumentationStartedAt ||
              action.argumentationStartedAt >= where.argumentationStartedAt.lt
            ) {
              return;
            }
          }
          if (where.votingStartedAt?.lt) {
            if (
              !action.votingStartedAt ||
              action.votingStartedAt >= where.votingStartedAt.lt
            ) {
              return;
            }
          }
          if (select) {
            const selectedAction: any = {};
            Object.keys(select).forEach((key) => {
              if (select[key]) selectedAction[key] = action[key];
            });
            results.push(selectedAction);
          } else {
            results.push(action);
          }
        });
        return results;
      }),
      findUnique: vi.fn(async ({ where, include }: any) => {
        const action = actions.get(where.id);
        if (!action) return null;
        const result = { ...action };
        if (include?.game) {
          result.game = { ...games.get(action.gameId) };
          if (include.game.include?.players) {
            result.game.players = (players.get(action.gameId) || []).filter(
              (p: any) => p.isActive
            );
          }
        }
        if (include?.votes) {
          result.votes = votes.get(action.id) || [];
        }
        return result;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const action = actions.get(where.id);
        if (action) {
          Object.assign(action, data);
        }
        return action;
      }),
    },
    game: {
      update: vi.fn(async ({ where, data }: any) => {
        const game = games.get(where.id);
        if (game) {
          Object.assign(game, data);
        }
        return game;
      }),
    },
    vote: {
      createMany: vi.fn(async ({ data }: any) => {
        data.forEach((vote: any) => {
          const actionVotes = votes.get(vote.actionId) || [];
          actionVotes.push({ id: `vote-${Date.now()}-${Math.random()}`, ...vote });
          votes.set(vote.actionId, actionVotes);
        });
        return { count: data.length };
      }),
    },
    gameEvent: {
      create: vi.fn(async ({ data }: any) => {
        const event = { id: `event-${Date.now()}`, ...data };
        gameEvents.push(event);
        return event;
      }),
    },
  },
}));

vi.mock('../../../src/services/game.service.js', () => ({
  transitionPhase: vi.fn(async (gameId: string, phase: string) => {
    const game = games.get(gameId);
    if (game) {
      game.currentPhase = phase;
    }
  }),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import {
  getTimedOutArgumentationActions,
  getTimedOutVotingActions,
  processArgumentationTimeout,
  processVotingTimeout,
  processAllTimeouts,
  getActionTimeoutStatus,
} from '../../../src/services/timeout.service.js';

describe('Timeout Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();

    // Set up default game
    games.set('game-1', {
      id: 'game-1',
      name: 'Test Game',
      status: 'ACTIVE',
      currentPhase: 'ARGUMENTATION',
    });

    // Set up default players
    players.set('game-1', [
      { id: 'player-1', userId: 'user-1', isActive: true },
      { id: 'player-2', userId: 'user-2', isActive: true },
      { id: 'player-3', userId: 'user-3', isActive: true },
    ]);
  });

  describe('getTimedOutArgumentationActions', () => {
    it('should return actions that exceeded argumentation timeout', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'ARGUING',
        argumentationStartedAt: twentyFiveHoursAgo,
      });

      const result = await getTimedOutArgumentationActions();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('action-1');
    });

    it('should not return actions within timeout period', async () => {
      const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'ARGUING',
        argumentationStartedAt: twentyThreeHoursAgo,
      });

      const result = await getTimedOutArgumentationActions();

      expect(result).toHaveLength(0);
    });

    it('should not return actions in other statuses', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING', // Not ARGUING
        argumentationStartedAt: twentyFiveHoursAgo,
      });

      const result = await getTimedOutArgumentationActions();

      expect(result).toHaveLength(0);
    });

    it('should respect custom timeout duration', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'ARGUING',
        argumentationStartedAt: twoHoursAgo,
      });

      // With 1 hour timeout, should be timed out
      const result = await getTimedOutArgumentationActions({
        argumentationTimeoutMs: 1 * 60 * 60 * 1000,
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('getTimedOutVotingActions', () => {
    it('should return actions that exceeded voting timeout', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING',
        votingStartedAt: twentyFiveHoursAgo,
      });

      const result = await getTimedOutVotingActions();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('action-1');
    });

    it('should not return actions within timeout period', async () => {
      const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING',
        votingStartedAt: twentyThreeHoursAgo,
      });

      const result = await getTimedOutVotingActions();

      expect(result).toHaveLength(0);
    });
  });

  describe('processArgumentationTimeout', () => {
    it('should advance action to VOTING phase', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'ARGUING',
        argumentationStartedAt: twentyFiveHoursAgo,
      });

      const result = await processArgumentationTimeout('action-1');

      expect(result.phase).toBe('ARGUMENTATION');
      expect(result.newPhase).toBe('VOTING');
      expect(actions.get('action-1').status).toBe('VOTING');
      expect(actions.get('action-1').votingStartedAt).toBeInstanceOf(Date);
    });

    it('should create timeout event', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'ARGUING',
        argumentationStartedAt: twentyFiveHoursAgo,
      });

      await processArgumentationTimeout('action-1');

      expect(gameEvents).toHaveLength(1);
      expect(gameEvents[0].eventType).toBe('ARGUMENTATION_TIMEOUT');
    });

    it('should throw error for non-existent action', async () => {
      await expect(processArgumentationTimeout('non-existent')).rejects.toThrow(
        'Action not found'
      );
    });

    it('should throw error for action not in ARGUING phase', async () => {
      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING',
      });

      await expect(processArgumentationTimeout('action-1')).rejects.toThrow(
        'not in argumentation phase'
      );
    });
  });

  describe('processVotingTimeout', () => {
    it('should create auto-votes for players who havent voted', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING',
        votingStartedAt: twentyFiveHoursAgo,
      });

      // Only player-1 has voted
      votes.set('action-1', [
        { id: 'vote-1', actionId: 'action-1', playerId: 'player-1' },
      ]);

      const result = await processVotingTimeout('action-1');

      expect(result.playersAffected).toBe(2); // player-2 and player-3
      expect(result.newPhase).toBe('RESOLUTION');

      // Verify auto-votes were created
      const actionVotes = votes.get('action-1') || [];
      expect(actionVotes.length).toBe(3); // 1 original + 2 auto-votes

      // Verify auto-votes are UNCERTAIN type
      const autoVotes = actionVotes.filter((v: any) => v.voteType === 'UNCERTAIN');
      expect(autoVotes.length).toBe(2);
      autoVotes.forEach((v: any) => {
        expect(v.successTokens).toBe(1);
        expect(v.failureTokens).toBe(1);
      });
    });

    it('should advance action to RESOLVED phase', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING',
        votingStartedAt: twentyFiveHoursAgo,
      });

      votes.set('action-1', []);

      await processVotingTimeout('action-1');

      expect(actions.get('action-1').status).toBe('RESOLVED');
    });

    it('should handle case where all players already voted', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING',
        votingStartedAt: twentyFiveHoursAgo,
      });

      // All players have voted
      votes.set('action-1', [
        { id: 'vote-1', actionId: 'action-1', playerId: 'player-1' },
        { id: 'vote-2', actionId: 'action-1', playerId: 'player-2' },
        { id: 'vote-3', actionId: 'action-1', playerId: 'player-3' },
      ]);

      const result = await processVotingTimeout('action-1');

      expect(result.playersAffected).toBe(0);
      expect(votes.get('action-1')?.length).toBe(3); // No new votes added
    });

    it('should create timeout event with affected player IDs', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'VOTING',
        votingStartedAt: twentyFiveHoursAgo,
      });

      votes.set('action-1', [
        { id: 'vote-1', actionId: 'action-1', playerId: 'player-1' },
      ]);

      await processVotingTimeout('action-1');

      expect(gameEvents).toHaveLength(1);
      expect(gameEvents[0].eventType).toBe('VOTING_TIMEOUT');
      expect(gameEvents[0].eventData.autoVotedPlayerIds).toHaveLength(2);
    });
  });

  describe('processAllTimeouts', () => {
    it('should process both argumentation and voting timeouts', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'ARGUING',
        argumentationStartedAt: twentyFiveHoursAgo,
      });

      actions.set('action-2', {
        id: 'action-2',
        gameId: 'game-1',
        status: 'VOTING',
        votingStartedAt: twentyFiveHoursAgo,
      });

      votes.set('action-2', []);

      const results = await processAllTimeouts();

      expect(results.argumentationTimeouts).toHaveLength(1);
      expect(results.votingTimeouts).toHaveLength(1);
      expect(results.errors).toHaveLength(0);
    });

    it('should return empty results when no timeouts', async () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        gameId: 'game-1',
        status: 'ARGUING',
        argumentationStartedAt: oneHourAgo,
      });

      const results = await processAllTimeouts();

      expect(results.argumentationTimeouts).toHaveLength(0);
      expect(results.votingTimeouts).toHaveLength(0);
      expect(results.errors).toHaveLength(0);
    });
  });

  describe('getActionTimeoutStatus', () => {
    it('should return correct status for ARGUING action', async () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        status: 'ARGUING',
        argumentationStartedAt: oneHourAgo,
        votingStartedAt: null,
      });

      const status = await getActionTimeoutStatus('action-1');

      expect(status).not.toBeNull();
      expect(status!.phase).toBe('ARGUMENTATION');
      expect(status!.isTimedOut).toBe(false);
      expect(status!.remainingMs).toBeGreaterThan(22 * 60 * 60 * 1000); // > 22 hours
    });

    it('should return correct status for VOTING action', async () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        status: 'VOTING',
        argumentationStartedAt: null,
        votingStartedAt: oneHourAgo,
      });

      const status = await getActionTimeoutStatus('action-1');

      expect(status).not.toBeNull();
      expect(status!.phase).toBe('VOTING');
      expect(status!.isTimedOut).toBe(false);
    });

    it('should indicate timed out action', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      actions.set('action-1', {
        id: 'action-1',
        status: 'ARGUING',
        argumentationStartedAt: twentyFiveHoursAgo,
        votingStartedAt: null,
      });

      const status = await getActionTimeoutStatus('action-1');

      expect(status).not.toBeNull();
      expect(status!.isTimedOut).toBe(true);
      expect(status!.remainingMs).toBe(0);
    });

    it('should return null for non-existent action', async () => {
      const status = await getActionTimeoutStatus('non-existent');

      expect(status).toBeNull();
    });

    it('should return no timeout info for actions without active timeout', async () => {
      actions.set('action-1', {
        id: 'action-1',
        status: 'RESOLVED',
        argumentationStartedAt: null,
        votingStartedAt: null,
      });

      const status = await getActionTimeoutStatus('action-1');

      expect(status).not.toBeNull();
      expect(status!.phase).toBe('RESOLVED');
      expect(status!.timeoutAt).toBeNull();
      expect(status!.remainingMs).toBeNull();
    });
  });
});
