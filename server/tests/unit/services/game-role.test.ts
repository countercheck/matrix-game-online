import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/config/database.js', () => ({
  db: {
    gamePlayer: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    game: {
      findUnique: vi.fn(),
    },
    gameEvent: {
      create: vi.fn(),
    },
  },
}));

import { db } from '../../../src/config/database.js';
import { setPlayerRole } from '../../../src/services/game.service.js';
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../../src/middleware/errorHandler.js';

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

const hostPlayer = {
  id: 'player-host',
  userId: 'user-host',
  gameRole: 'PLAYER',
  isActive: true,
  isHost: true,
  gameId: 'game-1',
};

const targetPlayer = {
  id: 'player-target',
  userId: 'user-target',
  gameRole: 'PLAYER',
  isActive: true,
  isHost: false,
  gameId: 'game-1',
};

const existingArbiter = {
  id: 'player-arbiter',
  userId: 'user-arbiter',
  gameRole: 'ARBITER',
  isActive: true,
  isHost: false,
  gameId: 'game-1',
};

const updatedPlayer = {
  ...targetPlayer,
  gameRole: 'ARBITER',
  user: { displayName: 'Target User' },
};

describe('setPlayerRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws ForbiddenError when caller is not the game host', async () => {
    mockDb.gamePlayer.findFirst.mockResolvedValueOnce(null); // no host record for caller

    await expect(
      setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-not-host')
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError when target player not found in game', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer) // requesting player is host
      .mockResolvedValueOnce(null);      // target player not found

    await expect(
      setPlayerRole('game-1', 'player-nonexistent', 'ARBITER', 'user-host')
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when trying to reassign during ARBITER_REVIEW phase', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)  // requesting player is host
      .mockResolvedValueOnce(targetPlayer); // target player found
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'ARBITER_REVIEW' });

    await expect(
      setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-host')
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError when trying to reassign during ARGUMENTATION phase', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)
      .mockResolvedValueOnce(targetPlayer);
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'ARGUMENTATION' });

    await expect(
      setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-host')
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError when trying to reassign during VOTING phase', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)
      .mockResolvedValueOnce(targetPlayer);
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'VOTING' });

    await expect(
      setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-host')
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError when trying to reassign during RESOLUTION phase', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)
      .mockResolvedValueOnce(targetPlayer);
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'RESOLUTION' });

    await expect(
      setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-host')
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError when trying to reassign during NARRATION phase', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)
      .mockResolvedValueOnce(targetPlayer);
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'NARRATION' });

    await expect(
      setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-host')
    ).rejects.toThrow(ConflictError);
  });

  it('includes message about action in progress in the ConflictError', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)
      .mockResolvedValueOnce(targetPlayer);
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'ARBITER_REVIEW' });

    await expect(
      setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-host')
    ).rejects.toThrow('Cannot reassign roles while the action is in progress');
  });

  it('throws ConflictError when assigning ARBITER and another player already holds the role', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)    // requesting player is host
      .mockResolvedValueOnce(targetPlayer)  // target player found
      .mockResolvedValueOnce(existingArbiter); // another arbiter already exists
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'WAITING' });

    await expect(
      setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-host')
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError with correct message when another arbiter exists', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)
      .mockResolvedValueOnce(targetPlayer)
      .mockResolvedValueOnce(existingArbiter);
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'WAITING' });

    await expect(
      setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-host')
    ).rejects.toThrow('Another player is already assigned as Arbiter');
  });

  it('successfully assigns ARBITER role when no existing arbiter and game in WAITING phase', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)    // requesting player is host
      .mockResolvedValueOnce(targetPlayer)  // target player found
      .mockResolvedValueOnce(null);         // no existing arbiter
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'WAITING' });
    mockDb.gamePlayer.update.mockResolvedValueOnce(updatedPlayer);
    mockDb.gameEvent.create.mockResolvedValueOnce({});

    const result = await setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-host');

    expect(result.gameRole).toBe('ARBITER');
    expect(mockDb.gamePlayer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'player-target' },
        data: { gameRole: 'ARBITER' },
      })
    );
  });

  it('successfully assigns ARBITER role when game is in PROPOSAL phase', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)
      .mockResolvedValueOnce(targetPlayer)
      .mockResolvedValueOnce(null); // no existing arbiter
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'PROPOSAL' });
    mockDb.gamePlayer.update.mockResolvedValueOnce(updatedPlayer);
    mockDb.gameEvent.create.mockResolvedValueOnce({});

    const result = await setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-host');

    expect(result.gameRole).toBe('ARBITER');
  });

  it('successfully demotes an arbiter back to PLAYER', async () => {
    const demotedPlayer = { ...existingArbiter, gameRole: 'PLAYER', user: { displayName: 'Arbiter User' } };

    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)     // requesting player is host
      .mockResolvedValueOnce(existingArbiter); // target player is the current arbiter
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'WAITING' });
    mockDb.gamePlayer.update.mockResolvedValueOnce(demotedPlayer);
    mockDb.gameEvent.create.mockResolvedValueOnce({});

    const result = await setPlayerRole('game-1', 'player-arbiter', 'PLAYER', 'user-host');

    expect(result.gameRole).toBe('PLAYER');
    expect(mockDb.gamePlayer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'player-arbiter' },
        data: { gameRole: 'PLAYER' },
      })
    );
  });

  it('logs a game event after successful role assignment', async () => {
    mockDb.gamePlayer.findFirst
      .mockResolvedValueOnce(hostPlayer)
      .mockResolvedValueOnce(targetPlayer)
      .mockResolvedValueOnce(null);
    mockDb.game.findUnique.mockResolvedValueOnce({ currentPhase: 'WAITING' });
    mockDb.gamePlayer.update.mockResolvedValueOnce(updatedPlayer);
    mockDb.gameEvent.create.mockResolvedValueOnce({});

    await setPlayerRole('game-1', 'player-target', 'ARBITER', 'user-host');

    expect(mockDb.gameEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'PLAYER_ROLE_ASSIGNED',
          gameId: 'game-1',
          userId: 'user-host',
        }),
      })
    );
  });
});
