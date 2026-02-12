import { db } from '../config/database.js';
import { GamePhase, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../middleware/errorHandler.js';
import type { CreateGameInput, UpdatePersonaInput } from '../utils/validators.js';
import { notifyGameStarted, notifyYourTurn } from './notification.service.js';
import fs from 'fs/promises';
import path from 'path';
import { getUploadsDir } from '../config/uploads.js';

const NPC_USER_EMAIL = process.env.NPC_USER_EMAIL || 'npc@system.local';

interface GameSettings {
  argumentLimit?: number;
  personasRequired?: boolean;
}

/**
 * Get or create the NPC system user.
 * Auto-creates the user if it doesn't exist, so no manual seeding is required.
 */
async function getNpcUser() {
  const npcUser = await db.user.upsert({
    where: { email: NPC_USER_EMAIL },
    update: {},
    create: {
      email: NPC_USER_EMAIL,
      displayName: 'NPC System',
      passwordHash: 'npc-system-user-no-login',
    },
  });

  return npcUser;
}

export async function createGame(userId: string, data: CreateGameInput) {
  const user = await db.user.findUnique({ where: { id: userId } });

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
          playerName: user!.displayName,
          joinOrder: 1,
          isHost: true,
        },
      },
      // Create personas if provided
      personas: data.personas?.length
        ? {
            create: data.personas.map((persona, index) => ({
              name: persona.name,
              description: persona.description,
              isNpc: persona.isNpc || false,
              npcActionDescription: persona.npcActionDescription,
              npcDesiredOutcome: persona.npcDesiredOutcome,
              sortOrder: index,
            })),
          }
        : undefined,
    },
    include: {
      players: {
        include: {
          user: {
            select: { id: true, displayName: true },
          },
          persona: true,
        },
      },
      personas: {
        orderBy: { sortOrder: 'asc' },
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
          persona: true,
        },
      },
      personas: {
        orderBy: { sortOrder: 'asc' },
        include: {
          claimedBy: {
            select: { id: true, playerName: true },
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

  if (!game || game.deletedAt) {
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

  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { id: true, status: true, deletedAt: true },
  });

  if (!game || game.deletedAt) {
    throw new NotFoundError('Game not found');
  }

  const updatedGame = await db.game.update({
    where: { id: gameId },
    data: {
      name: data.name,
      description: data.description,
      settings: data.settings,
    },
  });

  await logGameEvent(gameId, userId, 'GAME_EDITED', {
    fieldsUpdated: Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined),
  });

  return updatedGame;
}

export async function joinGame(
  gameId: string,
  userId: string,
  playerName: string,
  personaId?: string
) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: true,
      personas: {
        include: { claimedBy: true },
      },
    },
  });

  if (!game || game.deletedAt) {
    throw new NotFoundError('Game not found');
  }

  if (game.status !== 'LOBBY') {
    throw new BadRequestError('Game has already started');
  }

  const settings = (game.settings as GameSettings) || {};
  const hasPersonas = game.personas.length > 0;

  // Validate persona requirement
  if (hasPersonas && settings.personasRequired && !personaId) {
    throw new BadRequestError('A persona selection is required to join this game');
  }

  // Validate persona if provided
  if (personaId) {
    const persona = game.personas.find((p) => p.id === personaId);
    if (!persona) {
      throw new BadRequestError('Invalid persona selected');
    }
    // NPC personas cannot be selected by players
    if (persona.isNpc) {
      throw new BadRequestError('Cannot select an NPC persona');
    }
    if (persona.claimedBy) {
      throw new ConflictError('This persona has already been claimed');
    }
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
        personaId: personaId || null,
      },
      include: { persona: true },
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
      personaId: personaId || null,
      joinOrder: game.players.length + 1,
      isHost: false,
    },
    include: { persona: true },
  });

  await db.game.update({
    where: { id: gameId },
    data: { playerCount: { increment: 1 } },
  });

  await logGameEvent(gameId, userId, 'PLAYER_JOINED', {
    playerName,
    personaName: player.persona?.name,
  });

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

export async function deleteGame(gameId: string, userId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: { where: { isActive: true } },
    },
  });

  if (!game || game.deletedAt) {
    throw new NotFoundError('Game not found');
  }

  // Only the host can delete the game
  const hostPlayer = game.players.find((p) => p.isHost);
  if (!hostPlayer || hostPlayer.userId !== userId) {
    throw new ForbiddenError('Only the game host can delete this game');
  }

  // Can only delete games in LOBBY status
  if (game.status !== 'LOBBY') {
    throw new BadRequestError('Cannot delete a game that has already started');
  }

  // Soft delete the game by setting deletedAt timestamp
  await db.game.update({
    where: { id: gameId },
    data: { deletedAt: new Date() },
  });

  // Log the deletion event after successful soft delete
  await logGameEvent(gameId, userId, 'GAME_DELETED', { gameName: game.name });
  return { message: 'Game deleted successfully' };
}

export async function selectPersona(
  gameId: string,
  userId: string,
  personaId: string | null
) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: { where: { isActive: true } },
      personas: {
        include: { claimedBy: true },
      },
    },
  });

  if (!game || game.deletedAt) {
    throw new NotFoundError('Game not found');
  }

  if (game.status !== 'LOBBY') {
    throw new BadRequestError('Cannot change persona after game has started');
  }

  const player = game.players.find((p) => p.userId === userId);
  if (!player) {
    throw new ForbiddenError('Not a member of this game');
  }

  // If selecting a persona (not clearing)
  if (personaId) {
    const persona = game.personas.find((p) => p.id === personaId);
    if (!persona) {
      throw new BadRequestError('Invalid persona');
    }
    // NPC personas cannot be selected by players
    if (persona.isNpc) {
      throw new BadRequestError('Cannot select an NPC persona');
    }
    // Allow if unclaimed or claimed by this player
    if (persona.claimedBy && persona.claimedBy.id !== player.id) {
      throw new ConflictError('This persona has already been claimed');
    }
  }

  const updatedPlayer = await db.gamePlayer.update({
    where: { id: player.id },
    data: { personaId },
    include: { persona: true },
  });

  await logGameEvent(gameId, userId, 'PERSONA_SELECTED', {
    playerName: player.playerName,
    personaName: updatedPlayer.persona?.name || null,
  });

  return updatedPlayer;
}

export async function updatePersona(
  gameId: string,
  personaId: string,
  userId: string,
  data: UpdatePersonaInput
) {
  await requireHost(gameId, userId);

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { personas: true },
  });

  if (!game || game.deletedAt) {
    throw new NotFoundError('Game not found');
  }

  const persona = game.personas.find((p) => p.id === personaId);
  if (!persona) {
    throw new NotFoundError('Persona not found');
  }

  try {
    const updatedPersona = await db.persona.update({
      where: { id: personaId },
      data: {
        name: data.name,
        description: data.description,
        npcActionDescription: data.npcActionDescription,
        npcDesiredOutcome: data.npcDesiredOutcome,
      },
    });

    await logGameEvent(gameId, userId, 'PERSONA_UPDATED', {
      personaName: updatedPersona.name,
    });

    return updatedPersona;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        throw new ConflictError('Persona name must be unique within the game');
      }
      if (err.code === 'P2000') {
        throw new BadRequestError('Persona fields exceed allowed length');
      }
    }
    throw err;
  }
}

export async function startGame(gameId: string, userId: string) {
  await requireHost(gameId, userId);

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        where: { isActive: true },
        include: { persona: true },
      },
      personas: true,
    },
  });

  if (!game || game.deletedAt) {
    throw new NotFoundError('Game not found');
  }

  if (game.status !== 'LOBBY') {
    throw new BadRequestError('Game has already started');
  }

  if (game.players.length < 2) {
    throw new BadRequestError('Need at least 2 players to start');
  }

  // Validate personas if required (excluding NPC personas)
  const settings = (game.settings as GameSettings) || {};
  const nonNpcPersonas = game.personas.filter((p) => !p.isNpc);
  if (settings.personasRequired && nonNpcPersonas.length > 0) {
    const playersWithoutPersona = game.players.filter((p) => !p.personaId);
    if (playersWithoutPersona.length > 0) {
      const names = playersWithoutPersona.map((p) => p.playerName).join(', ');
      throw new BadRequestError(
        `All players must select a persona before starting. Missing: ${names}`
      );
    }
  }

  // Check if there's an NPC persona and create an NPC player
  const npcPersona = game.personas.find((p) => p.isNpc);
  let totalPlayers = game.players.length;

  if (npcPersona) {
    // Get the NPC system user
    const npcUser = await getNpcUser();

    // Create NPC player with highest joinOrder so it goes last
    await db.gamePlayer.create({
      data: {
        gameId,
        userId: npcUser.id, // Use dedicated NPC system user
        playerName: npcPersona.name,
        personaId: npcPersona.id,
        joinOrder: game.players.length + 1, // NPC always goes last
        isHost: false,
        isNpc: true,
      },
    });

    await db.game.update({
      where: { id: gameId },
      data: { playerCount: { increment: 1 } },
    });

    totalPlayers += 1;
  }

  // Create first round
  const round = await db.round.create({
    data: {
      gameId,
      roundNumber: 1,
      status: 'IN_PROGRESS',
      totalActionsRequired: totalPlayers,
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

  // Notify all human players it's their turn to propose
  const humanPlayerUserIds = updatedGame.players
    .filter((p) => !p.isNpc)
    .map((p) => p.user.id);
  notifyYourTurn(gameId, game.name, humanPlayerUserIds, 'propose an action').catch(() => {});

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
      arguments: {
        include: {
          player: {
            select: { playerName: true },
          },
        },
        orderBy: { sequence: 'asc' },
      },
      votes: {
        select: {
          voteType: true,
          successTokens: true,
          failureTokens: true,
          wasSkipped: true,
        },
      },
      tokenDraw: true,
      narration: true,
    },
    orderBy: { sequenceNumber: 'asc' },
  });

  // Calculate vote totals for each action
  return actions.map((action) => {
    const voteTotals = action.votes.reduce(
      (acc, vote) => ({
        totalSuccessTokens: acc.totalSuccessTokens + vote.successTokens,
        totalFailureTokens: acc.totalFailureTokens + vote.failureTokens,
        voteCount: acc.voteCount + 1,
        skippedVotes: acc.skippedVotes + (vote.wasSkipped ? 1 : 0),
      }),
      { totalSuccessTokens: 1, totalFailureTokens: 1, voteCount: 0, skippedVotes: 0 } // Base pool of 1+1
    );

    return {
      ...action,
      voteTotals,
    };
  });
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

export async function updateGameImage(gameId: string, userId: string, imageUrl: string) {
  // Verify the game exists and user is the creator
  const game = await db.game.findUnique({
    where: { id: gameId },
    select: { id: true, creatorId: true, imageUrl: true, deletedAt: true },
  });

  if (!game || game.deletedAt) {
    throw new NotFoundError('Game not found');
  }

  if (game.creatorId !== userId) {
    throw new ForbiddenError('Only the game creator can update the game image');
  }

  // Delete old image file if it exists
  if (game.imageUrl) {
    try {
      // Extract filename from URL
      const oldFilename = game.imageUrl.split('/').pop();
      if (oldFilename) {
        const uploadsDirResolved = path.resolve(getUploadsDir());
        const oldFilePath = path.resolve(uploadsDirResolved, oldFilename);
        if (oldFilePath.startsWith(uploadsDirResolved + path.sep)) {
          await fs.unlink(oldFilePath);
        }
      }
    } catch {
      // Ignore errors if old file doesn't exist or can't be deleted
    }
  }

  // Update the game with the new image URL
  const updatedGame = await db.game.update({
    where: { id: gameId },
    data: { imageUrl },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      status: true,
      currentPhase: true,
      playerCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedGame;
}


export async function transitionPhase(gameId: string, newPhase: GamePhase) {
  const game = await db.game.findUnique({ where: { id: gameId } });
  if (!game || game.deletedAt) {
    throw new NotFoundError('Game not found');
  }

  const validTransitions: Record<GamePhase, GamePhase[]> = {
    WAITING: [GamePhase.PROPOSAL],
    PROPOSAL: [GamePhase.ARGUMENTATION],
    ARGUMENTATION: [GamePhase.VOTING],
    VOTING: [GamePhase.RESOLUTION],
    RESOLUTION: [GamePhase.NARRATION],
    NARRATION: [GamePhase.PROPOSAL, GamePhase.ROUND_SUMMARY],
    ROUND_SUMMARY: [GamePhase.PROPOSAL],
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
  eventData: Prisma.InputJsonValue
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
