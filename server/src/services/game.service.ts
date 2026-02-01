import { db } from '../config/database.js';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../middleware/errorHandler.js';
import type { CreateGameInput } from '../utils/validators.js';
import { notifyGameStarted, notifyNewRound } from './notification.service.js';

export async function createGame(userId: string, data: CreateGameInput) {
  const game = await db.game.create({
    data: {
      name: data.name,
      description: data.description,
      creatorId: userId,
      status: 'LOBBY',
      currentPhase: 'WAITING',
      settings: data.settings || {},
      playerCount: 1,
      players: {
        create: {
          userId,
          playerName: (await db.user.findUnique({ where: { id: userId } }))!.displayName,
          joinOrder: 1,
          isHost: true,
        },
      },
    },
    include: {
      players: {
        include: {
          user: {
            select: { id: true, displayName: true },
          },
        },
      },
    },
  });

  await logGameEvent(game.id, userId, 'GAME_CREATED', { gameName: game.name });

  return game;
}

export async function getGame(gameId: string, userId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        where: { isActive: true },
        include: {
          user: {
            select: { id: true, displayName: true },
          },
        },
      },
      currentRound: true,
      currentAction: {
        include: {
          initiator: {
            include: {
              user: {
                select: { id: true, displayName: true },
              },
            },
          },
        },
      },
    },
  });

  if (!game) {
    throw new NotFoundError('Game not found');
  }

  const myPlayer = game.players.find((p) => p.userId === userId);
  const isMember = !!myPlayer;
  if (!isMember && game.status !== 'LOBBY') {
    throw new ForbiddenError('Not a member of this game');
  }

  // Calculate myPlayer's game state
  let myPlayerData = null;
  if (myPlayer && game.currentRound) {
    // Check if player has proposed this round
    const hasProposedThisRound = await db.action.findFirst({
      where: {
        gameId,
        roundId: game.currentRound.id,
        initiatorId: myPlayer.id,
      },
    });

    // Get game settings for argument limit
    const settings = (game.settings as { argumentLimit?: number }) || {};
    const argumentLimit = settings.argumentLimit || 3;

    // Count arguments made on current action
    let remainingArguments = argumentLimit;
    let hasCompletedArgumentation = false;
    if (game.currentAction) {
      const argumentCount = await db.argument.count({
        where: {
          actionId: game.currentAction.id,
          playerId: myPlayer.id,
        },
      });
      remainingArguments = Math.max(0, argumentLimit - argumentCount);

      // Check if player has marked argumentation complete
      const completionRecord = await db.argumentationComplete.findUnique({
        where: {
          actionId_playerId: {
            actionId: game.currentAction.id,
            playerId: myPlayer.id,
          },
        },
      });
      hasCompletedArgumentation = !!completionRecord;
    }

    myPlayerData = {
      id: myPlayer.id,
      playerName: myPlayer.playerName,
      isHost: myPlayer.isHost,
      hasProposedThisRound: !!hasProposedThisRound,
      remainingArguments,
      hasCompletedArgumentation,
    };
  }

  return {
    ...game,
    myPlayer: myPlayerData,
  };
}

export async function updateGame(gameId: string, userId: string, data: Partial<CreateGameInput>) {
  await requireHost(gameId, userId);

  const game = await db.game.update({
    where: { id: gameId },
    data: {
      name: data.name,
      description: data.description,
      settings: data.settings,
    },
  });

  return game;
}

export async function joinGame(gameId: string, userId: string, playerName: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: true,
    },
  });

  if (!game) {
    throw new NotFoundError('Game not found');
  }

  if (game.status !== 'LOBBY') {
    throw new BadRequestError('Game has already started');
  }

  const existingPlayer = game.players.find((p) => p.userId === userId);
  if (existingPlayer) {
    if (existingPlayer.isActive) {
      throw new ConflictError('Already in this game');
    }
    // Rejoin if previously left
    const player = await db.gamePlayer.update({
      where: { id: existingPlayer.id },
      data: {
        isActive: true,
        playerName,
      },
    });
    await db.game.update({
      where: { id: gameId },
      data: { playerCount: { increment: 1 } },
    });
    return player;
  }

  const player = await db.gamePlayer.create({
    data: {
      gameId,
      userId,
      playerName,
      joinOrder: game.players.length + 1,
      isHost: false,
    },
  });

  await db.game.update({
    where: { id: gameId },
    data: { playerCount: { increment: 1 } },
  });

  await logGameEvent(gameId, userId, 'PLAYER_JOINED', { playerName });

  return player;
}

export async function leaveGame(gameId: string, userId: string) {
  const player = await db.gamePlayer.findFirst({
    where: { gameId, userId, isActive: true },
  });

  if (!player) {
    throw new NotFoundError('Not in this game');
  }

  await db.gamePlayer.update({
    where: { id: player.id },
    data: { isActive: false },
  });

  await db.game.update({
    where: { id: gameId },
    data: { playerCount: { decrement: 1 } },
  });

  await logGameEvent(gameId, userId, 'PLAYER_LEFT', { playerName: player.playerName });
}

export async function startGame(gameId: string, userId: string) {
  await requireHost(gameId, userId);

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        where: { isActive: true },
      },
    },
  });

  if (!game) {
    throw new NotFoundError('Game not found');
  }

  if (game.status !== 'LOBBY') {
    throw new BadRequestError('Game has already started');
  }

  if (game.players.length < 2) {
    throw new BadRequestError('Need at least 2 players to start');
  }

  // Create first round
  const round = await db.round.create({
    data: {
      gameId,
      roundNumber: 1,
      status: 'IN_PROGRESS',
      totalActionsRequired: game.players.length,
    },
  });

  const updatedGame = await db.game.update({
    where: { id: gameId },
    data: {
      status: 'ACTIVE',
      currentPhase: 'PROPOSAL',
      currentRoundId: round.id,
      startedAt: new Date(),
    },
    include: {
      players: {
        where: { isActive: true },
        include: {
          user: {
            select: { id: true, displayName: true },
          },
        },
      },
      currentRound: true,
    },
  });

  await logGameEvent(gameId, userId, 'GAME_STARTED', {});
  await logGameEvent(gameId, null, 'ROUND_STARTED', { roundNumber: 1 });

  // Send notifications (async, don't wait)
  notifyGameStarted(gameId, game.name).catch(() => {});

  return updatedGame;
}

export async function getPlayers(gameId: string, userId: string) {
  await requireMember(gameId, userId);

  const players = await db.gamePlayer.findMany({
    where: { gameId, isActive: true },
    include: {
      user: {
        select: { id: true, displayName: true },
      },
    },
    orderBy: { joinOrder: 'asc' },
  });

  return players;
}

export async function getGameHistory(gameId: string, userId: string) {
  await requireMember(gameId, userId);

  const actions = await db.action.findMany({
    where: {
      gameId,
      status: 'NARRATED',
    },
    include: {
      initiator: {
        include: {
          user: {
            select: { displayName: true },
          },
        },
      },
      tokenDraw: true,
      narration: true,
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  return actions;
}

export async function getRounds(gameId: string, userId: string) {
  await requireMember(gameId, userId);

  const rounds = await db.round.findMany({
    where: { gameId },
    include: {
      summary: true,
      actions: {
        include: {
          tokenDraw: true,
        },
      },
    },
    orderBy: { roundNumber: 'asc' },
  });

  return rounds;
}

export async function transitionPhase(gameId: string, newPhase: string) {
  const game = await db.game.findUnique({ where: { id: gameId } });
  if (!game) {
    throw new NotFoundError('Game not found');
  }

  const validTransitions: Record<string, string[]> = {
    WAITING: ['PROPOSAL'],
    PROPOSAL: ['ARGUMENTATION'],
    ARGUMENTATION: ['VOTING'],
    VOTING: ['RESOLUTION'],
    RESOLUTION: ['NARRATION'],
    NARRATION: ['PROPOSAL', 'ROUND_SUMMARY'],
    ROUND_SUMMARY: ['PROPOSAL'],
  };

  const valid = validTransitions[game.currentPhase];
  if (!valid?.includes(newPhase)) {
    throw new BadRequestError(`Cannot transition from ${game.currentPhase} to ${newPhase}`);
  }

  await db.game.update({
    where: { id: gameId },
    data: { currentPhase: newPhase },
  });

  await logGameEvent(gameId, null, 'PHASE_CHANGED', {
    from: game.currentPhase,
    to: newPhase,
  });
}

// Helper functions
async function requireHost(gameId: string, userId: string) {
  const player = await db.gamePlayer.findFirst({
    where: { gameId, userId, isActive: true },
  });

  if (!player?.isHost) {
    throw new ForbiddenError('Only the host can perform this action');
  }
}

async function requireMember(gameId: string, userId: string) {
  const player = await db.gamePlayer.findFirst({
    where: { gameId, userId, isActive: true },
  });

  if (!player) {
    throw new ForbiddenError('Not a member of this game');
  }
}

async function logGameEvent(
  gameId: string,
  userId: string | null,
  eventType: string,
  eventData: Record<string, unknown>
) {
  await db.gameEvent.create({
    data: {
      gameId,
      userId,
      eventType,
      eventData,
    },
  });
}

export { requireMember, logGameEvent };
