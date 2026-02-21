import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../src/config/database.js', () => ({
  db: {
    action: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gamePlayer: {
      findFirst: vi.fn(),
    },
    argumentationComplete: {
      upsert: vi.fn(),
      findMany: vi.fn(),
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
  notifyNarrationNeeded: vi.fn().mockResolvedValue(undefined),
  notifyRoundSummaryNeeded: vi.fn().mockResolvedValue(undefined),
  notifyActionProposed: vi.fn().mockResolvedValue(undefined),
}));

// Mock game service exports
vi.mock('../../../src/services/game.service.js', () => ({
  requireMember: vi.fn().mockResolvedValue({ id: 'player-host', userId: 'user-host' }),
  logGameEvent: vi.fn().mockResolvedValue({}),
  transitionPhase: vi.fn().mockResolvedValue({}),
}));

// Register both strategies so getStrategy('arbiter') and getStrategy('token_draw') work
import '../../../src/services/resolution/strategies/arbiter.strategy.js';
import '../../../src/services/resolution/strategies/token-draw.strategy.js';

import { db } from '../../../src/config/database.js';
import { transitionPhase, logGameEvent } from '../../../src/services/game.service.js';
import { completeArgumentation, skipArgumentation } from '../../../src/services/action.service.js';
import { BadRequestError } from '../../../src/middleware/errorHandler.js';
import { GamePhase } from '@prisma/client';

// ------------------------------------------------------------------
// Shared fixtures
// ------------------------------------------------------------------

const hostPlayer = {
  id: 'player-host',
  userId: 'user-host',
  isHost: true,
  isActive: true,
  isNpc: false,
  gameRole: null,
  personaId: null,
};

// Action where resolutionMethod is 'arbiter' and there is one human player (the host)
function makeArbiterAction() {
  return {
    id: 'action-1',
    gameId: 'game-1',
    status: 'ARGUING',
    actionDescription: 'Test action',
    game: {
      id: 'game-1',
      name: 'Test Game',
      settings: { resolutionMethod: 'arbiter' },
      // One human player — so completionThreshold = 1
      players: [hostPlayer],
    },
  };
}

// Action where resolutionMethod is 'token_draw'
function makeTokenDrawAction() {
  return {
    id: 'action-1',
    gameId: 'game-1',
    status: 'ARGUING',
    actionDescription: 'Test action',
    game: {
      id: 'game-1',
      name: 'Test Game',
      settings: { resolutionMethod: 'token_draw' },
      players: [hostPlayer],
    },
  };
}

// ------------------------------------------------------------------
// Fix A: completeArgumentation — arbiter guard
// ------------------------------------------------------------------

describe('completeArgumentation — arbiter guard (Fix A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Setup helper for completeArgumentation where all players have completed.
   * Call sequence for db.gamePlayer.findFirst:
   *   1st call → caller's player record (member check)
   *   2nd call → arbiter existence check
   */
  function setupCompleteArgumentation(arbiterResult: { id: string } | null) {
    const action = makeArbiterAction();
    vi.mocked(db.action.findUnique).mockResolvedValue(action as any);

    // 1st findFirst: member check — returns the host player (they ARE a member)
    // 2nd findFirst: arbiter existence check
    vi.mocked(db.gamePlayer.findFirst)
      .mockResolvedValueOnce(hostPlayer as any)
      .mockResolvedValueOnce(arbiterResult as any);

    vi.mocked(db.argumentationComplete.upsert).mockResolvedValue({} as any);

    // All players have completed: return one completion record (matches our one human player)
    vi.mocked(db.argumentationComplete.findMany).mockResolvedValue([
      { playerId: 'player-host' },
    ] as any);

    vi.mocked(db.action.update).mockResolvedValue({} as any);
  }

  it('throws BadRequestError containing "no arbiter" when resolutionMethod=arbiter and no ARBITER player exists', async () => {
    setupCompleteArgumentation(null); // no arbiter player

    const error = await completeArgumentation('action-1', 'user-host').catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestError);
    expect(error.message).toMatch(/no arbiter/i);
  });

  it('transitions to ARBITER_REVIEW and returns success message when ARBITER player exists', async () => {
    setupCompleteArgumentation({ id: 'player-arbiter' }); // arbiter found

    const result = await completeArgumentation('action-1', 'user-host');

    expect(result).toMatchObject({ message: 'Moved to arbiter review phase' });
    expect(vi.mocked(transitionPhase)).toHaveBeenCalledWith('game-1', GamePhase.ARBITER_REVIEW);
  });
});

// ------------------------------------------------------------------
// Fix B: skipArgumentation — arbiter strategy routing
// ------------------------------------------------------------------

describe('skipArgumentation — arbiter strategy routing (Fix B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Call sequence for skipArgumentation with an arbiter game:
   *   db.action.findUnique         → action
   *   db.gamePlayer.findFirst #1   → requireHost (isHost: true)
   *   db.gamePlayer.findFirst #2   → arbiter existence check
   */
  function setupSkipArgumentation(
    strategyId: 'arbiter' | 'token_draw',
    arbiterResult: { id: string } | null
  ) {
    const action =
      strategyId === 'arbiter' ? makeArbiterAction() : makeTokenDrawAction();

    vi.mocked(db.action.findUnique).mockResolvedValue(action as any);

    // requireHost check — always succeeds (hostPlayer is the host)
    vi.mocked(db.gamePlayer.findFirst).mockResolvedValueOnce(hostPlayer as any);

    if (strategyId === 'arbiter') {
      // Arbiter existence check
      vi.mocked(db.gamePlayer.findFirst).mockResolvedValueOnce(arbiterResult as any);
    }

    vi.mocked(db.action.update).mockResolvedValue({} as any);
  }

  it('throws BadRequestError containing "no arbiter" when resolutionMethod=arbiter and no arbiter assigned', async () => {
    setupSkipArgumentation('arbiter', null); // no arbiter player

    const error = await skipArgumentation('action-1', 'user-host').catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestError);
    expect(error.message).toMatch(/no arbiter/i);
  });

  it('succeeds and transitions to ARBITER_REVIEW (not VOTING) when arbiter is assigned', async () => {
    setupSkipArgumentation('arbiter', { id: 'player-arbiter' }); // arbiter found

    const result = await skipArgumentation('action-1', 'user-host');

    expect(result).toMatchObject({
      message: 'Argumentation skipped, moved to arbiter review phase',
    });
    expect(vi.mocked(transitionPhase)).toHaveBeenCalledWith('game-1', GamePhase.ARBITER_REVIEW);
    expect(vi.mocked(transitionPhase)).not.toHaveBeenCalledWith('game-1', GamePhase.VOTING);

    expect(vi.mocked(db.action.update)).toHaveBeenCalledWith({
      where: { id: 'action-1' },
      data: { status: 'ARGUING', argumentationWasSkipped: true },
    });

    expect(vi.mocked(logGameEvent)).toHaveBeenCalledWith(
      'game-1',
      'user-host',
      'ARGUMENTATION_SKIPPED',
      { actionId: 'action-1', skippedByHost: true }
    );
  });

  it('token_draw game still transitions to VOTING (no regression)', async () => {
    setupSkipArgumentation('token_draw', null); // no second findFirst needed

    const result = await skipArgumentation('action-1', 'user-host');

    expect(result).toMatchObject({ message: 'Argumentation skipped, moved to voting phase' });
    expect(vi.mocked(transitionPhase)).toHaveBeenCalledWith('game-1', GamePhase.VOTING);
    expect(vi.mocked(transitionPhase)).not.toHaveBeenCalledWith(
      'game-1',
      GamePhase.ARBITER_REVIEW
    );

    expect(vi.mocked(db.action.update)).toHaveBeenCalledWith({
      where: { id: 'action-1' },
      data: {
        status: 'VOTING',
        votingStartedAt: expect.any(Date),
        argumentationWasSkipped: true,
      },
    });
  });
});
