import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockLogGameEvent } = vi.hoisted(() => {
  const mockDb = {
    action: { findUnique: vi.fn(), update: vi.fn() },
    argument: { findUnique: vi.fn(), update: vi.fn() },
    narration: { findUnique: vi.fn(), update: vi.fn() },
    round: { findUnique: vi.fn() },
    roundSummary: { update: vi.fn() },
    gamePlayer: { findFirst: vi.fn() },
    gameEvent: { create: vi.fn() },
  };
  const mockLogGameEvent = vi.fn();
  return { mockDb, mockLogGameEvent };
});

vi.mock('../../../src/config/database.js', () => ({
  db: mockDb,
}));

vi.mock('../../../src/services/game.service.js', () => ({
  requireMember: vi.fn(),
  logGameEvent: mockLogGameEvent,
  transitionPhase: vi.fn(),
}));

vi.mock('../../../src/services/notification.service.js', () => ({
  notifyActionProposed: vi.fn().mockResolvedValue(undefined),
  notifyVotingStarted: vi.fn().mockResolvedValue(undefined),
  notifyResolutionReady: vi.fn().mockResolvedValue(undefined),
  notifyNarrationNeeded: vi.fn().mockResolvedValue(undefined),
  notifyRoundSummaryNeeded: vi.fn().mockResolvedValue(undefined),
  notifyNewRound: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks
import {
  updateAction,
  updateArgument,
  updateNarration,
} from '../../../src/services/action.service.js';
import { updateRoundSummary } from '../../../src/services/round.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Host Edit: updateAction', () => {
  const userId = 'host-user-id';
  const actionId = 'action-1';
  const gameId = 'game-1';

  it('should update action description when user is host', async () => {
    mockDb.action.findUnique.mockResolvedValue({ id: actionId, gameId });
    mockDb.gamePlayer.findFirst.mockResolvedValue({ id: 'player-1', isHost: true });
    mockDb.action.update.mockResolvedValue({
      id: actionId,
      actionDescription: 'Updated description',
      desiredOutcome: 'Original outcome',
    });

    const result = await updateAction(actionId, userId, {
      actionDescription: 'Updated description',
    });

    expect(mockDb.action.findUnique).toHaveBeenCalledWith({
      where: { id: actionId },
      select: { id: true, gameId: true },
    });
    expect(mockDb.gamePlayer.findFirst).toHaveBeenCalledWith({
      where: { gameId, userId, isActive: true, isHost: true },
    });
    expect(result.actionDescription).toBe('Updated description');
    expect(mockLogGameEvent).toHaveBeenCalledWith(
      gameId,
      userId,
      'ACTION_EDITED',
      expect.objectContaining({ actionId })
    );
  });

  it('should throw NotFoundError when action does not exist', async () => {
    mockDb.action.findUnique.mockResolvedValue(null);

    await expect(updateAction(actionId, userId, { actionDescription: 'test' })).rejects.toThrow(
      'Action not found'
    );
  });

  it('should throw ForbiddenError when user is not host', async () => {
    mockDb.action.findUnique.mockResolvedValue({ id: actionId, gameId });
    mockDb.gamePlayer.findFirst.mockResolvedValue(null);

    await expect(updateAction(actionId, userId, { actionDescription: 'test' })).rejects.toThrow(
      'Only the game host can perform this action'
    );
  });
});

describe('Host Edit: updateArgument', () => {
  const userId = 'host-user-id';
  const argumentId = 'arg-1';
  const actionId = 'action-1';
  const gameId = 'game-1';

  it('should update argument content when user is host', async () => {
    mockDb.argument.findUnique.mockResolvedValue({
      id: argumentId,
      action: { id: actionId, gameId },
    });
    mockDb.gamePlayer.findFirst.mockResolvedValue({ id: 'player-1', isHost: true });
    mockDb.argument.update.mockResolvedValue({
      id: argumentId,
      content: 'Updated content',
    });

    const result = await updateArgument(argumentId, userId, { content: 'Updated content' });

    expect(result.content).toBe('Updated content');
    expect(mockDb.gamePlayer.findFirst).toHaveBeenCalledWith({
      where: { gameId, userId, isActive: true, isHost: true },
    });
    expect(mockLogGameEvent).toHaveBeenCalledWith(
      gameId,
      userId,
      'ARGUMENT_EDITED',
      expect.objectContaining({ argumentId, actionId })
    );
  });

  it('should throw NotFoundError when argument does not exist', async () => {
    mockDb.argument.findUnique.mockResolvedValue(null);

    await expect(updateArgument(argumentId, userId, { content: 'test' })).rejects.toThrow(
      'Argument not found'
    );
  });

  it('should throw ForbiddenError when user is not host', async () => {
    mockDb.argument.findUnique.mockResolvedValue({
      id: argumentId,
      action: { id: actionId, gameId },
    });
    mockDb.gamePlayer.findFirst.mockResolvedValue(null);

    await expect(updateArgument(argumentId, userId, { content: 'test' })).rejects.toThrow(
      'Only the game host can perform this action'
    );
  });
});

describe('Host Edit: updateNarration', () => {
  const userId = 'host-user-id';
  const actionId = 'action-1';
  const gameId = 'game-1';

  it('should update narration content when user is host', async () => {
    mockDb.narration.findUnique.mockResolvedValue({
      id: 'narr-1',
      actionId,
      action: { id: actionId, gameId },
    });
    mockDb.gamePlayer.findFirst.mockResolvedValue({ id: 'player-1', isHost: true });
    mockDb.narration.update.mockResolvedValue({
      id: 'narr-1',
      content: 'Updated narration',
    });

    const result = await updateNarration(actionId, userId, { content: 'Updated narration' });

    expect(result.content).toBe('Updated narration');
    expect(mockDb.gamePlayer.findFirst).toHaveBeenCalledWith({
      where: { gameId, userId, isActive: true, isHost: true },
    });
    expect(mockLogGameEvent).toHaveBeenCalledWith(
      gameId,
      userId,
      'NARRATION_EDITED',
      expect.objectContaining({ actionId })
    );
  });

  it('should throw NotFoundError when narration does not exist', async () => {
    mockDb.narration.findUnique.mockResolvedValue(null);

    await expect(updateNarration(actionId, userId, { content: 'test' })).rejects.toThrow(
      'Narration not found'
    );
  });

  it('should throw ForbiddenError when user is not host', async () => {
    mockDb.narration.findUnique.mockResolvedValue({
      id: 'narr-1',
      actionId,
      action: { id: actionId, gameId },
    });
    mockDb.gamePlayer.findFirst.mockResolvedValue(null);

    await expect(updateNarration(actionId, userId, { content: 'test' })).rejects.toThrow(
      'Only the game host can perform this action'
    );
  });
});

describe('Host Edit: updateRoundSummary', () => {
  const userId = 'host-user-id';
  const roundId = 'round-1';
  const gameId = 'game-1';

  it('should update round summary content when user is host', async () => {
    mockDb.round.findUnique.mockResolvedValue({
      id: roundId,
      gameId,
      summary: { id: 'summary-1', content: 'Old summary' },
    });
    mockDb.gamePlayer.findFirst.mockResolvedValue({ id: 'player-1', isHost: true });
    mockDb.roundSummary.update.mockResolvedValue({
      id: 'summary-1',
      content: 'Updated summary',
    });

    const result = await updateRoundSummary(roundId, userId, { content: 'Updated summary' });

    expect(result.content).toBe('Updated summary');
    expect(mockDb.gamePlayer.findFirst).toHaveBeenCalledWith({
      where: { gameId, userId, isActive: true, isHost: true },
    });
    expect(mockLogGameEvent).toHaveBeenCalledWith(
      gameId,
      userId,
      'ROUND_SUMMARY_EDITED',
      expect.objectContaining({ roundId })
    );
  });

  it('should throw NotFoundError when round does not exist', async () => {
    mockDb.round.findUnique.mockResolvedValue(null);

    await expect(updateRoundSummary(roundId, userId, { content: 'test' })).rejects.toThrow(
      'Round not found'
    );
  });

  it('should throw NotFoundError when round summary does not exist', async () => {
    mockDb.round.findUnique.mockResolvedValue({
      id: roundId,
      gameId,
      summary: null,
    });

    await expect(updateRoundSummary(roundId, userId, { content: 'test' })).rejects.toThrow(
      'Round summary not found'
    );
  });

  it('should throw ForbiddenError when user is not host', async () => {
    mockDb.round.findUnique.mockResolvedValue({
      id: roundId,
      gameId,
      summary: { id: 'summary-1', content: 'Old summary' },
    });
    mockDb.gamePlayer.findFirst.mockResolvedValue(null);

    await expect(updateRoundSummary(roundId, userId, { content: 'test' })).rejects.toThrow(
      'Only the game host can perform this action'
    );
  });
});
