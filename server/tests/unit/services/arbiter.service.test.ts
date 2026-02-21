import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/config/database.js', () => ({
  db: {
    action: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    argument: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    gamePlayer: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    game: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gameEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../../src/services/notification.service.js', () => ({
  notifyResolutionReady: vi.fn().mockResolvedValue(undefined),
  notifyVotingStarted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/services/game.service.js', () => ({
  requireMember: vi.fn().mockResolvedValue({}),
  logGameEvent: vi.fn().mockResolvedValue({}),
  transitionPhase: vi.fn().mockResolvedValue({}),
}));

// Register arbiter strategy
import '../../../src/services/resolution/strategies/arbiter.strategy.js';

import { db } from '../../../src/config/database.js';
import {
  markArgumentStrong,
  completeArbiterReview,
} from '../../../src/services/arbiter.service.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../../src/middleware/errorHandler.js';

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

const arbiterPlayer = {
  id: 'player-arbiter',
  userId: 'user-arbiter',
  gameRole: 'ARBITER',
  isActive: true,
  isHost: false,
  gameId: 'game-1',
};

const baseAction = {
  id: 'action-1',
  gameId: 'game-1',
  actionDescription: 'Test action',
  desiredOutcome: 'Test outcome',
  status: 'ARGUING',
  resolutionData: null,
  game: {
    id: 'game-1',
    name: 'Test Game',
    currentPhase: 'ARBITER_REVIEW',
    settings: { resolutionMethod: 'arbiter' },
    players: [arbiterPlayer],
  },
  arguments: [
    { argumentType: 'FOR', isStrong: false },
    { argumentType: 'INITIATOR_FOR', isStrong: true },
    { argumentType: 'AGAINST', isStrong: false },
  ],
  initiator: { id: 'player-1', userId: 'user-1', isNpc: false, user: { id: 'user-1' } },
};

describe('markArgumentStrong', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NotFoundError if action not found', async () => {
    mockDb.action.findUnique.mockResolvedValue(null);
    await expect(markArgumentStrong('bad-id', 'arg-1', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('throws BadRequestError if game is not in ARBITER_REVIEW phase', async () => {
    mockDb.action.findUnique.mockResolvedValue({
      ...baseAction,
      game: { ...baseAction.game, currentPhase: 'ARGUMENTATION' },
    });
    await expect(markArgumentStrong('action-1', 'arg-1', 'user-arbiter')).rejects.toThrow(
      BadRequestError
    );
  });

  it('throws ForbiddenError if caller is not arbiter', async () => {
    mockDb.action.findUnique.mockResolvedValue(baseAction);
    mockDb.gamePlayer.findFirst.mockResolvedValue(null); // no arbiter player found
    await expect(markArgumentStrong('action-1', 'arg-1', 'user-1')).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError if argument not found', async () => {
    mockDb.action.findUnique.mockResolvedValue(baseAction);
    mockDb.gamePlayer.findFirst.mockResolvedValue(arbiterPlayer);
    mockDb.argument.findUnique.mockResolvedValue(null);
    await expect(markArgumentStrong('action-1', 'bad-arg', 'user-arbiter')).rejects.toThrow(
      NotFoundError
    );
  });

  it('toggles isStrong from false to true', async () => {
    const arg = { id: 'arg-1', actionId: 'action-1', isStrong: false };
    mockDb.action.findUnique.mockResolvedValue(baseAction);
    mockDb.gamePlayer.findFirst.mockResolvedValue(arbiterPlayer);
    mockDb.argument.findUnique.mockResolvedValue(arg);
    mockDb.argument.update.mockResolvedValue({ ...arg, isStrong: true, player: { user: {} } });
    mockDb.gameEvent.create.mockResolvedValue({});

    await markArgumentStrong('action-1', 'arg-1', 'user-arbiter');

    expect(mockDb.argument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isStrong: true } })
    );
  });

  it('toggles isStrong from true to false', async () => {
    const arg = { id: 'arg-1', actionId: 'action-1', isStrong: true };
    mockDb.action.findUnique.mockResolvedValue(baseAction);
    mockDb.gamePlayer.findFirst.mockResolvedValue(arbiterPlayer);
    mockDb.argument.findUnique.mockResolvedValue(arg);
    mockDb.argument.update.mockResolvedValue({ ...arg, isStrong: false, player: { user: {} } });
    mockDb.gameEvent.create.mockResolvedValue({});

    await markArgumentStrong('action-1', 'arg-1', 'user-arbiter');

    expect(mockDb.argument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isStrong: false } })
    );
  });
});

describe('completeArbiterReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NotFoundError if action not found', async () => {
    mockDb.action.findUnique.mockResolvedValue(null);
    await expect(completeArbiterReview('bad-id', 'user-arbiter')).rejects.toThrow(NotFoundError);
  });

  it('throws BadRequestError if not in ARBITER_REVIEW phase', async () => {
    mockDb.action.findUnique.mockResolvedValue({
      ...baseAction,
      game: { ...baseAction.game, currentPhase: 'ARGUMENTATION' },
    });
    await expect(completeArbiterReview('action-1', 'user-arbiter')).rejects.toThrow(
      BadRequestError
    );
  });

  it('throws ForbiddenError if caller is not arbiter', async () => {
    mockDb.action.findUnique.mockResolvedValue(baseAction);
    mockDb.gamePlayer.findFirst.mockResolvedValue(null);
    await expect(completeArbiterReview('action-1', 'user-1')).rejects.toThrow(ForbiddenError);
  });

  it('resolves and stores resolutionData', async () => {
    mockDb.action.findUnique.mockResolvedValue(baseAction);
    mockDb.gamePlayer.findFirst.mockResolvedValue(arbiterPlayer);
    mockDb.action.update.mockResolvedValue({});
    mockDb.gameEvent.create.mockResolvedValue({});

    const result = await completeArbiterReview('action-1', 'user-arbiter');

    expect(mockDb.action.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RESOLVED',
          resolutionMethod: 'arbiter',
        }),
      })
    );

    // Result should have resultType and resultValue
    expect(result.resultType).toMatch(/SUCCESS_BUT|FAILURE_BUT/);
    expect([-1, 1]).toContain(result.resultValue);
  });

  it('counts strong arguments correctly (1 strong FOR, 0 strong AGAINST in baseAction)', async () => {
    mockDb.action.findUnique.mockResolvedValue(baseAction);
    mockDb.gamePlayer.findFirst.mockResolvedValue(arbiterPlayer);
    mockDb.action.update.mockResolvedValue({});
    mockDb.gameEvent.create.mockResolvedValue({});

    await completeArbiterReview('action-1', 'user-arbiter');

    const updateCall = mockDb.action.update.mock.calls[0][0];
    const storedData = updateCall.data.resolutionData as Record<string, unknown>;
    // 1 strong INITIATOR_FOR arg, 0 strong AGAINST
    expect(storedData.strongProCount).toBe(1);
    expect(storedData.strongAntiCount).toBe(0);
  });
});
